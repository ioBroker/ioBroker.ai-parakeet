import { SAMPLE_RATE } from './audio';

export interface SessionJob {
    segment: number;
    pcm: Float32Array;
    final: boolean;
}

export interface SessionOptions {
    /** RMS level from which a packet counts as speech */
    threshold?: number;
    /** Seconds between intermediate results */
    interval?: number;
    /** Seconds of silence that end a sentence */
    silence?: number;
    /** A sentence is cut after so many seconds */
    maxSeconds?: number;
}

/**
 * Cuts the microphone stream of the test page into sentences with a simple energy gate (no neural VAD).
 * During a sentence it emits intermediate results every `interval` seconds, at its end a final one.
 */
export class AudioSession {
    private readonly threshold: number;
    private readonly interval: number;
    private readonly silenceLimit: number;
    private readonly maxSamples: number;
    private segment = 0;
    private chunks: Float32Array[] = [];
    private samples = 0;
    private quiet = 0;
    private lastEmit = 0;
    /** Audio shortly before the speech starts, so the first syllable is not cut */
    private preRoll: Float32Array[] = [];
    private preSamples = 0;

    public constructor(
        private readonly emit: (job: SessionJob) => void,
        options: SessionOptions = {},
    ) {
        this.threshold = options.threshold ?? 0.008;
        this.interval = (options.interval ?? 1.5) * SAMPLE_RATE;
        this.silenceLimit = (options.silence ?? 0.8) * SAMPLE_RATE;
        this.maxSamples = (options.maxSeconds ?? 12) * SAMPLE_RATE;
    }

    public get preRollSamples(): number {
        return this.preSamples;
    }

    public push(pcm: Float32Array): void {
        if (!pcm.length || pcm.length > SAMPLE_RATE / 2) {
            throw new Error('Expected 1-8000 samples per audio message');
        }
        let energy = 0;
        for (const sample of pcm) {
            if (!Number.isFinite(sample) || Math.abs(sample) > 1.01) {
                throw new Error('Invalid PCM sample');
            }
            energy += sample * sample;
        }
        const speech = Math.sqrt(energy / pcm.length) >= this.threshold;
        if (!this.samples && !speech) {
            this.preRoll.push(pcm);
            this.preSamples += pcm.length;
            while (this.preSamples > SAMPLE_RATE * 0.3 && this.preRoll.length > 1) {
                this.preSamples -= this.preRoll.shift()!.length;
            }
            return;
        }
        if (!this.samples) {
            this.segment++;
            this.chunks.push(...this.preRoll);
            this.samples = this.preSamples;
            this.preRoll = [];
            this.preSamples = 0;
        }
        this.chunks.push(pcm);
        this.samples += pcm.length;
        this.quiet = speech ? 0 : this.quiet + pcm.length;
        if (this.quiet >= this.silenceLimit || this.samples >= this.maxSamples) {
            this.flush();
        } else if (this.samples - this.lastEmit >= this.interval) {
            this.publish(false);
        }
    }

    /** Ends the current sentence */
    public flush(): void {
        if (this.samples) {
            this.publish(true);
        }
        this.reset();
    }

    /** Drops everything */
    public reset(): void {
        this.chunks = [];
        this.samples = 0;
        this.quiet = 0;
        this.lastEmit = 0;
        this.preRoll = [];
        this.preSamples = 0;
    }

    private publish(final: boolean): void {
        const pcm = new Float32Array(this.samples);
        let offset = 0;
        for (const chunk of this.chunks) {
            pcm.set(chunk, offset);
            offset += chunk.length;
        }
        this.lastEmit = this.samples;
        this.emit({ segment: this.segment, pcm, final });
    }
}
