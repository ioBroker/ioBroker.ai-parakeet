/** Builds a WAV file: 16-bit PCM (format 1) or 32-bit float (format 3), interleaved channels */
export function makeWav(
    channels: Float32Array[],
    sampleRate: number,
    encoding: 'pcm16' | 'pcm24' | 'float32' | 'pcm16-extensible' = 'pcm16',
): Buffer {
    const bits = encoding === 'float32' ? 32 : encoding === 'pcm24' ? 24 : 16;
    const bytes = bits / 8;
    const frames = channels[0].length;
    const data = Buffer.alloc(frames * channels.length * bytes);
    for (let frame = 0; frame < frames; frame++) {
        for (let channel = 0; channel < channels.length; channel++) {
            const value = channels[channel][frame];
            const offset = (frame * channels.length + channel) * bytes;
            if (encoding === 'float32') {
                data.writeFloatLE(value, offset);
            } else if (encoding === 'pcm24') {
                data.writeIntLE(Math.round(Math.max(-1, Math.min(1, value)) * 8388607), offset, 3);
            } else {
                data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), offset);
            }
        }
    }
    const extensible = encoding === 'pcm16-extensible';
    const fmt = Buffer.alloc(extensible ? 40 : 16);
    fmt.writeUInt16LE(extensible ? 0xfffe : encoding === 'float32' ? 3 : 1, 0);
    fmt.writeUInt16LE(channels.length, 2);
    fmt.writeUInt32LE(sampleRate, 4);
    fmt.writeUInt32LE(sampleRate * channels.length * bytes, 8);
    fmt.writeUInt16LE(channels.length * bytes, 12);
    fmt.writeUInt16LE(bits, 14);
    if (extensible) {
        fmt.writeUInt16LE(22, 16);
        fmt.writeUInt16LE(bits, 18);
        fmt.writeUInt32LE(0, 20);
        // KSDATAFORMAT_SUBTYPE_PCM
        Buffer.from('0100000000001000800000aa00389b71', 'hex').copy(fmt, 24);
    }
    const header = Buffer.alloc(12);
    header.write('RIFF', 0);
    header.writeUInt32LE(4 + 8 + fmt.length + 8 + data.length, 4);
    header.write('WAVE', 8);
    const fmtHeader = Buffer.alloc(8);
    fmtHeader.write('fmt ', 0);
    fmtHeader.writeUInt32LE(fmt.length, 4);
    const dataHeader = Buffer.alloc(8);
    dataHeader.write('data', 0);
    dataHeader.writeUInt32LE(data.length, 4);
    return Buffer.concat([header, fmtHeader, fmt, dataHeader, data]);
}

/** A sine tone */
export function tone(seconds: number, sampleRate: number, frequency = 440, amplitude = 0.5): Float32Array {
    const samples = new Float32Array(Math.round(seconds * sampleRate));
    for (let i = 0; i < samples.length; i++) {
        samples[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
    }
    return samples;
}

export const silentLog = {
    debug: (): void => {},
    info: (): void => {},
    warn: (): void => {},
    error: (): void => {},
};
