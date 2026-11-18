import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { promisify } from 'node:util';

import {
    Adapter,
    type AdapterOptions,
    getAbsoluteDefaultDataDir,
    getAbsoluteInstanceDataDir,
} from '@iobroker/adapter-core';

import { ApiServer } from './lib/apiServer';
import { pcm16ToFloat, resample, RequestError, sanitize } from './lib/audio';
import { createCorrector } from './lib/corrections';
import { Engine, type EngineState } from './lib/engine';
import { downloadFfmpegStatic, ffmpegStaticPath } from './lib/ffmpegStatic';
import { translate, type TextId } from './lib/i18n';
import { speechLanguage } from './lib/languages';
import { LiveSessions } from './lib/liveSessions';
import { moveOldDir, OLD_ADAPTER_NAME, UPLOAD_FOLDERS } from './lib/migration';
import { checkModel, downloadModel, MODEL, modelOf, modelSize, verifyModel, type KnownModel } from './lib/modelFiles';
import { CUSTOM_VOICE_NAME, PiperTts } from './lib/piperTts';
import { directAdminHost, isSecureContextUrl, selectLanAddress } from './lib/network';
import type { JobResult } from './lib/scheduler';
import { adapterTimers } from './lib/timers';
import { Transcriber } from './lib/transcriber';
import type { VoiceConfig } from './types';

const DEFAULT_PORT = 9999;
const MAX_FILE_BYTES = 64 * 1024 * 1024;
const WILDCARD_ADDRESSES = ['', '0.0.0.0', '::'];
const BUNDLED_WAKEWORDS = ['io_broker', 'hey_jarvis', 'alexa', 'hey_mycroft', 'hey_rhasspy'];
const MAX_WAKEWORD_MODEL_BYTES = 10 * 1024 * 1024;

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

/** The `path` field that the ffmpeg buttons send from the form, undefined if there is none */
function formPath(message: unknown): string | undefined {
    const path = (message as { path?: unknown } | undefined)?.path;
    return typeof path === 'string' ? path : undefined;
}

export class VoiceAdapter extends Adapter {
    declare config: VoiceConfig;

    private engine: Engine | null = null;
    private transcriber: Transcriber | null = null;
    private server: ApiServer | null = null;
    /** Live test of admin over sendTo; works without the server, e.g. while its port is used */
    private live: LiveSessions | null = null;
    private piper: PiperTts | null = null;
    private abort = new AbortController();

    private systemLanguage = 'en';
    private modelDir = '';
    /** The model of the settings (`model`): Parakeet, or Canary, which is told the language */
    private model: KnownModel = MODEL;
    /** Data directory of the instance; the old one of ai-parakeet if it could not be moved */
    private dataDir = '';
    private port = DEFAULT_PORT;
    private serverRunning = false;
    private modelState: 'checking' | 'downloading' | 'verifying' | 'available' | 'error' = 'checking';
    private modelError = '';
    private progress = 0;
    private status: Status = 'starting';
    private requests = 0;
    private lastQueue = -1;
    /** A running "Download ffmpeg": a second click waits for the same download */
    private ffmpegDownload: Promise<string> | null = null;

    public constructor(options: Partial<AdapterOptions> = {}) {
        super({
            ...options,
            name: 'voice',
            ready: () => this.onReady(),
            unload: callback => this.onUnload(callback),
            message: obj => this.onMessage(obj),
        });
        adapterTimers.use(this);
    }

    private async onReady(): Promise<void> {
        if (await this.takeOverOldSettings()) {
            // The instance restarts with the settings of ai-parakeet.
            return;
        }
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
        // Up to 0.1.x the adapter was called ai-parakeet: use its downloads instead of loading them again.
        const dataRoot = getAbsoluteDefaultDataDir();
        const modelRoot =
            configuredDir && isAbsolute(configuredDir)
                ? configuredDir
                : await moveOldDir(
                      join(dataRoot, OLD_ADAPTER_NAME, 'models'),
                      join(dataRoot, 'voice', 'models'),
                      this.log,
                  );
        this.model = modelOf(cfg.model);
        // Parakeet stays where it always was; another model gets a directory of its own next to it
        this.modelDir = this.model.id === MODEL.id ? modelRoot : join(modelRoot, this.model.id);
        this.dataDir = await moveOldDir(
            join(dataRoot, `${OLD_ADAPTER_NAME}.${this.instance}`),
            this.instanceDataDir(),
            this.log,
        );
        await this.copyOldUploads();
        this.piper = new PiperTts(this.instanceDataDir(), this.log, name => this.readUploadedPiperVoice(name));
        const maxAudioSeconds = Math.round(num(cfg.maxAudioSeconds, 300, 5, 3600));

        this.engine = new Engine({
            modelDir: this.modelDir,
            model: this.model.id,
            language: this.systemLanguage,
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
            ffmpegPath: () => this.ffmpegBin(),
            useHints: cfg.useHints !== false,
            unavailable: () => this.unavailableReason(),
            onResult: result => this.onResult(result),
            onQueue: queued => this.onQueue(queued),
        });

        this.live = new LiveSessions({
            transcriber: this.transcriber,
            session: this.sessionOptions(),
            maxClients: this.maxClients(),
            otherClients: () => this.server?.clients ?? 0,
        });

        await this.startServer();
        await this.prepareModel();
    }

    // ---------------------------------------------------------------- server

    /** How the live tests (test page and admin) cut the microphone into sentences */
    private sessionOptions(): { threshold: number; interval: number; silence: number } {
        const cfg = this.config;
        return {
            threshold: num(cfg.vadThreshold, 0.008, 0.0001, 1),
            interval: num(cfg.partialInterval, 1.5, 0.5, 30),
            silence: num(cfg.silenceSeconds, 0.8, 0.2, 10),
        };
    }

    /** Live tests at the same time, of the test page and of admin together */
    private maxClients(): number {
        return Math.round(num(this.config.maxClients, 4, 1, 64));
    }

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
            maxClients: this.maxClients(),
            otherClients: () => this.live?.size ?? 0,
            session: this.sessionOptions(),
            transcriber: this.transcriber!,
            modelId: this.model.id,
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

    private baseUrl(host = this.publicHost()): string {
        return `${this.config.secure ? 'https' : 'http'}://${host}:${this.port}`;
    }

    /**
     * Address of the test page for the browser that shows admin. If the browser reaches this host directly,
     * the page gets the same host name as admin: "localhost" gives the microphone without HTTPS, and a
     * name matches the certificate better than the IP address. Otherwise the address in the network.
     *
     * @param adminUrl the address of admin in the browser (`_origin` of the button, `_href` of the status)
     * @param from the admin instance that asks
     */
    private async testPageUrl(adminUrl: unknown, from: string | undefined): Promise<string> {
        let host: string | undefined;
        // only if the server listens on all addresses, otherwise only the configured one works
        if (WILDCARD_ADDRESSES.includes((this.config.bind || '').trim()) && from?.startsWith('system.adapter.admin.')) {
            try {
                const admin = await this.getForeignObjectAsync(from);
                // admin on another host: its host name points to that host
                if (admin?.common?.host === this.host) {
                    host = directAdminHost(adminUrl, admin?.native?.port);
                }
            } catch {
                // use the address in the network
            }
        }
        return `${this.baseUrl(host)}/`;
    }

    // ---------------------------------------------------------------- model

    private async prepareModel(): Promise<void> {
        const signal = this.abort.signal;
        try {
            const check = await checkModel(this.modelDir, this.model);
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
                    `Downloading the model ${this.model.id} (${Math.round(modelSize(this.model) / 1024 / 1024)} MB) into ${this.modelDir}`,
                );
                await downloadModel(this.modelDir, {
                    model: this.model,
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
                await verifyModel(this.modelDir, signal, this.model);
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

    /** The test page in the status: link, and a warning if the browser does not allow the microphone there */
    private testPageHtml(url: string): string {
        if (this.config.testPage === false) {
            return escapeHtml(this.t('testPageOff'));
        }
        const link = `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a>`;
        if (isSecureContextUrl(url)) {
            return link;
        }
        const local = `http://localhost:${this.port}/`;
        return `${link}<br><span style="color:#ed6c02">⚠ ${escapeHtml(this.t('testPageInsecure', local))}</span>`;
    }

    /**
     * Status in the configuration dialog
     *
     * @param adminUrl the address of admin in the browser, if admin sends it
     * @param from the admin instance that asks
     */
    private async statusHtml(adminUrl: unknown, from: string | undefined): Promise<string> {
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
            [this.t('testPage'), this.testPageHtml(await this.testPageUrl(adminUrl, from))],
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

    /** sendTo('voice.0', 'transcribe', { file | audio | pcm, sampleRate, prompt, segments, language }) */
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
            language?: unknown;
        };
        const options = {
            prompt: typeof msg.prompt === 'string' ? msg.prompt : undefined,
            segments: msg.segments === true,
            // Canary is told the language of the speech; Parakeet decides itself
            language: speechLanguage(msg.language),
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
                case 'getWakewords':
                    response = (await this.wakewordNames()).map(name => ({ value: name, label: name }));
                    break;
                case 'getWakewordConfig': {
                    const available = await this.wakewordNames();
                    const names = [
                        this.config.wakewordModel,
                        this.config.wakewordModel2,
                        this.config.wakewordModel3,
                    ].filter(name => name && available.includes(name));
                    response = {
                        names: names.length ? names : ['io_broker'],
                        threshold: num(this.config.wakewordThreshold, 0.5, 0.01, 1),
                    };
                    break;
                }
                case 'getWakewordModel': {
                    const name = (obj.message as { name?: unknown } | undefined)?.name;
                    if (
                        typeof name !== 'string' ||
                        !/^[\w.-]+\.onnx$/i.test(name) ||
                        !(await this.wakewordNames()).includes(name)
                    ) {
                        throw new Error('Unknown uploaded wake word model');
                    }
                    const file = await this.readFileAsync(this.namespace, `wakeWords/${name}`);
                    const data = file && typeof file === 'object' && 'file' in file ? file.file : file;
                    const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data, 'binary');
                    if (!bytes.length || bytes.length > MAX_WAKEWORD_MODEL_BYTES) {
                        throw new Error('Invalid wake word model size');
                    }
                    response = { base64: bytes.toString('base64') };
                    break;
                }
                case 'transcribe':
                    response = await this.transcribeMessage(obj.message);
                    break;
                case 'piperVoices':
                    response = [
                        ...((obj.message as { includeDefault?: boolean } | undefined)?.includeDefault
                            ? [
                                  {
                                      value: '',
                                      label: 'Adapter default',
                                      description: 'Use the voice configured in the adapter',
                                  },
                              ]
                            : []),
                        ...(this.piper?.listVoices() || []),
                        ...(await this.uploadedPiperVoiceNames()).map(name => ({
                            value: `custom:${name}`,
                            label: `Uploaded: ${name}`,
                            description: 'User-supplied model; verify its license and Piper compatibility',
                            language: '',
                            license: 'user supplied',
                            standard: false,
                            installed: true,
                        })),
                    ];
                    break;
                case 'downloadPiperVoice': {
                    const id = (obj.message as { voice?: unknown } | undefined)?.voice;
                    if (typeof id !== 'string' || !this.piper) {
                        throw new Error('Unknown Piper voice');
                    }
                    await this.piper.downloadVoice(id);
                    response = { result: `Piper voice ${id} is ready` };
                    break;
                }
                case 'synthesize':
                    if (!this.piper) {
                        throw new Error('Piper is not ready');
                    }
                    response = await this.piper.synthesize(obj.message, this.config.ttsVoice || 'de_DE-thorsten-low');
                    break;
                case 'status':
                    // message = { href } with the address of admin in the browser (admin with `_href`)
                    response = await this.statusHtml((obj.message as { href?: unknown } | null)?.href, obj.from);
                    break;
                case 'getEndpoint':
                    response = {
                        baseUrl: this.baseUrl(),
                        openai: `${this.baseUrl()}/v1`,
                        ready: this.status === 'ready',
                    };
                    break;
                case 'openTestPage':
                    // admin sends { _origin, _originIp } with the address of admin in the browser
                    response =
                        this.config.testPage !== false && this.serverRunning
                            ? {
                                  openUrl: await this.testPageUrl(
                                      (obj.message as { _origin?: unknown } | null)?._origin,
                                      obj.from,
                                  ),
                                  window: '_blank',
                              }
                            : { error: this.t(this.serverRunning ? 'testPageDisabled' : 'notRunning') };
                    break;
                case 'live':
                    // live test of admin, see LiveSessions
                    response = this.live ? this.live.handle(obj.message) : { error: this.t('notReady') };
                    break;
                case 'generateApiKey':
                    response = { native: { apiKey: `sk-iob-${randomBytes(24).toString('base64url')}` } };
                    break;
                case 'testFfmpeg':
                    // message = { path } with the (unsaved) path of the form
                    response = await this.testFfmpeg(formPath(obj.message) ?? this.config.ffmpegPath ?? '');
                    break;
                case 'downloadFfmpeg':
                    response = await this.downloadFfmpeg(formPath(obj.message) ?? this.config.ffmpegPath ?? '');
                    break;
                default:
                    response = { error: `Unknown command ${obj.command}` };
            }
        } catch (e) {
            response = { error: e.message };
        }
        this.sendTo(obj.from, obj.command, response as ioBroker.MessagePayload, obj.callback);
    }

    private async wakewordNames(): Promise<string[]> {
        try {
            const files = await this.readDirAsync(this.namespace, 'wakeWords/');
            const uploaded = files
                .filter(file => !file.isDir)
                .map(file => file.file.split('/').pop() || '')
                .filter(name => /^[\w.-]+\.onnx$/i.test(name));
            return [...BUNDLED_WAKEWORDS, ...uploaded];
        } catch {
            return [...BUNDLED_WAKEWORDS];
        }
    }

    private async uploadedPiperVoiceNames(): Promise<string[]> {
        try {
            const files = await this.readDirAsync(this.namespace, 'ttsVoices/');
            const names = new Set(files.filter(file => !file.isDir).map(file => file.file.split('/').pop() || ''));
            return [...names]
                .filter(
                    file =>
                        file.endsWith('.onnx') &&
                        CUSTOM_VOICE_NAME.test(file.slice(0, -5)) &&
                        names.has(`${file}.json`),
                )
                .map(file => file.slice(0, -5))
                .sort();
        } catch {
            return [];
        }
    }

    private async readUploadedPiperVoice(name: string): Promise<{ model: Buffer; config: Buffer }> {
        if (!CUSTOM_VOICE_NAME.test(name) || !(await this.uploadedPiperVoiceNames()).includes(name)) {
            throw new Error('Unknown uploaded Piper voice');
        }
        const read = async (fileName: string): Promise<Buffer> => {
            const file = await this.readFileAsync(this.namespace, `ttsVoices/${fileName}`);
            const data = file && typeof file === 'object' && 'file' in file ? file.file : file;
            return Buffer.isBuffer(data) ? data : Buffer.from(data, fileName.endsWith('.json') ? 'utf8' : 'binary');
        };
        return { model: await read(`${name}.onnx`), config: await read(`${name}.onnx.json`) };
    }

    // ---------------------------------------------------------------- ffmpeg

    /** The ffmpeg binary: the configured path, else the downloaded one, else `ffmpeg` from the search path */
    private ffmpegBin(): string {
        return this.config.ffmpegPath?.trim() || this.downloadedFfmpeg() || 'ffmpeg';
    }

    /**
     * The static ffmpeg of "Download ffmpeg", '' if there is none. Looked up for every file (one `stat`),
     * so a download is used and a deleted file falls back to the search path without a restart.
     */
    private downloadedFfmpeg(): string {
        const file = ffmpegStaticPath(this.instanceDataDir());
        return existsSync(file) ? file : '';
    }

    /**
     * Up to 0.1.x this adapter was called ai-parakeet. If an instance ai-parakeet.<n> with the same number exists,
     * this instance takes over its settings once and stops it (both would use the same port). Returns true if the
     * settings were written: the instance then restarts with them.
     */
    private async takeOverOldSettings(): Promise<boolean> {
        if (this.config.migratedFrom !== undefined) {
            return false;
        }
        const oldId = `system.adapter.${OLD_ADAPTER_NAME}.${this.instance}`;
        try {
            const old = await this.getForeignObjectAsync(oldId);
            if (old?.type !== 'instance' || !old.native) {
                return false;
            }
            if (old.common?.enabled) {
                await this.extendForeignObjectAsync(oldId, { common: { enabled: false } });
            }
            this.log.info(
                `Took over the settings of ${OLD_ADAPTER_NAME}.${this.instance} and stopped it. The instance restarts with them. ` +
                    `Change scripts and VIS widgets to ${this.namespace} and delete ${OLD_ADAPTER_NAME}.${this.instance} afterwards.`,
            );
            await this.extendForeignObjectAsync(`system.adapter.${this.namespace}`, {
                native: { ...old.native, migratedFrom: `${OLD_ADAPTER_NAME}.${this.instance}` },
            });
            return true;
        } catch (error) {
            this.log.warn(`Could not take over the settings of ${oldId}: ${(error as Error).message}`);
            return false;
        }
    }

    /** Copies the wake word models and Piper voices uploaded to ai-parakeet.<n> that this instance does not have. */
    private async copyOldUploads(): Promise<void> {
        const oldNamespace = `${OLD_ADAPTER_NAME}.${this.instance}`;
        try {
            const meta = await this.getForeignObjectAsync(oldNamespace);
            if (meta?.type !== 'meta') {
                return;
            }
        } catch {
            return;
        }
        let copied = 0;
        for (const folder of UPLOAD_FOLDERS) {
            let files: ioBroker.ReadDirResult[];
            try {
                files = await this.readDirAsync(oldNamespace, `${folder}/`);
            } catch {
                continue;
            }
            const present = new Set<string>();
            try {
                for (const file of await this.readDirAsync(this.namespace, `${folder}/`)) {
                    present.add(file.file);
                }
            } catch {
                // nothing uploaded yet
            }
            for (const file of files) {
                if (file.isDir || present.has(file.file)) {
                    continue;
                }
                try {
                    const { file: data } = await this.readFileAsync(oldNamespace, `${folder}/${file.file}`);
                    await this.writeFileAsync(this.namespace, `${folder}/${file.file}`, data);
                    copied++;
                } catch (error) {
                    this.log.warn(`Could not copy ${oldNamespace}/${folder}/${file.file}: ${(error as Error).message}`);
                }
            }
        }
        if (copied) {
            this.log.info(`Copied ${copied} uploaded file(s) from ${oldNamespace}`);
        }
    }

    private instanceDataDir(): string {
        if (this.dataDir) {
            return this.dataDir;
        }
        try {
            return getAbsoluteInstanceDataDir(this);
        } catch {
            return join(getAbsoluteDefaultDataDir(), this.namespace);
        }
    }

    /**
     * "Check ffmpeg": runs it and returns its version
     *
     * @param path the path from the (unsaved) form, '' = downloaded or from the search path
     */
    private async testFfmpeg(path: string): Promise<{ result?: string; error?: string }> {
        const bin = path.trim() || this.downloadedFfmpeg() || 'ffmpeg';
        try {
            const { stdout } = await promisify(execFile)(bin, ['-version'], {
                timeout: 10_000,
                maxBuffer: 4 * 1024 * 1024,
                windowsHide: true,
            });
            const version = stdout
                .split(/\r?\n/)[0]
                .replace(/\s+Copyright.*$/i, '')
                .trim();
            return { result: `${version} (${bin})` };
        } catch (e) {
            const error = e as NodeJS.ErrnoException;
            return {
                error:
                    error.code === 'ENOENT'
                        ? `${bin} not found${path.trim() ? '' : ' in the search path'}: install ffmpeg, download it or enter the full path`
                        : `${bin} failed: ${error.message}`,
            };
        }
    }

    /**
     * "Download ffmpeg": the static build of ffmpeg-static into the data dir, then the same check as
     * "Check ffmpeg". It is used from now on, unless a path is entered.
     *
     * @param configuredPath the path from the (unsaved) form
     */
    private async downloadFfmpeg(configuredPath: string): Promise<{ result?: string; error?: string }> {
        let file: string;
        try {
            this.ffmpegDownload ??= downloadFfmpegStatic(this.instanceDataDir(), {
                log: this.log,
                signal: this.abort.signal,
            }).finally(() => (this.ffmpegDownload = null));
            file = await this.ffmpegDownload;
        } catch (e) {
            this.log.warn(`Download of ffmpeg failed: ${e.message}`);
            return { error: `Download failed: ${e.message}` };
        }
        const check = await this.testFfmpeg(file);
        if (check.error || !configuredPath.trim()) {
            return check;
        }
        return { result: `${check.result}: not used while a path to ffmpeg is entered` };
    }

    // ---------------------------------------------------------------- unload

    private async onUnload(callback: () => void): Promise<void> {
        try {
            this.abort.abort();
            this.piper?.close();
            this.live?.closeAll();
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
    module.exports = (options: Partial<AdapterOptions> | undefined) => new VoiceAdapter(options);
} else {
    // otherwise start the instance directly
    (() => new VoiceAdapter())();
}
