import { randomBytes } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

import { Adapter, type AdapterOptions, getAbsoluteDefaultDataDir } from '@iobroker/adapter-core';

import { ApiServer } from './lib/apiServer';
import { pcm16ToFloat, resample, RequestError, sanitize } from './lib/audio';
import { createCorrector } from './lib/corrections';
import { Engine, type EngineState } from './lib/engine';
import { translate, type TextId } from './lib/i18n';
import { checkModel, downloadModel, MODEL, MODEL_SIZE, verifyModel } from './lib/modelFiles';
import { selectLanAddress } from './lib/network';
import type { JobResult } from './lib/scheduler';
import { Transcriber } from './lib/transcriber';
import type { AiParakeetConfig } from './types';

const DEFAULT_PORT = 9999;
const MAX_FILE_BYTES = 64 * 1024 * 1024;
const WILDCARD_ADDRESSES = ['', '0.0.0.0', '::'];

type Status = 'starting' | 'downloading' | 'verifying' | 'loading' | 'ready' | 'idle' | 'error';

function escapeHtml(text: string | number | undefined): string {
    return String(text ?? '').replace(
        /[&<>"']/g,
        c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
    );
}

/** A number from the settings, limited to min..max */
function num(value: unknown, fallback: number, min: number, max: number): number {
    const parsed = typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value) : NaN;
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

/** Audio from a sendTo message: Buffer, base64 text, or a Buffer that went through JSON */
function toBuffer(value: unknown): Buffer | undefined {
    if (Buffer.isBuffer(value)) {
        return value;
    }
    if (value instanceof Uint8Array) {
        return Buffer.from(value);
    }
    if (typeof value === 'string') {
        return Buffer.from(value.replace(/^data:[^,]*,/, ''), 'base64');
    }
    if (value && typeof value === 'object' && (value as { type?: string }).type === 'Buffer') {
        const data = (value as { data?: unknown }).data;
        return Array.isArray(data) ? Buffer.from(data as number[]) : undefined;
    }
    return undefined;
}

export class AiParakeetAdapter extends Adapter {
    declare config: AiParakeetConfig;

    private engine: Engine | null = null;
    private transcriber: Transcriber | null = null;
    private server: ApiServer | null = null;
    private abort = new AbortController();

    private systemLanguage = 'en';
    private modelDir = '';
    private port = DEFAULT_PORT;
    private serverRunning = false;
    private modelState: 'checking' | 'downloading' | 'verifying' | 'available' | 'error' = 'checking';
    private modelError = '';
    private progress = 0;
    private status: Status = 'starting';
    private requests = 0;
    private lastQueue = -1;

    public constructor(options: Partial<AdapterOptions> = {}) {
        super({
            ...options,
            name: 'ai-parakeet',
            ready: () => this.onReady(),
            unload: callback => this.onUnload(callback),
            message: obj => this.onMessage(obj),
        });
    }

    private async onReady(): Promise<void> {
        await this.setState('info.connection', false, true);
        await this.setState('info.status', 'starting', true);
        await this.setState('info.lastError', '', true);
        try {
            const systemConfig = await this.getForeignObjectAsync('system.config');
            this.systemLanguage = systemConfig?.common?.language || 'en';
        } catch {
            // English
        }
        const requests = await this.getStateAsync('stats.requests');
        this.requests = typeof requests?.val === 'number' ? requests.val : 0;

        const cfg = this.config;
        this.port = Math.round(num(cfg.port, DEFAULT_PORT, 1, 65535));
        const configuredDir = (cfg.modelDir || '').trim();
        if (configuredDir && !isAbsolute(configuredDir)) {
            this.log.warn(`The model directory "${configuredDir}" is not absolute. Using the default directory.`);
        }
        this.modelDir =
            configuredDir && isAbsolute(configuredDir)
                ? configuredDir
                : join(getAbsoluteDefaultDataDir(), 'ai-parakeet', 'models');
        const maxAudioSeconds = Math.round(num(cfg.maxAudioSeconds, 300, 5, 3600));

        this.engine = new Engine({
            modelDir: this.modelDir,
            threads: Math.round(num(cfg.threads, 0, 0, 64)),
            memoryCheck: cfg.memoryCheck !== false,
            unloadAfterMs: num(cfg.unloadAfter, 0, 0, 7 * 24 * 60) * 60_000,
            log: this.log,
            onState: (state, error) => this.onEngineState(state, error),
        });
        const corrector = createCorrector(cfg.corrections, text => this.log.warn(text));
        this.transcriber = new Transcriber({
            engine: this.engine,
            corrector,
            maxAudioSeconds,
            ffmpegPath: (cfg.ffmpegPath ?? 'ffmpeg').trim(),
            useHints: cfg.useHints !== false,
            unavailable: () => this.unavailableReason(),
            onResult: result => this.onResult(result),
            onQueue: queued => this.onQueue(queued),
        });

        await this.startServer();
        await this.prepareModel();
    }

    // ---------------------------------------------------------------- server

    private async startServer(): Promise<void> {
        const cfg = this.config;
        let tls: { key: string; cert: string; ca?: string } | undefined;
        if (cfg.secure) {
            try {
                const [certificates] = await this.getCertificatesAsync(
                    cfg.certPublic,
                    cfg.certPrivate,
                    cfg.certChained,
                );
                if (!certificates?.key || !certificates?.cert) {
                    throw new Error('certificates not found');
                }
                tls = { key: certificates.key, cert: certificates.cert, ca: certificates.ca || undefined };
            } catch (e) {
                this.fail(`HTTPS is enabled, but the certificates cannot be read: ${e.message}`);
                return;
            }
        }
        this.server = new ApiServer({
            bind: (cfg.bind || '').trim(),
            port: this.port,
            tls,
            apiKey: (cfg.apiKey || '').trim(),
            testPage: cfg.testPage !== false,
            publicDir: join(__dirname, '..', 'public'),
            maxClients: Math.round(num(cfg.maxClients, 4, 1, 64)),
            session: {
                threshold: num(cfg.vadThreshold, 0.008, 0.0001, 1),
                interval: num(cfg.partialInterval, 1.5, 0.5, 30),
                silence: num(cfg.silenceSeconds, 0.8, 0.2, 10),
            },
            transcriber: this.transcriber!,
            health: () => ({
                ready: this.status === 'ready' || this.status === 'idle',
                status: this.status,
                error: this.status === 'error' ? this.modelError || this.engine?.error : undefined,
                threads: this.engine?.threads ?? 0,
            }),
            log: this.log,
        });
        try {
            await this.server.start();
            this.serverRunning = true;
            const base = this.baseUrl();
            await this.setState('info.endpoint', `${base}/v1`, true);
            this.log.info(
                `OpenAI-compatible API at ${base}/v1${cfg.testPage !== false ? `, test page at ${base}/` : ''}`,
            );
            if (WILDCARD_ADDRESSES.includes((cfg.bind || '').trim()) && !(cfg.apiKey || '').trim()) {
                this.log.info(
                    'The server is reachable from the whole network without an API key. Set a key in the instance settings if the network is not trusted.',
                );
            }
        } catch (e) {
            this.server = null;
            this.fail(
                e.code === 'EADDRINUSE'
                    ? `Port ${this.port} is used by another program. Choose another port in the instance settings.`
                    : `Cannot start the server: ${e.message}`,
            );
        }
    }

    private publicHost(): string {
        const bind = (this.config.bind || '').trim();
        const host = WILDCARD_ADDRESSES.includes(bind) ? selectLanAddress() || '127.0.0.1' : bind;
        return host.includes(':') ? `[${host}]` : host;
    }

    private baseUrl(): string {
        return `${this.config.secure ? 'https' : 'http'}://${this.publicHost()}:${this.port}`;
    }

    // ---------------------------------------------------------------- model

    private async prepareModel(): Promise<void> {
        const signal = this.abort.signal;
        try {
            const check = await checkModel(this.modelDir);
            if (check === 'missing') {
                if (this.config.autoDownload === false) {
                    throw new Error(
                        `The model files are missing in ${this.modelDir}. Enable the download in the instance settings or copy the files there.`,
                    );
                }
                this.modelState = 'downloading';
                this.progress = 0;
                await this.updateStatus();
                this.log.info(
                    `Downloading the model ${MODEL.id} (${Math.round(MODEL_SIZE / 1024 / 1024)} MB) into ${this.modelDir}`,
                );
                await downloadModel(this.modelDir, {
                    baseUrl: this.config.downloadUrl || 'https://huggingface.co',
                    signal,
                    log: this.log,
                    onProgress: progress => {
                        this.progress = progress.percent;
                        void this.setState('info.modelProgress', progress.percent, true);
                    },
                });
                this.log.info('The model was downloaded and checked');
            } else if (check === 'unverified') {
                this.modelState = 'verifying';
                await this.updateStatus();
                this.log.info(`Checking the model files in ${this.modelDir}`);
                await verifyModel(this.modelDir, signal);
            }
            this.modelState = 'available';
            this.progress = 100;
            await this.setState('info.modelProgress', 100, true);
            await this.updateStatus();
        } catch (e) {
            if (signal.aborted) {
                return;
            }
            this.modelState = 'error';
            this.fail(e.message);
            return;
        }
        // Load the model now, so the first request is fast
        try {
            await this.engine!.start();
        } catch (e) {
            this.log.error(e.message);
        }
    }

    private unavailableReason(): string | undefined {
        if (this.modelState === 'downloading') {
            return `The model is being downloaded (${this.progress} %)`;
        }
        if (this.modelState === 'verifying' || this.modelState === 'checking') {
            return 'The model files are being checked';
        }
        if (this.modelState === 'error') {
            return this.modelError;
        }
        return undefined;
    }

    // ---------------------------------------------------------------- states

    private fail(message: string): void {
        this.modelError = message;
        this.log.error(message);
        void this.setState('info.lastError', message, true);
        void this.updateStatus();
    }

    private onEngineState(_state: EngineState, error?: string): void {
        if (error) {
            void this.setState('info.lastError', error, true);
        }
        void this.updateStatus();
    }

    private async updateStatus(): Promise<void> {
        let status: Status;
        if (this.modelState === 'error' || (!this.serverRunning && this.modelError)) {
            status = 'error';
        } else if (this.modelState === 'downloading' || this.modelState === 'verifying') {
            status = this.modelState;
        } else if (this.modelState === 'checking') {
            status = 'starting';
        } else {
            const engineState = this.engine?.state;
            status =
                engineState === 'ready'
                    ? 'ready'
                    : engineState === 'loading'
                      ? 'loading'
                      : engineState === 'error'
                        ? 'error'
                        : 'idle';
        }
        this.status = status;
        await this.setState('info.status', status, true);
        await this.setState(
            'info.connection',
            this.serverRunning && (status === 'ready' || status === 'idle' || status === 'loading'),
            true,
        );
    }

    private onResult(result: JobResult): void {
        this.requests++;
        if (this.config.publishText !== false) {
            void this.setState('stats.lastText', result.text, true);
        }
        void this.setState('stats.lastAudioSeconds', Math.round(result.audioSeconds * 100) / 100, true);
        void this.setState('stats.lastInferenceMs', Math.round(result.inferenceMs), true);
        void this.setState(
            'stats.lastRtf',
            result.audioSeconds ? Math.round((result.inferenceMs / 1000 / result.audioSeconds) * 1000) / 1000 : 0,
            true,
        );
        void this.setState('stats.requests', this.requests, true);
    }

    private onQueue(queued: number): void {
        if (queued !== this.lastQueue) {
            this.lastQueue = queued;
            void this.setState('stats.queue', queued, true);
        }
    }

    // ---------------------------------------------------------------- messages

    private t(id: TextId, ...args: (string | number)[]): string {
        return translate(this.systemLanguage, id, ...args);
    }

    private statusHtml(): string {
        const statusText: Record<Status, string> = {
            starting: this.t('starting'),
            downloading: this.t('downloading', this.progress),
            verifying: this.t('verifying'),
            loading: this.t('loading'),
            ready: this.t('ready'),
            idle: this.t('idle'),
            error: `${this.t('error')}: ${this.modelError || this.engine?.error || ''}`,
        };
        if (!this.serverRunning) {
            return `<p style="color:#d32f2f">${escapeHtml(this.modelError || this.t('notRunning'))}</p>`;
        }
        const base = this.baseUrl();
        const color = this.status === 'error' ? '#d32f2f' : this.status === 'ready' ? '#2e7d32' : 'inherit';
        const rows: [string, string][] = [
            [this.t('status'), `<span style="color:${color}">${escapeHtml(statusText[this.status])}</span>`],
            [this.t('endpoint'), `<code>${escapeHtml(base)}/v1/audio/transcriptions</code>`],
            [
                this.t('testPage'),
                this.config.testPage !== false
                    ? `<a href="${escapeHtml(base)}/" target="_blank" rel="noopener">${escapeHtml(base)}/</a>`
                    : escapeHtml(this.t('testPageOff')),
            ],
            [this.t('modelDir'), `<code>${escapeHtml(this.modelDir)}</code>`],
            [this.t('threads'), escapeHtml(this.engine?.threads)],
            [this.t('queue'), escapeHtml(this.transcriber?.scheduler.queued ?? 0)],
        ];
        const table = rows
            .map(
                ([label, value]) =>
                    `<tr><td style="padding:2px 16px 2px 0;opacity:.7;white-space:nowrap">${escapeHtml(label)}</td><td>${value}</td></tr>`,
            )
            .join('');
        const assistant = `<p><b>${escapeHtml(this.t('assistantTitle'))}</b><br>${escapeHtml(
            this.t('assistantText', base),
        )}${(this.config.apiKey || '').trim() ? ` ${escapeHtml(this.t('assistantKey'))}` : ''}</p>`;
        return `<table>${table}</table>${assistant}`;
    }

    /** sendTo('ai-parakeet.0', 'transcribe', { file | audio | pcm, sampleRate, prompt, segments }) */
    private async transcribeMessage(message: unknown): Promise<Record<string, unknown>> {
        const transcriber = this.transcriber;
        if (!transcriber) {
            throw new Error('The adapter is not ready');
        }
        const msg = (typeof message === 'string' ? { file: message } : message || {}) as {
            file?: unknown;
            audio?: unknown;
            pcm?: unknown;
            sampleRate?: unknown;
            prompt?: unknown;
            segments?: unknown;
        };
        const options = {
            prompt: typeof msg.prompt === 'string' ? msg.prompt : undefined,
            segments: msg.segments === true,
        };
        let result: JobResult;
        if (typeof msg.file === 'string' && msg.file) {
            if (!isAbsolute(msg.file)) {
                throw new RequestError('"file" must be an absolute path on the host of the instance');
            }
            const info = await stat(msg.file);
            if (info.size > MAX_FILE_BYTES) {
                throw new RequestError(`The file is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB`);
            }
            result = await transcriber.transcribeFile(await readFile(msg.file), options);
        } else if (msg.audio !== undefined) {
            const audio = toBuffer(msg.audio);
            if (!audio?.length) {
                throw new RequestError('"audio" must be a Buffer or a base64 text of an audio file');
            }
            result = await transcriber.transcribeFile(audio, options);
        } else if (msg.pcm !== undefined) {
            const pcm = toBuffer(msg.pcm);
            const sampleRate = num(msg.sampleRate, 16000, 4000, 384_000);
            if (!pcm?.length) {
                throw new RequestError('"pcm" must be a Buffer or base64 text with 16-bit mono PCM');
            }
            result = await transcriber.transcribePcm(sanitize(resample(pcm16ToFloat(pcm), sampleRate)), options);
        } else {
            throw new RequestError('Send "file", "audio" or "pcm"');
        }
        return {
            text: result.text,
            rawText: result.rawText,
            audioSeconds: result.audioSeconds,
            inferenceMs: Math.round(result.inferenceMs),
            queueMs: Math.round(result.queueMs),
            ...(result.segments ? { segments: result.segments } : {}),
        };
    }

    private async onMessage(obj: ioBroker.Message): Promise<void> {
        if (!obj?.callback) {
            return;
        }
        let response: unknown;
        try {
            switch (obj.command) {
                case 'transcribe':
                    response = await this.transcribeMessage(obj.message);
                    break;
                case 'status':
                    response = this.statusHtml();
                    break;
                case 'getEndpoint':
                    response = {
                        baseUrl: this.baseUrl(),
                        openai: `${this.baseUrl()}/v1`,
                        ready: this.status === 'ready',
                    };
                    break;
                case 'openTestPage':
                    response =
                        this.config.testPage !== false && this.serverRunning
                            ? { openUrl: `${this.baseUrl()}/`, window: '_blank' }
                            : { error: this.t(this.serverRunning ? 'testPageDisabled' : 'notRunning') };
                    break;
                case 'generateApiKey':
                    response = { native: { apiKey: `sk-iob-${randomBytes(24).toString('base64url')}` } };
                    break;
                default:
                    response = { error: `Unknown command ${obj.command}` };
            }
        } catch (e) {
            response = { error: e.message };
        }
        this.sendTo(obj.from, obj.command, response as ioBroker.MessagePayload, obj.callback);
    }

    // ---------------------------------------------------------------- unload

    private async onUnload(callback: () => void): Promise<void> {
        try {
            this.abort.abort();
            this.transcriber?.scheduler.cancelAll(new Error('The adapter stops'));
            await this.server?.stop();
            await this.engine?.stop();
            await this.setState('info.connection', false, true);
        } catch {
            // ignore
        } finally {
            callback();
        }
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<AdapterOptions> | undefined) => new AiParakeetAdapter(options);
} else {
    // otherwise start the instance directly
    (() => new AiParakeetAdapter())();
}
