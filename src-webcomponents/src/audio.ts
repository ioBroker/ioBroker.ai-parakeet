export const RATE = 16_000;

export function pcmBase64(samples: Float32Array): string {
    const bytes = new Uint8Array(samples.length * 2);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(i * 2, Math.round(s < 0 ? s * 32768 : s * 32767), true);
    }
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
}

export function rms(samples: Float32Array): number {
    if (!samples.length) return 0;
    let energy = 0;
    for (const sample of samples) energy += sample * sample;
    return Math.sqrt(energy / samples.length);
}

export class AudioRingBuffer {
    private chunks: Float32Array[] = [];
    private count = 0;
    constructor(private readonly maxSamples: number) {}
    push(samples: Float32Array): void {
        this.chunks.push(samples.slice());
        this.count += samples.length;
        while (this.count > this.maxSamples && this.chunks.length) {
            const excess = this.count - this.maxSamples;
            const first = this.chunks[0];
            if (first.length <= excess) {
                this.chunks.shift();
                this.count -= first.length;
            } else {
                this.chunks[0] = first.slice(excess);
                this.count -= excess;
            }
        }
    }
    snapshot(): Float32Array {
        const out = new Float32Array(this.count);
        let offset = 0;
        for (const chunk of this.chunks) { out.set(chunk, offset); offset += chunk.length; }
        return out;
    }
    clear(): void { this.chunks = []; this.count = 0; }
}

export interface VadOptions {
    threshold: number;
    minSpeechMs: number;
    silenceMs: number;
    maxRecordMs: number;
    noSpeechMs: number;
}

export class VoiceActivityDetector {
    private elapsed = 0;
    private speechMs = 0;
    private silence = 0;
    constructor(private readonly options: VadOptions) {}
    push(samples: Float32Array): 'continue' | 'done' | 'no-speech' {
        const duration = samples.length / RATE * 1000;
        this.elapsed += duration;
        const voiced = rms(samples) >= this.options.threshold;
        if (voiced) { this.speechMs += duration; this.silence = 0; }
        else if (this.speechMs >= this.options.minSpeechMs) this.silence += duration;
        if (this.elapsed >= this.options.maxRecordMs) return 'done';
        if (this.speechMs >= this.options.minSpeechMs && this.silence >= this.options.silenceMs) return 'done';
        if (this.speechMs < this.options.minSpeechMs && this.elapsed >= this.options.noSpeechMs) return 'no-speech';
        return 'continue';
    }
}
