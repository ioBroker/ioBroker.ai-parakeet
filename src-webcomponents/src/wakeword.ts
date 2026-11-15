import * as ort from 'onnxruntime-web/wasm';

export interface WakewordResult {
    detected: boolean;
    confidence: number;
    timestamp: number;
    name?: string;
}
export interface WakewordConfig {
    names: string[];
    threshold: number;
    assetBase: string;
    getUploadedModel: (name: string) => Promise<Uint8Array>;
    loadAsset?: (name: string) => Promise<Uint8Array>;
}
export interface WakewordEngine {
    initialize(config: WakewordConfig): Promise<void>;
    processAudio(samples: Float32Array): Promise<WakewordResult>;
    reset(): void;
    dispose(): Promise<void>;
}

const BUILTIN: Record<string, string> = {
    io_broker: 'io_broker.onnx',
    hey_jarvis: 'hey_jarvis_v0.1.onnx',
    alexa: 'alexa_v0.1.onnx',
    hey_mycroft: 'hey_mycroft_v0.1.onnx',
    hey_rhasspy: 'hey_rhasspy_v0.1.onnx',
};
const MEL_BINS = 32;
const EMB_WINDOW = 76;
const EMB_HOP = 8;
const EMB_DIM = 96;
const WW_FRAMES = 16;

export class OnnxWakewordEngine implements WakewordEngine {
    private mel?: ort.InferenceSession;
    private embedding?: ort.InferenceSession;
    private classifiers: { name: string; session: ort.InferenceSession }[] = [];
    private melRows: Float32Array[] = [];
    private melProcessed = 0;
    private embeddings: Float32Array[] = [];
    private threshold = 0.5;

    async initialize(config: WakewordConfig): Promise<void> {
        await this.dispose();
        ort.env.wasm.numThreads = 1;
        ort.env.wasm.proxy = false;
        ort.env.wasm.wasmPaths = {
            mjs: new URL('wasm/ort-wasm-simd-threaded.mjs', config.assetBase).href,
            wasm: new URL('wasm/ort-wasm-simd-threaded.wasm', config.assetBase).href,
        };
        this.threshold = Math.max(0.01, Math.min(1, config.threshold));
        const loadAsset =
            config.loadAsset ||
            (async (name: string): Promise<Uint8Array> => {
                const response = await fetch(new URL(`models/${name}`, config.assetBase));
                if (!response.ok) throw new Error(`Could not load model ${name}: HTTP ${response.status}`);
                return new Uint8Array(await response.arrayBuffer());
            });
        try {
            this.mel = await ort.InferenceSession.create(await loadAsset('melspectrogram.onnx'));
            this.embedding = await ort.InferenceSession.create(await loadAsset('embedding_model.onnx'));
            for (const name of config.names) {
                const file = BUILTIN[name];
                const session = file
                    ? await ort.InferenceSession.create(await loadAsset(file))
                    : await ort.InferenceSession.create(await config.getUploadedModel(name));
                this.classifiers.push({ name, session });
            }
            if (!this.classifiers.length) throw new Error('No wake word model selected');
        } catch (error) {
            await this.dispose();
            throw error;
        }
    }

    async processAudio(samples: Float32Array): Promise<WakewordResult> {
        if (!this.mel || !this.embedding || !this.classifiers.length)
            throw new Error('Wake word engine not initialized');
        // The feature model expects int16 values represented as float32, not normalized floats.
        const audio = Float32Array.from(samples, sample => Math.round(Math.max(-1, Math.min(1, sample)) * 32767));
        const melOut = await this.mel.run({
            [this.mel.inputNames[0]]: new ort.Tensor('float32', audio, [1, audio.length]),
        });
        const melTensor = melOut[this.mel.outputNames[0]];
        const melData = melTensor.data as Float32Array;
        const frames = Number(melTensor.dims[2]);
        if (!Number.isInteger(frames) || melData.length < frames * MEL_BINS)
            throw new Error('Unexpected mel model output');
        for (let f = 0; f < frames; f++) {
            const row = new Float32Array(MEL_BINS);
            for (let b = 0; b < MEL_BINS; b++) row[b] = melData[f * MEL_BINS + b] / 10 + 2;
            this.melRows.push(row);
        }
        while (this.melProcessed + EMB_WINDOW <= this.melRows.length) {
            const flat = new Float32Array(EMB_WINDOW * MEL_BINS);
            for (let f = 0; f < EMB_WINDOW; f++) flat.set(this.melRows[this.melProcessed + f], f * MEL_BINS);
            const out = await this.embedding.run({
                [this.embedding.inputNames[0]]: new ort.Tensor('float32', flat, [1, EMB_WINDOW, MEL_BINS, 1]),
            });
            const data = out[this.embedding.outputNames[0]].data as Float32Array;
            if (data.length < EMB_DIM) throw new Error('Unexpected embedding model output');
            this.embeddings.push(data.slice(0, EMB_DIM));
            this.melProcessed += EMB_HOP;
        }
        if (this.melProcessed > EMB_WINDOW) {
            const drop = this.melProcessed - EMB_WINDOW;
            this.melRows.splice(0, drop);
            this.melProcessed -= drop;
        }
        if (this.embeddings.length > WW_FRAMES * 4) this.embeddings.splice(0, this.embeddings.length - WW_FRAMES * 4);
        if (this.embeddings.length < WW_FRAMES) return { detected: false, confidence: 0, timestamp: Date.now() };
        const features = new Float32Array(WW_FRAMES * EMB_DIM);
        for (let f = 0; f < WW_FRAMES; f++)
            features.set(this.embeddings[this.embeddings.length - WW_FRAMES + f], f * EMB_DIM);
        let best = { name: '', confidence: 0 };
        for (const { name, session } of this.classifiers) {
            const out = await session.run({
                [session.inputNames[0]]: new ort.Tensor('float32', features, [1, WW_FRAMES, EMB_DIM]),
            });
            const score = Number((out[session.outputNames[0]].data as Float32Array)[0]);
            if (score > best.confidence) best = { name, confidence: score };
        }
        return {
            detected: best.confidence >= this.threshold,
            confidence: best.confidence,
            timestamp: Date.now(),
            name: best.name,
        };
    }

    reset(): void {
        this.melRows = [];
        this.melProcessed = 0;
        this.embeddings = [];
    }
    async dispose(): Promise<void> {
        const sessions = [this.mel, this.embedding, ...this.classifiers.map(item => item.session)];
        this.mel = undefined;
        this.embedding = undefined;
        this.classifiers = [];
        this.reset();
        await Promise.all(sessions.filter((item): item is ort.InferenceSession => !!item).map(item => item.release()));
    }
}
