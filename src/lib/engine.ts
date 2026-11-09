import { fork, type ChildProcess } from 'node:child_process';
import { availableParallelism, freemem } from 'node:os';
import { join } from 'node:path';

import type { InferenceRequest, InferenceResponse } from './protocol';
import type { Segment } from './scheduler';
import { adapterTimers } from './timers';

/** The process needs about 1.1 GB with 12-second windows, measured on a Raspberry Pi 5 */
export const REQUIRED_MEMORY_MB = 1100;
const LOAD_TIMEOUT_MS = 5 * 60_000;
/** After a failed start the next try waits so long */
const RETRY_AFTER_MS = 30_000;

export type EngineState = 'stopped' | 'loading' | 'ready' | 'error';

export interface EngineResult {
    text: string;
    segments?: Segment[];
    inferenceMs: number;
}

export interface EngineLogger {
    debug(text: string): void;
    info(text: string): void;
    warn(text: string): void;
    error(text: string): void;
}

export interface EngineOptions {
    modelDir: string;
    /** 0 = automatic */
    threads: number;
    /** Do not start if the host has less free memory */
    memoryCheck: boolean;
    /** End the process after so many idle milliseconds. 0 = never */
    unloadAfterMs: number;
    log: EngineLogger;
    onState?: (state: EngineState, error?: string) => void;
    /** Path of the inference script, for tests */
    script?: string;
}

/** Threads for the inference: all cores but one for ioBroker, at most 4 (more does not help) */
export function autoThreads(cores = availableParallelism()): number {
    return Math.max(1, Math.min(4, cores - 1));
}

/** Runs the model in a child process. It is started on the first request and can be unloaded when idle */
export class Engine {
    private child: ChildProcess | null = null;
    private starting: Promise<void> | null = null;
    private readonly pending = new Map<
        number,
        { resolve: (result: EngineResult) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }
    >();
    private nextId = 1;
    private idleTimer: NodeJS.Timeout | null = null;
    private stopping = false;
    private lastFailure = 0;
    private lastError = '';
    public state: EngineState = 'stopped';
    public loadMs = 0;
    public readonly threads: number;

    public constructor(private readonly options: EngineOptions) {
        this.threads = options.threads > 0 ? options.threads : autoThreads();
    }

    public get error(): string {
        return this.lastError;
    }

    private setState(state: EngineState, error?: string): void {
        if (state === this.state && error === undefined) {
            return;
        }
        this.state = state;
        if (error !== undefined) {
            this.lastError = error;
        } else if (state === 'ready') {
            this.lastError = '';
        }
        this.options.onState?.(state, error);
    }

    /** Loads the model. Resolves when it is ready */
    public start(): Promise<void> {
        if (this.state === 'ready' && this.child) {
            return Promise.resolve();
        }
        if (this.starting) {
            return this.starting;
        }
        if (this.lastFailure && Date.now() - this.lastFailure < RETRY_AFTER_MS) {
            return Promise.reject(new Error(this.lastError || 'The model could not be loaded'));
        }
        this.starting = this.spawn().finally(() => {
            this.starting = null;
        });
        return this.starting;
    }

    private spawn(): Promise<void> {
        const { log } = this.options;
        if (this.options.memoryCheck) {
            const free = Math.round(freemem() / 1024 / 1024);
            if (free < REQUIRED_MEMORY_MB) {
                const message = `Only ${free} MB of memory are free, the model needs about ${REQUIRED_MEMORY_MB} MB. Free memory or disable the memory check in the instance settings.`;
                this.lastFailure = Date.now();
                this.setState('error', message);
                return Promise.reject(new Error(message));
            }
        }
        this.stopping = false;
        this.setState('loading');
        log.info(`Loading the model with ${this.threads} CPU thread(s) from ${this.options.modelDir}`);
        const child = fork(this.options.script || join(__dirname, '..', 'inference.js'), [], {
            serialization: 'advanced',
            stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
            // Debug flags of the adapter (e.g. --inspect) must not go to the child
            execArgv: [],
        });
        this.child = child;
        const forward = (data: Buffer, warn: boolean): void => {
            for (const line of data.toString().split(/\r?\n/)) {
                if (line.trim()) {
                    // ONNX Runtime writes harmless warnings, e.g. that no GPU was found
                    if (warn && /\[E:|error/i.test(line)) {
                        log.warn(`Inference: ${line.trim()}`);
                    } else {
                        log.debug(`Inference: ${line.trim()}`);
                    }
                }
            }
        };
        child.stdout?.on('data', (data: Buffer) => forward(data, false));
        child.stderr?.on('data', (data: Buffer) => forward(data, true));

        return new Promise<void>((resolve, reject) => {
            let settled = false;
            const timers: { load?: NodeJS.Timeout } = {};
            const finish = (error?: Error): void => {
                if (settled) {
                    return;
                }
                settled = true;
                adapterTimers.clearTimeout(timers.load);
                if (error) {
                    this.lastFailure = Date.now();
                    this.setState('error', error.message);
                    this.kill();
                    reject(error);
                } else {
                    this.lastFailure = 0;
                    this.setState('ready');
                    this.touch();
                    resolve();
                }
            };
            timers.load = adapterTimers.setTimeout(
                () => finish(new Error(`The model did not load within ${LOAD_TIMEOUT_MS / 60_000} minutes`)),
                LOAD_TIMEOUT_MS,
            );

            child.on('message', (message: InferenceResponse) => {
                if (message.type === 'ready') {
                    this.loadMs = message.loadMs;
                    log.info(`Model loaded in ${(message.loadMs / 1000).toFixed(1)} s`);
                    finish();
                } else if (message.type === 'fatal') {
                    finish(new Error(`Cannot load the model: ${message.message}`));
                } else if (message.type === 'result' || message.type === 'error') {
                    const job = this.pending.get(message.id);
                    if (!job) {
                        return;
                    }
                    this.pending.delete(message.id);
                    adapterTimers.clearTimeout(job.timer);
                    this.touch();
                    if (message.type === 'error') {
                        job.reject(new Error(message.message));
                    } else {
                        job.resolve({
                            text: message.text,
                            segments: message.segments,
                            inferenceMs: message.inferenceMs,
                        });
                    }
                }
            });
            child.on('error', error => finish(error));
            child.on('exit', (code, signal) => {
                const reason = signal ? `signal ${signal}` : `exit code ${code}`;
                if (this.child === child) {
                    this.child = null;
                }
                const error = new Error(`The inference process ended (${reason})`);
                for (const [id, job] of this.pending) {
                    adapterTimers.clearTimeout(job.timer);
                    job.reject(error);
                    this.pending.delete(id);
                }
                if (!settled) {
                    finish(error);
                } else if (this.stopping) {
                    this.setState('stopped');
                } else {
                    log.error(error.message);
                    this.lastFailure = Date.now();
                    this.setState('error', error.message);
                }
            });
            this.send({ type: 'load', modelDir: this.options.modelDir, threads: this.threads });
        });
    }

    private send(message: InferenceRequest): void {
        this.child?.send(message);
    }

    /** Restarts the timer that unloads the model when it is idle */
    private touch(): void {
        if (this.idleTimer) {
            adapterTimers.clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
        if (this.options.unloadAfterMs > 0) {
            this.idleTimer = adapterTimers.setTimeout(() => {
                if (!this.pending.size && this.state === 'ready') {
                    this.options.log.info('Unloading the model after the idle time');
                    void this.stop();
                }
            }, this.options.unloadAfterMs);
        }
    }

    /**
     * Transcribes 16 kHz mono audio. Loads the model first, if needed.
     *
     * @param pcm the audio
     * @param segments return the sentences with times
     */
    public async transcribe(pcm: Float32Array, segments = false): Promise<EngineResult> {
        await this.start();
        const child = this.child;
        if (!child) {
            throw new Error('The inference process is not running');
        }
        const id = this.nextId++;
        // Even a slow CPU needs less than 3 times the audio length. A process that needs longer hangs.
        const timeoutMs = 30_000 + (pcm.length / 16000) * 3000;
        return new Promise<EngineResult>((resolve, reject) => {
            const timer = adapterTimers.setTimeout(() => {
                this.pending.delete(id);
                const error = new Error(`The transcription took longer than ${Math.round(timeoutMs / 1000)} s`);
                this.options.log.error(`${error.message}. Restarting the inference process.`);
                this.kill();
                reject(error);
            }, timeoutMs);
            this.pending.set(id, { resolve, reject, timer });
            if (this.idleTimer) {
                adapterTimers.clearTimeout(this.idleTimer);
                this.idleTimer = null;
            }
            this.send({ type: 'transcribe', id, pcm, segments });
        });
    }

    private kill(): void {
        const child = this.child;
        if (child && child.exitCode === null && child.signalCode === null) {
            child.kill('SIGKILL');
        }
    }

    /** Ends the process and frees its memory */
    public async stop(): Promise<void> {
        if (this.idleTimer) {
            adapterTimers.clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
        const child = this.child;
        this.stopping = true;
        if (!child) {
            if (this.state !== 'error') {
                this.setState('stopped');
            }
            return;
        }
        await new Promise<void>(resolve => {
            const timer = adapterTimers.setTimeout(() => {
                this.kill();
                resolve();
            }, 2000);
            child.once('exit', () => {
                adapterTimers.clearTimeout(timer);
                resolve();
            });
            try {
                this.send({ type: 'close' });
            } catch {
                this.kill();
            }
        });
        this.child = null;
        this.setState('stopped');
    }
}
