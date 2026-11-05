/** Messages between the adapter and the inference process */
import type { Segment } from './scheduler';

export type InferenceRequest =
    | { type: 'load'; modelDir: string; threads: number }
    | { type: 'transcribe'; id: number; pcm: Float32Array; segments?: boolean }
    | { type: 'close' };

export type InferenceResponse =
    | { type: 'ready'; loadMs: number }
    | { type: 'fatal'; message: string }
    | { type: 'result'; id: number; text: string; segments?: Segment[]; inferenceMs: number }
    | { type: 'error'; id: number; message: string };
