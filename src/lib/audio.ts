import { spawn } from 'node:child_process';

/** The model works with 16 kHz mono */
export const SAMPLE_RATE = 16_000;

/** An error with an HTTP status code, e.g. 400 for a broken file */
export class RequestError extends Error {
    public constructor(
        message: string,
        public readonly status = 400,
        public readonly code = 'invalid_request',
    ) {
        super(message);
    }
}

export interface DecodedAudio {
    /** Mono samples in the range -1..1 */
    samples: Float32Array;
    sampleRate: number;
}

const GUID_TAIL = '000000001000800000aa00389b71';

/** True if the buffer starts like a WAV file */
export function isWav(buffer: Buffer): boolean {
    return (
        buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE'
    );
}

/**
 * Reads a WAV file: PCM with 8, 16, 24 or 32 bits, IEEE float with 32 or 64 bits, also WAVE_FORMAT_EXTENSIBLE.
 * Several channels are mixed to mono.
 */
export function decodeWav(buffer: Buffer): DecodedAudio {
    if (!isWav(buffer)) {
        throw new RequestError('Not a WAV file');
    }
    let offset = 12;
    let format: { tag: number; channels: number; sampleRate: number; bits: number } | undefined;
    let data: Buffer | undefined;
    while (offset + 8 <= buffer.length) {
        const id = buffer.toString('ascii', offset, offset + 4);
        let size = buffer.readUInt32LE(offset + 4);
        const start = offset + 8;
        if (id === 'fmt ') {
            if (size < 16 || start + size > buffer.length) {
                throw new RequestError('Broken WAV header');
            }
            let tag = buffer.readUInt16LE(start);
            if (tag === 0xfffe && size >= 40) {
                // WAVE_FORMAT_EXTENSIBLE: the real format is in the first two bytes of the sub-format GUID
                const guid = buffer.toString('hex', start + 24, start + 40);
                if (guid.slice(4) === GUID_TAIL) {
                    tag = buffer.readUInt16LE(start + 24);
                }
            }
            format = {
                tag,
                channels: buffer.readUInt16LE(start + 2),
                sampleRate: buffer.readUInt32LE(start + 4),
                bits: buffer.readUInt16LE(start + 14),
            };
        } else if (id === 'data') {
            // Streamed WAVs write 0 or 0xFFFFFFFF as size: then the data goes to the end of the file
            if (size === 0 || size === 0xffffffff || start + size > buffer.length) {
                size = buffer.length - start;
            }
            data = buffer.subarray(start, start + size);
            break;
        }
        offset = start + size + (size % 2);
    }
    if (!format || !data) {
        throw new RequestError('WAV file without "fmt " or "data" chunk');
    }
    const { tag, channels, sampleRate, bits } = format;
    if (!channels || channels > 32 || sampleRate < 4000 || sampleRate > 384_000) {
        throw new RequestError(`Unsupported WAV format: ${channels} channels, ${sampleRate} Hz`);
    }
    const bytes = bits / 8;
    let read: (position: number) => number;
    if (tag === 1 && bits === 16) {
        read = position => data.readInt16LE(position) / 32768;
    } else if (tag === 1 && bits === 8) {
        read = position => (data[position] - 128) / 128;
    } else if (tag === 1 && bits === 24) {
        read = position => data.readIntLE(position, 3) / 8388608;
    } else if (tag === 1 && bits === 32) {
        read = position => data.readInt32LE(position) / 2147483648;
    } else if (tag === 3 && bits === 32) {
        read = position => data.readFloatLE(position);
    } else if (tag === 3 && bits === 64) {
        read = position => data.readDoubleLE(position);
    } else {
        throw new RequestError(`Unsupported WAV encoding (format ${tag}, ${bits} bits). Use PCM or float.`);
    }
    const frameSize = bytes * channels;
    const frames = Math.floor(data.length / frameSize);
    const samples = new Float32Array(frames);
    for (let frame = 0; frame < frames; frame++) {
        let sum = 0;
        for (let channel = 0; channel < channels; channel++) {
            sum += read(frame * frameSize + channel * bytes);
        }
        samples[frame] = sum / channels;
    }
    return { samples, sampleRate };
}

/**
 * Converts to 16 kHz. Downsampling averages the input samples around every output sample (box filter
 * against aliasing), upsampling interpolates linearly. Good enough for speech recognition.
 */
export function resample(samples: Float32Array, sampleRate: number, targetRate = SAMPLE_RATE): Float32Array {
    if (sampleRate === targetRate || !samples.length) {
        return samples;
    }
    const ratio = sampleRate / targetRate;
    const length = Math.max(1, Math.round(samples.length / ratio));
    const output = new Float32Array(length);
    if (ratio > 1) {
        for (let i = 0; i < length; i++) {
            const from = Math.floor(i * ratio);
            const to = Math.min(samples.length, Math.max(from + 1, Math.floor((i + 1) * ratio)));
            let sum = 0;
            for (let j = from; j < to; j++) {
                sum += samples[j];
            }
            output[i] = sum / (to - from);
        }
    } else {
        for (let i = 0; i < length; i++) {
            const position = i * ratio;
            const index = Math.floor(position);
            const next = Math.min(index + 1, samples.length - 1);
            const fraction = position - index;
            output[i] = samples[index] * (1 - fraction) + samples[next] * fraction;
        }
    }
    return output;
}

/** Signed 16-bit little-endian PCM to float samples */
export function pcm16ToFloat(buffer: Buffer): Float32Array {
    const samples = new Float32Array(Math.floor(buffer.length / 2));
    for (let i = 0; i < samples.length; i++) {
        samples[i] = buffer.readInt16LE(i * 2) / 32768;
    }
    return samples;
}

/** Replaces NaN/Infinity by silence and limits the samples to -1..1 */
export function sanitize(samples: Float32Array): Float32Array {
    for (let i = 0; i < samples.length; i++) {
        const value = samples[i];
        if (!Number.isFinite(value)) {
            samples[i] = 0;
        } else if (value > 1) {
            samples[i] = 1;
        } else if (value < -1) {
            samples[i] = -1;
        }
    }
    return samples;
}

/** Converts any audio file to 16 kHz mono float with ffmpeg (no shell, the file goes through stdin) */
export function decodeWithFfmpeg(
    buffer: Buffer,
    ffmpegPath: string,
    maxSeconds: number,
    timeoutMs = 120_000,
): Promise<Float32Array> {
    const maxBytes = Math.ceil((maxSeconds + 1) * SAMPLE_RATE) * 4;
    return new Promise((resolve, reject) => {
        const child = spawn(
            ffmpegPath,
            [
                '-hide_banner',
                '-loglevel',
                'error',
                '-i',
                'pipe:0',
                '-f',
                'f32le',
                '-ac',
                '1',
                '-ar',
                String(SAMPLE_RATE),
                'pipe:1',
            ],
            { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true },
        );
        const chunks: Buffer[] = [];
        let size = 0;
        let stderr = '';
        let failure: Error | undefined;
        const timer = setTimeout(() => {
            failure = new RequestError('ffmpeg took too long to convert the audio', 400);
            child.kill('SIGKILL');
        }, timeoutMs);
        child.stdout.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > maxBytes) {
                failure = new RequestError(`The audio is longer than ${maxSeconds} seconds`, 413, 'audio_too_long');
                child.kill('SIGKILL');
                return;
            }
            chunks.push(chunk);
        });
        child.stderr.on('data', (chunk: Buffer) => {
            stderr = (stderr + chunk.toString()).slice(-2000);
        });
        child.on('error', (error: NodeJS.ErrnoException) => {
            clearTimeout(timer);
            reject(
                error.code === 'ENOENT'
                    ? new RequestError(
                          `Only WAV is supported without ffmpeg. "${ffmpegPath}" was not found: install ffmpeg on the ioBroker host, or download it or enter its path in the instance settings (tab Recognition).`,
                          415,
                          'unsupported_format',
                      )
                    : error,
            );
        });
        child.on('close', code => {
            clearTimeout(timer);
            if (failure) {
                reject(failure);
            } else if (code !== 0) {
                reject(new RequestError(`ffmpeg cannot read the audio: ${stderr.trim() || `exit code ${code}`}`, 400));
            } else {
                const data = Buffer.concat(chunks);
                const samples = new Float32Array(Math.floor(data.length / 4));
                for (let i = 0; i < samples.length; i++) {
                    samples[i] = data.readFloatLE(i * 4);
                }
                resolve(samples);
            }
        });
        // ffmpeg may stop reading early (broken file): that is reported by "close"
        child.stdin.on('error', () => {});
        child.stdin.end(buffer);
    });
}

/**
 * Converts an uploaded file to 16 kHz mono float. WAV is read directly, everything else needs ffmpeg.
 *
 * @param buffer the file
 * @param ffmpegPath path of ffmpeg, '' = only WAV
 * @param maxSeconds longer audio is rejected
 */
export async function decodeAudio(buffer: Buffer, ffmpegPath: string, maxSeconds: number): Promise<Float32Array> {
    if (!buffer.length) {
        throw new RequestError('The audio file is empty');
    }
    let samples: Float32Array;
    if (isWav(buffer)) {
        const wav = decodeWav(buffer);
        if (wav.samples.length / wav.sampleRate > maxSeconds + 0.5) {
            throw new RequestError(`The audio is longer than ${maxSeconds} seconds`, 413, 'audio_too_long');
        }
        samples = resample(wav.samples, wav.sampleRate);
    } else if (ffmpegPath) {
        samples = await decodeWithFfmpeg(buffer, ffmpegPath, maxSeconds);
    } else {
        throw new RequestError(
            'Only WAV is supported. For MP3, OGG, M4A or WebM download ffmpeg or enter its path in the instance settings (tab Recognition).',
            415,
            'unsupported_format',
        );
    }
    if (samples.length / SAMPLE_RATE > maxSeconds + 0.5) {
        throw new RequestError(`The audio is longer than ${maxSeconds} seconds`, 413, 'audio_too_long');
    }
    return sanitize(samples);
}
