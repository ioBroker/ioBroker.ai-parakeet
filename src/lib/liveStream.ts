import { SAMPLE_RATE } from './audio';
import { AudioSession, type SessionOptions } from './audioSession';
import type { JobResult, Owner } from './scheduler';
import type { Transcriber } from './transcriber';

export const MAX_STREAM_MINUTES = 30;

/** What a live stream reports to its client */
export type LiveEvent =
    ({ type: 'transcript'; correctedText: string } & JobResult) | { type: 'done' } | { type: 'error'; message: string };

export interface LiveStreamOptions {
    transcriber: Transcriber;
    session: SessionOptions;
    /** Gets every event: the transcripts, at the end `done` or `error` */
    send: (event: LiveEvent) => void;
    /** The stream is over: `true` after `done`, `false` after `error`. The transport ends its connection */
    end: (ok: boolean) => void;
}

/** The correction dictionary as the clients show it */
export function correctionInfo(transcriber: Transcriber): { enabled: boolean; rules: number } {
    return { enabled: transcriber.corrector.size > 0, rules: transcriber.corrector.size };
}

/**
 * Live recognition of a microphone, the same for every transport (WebSocket of the test page, sendTo of admin):
 * cuts the audio into sentences, queues them and reports intermediate and final results. After `stop()` the rest
 * of the audio is recognized, then the stream ends with `done`.
 */
export class LiveStream {
    private state: 'recording' | 'stopping' | 'closed' = 'recording';
    private readonly started = performance.now();
    private received = 0;
    private readonly owner: Owner;
    private readonly session: AudioSession;
    private readonly timer: NodeJS.Timeout;

    public constructor(private readonly options: LiveStreamOptions) {
        const { transcriber } = options;
        this.owner = {
            id: `live-${Math.random().toString(36).slice(2)}`,
            streaming: true,
            result: (result: JobResult): void => {
                if (this.state === 'closed') {
                    return;
                }
                options.send({ type: 'transcript', ...result, correctedText: result.text });
                if (result.final) {
                    transcriber.reportResult(result);
                }
            },
            idle: (): void => this.checkDone(),
            fail: (error: Error): void => this.fail(error),
        };
        this.session = new AudioSession(job => transcriber.enqueue(this.owner, job), options.session);
        this.timer = setTimeout(
            () => this.fail(new Error(`The maximal session length is ${MAX_STREAM_MINUTES} minutes`)),
            MAX_STREAM_MINUTES * 60_000,
        );
    }

    /** True after `done`, an error or `close()` */
    public get closed(): boolean {
        return this.state === 'closed';
    }

    /** 16 kHz mono audio, at most 8000 samples. Invalid audio ends the stream with an error */
    public push(pcm: Float32Array): void {
        if (this.state === 'closed') {
            return;
        }
        try {
            if (this.state !== 'recording') {
                throw new Error('Recording already stopped');
            }
            this.received += pcm.length;
            if (this.received > ((performance.now() - this.started) / 1000 + 3) * SAMPLE_RATE) {
                throw new Error('Audio sent faster than real time');
            }
            this.session.push(pcm);
        } catch (error) {
            this.fail(error);
        }
    }

    /** The microphone is off: recognize the rest, then end with `done` */
    public stop(): void {
        if (this.state === 'closed') {
            return;
        }
        if (this.state !== 'recording') {
            this.fail(new Error('Recording already stopped'));
            return;
        }
        this.state = 'stopping';
        this.session.flush();
        this.checkDone();
    }

    /** Ends the stream with an error */
    public fail(error: Error): void {
        if (this.state === 'closed') {
            return;
        }
        this.finish();
        this.options.send({ type: 'error', message: error.message });
        this.options.end(false);
    }

    /** The client is gone: drop everything without an event */
    public close(): void {
        if (this.state !== 'closed') {
            this.finish();
        }
    }

    private checkDone(): void {
        if (this.state === 'stopping' && !this.options.transcriber.scheduler.has(this.owner)) {
            this.finish();
            this.options.send({ type: 'done' });
            this.options.end(true);
        }
    }

    private finish(): void {
        this.state = 'closed';
        clearTimeout(this.timer);
        this.session.reset();
        // without a reason: the owner is not told again
        this.options.transcriber.scheduler.cancel(this.owner);
    }
}
