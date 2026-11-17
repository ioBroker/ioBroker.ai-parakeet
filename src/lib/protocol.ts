/** Messages between the adapter and the inference process */
import type { ModelId } from './modelFiles';
import type { Segment } from './scheduler';

export type InferenceRequest =
    | { type: 'load'; modelDir: string; threads: number; model?: ModelId; language?: string }
    | { type: 'transcribe'; id: number; pcm: Float32Array; segments?: boolean; language?: string }
    | { type: 'close' };

export type InferenceResponse =
    | { type: 'ready'; loadMs: number }
    | { type: 'fatal'; message: string }
    | { type: 'result'; id: number; text: string; segments?: Segment[]; inferenceMs: number }
    | { type: 'error'; id: number; message: string };
