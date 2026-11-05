import { applyHints, type Corrector } from './corrections';
import { decodeAudio, RequestError, SAMPLE_RATE } from './audio';
import type { Engine, EngineResult } from './engine';
import { Scheduler, type Job, type JobResult, type Owner } from './scheduler';

/** What the transcriber needs from the engine (a fake one in the tests) */
export type EngineLike = Pick<Engine, 'transcribe' | 'state' | 'error' | 'threads'>;

export interface TranscriberOptions {
    engine: EngineLike;
    corrector: Corrector;
    maxAudioSeconds: number;
    /** Path of ffmpeg, asked for every file (a downloaded ffmpeg is used without a restart). '' = only WAV */
    ffmpegPath: () => string;
    /** Use the words of the prompt to fix their spelling */
    useHints: boolean;
    /** Returns an error text while the model cannot be used (e.g. it is being downloaded) */
    unavailable: () => string | undefined;
    /** Called for every final result */
    onResult?: (result: JobResult) => void;
    onQueue?: (queued: number, busy: boolean) => void;
}

export interface TranscribeOptions {
    prompt?: string;
    segments?: boolean;
    /** Gets the owner of the job, to cancel it when the client goes away */
    register?: (owner: Owner) => void;
}

/** Decodes audio, queues it, runs the model and applies the corrections */
export class Transcriber {
    public readonly scheduler: Scheduler;

    public constructor(private readonly options: TranscriberOptions) {
        // Five maximal recordings may wait, at least 10 minutes of audio
        this.scheduler = new Scheduler(
            job => this.run(job),
            Math.max(600, options.maxAudioSeconds * 5),
            options.onQueue,
        );
    }

    public get corrector(): Corrector {
        return this.options.corrector;
    }

    public get maxAudioSeconds(): number {
        return this.options.maxAudioSeconds;
    }

    /** Why the model cannot be used at the moment (e.g. it is being downloaded), undefined if it can */
    public get unavailableReason(): string | undefined {
        return this.options.unavailable();
    }

    private async run(job: Job): Promise<Omit<JobResult, 'queueMs' | 'audioSeconds' | 'segment' | 'final'>> {
        const reason = this.options.unavailable();
        if (reason) {
            throw new RequestError(reason, 503, 'model_not_ready');
        }
        let result: EngineResult;
        try {
            result = await this.options.engine.transcribe(job.pcm, !!job.segments);
        } catch (error) {
            // The model could not be loaded (memory, broken files): that is not the fault of the request
            if (this.options.engine.state === 'error') {
                throw new RequestError(error.message, 503, 'model_not_ready');
            }
            throw error;
        }
        const fix = (text: string): string => {
            let fixed = this.options.corrector.apply(text);
            if (this.options.useHints && job.prompt) {
                fixed = applyHints(fixed, job.prompt);
            }
            return fixed;
        };
        return {
            text: fix(result.text),
            rawText: result.text,
            segments: result.segments?.map(segment => ({ ...segment, text: fix(segment.text) })),
            inferenceMs: result.inferenceMs,
        };
    }

    private checkAvailable(): void {
        const reason = this.options.unavailable();
        if (reason) {
            throw new RequestError(reason, 503, 'model_not_ready');
        }
    }

    /** Transcribes 16 kHz mono audio */
    public async transcribePcm(pcm: Float32Array, options: TranscribeOptions = {}): Promise<JobResult> {
        this.checkAvailable();
        if (!pcm.length) {
            throw new RequestError('The audio is empty');
        }
        if (pcm.length / SAMPLE_RATE > this.options.maxAudioSeconds + 0.5) {
            throw new RequestError(
                `The audio is longer than ${this.options.maxAudioSeconds} seconds`,
                413,
                'audio_too_long',
            );
        }
        const result = await this.scheduler.submit(
            { pcm, prompt: options.prompt, segments: options.segments },
            options.register,
        );
        this.options.onResult?.(result);
        return result;
    }

    /** Transcribes an audio file (WAV, or anything ffmpeg reads) */
    public async transcribeFile(file: Buffer, options: TranscribeOptions = {}): Promise<JobResult> {
        this.checkAvailable();
        const pcm = await decodeAudio(file, this.options.ffmpegPath(), this.options.maxAudioSeconds);
        return this.transcribePcm(pcm, options);
    }

    /** Queues a job of the test page */
    public enqueue(owner: Owner, job: Job): void {
        this.scheduler.enqueue(owner, job);
    }

    /** Reports a final result of the test page */
    public reportResult(result: JobResult): void {
        this.options.onResult?.(result);
    }
}
