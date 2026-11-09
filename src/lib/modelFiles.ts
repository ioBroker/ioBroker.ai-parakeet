import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, readFile, rename, rm, stat, statfs, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { adapterTimers } from './timers';

/**
 * Parakeet TDT 0.6B v3 (NVIDIA, CC-BY-4.0), converted to ONNX with INT8 weights.
 * The revision is pinned, the checksums were taken from the Hugging Face API.
 */
export const MODEL = {
    id: 'parakeet-tdt-0.6b-v3',
    repository: 'ysdede/parakeet-tdt-0.6b-v3-onnx',
    revision: 'e5356bf6e24bdb7a269536b0e9e7869bc034b893',
    files: [
        {
            name: 'encoder-model.int8.onnx',
            size: 652_183_999,
            sha256: '6139d2fa7e1b086097b277c7149725edbab89cc7c7ae64b23c741be4055aff09',
        },
        {
            name: 'decoder_joint-model.int8.onnx',
            size: 18_202_004,
            sha256: 'eea7483ee3d1a30375daedc8ed83e3960c91b098812127a0d99d1c8977667a70',
        },
        {
            name: 'vocab.txt',
            size: 102_132,
            sha256: 'ba8e4007c65f4bb4358ffe2ecc13d9ccc7a10351151065242b5c3a943e685742',
        },
    ],
} as const;

export const MODEL_SIZE = MODEL.files.reduce((sum, file) => sum + file.size, 0);

export interface ModelFile {
    name: string;
    size: number;
    sha256: string;
}

/** A model on Hugging Face: the files of a pinned revision */
export interface ModelSpec {
    repository: string;
    revision: string;
    files: readonly ModelFile[];
}

const MANIFEST = 'model.json';
const ATTEMPTS = 8;
/** A download that receives nothing for so long is restarted */
const STALL_MS = 60_000;

interface Manifest {
    repository: string;
    revision: string;
    files: string[];
    sizes: Record<string, number>;
}

export type ModelCheck = 'ok' | 'unverified' | 'missing';

export interface Progress {
    /** 0..100 */
    percent: number;
    file: string;
}

async function fileSize(path: string): Promise<number> {
    try {
        return (await stat(path)).size;
    } catch {
        return -1;
    }
}

/**
 * Checks the model directory.
 * - 'ok': all files have the right size and the manifest (model.json) belongs to the pinned revision
 * - 'unverified': the sizes are right, but there is no manifest: the checksums must be checked
 * - 'missing': files are missing or have a wrong size
 */
export async function checkModel(dir: string, model: ModelSpec = MODEL): Promise<ModelCheck> {
    for (const file of model.files) {
        if ((await fileSize(join(dir, file.name))) !== file.size) {
            return 'missing';
        }
    }
    try {
        const manifest = JSON.parse(await readFile(join(dir, MANIFEST), 'utf8')) as Manifest;
        if (
            manifest.repository === model.repository &&
            manifest.revision === model.revision &&
            model.files.every(file => manifest.sizes?.[file.name] === file.size)
        ) {
            return 'ok';
        }
    } catch {
        // no manifest
    }
    return 'unverified';
}

/** Writes model.json. The format is the same as of the parakeet demo, so its model directory can be used */
async function writeManifest(dir: string, model: ModelSpec): Promise<void> {
    const manifest: Manifest = {
        repository: model.repository,
        revision: model.revision,
        files: model.files.map(file => file.name),
        sizes: Object.fromEntries(model.files.map(file => [file.name, file.size])),
    };
    await writeFile(join(dir, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
}

export async function sha256(path: string, signal?: AbortSignal): Promise<string> {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path, { signal })) {
        hash.update(chunk as Buffer);
    }
    return hash.digest('hex');
}

/** Checks the checksums of all files and writes the manifest. Throws if a file is broken */
export async function verifyModel(dir: string, signal?: AbortSignal, model: ModelSpec = MODEL): Promise<void> {
    for (const file of model.files) {
        const actual = await sha256(join(dir, file.name), signal);
        if (actual !== file.sha256) {
            throw new Error(`${file.name} is broken (wrong SHA-256 checksum). Delete it to download it again.`);
        }
    }
    await writeManifest(dir, model);
}

/** Free bytes on the disk of the directory, or undefined if unknown */
async function freeSpace(dir: string): Promise<number | undefined> {
    try {
        const info = await statfs(dir);
        return info.bavail * info.bsize;
    } catch {
        return undefined;
    }
}

export interface DownloadOptions {
    /** Base address of Hugging Face or of a mirror, e.g. https://huggingface.co */
    baseUrl: string;
    signal?: AbortSignal;
    onProgress?: (progress: Progress) => void;
    log: { info(text: string): void; warn(text: string): void };
    /** For tests: another model and a shorter wait between the attempts */
    model?: ModelSpec;
    retryDelayMs?: (attempt: number) => number;
}

/**
 * Downloads the files that are missing. An interrupted download continues where it stopped (HTTP Range),
 * every file is checked with its SHA-256 checksum before it is used.
 */
export async function downloadModel(dir: string, options: DownloadOptions): Promise<void> {
    const { signal, log } = options;
    const model = options.model || MODEL;
    await mkdir(dir, { recursive: true });
    const missing: ModelFile[] = [];
    for (const file of model.files) {
        if ((await fileSize(join(dir, file.name))) !== file.size) {
            missing.push(file);
        }
    }
    const total = model.files.reduce((sum, file) => sum + file.size, 0);
    let done = model.files.filter(file => !missing.includes(file)).reduce((sum, file) => sum + file.size, 0);

    let needed = 0;
    for (const file of missing) {
        needed += file.size - Math.max(0, await fileSize(join(dir, `${file.name}.part`)));
    }
    const free = await freeSpace(dir);
    if (free !== undefined && free < needed + 50 * 1024 * 1024) {
        throw new Error(
            `Not enough disk space in ${dir}: ${Math.round(needed / 1024 / 1024)} MB needed, ${Math.round(free / 1024 / 1024)} MB free`,
        );
    }

    const base = options.baseUrl.trim().replace(/\/+$/, '') || 'https://huggingface.co';
    let lastReport = 0;
    for (const file of missing) {
        const target = join(dir, file.name);
        const part = `${target}.part`;
        const url = `${base}/${model.repository}/resolve/${model.revision}/${file.name}`;
        log.info(`Downloading ${file.name} (${Math.round(file.size / 1024 / 1024)} MB) from ${base}`);

        for (let attempt = 1; ; attempt++) {
            signal?.throwIfAborted();
            let have = Math.max(0, await fileSize(part));
            if (have > file.size) {
                await rm(part, { force: true });
                have = 0;
            }
            try {
                if (have < file.size) {
                    await downloadPart(url, part, have, file.size, signal, received => {
                        const now = Date.now();
                        if (now - lastReport > 1000) {
                            lastReport = now;
                            options.onProgress?.({
                                percent: Math.floor(((done + received) / total) * 100),
                                file: file.name,
                            });
                        }
                    });
                }
                const actual = await sha256(part, signal);
                if (actual !== file.sha256) {
                    await rm(part, { force: true });
                    throw new Error(`${file.name}: wrong SHA-256 checksum`);
                }
                await rename(part, target);
                break;
            } catch (error) {
                if (signal?.aborted || attempt >= ATTEMPTS) {
                    throw error;
                }
                const wait = options.retryDelayMs?.(attempt) ?? Math.min(60, 2 ** attempt) * 1000;
                log.warn(
                    `Download of ${file.name} failed (${error.message}). Attempt ${attempt + 1} of ${ATTEMPTS} in ${wait / 1000} s`,
                );
                await delay(wait, undefined, { signal });
            }
        }
        done += file.size;
        options.onProgress?.({ percent: Math.floor((done / total) * 100), file: file.name });
    }
    await writeManifest(dir, model);
}

/** Appends the bytes from `offset` to the file `part` */
async function downloadPart(
    url: string,
    part: string,
    offset: number,
    size: number,
    signal: AbortSignal | undefined,
    onData: (received: number) => void,
): Promise<void> {
    const controller = new AbortController();
    const abort = (): void => controller.abort(signal?.reason);
    signal?.addEventListener('abort', abort, { once: true });
    let stall = adapterTimers.setTimeout(() => controller.abort(new Error('no data for 60 s')), STALL_MS);
    const handle = await open(part, offset ? 'a' : 'w');
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'ioBroker.ai-parakeet', ...(offset ? { Range: `bytes=${offset}-` } : {}) },
            signal: controller.signal,
        });
        if (offset && response.status === 200) {
            // The server ignores Range: start again
            await handle.truncate(0);
            offset = 0;
        } else if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        if (!response.body) {
            throw new Error('Empty response');
        }
        let received = offset;
        for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
            adapterTimers.clearTimeout(stall);
            stall = adapterTimers.setTimeout(() => controller.abort(new Error('no data for 60 s')), STALL_MS);
            await handle.write(chunk);
            received += chunk.length;
            if (received > size) {
                throw new Error('The file is larger than expected');
            }
            onData(received);
        }
        if (received !== size) {
            throw new Error(`incomplete: ${received} of ${size} bytes`);
        }
    } catch (error) {
        // the reason of an abort is more helpful than "This operation was aborted"
        throw controller.signal.aborted && controller.signal.reason instanceof Error ? controller.signal.reason : error;
    } finally {
        adapterTimers.clearTimeout(stall);
        signal?.removeEventListener('abort', abort);
        await handle.close();
    }
}
