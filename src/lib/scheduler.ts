import { randomUUID } from 'node:crypto';

import { SAMPLE_RATE, RequestError } from './audio';

export interface Job {
    pcm: Float32Array;
    /** Number of the sentence of a stream. Jobs of the same owner and segment replace each other */
    segment: number;
    /** False for an intermediate result of the test page: it may be skipped if a newer one comes */
    final: boolean;
    /** Return the sentences with times (verbose_json, srt, vtt) */
    segments?: boolean;
    /** Vocabulary from the "prompt" field */
    prompt?: string;
}

export interface Segment {
    text: string;
    start: number;
    end: number;
}

export interface JobResult {
    /** Text after the corrections */
    text: string;
    /** Text as the model recognized it */
    rawText: string;
    segments?: Segment[];
    inferenceMs: number;
    /** Time in the queue, including loading the model */
    queueMs: number;
    audioSeconds: number;
    segment: number;
    final: boolean;
}

export interface Owner {
    readonly id: string;
    /** Streams are limited to 45 seconds of queued audio, so a slow host does not fall behind forever */
    readonly streaming?: boolean;
    result(result: JobResult): void;
    fail(error: Error): void;
    /** Called after every job of this owner */
    idle?(): void;
}

interface Pending {
    owner: Owner;
    job: Job;
    queuedAt: number;
}

export type RunJob = (job: Job) => Promise<Omit<JobResult, 'queueMs' | 'audioSeconds' | 'segment' | 'final'>>;

const MAX_STREAM_QUEUE_SECONDS = 45;

/**
 * Runs one inference at a time. Final results go first (an HTTP request should not wait behind
 * intermediate results of the test page), and a waiting intermediate result is replaced by a newer one.
 */
export class Scheduler {
    private readonly pending = new Map<string, Pending>();
    private active: Pending | null = null;
    private busy = false;

    /**
     * @param run runs one job
     * @param maxQueuedSeconds more audio is not accepted while this much waits
     * @param onChange called when the queue changes
     */
    public constructor(
        private readonly run: RunJob,
        private readonly maxQueuedSeconds: number,
        private readonly onChange: (queued: number, busy: boolean) => void = () => {},
    ) {}

    /** Jobs that wait, without the running one */
    public get queued(): number {
        return this.pending.size;
    }

    public get isBusy(): boolean {
        return this.busy;
    }

    /** Seconds of audio that wait */
    public get queuedSeconds(): number {
        let samples = 0;
        for (const item of this.pending.values()) {
            samples += item.job.pcm.length;
        }
        return samples / SAMPLE_RATE;
    }

    public enqueue(owner: Owner, job: Job): void {
        const key = `${owner.id}:${job.segment}`;
        const previous = this.pending.get(key);
        if (previous?.job.final) {
            throw new Error('Segment already finalized');
        }
        let ownerSamples = job.pcm.length;
        let allSamples = job.pcm.length;
        for (const item of this.pending.values()) {
            if (item !== previous) {
                allSamples += item.job.pcm.length;
                if (item.owner === owner) {
                    ownerSamples += item.job.pcm.length;
                }
            }
        }
        if (owner.streaming && ownerSamples > MAX_STREAM_QUEUE_SECONDS * SAMPLE_RATE) {
            throw new Error(
                `The server cannot keep up: more than ${MAX_STREAM_QUEUE_SECONDS} seconds of audio are waiting`,
            );
        }
        // One job is always accepted, however long it is: the length is checked before
        if (this.pending.size && allSamples > this.maxQueuedSeconds * SAMPLE_RATE) {
            throw new RequestError(
                `The server is busy: ${Math.round(this.queuedSeconds)} seconds of audio are waiting`,
                503,
                'server_busy',
            );
        }
        // A replaced intermediate result keeps its place in the queue
        this.pending.set(key, { owner, job, queuedAt: previous?.queuedAt ?? performance.now() });
        this.onChange(this.pending.size, this.busy);
        void this.drain();
    }

    /** Runs a single job and returns its result */
    public submit(job: Omit<Job, 'segment' | 'final'>, register?: (owner: Owner) => void): Promise<JobResult> {
        return new Promise((resolve, reject) => {
            const owner: Owner = { id: randomUUID(), result: resolve, fail: reject };
            register?.(owner);
            this.enqueue(owner, { ...job, segment: 0, final: true });
        });
    }

    /**
     * Removes the waiting jobs of an owner. A running job finishes, but its result is ignored by the owner.
     *
     * @param owner whose jobs are removed
     * @param reason if given, the owner gets it as failure, so nobody waits for the removed jobs forever
     */
    public cancel(owner: Owner, reason?: Error): void {
        let removed = 0;
        for (const [key, item] of this.pending) {
            if (item.owner === owner) {
                this.pending.delete(key);
                removed++;
            }
        }
        if (removed) {
            this.onChange(this.pending.size, this.busy);
            if (reason) {
                owner.fail(reason);
            }
        }
    }

    /** Fails all waiting jobs, e.g. when the adapter stops */
    public cancelAll(error: Error): void {
        const items = [...this.pending.values()];
        this.pending.clear();
        for (const item of items) {
            item.owner.fail(error);
        }
        this.onChange(0, this.busy);
    }

    /** True if the owner has a waiting or running job */
    public has(owner: Owner): boolean {
        return this.active?.owner === owner || [...this.pending.values()].some(item => item.owner === owner);
    }

    private next(): [string, Pending] | undefined {
        let first: [string, Pending] | undefined;
        for (const entry of this.pending) {
            if (entry[1].job.final) {
                return entry;
            }
            first ||= entry;
        }
        return first;
    }

    private async drain(): Promise<void> {
        if (this.busy) {
            return;
        }
        this.busy = true;
        try {
            for (let entry = this.next(); entry; entry = this.next()) {
                const [key, item] = entry;
                this.pending.delete(key);
                this.active = item;
                this.onChange(this.pending.size, true);
                const queueMs = performance.now() - item.queuedAt;
                try {
                    const result = await this.run(item.job);
                    item.owner.result({
                        ...result,
                        queueMs: Math.max(0, queueMs),
                        audioSeconds: item.job.pcm.length / SAMPLE_RATE,
                        segment: item.job.segment,
                        final: item.job.final,
                    });
                } catch (error) {
                    item.owner.fail(error instanceof Error ? error : new Error(String(error)));
                }
                this.active = null;
                item.owner.idle?.();
            }
        } finally {
            this.active = null;
            this.busy = false;
            this.onChange(this.pending.size, false);
        }
    }
}
