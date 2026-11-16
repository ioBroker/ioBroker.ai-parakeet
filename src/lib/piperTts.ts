/** Local Piper CLI synthesis. Binaries and voices are downloaded on demand, with pinned SHA-256 hashes. */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, readFile, rename, rm, rmdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const PIPER_RELEASE = '2023.11.14-2';
export const PIPER_VOICE_REVISION = 'e9ab671f2a0e50a701b34361136ba3e6a3a9eb0c';
const BINARY_BASE = `https://github.com/rhasspy/piper/releases/download/${PIPER_RELEASE}`;
const VOICE_BASE = `https://huggingface.co/rhasspy/piper-voices/resolve/${PIPER_VOICE_REVISION}`;
const MAX_WAV_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_LENGTH = 1000;
export const CUSTOM_VOICE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
export function validateUploadedVoice(model: Buffer, config: Buffer): void {
    if (
        !Buffer.isBuffer(model) ||
        model.length < 1024 ||
        model.length > 150 * 1024 * 1024 ||
        !Buffer.isBuffer(config) ||
        config.length < 20 ||
        config.length > 256 * 1024
    ) {
        throw new Error('Uploaded Piper voice must contain an ONNX model (max 150 MiB) and JSON config (max 256 KiB)');
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(config.toString('utf8'));
    } catch {
        throw new Error('Uploaded Piper voice has invalid JSON configuration');
    }
    const value =
        parsed && typeof parsed === 'object'
            ? (parsed as {
                  audio?: { sample_rate?: number };
                  espeak?: { voice?: string };
                  phoneme_id_map?: object;
              })
            : {};
    if (
        !Number.isInteger(value.audio?.sample_rate) ||
        value.audio!.sample_rate! < 8000 ||
        value.audio!.sample_rate! > 48000 ||
        typeof value.espeak?.voice !== 'string' ||
        !value.phoneme_id_map ||
        typeof value.phoneme_id_map !== 'object'
    ) {
        throw new Error('Uploaded Piper voice configuration is not compatible with this Piper runtime');
    }
}

interface BinaryAsset {
    name: string;
    sha256: string;
}
const BINARIES: Record<string, BinaryAsset> = {
    'win32-x64': {
        name: 'piper_windows_amd64.zip',
        sha256: 'f3c58906402b24f3a96d92145f58acba6d86c9b5db896d207f78dc80811efcea',
    },
    'linux-x64': {
        name: 'piper_linux_x86_64.tar.gz',
        sha256: 'a50cb45f355b7af1f6d758c1b360717877ba0a398cc8cbe6d2a7a3a26e225992',
    },
    'linux-arm64': {
        name: 'piper_linux_aarch64.tar.gz',
        sha256: 'fea0fd2d87c54dbc7078d0f878289f404bd4d6eea6e7444a77835d1537ab88eb',
    },
    'linux-arm': {
        name: 'piper_linux_armv7l.tar.gz',
        sha256: 'c6946fcd57c705ed1d4666ea880f80ba0bbbd14de62ecbdd13460baf3bac8e37',
    },
    'darwin-arm64': {
        name: 'piper_macos_aarch64.tar.gz',
        sha256: '6b1eb03b3735946cb35216e063e7eebcc33a6bbf5dd96ec0217959bf1cdcb0cc',
    },
    'darwin-x64': {
        name: 'piper_macos_x64.tar.gz',
        sha256: 'ced85c0a3df13945b1e623b878a48fdc2854d5c485b4b67f62857cf551deaf8b',
    },
};

export function piperBinaryAsset(platform = process.platform, arch = process.arch): BinaryAsset | null {
    return BINARIES[`${platform}-${arch}`] || null;
}

export interface PiperVoice {
    id: string;
    label: string;
    language: string;
    license: string;
    standard: boolean;
    folder: string;
    modelSha256: string;
    configSha256: string;
}

/** Standard voices are shown immediately; optional voices can be downloaded later. */
export const PIPER_VOICES: readonly PiperVoice[] = [
    {
        id: 'de_DE-thorsten-low',
        label: 'Deutsch — Thorsten',
        language: 'de-DE',
        license: 'CC0',
        standard: true,
        folder: 'de/de_DE/thorsten/low',
        modelSha256: '9ac27fad17cec5c1a791161976a64f026f16fc058b400b1fea62565b8b2cf375',
        configSha256: 'df38e892ed949f62d0c40978bc666de0b341c5f7921840ae7c72f4df8e8ffa05',
    },
    {
        id: 'de_DE-kerstin-low',
        label: 'Deutsch — Kerstin',
        language: 'de-DE',
        license: 'CC0',
        standard: true,
        folder: 'de/de_DE/kerstin/low',
        modelSha256: 'd352a7641892cebf2903859af94e9ba81a141110215fe3943bcda7f7da401b7a',
        configSha256: '56e708556b7b9b7a53c4f8957e021421e69f11a600962bba554cffbe72cf2d47',
    },
    {
        id: 'en_US-kristin-medium',
        label: 'English — Kristin',
        language: 'en-US',
        license: 'public domain',
        standard: true,
        folder: 'en/en_US/kristin/medium',
        modelSha256: '5849957f929cbf720c258f8458692d6103fff2f0e3d3b19c8259474bb06a18d4',
        configSha256: '5681426d4aead22195de70531eeeeddb46493cfaffc5764b2ea3db73428b651c',
    },
    {
        id: 'fr_FR-siwis-low',
        label: 'Français — Siwis',
        language: 'fr-FR',
        license: 'CC BY 4.0',
        standard: false,
        folder: 'fr/fr_FR/siwis/low',
        modelSha256: 'a7b7dcaf87229b32af8275cb1a719371234ea677bc0313d2289d5c50ab0ac53d',
        configSha256: '9722527d748c284f6dd7639c4b4e661853d4f7d4514079571f67d6a97a652b69',
    },
    {
        id: 'es_ES-carlfm-x_low',
        label: 'Español — CarlFM',
        language: 'es-ES',
        license: 'public domain',
        standard: false,
        folder: 'es/es_ES/carlfm/x_low',
        modelSha256: 'd69677323a907cd4963f42b29c20a98b5d6bfa7f3e64df339915e4650c00d125',
        configSha256: 'd9bdfa9ff01eb2bc9e62e7d2593939d1e4c4d8eb7cf75f972731539d12399966',
    },
];

export interface SynthesizeRequest {
    text: string;
    voice?: string;
    speaker?: number;
    lengthScale?: number;
    noiseScale?: number;
    noiseW?: number;
    format?: 'wav';
}
export interface SynthesizeResult {
    audio: string;
    mimeType: 'audio/wav';
    format: 'wav';
    filename: string;
    sampleRate: number;
    channels: 1;
    durationMs: number;
    voice: string;
}

function optionalNumber(value: unknown, name: string, min: number, max: number): number | undefined {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
        throw new Error(`${name} must be a number from ${min} to ${max}`);
    }
    return value;
}

export function parseSynthesizeRequest(
    value: unknown,
    defaultVoice: string,
): Required<Pick<SynthesizeRequest, 'text' | 'voice'>> & SynthesizeRequest {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
    if (typeof input.text !== 'string' || !input.text.trim()) {
        throw new Error('"text" must be a non-empty string');
    }
    const text = input.text.replace(/\s+/g, ' ').trim();
    if (text.length > MAX_TEXT_LENGTH) {
        throw new Error(`"text" is longer than ${MAX_TEXT_LENGTH} characters`);
    }
    const voice = input.voice === undefined ? defaultVoice : input.voice;
    if (
        typeof voice !== 'string' ||
        (!PIPER_VOICES.some(candidate => candidate.id === voice) &&
            !(voice.startsWith('custom:') && CUSTOM_VOICE_NAME.test(voice.slice(7))))
    ) {
        throw new Error('Unknown Piper voice; use piperVoices to list available voices');
    }
    if (input.format !== undefined && input.format !== 'wav') {
        throw new Error('Only WAV output is supported');
    }
    const speaker = optionalNumber(input.speaker, 'speaker', 0, 255);
    if (speaker !== undefined && !Number.isInteger(speaker)) {
        throw new Error('speaker must be an integer');
    }
    return {
        text,
        voice,
        format: 'wav',
        speaker,
        lengthScale: optionalNumber(input.lengthScale, 'lengthScale', 0.5, 2),
        noiseScale: optionalNumber(input.noiseScale, 'noiseScale', 0, 2),
        noiseW: optionalNumber(input.noiseW, 'noiseW', 0, 2),
    };
}

async function sha256(file: string): Promise<string> {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(file)) {
        hash.update(chunk);
    }
    return hash.digest('hex');
}

async function downloadVerified(
    url: string,
    destination: string,
    expected: string,
    maxBytes: number,
    signal: AbortSignal,
): Promise<void> {
    const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(10 * 60_000)]) });
    if (!response.ok || !response.body) {
        throw new Error(`Download failed: HTTP ${response.status} (${url})`);
    }
    await mkdir(dirname(destination), { recursive: true });
    const part = `${destination}.part`;
    const hash = createHash('sha256');
    let size = 0;
    const tap = new Transform({
        transform(chunk: Buffer, _encoding, done): void {
            size += chunk.length;
            if (size > maxBytes) {
                done(new Error('Piper download exceeds its size limit'));
                return;
            }
            hash.update(chunk);
            done(null, chunk);
        },
    });
    try {
        await pipeline(Readable.fromWeb(response.body), tap, createWriteStream(part));
        if (hash.digest('hex') !== expected) {
            throw new Error('Piper download has the wrong SHA-256 checksum');
        }
        await rm(destination, { force: true });
        await rename(part, destination);
    } catch (error) {
        await rm(part, { force: true });
        throw error;
    }
}

function safeStagePath(root: string, stage: string): boolean {
    return resolve(stage).startsWith(`${resolve(root)}${sep}`);
}

/** Piper's output is PCM16 mono with a 44-byte RIFF/WAVE header. */
export function inspectPiperWav(wav: Buffer, expectedRate: number): { sampleRate: number; durationMs: number } {
    if (
        wav.length < 44 ||
        wav.toString('ascii', 0, 4) !== 'RIFF' ||
        wav.toString('ascii', 8, 12) !== 'WAVE' ||
        wav.toString('ascii', 36, 40) !== 'data' ||
        wav.readUInt32LE(4) + 8 !== wav.length ||
        wav.readUInt32LE(40) + 44 !== wav.length ||
        wav.readUInt16LE(20) !== 1 ||
        wav.readUInt16LE(22) !== 1 ||
        wav.readUInt16LE(34) !== 16
    ) {
        throw new Error('Piper returned invalid WAV audio');
    }
    const sampleRate = wav.readUInt32LE(24);
    if (sampleRate !== expectedRate) {
        throw new Error('Piper WAV sample rate does not match the voice');
    }
    return { sampleRate, durationMs: Math.round((wav.readUInt32LE(40) / (sampleRate * 2)) * 1000) };
}

export class PiperTts {
    private readonly controller = new AbortController();
    private readonly voiceTasks = new Map<string, Promise<string>>();
    private binaryTask?: Promise<string>;
    private readonly verifiedVoices = new Set<string>();
    private tail: Promise<unknown> = Promise.resolve();
    private pending = 0;
    private readonly uploadedHashes = new Map<string, string>();

    constructor(
        private readonly dataDir: string,
        private readonly log?: { info(message: string): void },
        private readonly readUploadedVoice?: (name: string) => Promise<{ model: Buffer; config: Buffer }>,
    ) {}

    close(): void {
        this.controller.abort();
    }

    listVoices(): Array<{
        value: string;
        label: string;
        description: string;
        language: string;
        license: string;
        standard: boolean;
        installed: boolean;
    }> {
        return PIPER_VOICES.map(voice => {
            const installed = existsSync(this.voicePath(voice)) && existsSync(`${this.voicePath(voice)}.json`);
            return {
                value: voice.id,
                label: `${voice.label} (${voice.standard ? 'standard' : 'additional'})`,
                description: `Dataset: ${voice.license}; ${installed ? 'downloaded' : 'downloads on first use'}`,
                language: voice.language,
                license: voice.license,
                standard: voice.standard,
                installed,
            };
        });
    }

    async downloadVoice(id: string): Promise<string> {
        const voice = PIPER_VOICES.find(candidate => candidate.id === id);
        if (!voice) {
            throw new Error('Unknown Piper voice');
        }
        const running = this.voiceTasks.get(id);
        if (running) {
            return running;
        }
        const task = this.prepareVoice(voice).finally(() => this.voiceTasks.delete(id));
        this.voiceTasks.set(id, task);
        return task;
    }

    async synthesize(message: unknown, defaultVoice = 'de_DE-thorsten-low'): Promise<SynthesizeResult> {
        const request = parseSynthesizeRequest(message, defaultVoice);
        if (this.controller.signal.aborted) {
            throw new Error('Piper is stopping');
        }
        if (this.pending >= 8) {
            throw new Error('Piper synthesis queue is full');
        }
        this.pending++;
        const job = this.tail.then(() => this.perform(request));
        this.tail = job.catch(() => undefined);
        try {
            return await job;
        } finally {
            this.pending--;
        }
    }

    private voicePath(voice: PiperVoice): string {
        return join(this.dataDir, 'piper', 'voices', voice.id, `${voice.id}.onnx`);
    }

    private async prepareVoice(voice: PiperVoice): Promise<string> {
        const model = this.voicePath(voice);
        const config = `${model}.json`;
        if (!this.verifiedVoices.has(voice.id)) {
            const modelGood = existsSync(model) && (await sha256(model)) === voice.modelSha256;
            const configGood = existsSync(config) && (await sha256(config)) === voice.configSha256;
            if (!modelGood) {
                this.log?.info(`Downloading Piper voice ${voice.id} model`);
                await downloadVerified(
                    `${VOICE_BASE}/${voice.folder}/${voice.id}.onnx`,
                    model,
                    voice.modelSha256,
                    150 * 1024 * 1024,
                    this.controller.signal,
                );
            }
            if (!configGood) {
                await downloadVerified(
                    `${VOICE_BASE}/${voice.folder}/${voice.id}.onnx.json`,
                    config,
                    voice.configSha256,
                    64 * 1024,
                    this.controller.signal,
                );
            }
            this.verifiedVoices.add(voice.id);
        }
        return model;
    }

    private async prepareUploadedVoice(name: string): Promise<string> {
        if (!CUSTOM_VOICE_NAME.test(name) || !this.readUploadedVoice) {
            throw new Error('Unknown uploaded Piper voice');
        }
        const { model, config } = await this.readUploadedVoice(name);
        validateUploadedVoice(model, config);
        const digest = createHash('sha256').update(model).update(config).digest('hex');
        const path = join(this.dataDir, 'piper', 'voices', 'custom', name, `${name}.onnx`);
        if (this.uploadedHashes.get(name) !== digest || !existsSync(path) || !existsSync(`${path}.json`)) {
            await mkdir(dirname(path), { recursive: true });
            await writeFile(`${path}.part`, model);
            await writeFile(`${path}.json.part`, config);
            await rm(path, { force: true });
            await rm(`${path}.json`, { force: true });
            await rename(`${path}.part`, path);
            await rename(`${path}.json.part`, `${path}.json`);
            this.uploadedHashes.set(name, digest);
        }
        return path;
    }

    private async binary(): Promise<string> {
        const path = join(
            this.dataDir,
            'piper',
            'runtime',
            'piper',
            process.platform === 'win32' ? 'piper.exe' : 'piper',
        );
        if (existsSync(path)) {
            return path;
        }
        if (!this.binaryTask) {
            this.binaryTask = this.downloadBinary(path).finally(() => {
                this.binaryTask = undefined;
            });
        }
        return this.binaryTask;
    }

    private async downloadBinary(path: string): Promise<string> {
        const asset = piperBinaryAsset();
        if (!asset) {
            throw new Error(`Piper has no bundled runtime for ${process.platform}-${process.arch}`);
        }
        const root = join(this.dataDir, 'piper');
        const archive = join(root, asset.name);
        const stage = join(root, `runtime-stage-${process.pid}`);
        if (!safeStagePath(root, stage)) {
            throw new Error('Invalid Piper extraction path');
        }
        await mkdir(root, { recursive: true });
        this.log?.info(`Downloading Piper runtime ${asset.name}`);
        try {
            await downloadVerified(
                `${BINARY_BASE}/${asset.name}`,
                archive,
                asset.sha256,
                40 * 1024 * 1024,
                this.controller.signal,
            );
            await mkdir(stage, { recursive: true });
            await new Promise<void>((done, fail) => {
                const args = asset.name.endsWith('.zip')
                    ? ['-xf', archive, '-C', stage]
                    : ['-xzf', archive, '-C', stage];
                const child = spawn('tar', args, { windowsHide: true, signal: this.controller.signal });
                child.once('error', fail);
                child.once('close', code =>
                    code === 0 ? done() : fail(new Error(`Piper extraction failed (${code})`)),
                );
            });
            const extracted = join(stage, 'piper', process.platform === 'win32' ? 'piper.exe' : 'piper');
            await stat(extracted);
            if (process.platform !== 'win32') {
                await chmod(extracted, 0o755);
            }
            const runtime = join(root, 'runtime');
            if (existsSync(runtime)) {
                throw new Error('Piper runtime directory exists but is incomplete');
            }
            await rename(stage, runtime);
            return path;
        } finally {
            await rm(archive, { force: true });
            if (safeStagePath(root, stage)) {
                await rm(stage, { recursive: true, force: true });
            }
        }
    }

    private async perform(request: ReturnType<typeof parseSynthesizeRequest>): Promise<SynthesizeResult> {
        if (this.controller.signal.aborted) {
            throw new Error('Piper is stopping');
        }
        const voice = PIPER_VOICES.find(candidate => candidate.id === request.voice);
        const [binary, model] = await Promise.all([
            this.binary(),
            voice ? this.downloadVoice(voice.id) : this.prepareUploadedVoice(request.voice.slice(7)),
        ]);
        const config = JSON.parse(await readFile(`${model}.json`, 'utf8')) as {
            audio?: { sample_rate?: number };
            num_speakers?: number;
        };
        if (request.speaker !== undefined && request.speaker >= (config.num_speakers || 1)) {
            throw new Error(`speaker must be below ${config.num_speakers || 1} for ${request.voice}`);
        }
        const outputRoot = join(this.dataDir, 'piper', 'output');
        await mkdir(outputRoot, { recursive: true });
        const outputDir = await mkdtemp(join(outputRoot, 'speech-'));
        const outputFile = join(outputDir, 'speech.wav');
        const args = [
            '--model',
            model,
            '--config',
            `${model}.json`,
            '--output_file',
            outputFile,
            '--espeak_data',
            join(dirname(binary), 'espeak-ng-data'),
            '--quiet',
        ];
        if (request.speaker !== undefined) {
            args.push('--speaker', String(request.speaker));
        }
        if (request.lengthScale !== undefined) {
            args.push('--length_scale', String(request.lengthScale));
        }
        if (request.noiseScale !== undefined) {
            args.push('--noise_scale', String(request.noiseScale));
        }
        if (request.noiseW !== undefined) {
            args.push('--noise_w', String(request.noiseW));
        }
        try {
            await this.run(binary, args, request.text);
            const size = (await stat(outputFile)).size;
            if (size > MAX_WAV_BYTES) {
                throw new Error('Piper WAV output is too large');
            }
            const wav = await readFile(outputFile);
            const { sampleRate, durationMs } = inspectPiperWav(wav, config.audio?.sample_rate || 0);
            return {
                audio: wav.toString('base64'),
                mimeType: 'audio/wav',
                format: 'wav',
                filename: 'speech.wav',
                sampleRate,
                channels: 1,
                durationMs,
                voice: request.voice,
            };
        } finally {
            await rm(outputFile, { force: true });
            await rmdir(outputDir).catch(() => undefined);
        }
    }

    private async run(binary: string, args: string[], text: string): Promise<void> {
        const signal = AbortSignal.any([this.controller.signal, AbortSignal.timeout(120_000)]);
        return new Promise<void>((done, fail) => {
            const child = spawn(binary, args, {
                cwd: dirname(binary),
                windowsHide: true,
                signal,
                stdio: ['pipe', 'ignore', 'pipe'],
            });
            let error = '';
            child.stderr?.on('data', (chunk: Buffer) => {
                error = `${error}${chunk.toString()}`.slice(-4096);
            });
            child.once('error', fail);
            child.once('close', code => {
                if (code !== 0) {
                    fail(new Error(`Piper failed (${code}): ${error.trim() || 'unknown error'}`));
                } else {
                    done();
                }
            });
            child.stdin?.on('error', () => undefined);
            child.stdin?.end(`${text}\n`, 'utf8');
        });
    }
}
