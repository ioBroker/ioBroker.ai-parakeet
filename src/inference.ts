/**
 * Inference process: loads the Parakeet or the Canary model with ONNX Runtime and transcribes audio.
 * It runs as a child process of the adapter, so a crash or the memory of ONNX Runtime
 * does not affect the adapter, and the model can be unloaded by ending the process.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { InferenceSession } from 'onnxruntime-node';

import { speechLanguage } from './lib/languages';
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
    transcribe(pcm: Float32Array, segments: boolean, language?: string): Promise<ParakeetResult>;
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

/** Canary takes at most 40 s at once; longer audio is transcribed in windows of this length */
const CANARY_WINDOW_SECONDS = 30;
/** Longest output of one window, prompt included (`max_sequence_length` of onnx-asr) */
const CANARY_MAX_TOKENS = 1024;

/**
 * Canary 1B v2 (encoder + autoregressive decoder), as onnx-asr runs it (`NemoConformerAED`): the decoder is told the
 * language of the speech with a token, so accented speech stays in its language.
 *
 * @param modelDir directory with encoder-model.int8.onnx, decoder-model.int8.onnx and vocab.txt
 * @param threads CPU threads
 * @param defaultLanguage language of a request without one (the system language)
 */
async function loadCanary(modelDir: string, threads: number, defaultLanguage: string): Promise<Model> {
    const ort = await import('onnxruntime-node');
    const { JsPreprocessor } = await import('parakeet.js/mel');

    const vocabulary = await readFile(join(modelDir, 'vocab.txt'), 'utf8');
    const tokens: string[] = [];
    const ids = new Map<string, number>();
    for (const line of vocabulary.split(/\r?\n/).filter(line => line)) {
        // "token id"; the token may be "▁" alone
        const at = line.lastIndexOf(' ');
        const token = line.slice(0, at);
        const id = line.slice(at + 1);
        if (at <= 0 || !/^\d+$/.test(id)) {
            throw new Error('Invalid vocab.txt');
        }
        tokens[Number(id)] = token;
        ids.set(token, Number(id));
    }
    const tokenId = (token: string): number => {
        const id = ids.get(token);
        if (id === undefined) {
            throw new Error(`The model has no token ${token}`);
        }
        return id;
    };
    const eos = tokenId('<|endoftext|>');
    // The prompt of onnx-asr: space, context, transcript, emotion, source and target language, punctuation, no ITN,
    // no timestamps, no diarization. Index 4 and 5 are the language.
    const prompt = [
        tokenId('▁'),
        tokenId('<|startofcontext|>'),
        tokenId('<|startoftranscript|>'),
        tokenId('<|emo:undefined|>'),
        tokenId('<|en|>'),
        tokenId('<|en|>'),
        tokenId('<|pnc|>'),
        tokenId('<|noitn|>'),
        tokenId('<|notimestamp|>'),
        tokenId('<|nodiarize|>'),
    ];
    // Only the 25 languages of the model: anything else would put another special token into the prompt
    const languageToken = (language: string | undefined): number | undefined => {
        const code = speechLanguage(language);
        return code ? ids.get(`<|${code}|>`) : undefined;
    };
    const fallback = languageToken(defaultLanguage) ?? tokenId('<|en|>');

    const options = {
        executionProviders: ['cpu'],
        intraOpNumThreads: threads,
        interOpNumThreads: 1,
        executionMode: 'sequential' as const,
        graphOptimizationLevel: 'all' as const,
    };
    const encoder = await ort.InferenceSession.create(join(modelDir, 'encoder-model.int8.onnx'), options);
    let decoder: InferenceSession | undefined;
    try {
        decoder = await ort.InferenceSession.create(join(modelDir, 'decoder-model.int8.onnx'), options);
        // decoder_mems: [layers, batch, steps, hidden]; it starts with 0 steps
        const mems = decoder.inputMetadata.find(input => input.name === 'decoder_mems');
        const shape = mems && 'shape' in mems ? mems.shape : [];
        const layers = Number(shape[0]);
        const hidden = Number(shape[3]);
        if (!Number.isInteger(layers) || !Number.isInteger(hidden)) {
            throw new Error(`Unexpected shape of decoder_mems: ${JSON.stringify(shape)}`);
        }
        const preprocessor = new JsPreprocessor({ nMels: 128 });
        const session = decoder;

        const transcribeWindow = async (pcm: Float32Array, language: number): Promise<string> => {
            const { features, length } = preprocessor.process(pcm);
            if (!length) {
                return '';
            }
            const frames = features.length / 128;
            const encoded = await encoder.run({
                audio_signal: new ort.Tensor('float32', features, [1, 128, frames]),
                length: new ort.Tensor('int64', BigInt64Array.from([BigInt(length)]), [1]),
            });
            const embeddings = encoded.encoder_embeddings;
            const mask = encoded.encoder_mask;
            const sequence = [...prompt];
            sequence[4] = language;
            sequence[5] = language;
            let state = new ort.Tensor('float32', new Float32Array(0), [layers, 1, 0, hidden]);
            const output: number[] = [];
            try {
                while (sequence.length < CANARY_MAX_TOKENS) {
                    // the whole prompt first, then only the newest token (the rest is in decoder_mems)
                    const input = state.dims[2] === 0 ? sequence : sequence.slice(-1);
                    const result = await session.run({
                        input_ids: new ort.Tensor('int64', BigInt64Array.from(input.map(BigInt)), [1, input.length]),
                        encoder_embeddings: embeddings,
                        encoder_mask: mask,
                        decoder_mems: state,
                    });
                    const logits = result.logits;
                    const [, steps, vocab] = logits.dims;
                    const data = logits.data as Float32Array;
                    const last = (steps - 1) * vocab;
                    let best = 0;
                    for (let i = 1; i < vocab; i++) {
                        if (data[last + i] > data[last + best]) {
                            best = i;
                        }
                    }
                    state.dispose();
                    state = result.decoder_hidden_states as typeof state;
                    logits.dispose();
                    if (best === eos) {
                        break;
                    }
                    sequence.push(best);
                    if (!tokens[best]?.startsWith('<|')) {
                        output.push(best);
                    }
                }
            } finally {
                state.dispose();
                embeddings.dispose();
                mask.dispose();
            }
            return joinTokens(output.map(id => tokens[id]));
        };

        return {
            async transcribe(pcm: Float32Array, segments: boolean, language?: string): Promise<ParakeetResult> {
                const token = languageToken(language) ?? fallback;
                const window = CANARY_WINDOW_SECONDS * 16000;
                const chunks: { text: string; timestamp: [number, number] }[] = [];
                for (let from = 0; from < pcm.length; from += window) {
                    const part = pcm.subarray(from, Math.min(pcm.length, from + window));
                    const text = await transcribeWindow(part, token);
                    if (text) {
                        chunks.push({ text, timestamp: [from / 16000, (from + part.length) / 16000] });
                    }
                }
                return {
                    text: chunks.map(chunk => chunk.text).join(' '),
                    // no word times: one segment per window
                    chunks: segments ? chunks : undefined,
                };
            },
        };
    } catch (error) {
        await encoder.release();
        await decoder?.release();
        throw error;
    }
}

async function onMessage(message: InferenceRequest): Promise<void> {
    if (message.type === 'load') {
        try {
            const start = performance.now();
            model =
                message.model === 'canary-1b-v2'
                    ? await loadCanary(message.modelDir, message.threads, message.language || 'en')
                    : await loadModel(message.modelDir, message.threads);
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
            const result = await model.transcribe(message.pcm, !!message.segments, message.language);
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
