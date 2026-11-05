import assert from 'node:assert/strict';

import { decodeAudio, decodeWav, pcm16ToFloat, RequestError, resample, SAMPLE_RATE } from '../../src/lib/audio';
import { makeWav, tone } from './helpers';

describe('audio', () => {
    it('reads 16-bit mono WAV', () => {
        const input = tone(0.5, 16000);
        const wav = decodeWav(makeWav([input], 16000));
        assert.equal(wav.sampleRate, 16000);
        assert.equal(wav.samples.length, input.length);
        assert.ok(Math.abs(wav.samples[100] - input[100]) < 1e-3);
    });

    it('mixes stereo to mono', () => {
        const left = new Float32Array(100).fill(0.5);
        const right = new Float32Array(100).fill(-0.1);
        const wav = decodeWav(makeWav([left, right], 22050));
        assert.equal(wav.samples.length, 100);
        assert.ok(Math.abs(wav.samples[0] - 0.2) < 1e-3);
    });

    it('reads float, 24-bit and WAVE_FORMAT_EXTENSIBLE', () => {
        const input = tone(0.1, 16000, 300, 0.7);
        for (const encoding of ['float32', 'pcm24', 'pcm16-extensible'] as const) {
            const wav = decodeWav(makeWav([input], 16000, encoding));
            assert.equal(wav.samples.length, input.length, encoding);
            assert.ok(Math.abs(wav.samples[37] - input[37]) < 1e-3, encoding);
        }
    });

    it('takes the rest of the file if the data size is 0 (streamed WAV)', () => {
        const file = makeWav([new Float32Array(50).fill(0.25)], 16000);
        file.writeUInt32LE(0, 40);
        assert.equal(decodeWav(file).samples.length, 50);
    });

    it('rejects broken files', () => {
        assert.throws(() => decodeWav(Buffer.from('RIFF....WAVEjunk')), RequestError);
        assert.throws(() => decodeWav(Buffer.from('hello')), RequestError);
    });

    it('resamples to 16 kHz and keeps the level', () => {
        const down = resample(new Float32Array(48000).fill(0.5), 48000);
        assert.equal(down.length, 16000);
        assert.ok(Math.abs(down[1234] - 0.5) < 1e-6);
        const up = resample(new Float32Array(8000).fill(-0.25), 8000);
        assert.equal(up.length, 16000);
        assert.ok(Math.abs(up[5000] + 0.25) < 1e-6);
        const odd = resample(tone(1, 44100), 44100);
        assert.equal(odd.length, 16000);
    });

    it('converts 16-bit PCM', () => {
        const buffer = Buffer.alloc(4);
        buffer.writeInt16LE(16384, 0);
        buffer.writeInt16LE(-32768, 2);
        assert.deepEqual([...pcm16ToFloat(buffer)], [0.5, -1]);
    });

    it('decodes uploads: WAV directly, other formats only with ffmpeg', async () => {
        const pcm = await decodeAudio(makeWav([tone(1, 48000)], 48000), '', 10);
        assert.equal(pcm.length, SAMPLE_RATE);
        await assert.rejects(decodeAudio(Buffer.from('ID3 not a wav'), '', 10), (error: RequestError) => {
            assert.equal(error.status, 415);
            return true;
        });
        await assert.rejects(
            decodeAudio(Buffer.from('OggS not a wav'), 'ffmpeg-that-does-not-exist-xyz', 10),
            (error: RequestError) => {
                assert.equal(error.status, 415);
                assert.match(error.message, /not found/);
                return true;
            },
        );
    });

    it('rejects too long audio with 413', async () => {
        await assert.rejects(decodeAudio(makeWav([tone(3, 16000)], 16000), '', 2), (error: RequestError) => {
            assert.equal(error.status, 413);
            return true;
        });
    });
});
