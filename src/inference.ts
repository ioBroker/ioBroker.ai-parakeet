/**
 * Inference process: loads the Parakeet model with ONNX Runtime and transcribes audio.
 * It runs as a child process of the adapter, so a crash or the memory of ONNX Runtime
 * does not affect the adapter, and the model can be unloaded by ending the process.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { InferenceSession } from 'onnxruntime-node';

import type { InferenceRequest, InferenceResponse } from './lib/protocol';
import { joinTokens } from './lib/tokenText';

/** Longer audio is transcribed in windows, which needs much less memory */
const WINDOW_FROM_SECONDS = 90;
const WINDOW_SECONDS = 60;

interface ParakeetResult {
    text: string;
    chunks?: { text: string; timestamp: [number, number] }[];
}

/** The part of ParakeetModel that is used here */
interface ParakeetLike {
    resetMelCache(): void;
    clearIncrementalCache(): void;
    transcribeLongAudio(
        audio: Float32Array,
        sampleRate: number,
        options: { returnTimestamps: boolean; chunkLengthS: number; enableProfiling: boolean },
    ): Promise<unknown>;
}

interface Model {
    transcribe(pcm: Float32Array, segments: boolean): Promise<ParakeetResult>;
}

let model: Model | null = null;

function send(message: InferenceResponse): void {
    process.send?.(message);
}

async function loadModel(modelDir: string, threads: number): Promise<Model> {
    const ort = await import('onnxruntime-node');
    const { ParakeetModel } = await import('parakeet.js/parakeet');
    const { JsPreprocessor } = await import('parakeet.js/mel');
    // The tokenizer is not exported by parakeet.js. Its path is tied to the pinned version 1.4.4.
    const tokenizerPath = join(dirname(require.resolve('parakeet.js/parakeet')), 'tokenizer.js');
    const { ParakeetTokenizer } = await import(pathToFileURL(tokenizerPath).href);

    const vocabulary = await readFile(join(modelDir, 'vocab.txt'), 'utf8');
    const tokens: string[] = [];
    for (const line of vocabulary.split(/\r?\n/).filter(line => line)) {
        const [token, id] = line.trim().split(/\s+/);
        if (!token || !/^\d+$/.test(id)) {
            throw new Error('Invalid vocab.txt');
        }
        tokens[Number(id)] = token;
    }
    if (!tokens.includes('<blk>')) {
        throw new Error('Missing blank token in vocab.txt');
    }

    const options = {
        executionProviders: ['cpu'],
        intraOpNumThreads: threads,
        interOpNumThreads: 1,
        executionMode: 'sequential' as const,
        graphOptimizationLevel: 'all' as const,
    };
    const encoderSession = await ort.InferenceSession.create(join(modelDir, 'encoder-model.int8.onnx'), options);
    let joinerSession: InferenceSession | undefined;
    try {
        joinerSession = await ort.InferenceSession.create(join(modelDir, 'decoder_joint-model.int8.onnx'), options);
        // The type declarations of parakeet.js 1.4.4 miss the parameters of the constructor
        const Parakeet = ParakeetModel as unknown as new (config: Record<string, unknown>) => ParakeetLike;
        const tokenizer = new ParakeetTokenizer(tokens);
        // decode() of parakeet.js removes the spaces before words in Cyrillic and other non-ASCII letters
        tokenizer.decode = (ids: number[]): string =>
            joinTokens(ids.filter(id => id !== tokenizer.blankId && tokens[id] !== undefined).map(id => tokens[id]));
        const parakeet = new Parakeet({
            tokenizer,
            encoderSession,
            joinerSession,
            preprocessor: new JsPreprocessor({ nMels: 128 }),
            ort,
            nMels: 128,
        });
        return {
            async transcribe(pcm: Float32Array, segments: boolean): Promise<ParakeetResult> {
                // Every request is independent: no cache from the previous audio
                parakeet.resetMelCache();
                parakeet.clearIncrementalCache();
                const seconds = pcm.length / 16000;
                const result = (await parakeet.transcribeLongAudio(pcm, 16000, {
                    returnTimestamps: segments,
                    chunkLengthS: seconds > WINDOW_FROM_SECONDS ? WINDOW_SECONDS : 0,
                    enableProfiling: false,
                })) as ParakeetResult;
                return result;
            },
        };
    } catch (error) {
        await encoderSession.release();
        await joinerSession?.release();
        throw error;
    }
}

async function onMessage(message: InferenceRequest): Promise<void> {
    if (message.type === 'load') {
        try {
            const start = performance.now();
            model = await loadModel(message.modelDir, message.threads);
            send({ type: 'ready', loadMs: performance.now() - start });
        } catch (error) {
            send({ type: 'fatal', message: error instanceof Error ? error.message : String(error) });
            process.exit(1);
        }
    } else if (message.type === 'transcribe') {
        if (!model) {
            send({ type: 'error', id: message.id, message: 'Model not loaded' });
            return;
        }
        const start = performance.now();
        try {
            const result = await model.transcribe(message.pcm, !!message.segments);
            send({
                type: 'result',
                id: message.id,
                text: (result.text || '').trim(),
                segments: result.chunks?.map(chunk => ({
                    text: chunk.text.trim(),
                    start: chunk.timestamp[0],
                    end: chunk.timestamp[1],
                })),
                inferenceMs: performance.now() - start,
            });
        } catch (error) {
            send({ type: 'error', id: message.id, message: error instanceof Error ? error.message : String(error) });
        }
    } else if (message.type === 'close') {
        process.exit(0);
    }
}

process.on('message', (message: InferenceRequest) => void onMessage(message));
// The adapter is gone: do not stay as orphan
process.on('disconnect', () => process.exit(0));
