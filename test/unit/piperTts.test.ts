import { strict as assert } from 'node:assert';
import { describe, it } from 'mocha';
import { inspectPiperWav, PIPER_VOICES, PiperTts, parseSynthesizeRequest, piperBinaryAsset } from '../../src/lib/piperTts';

describe('Piper sendTo contract', () => {
    it('offers built-in and downloadable voices with unique IDs', () => {
        assert.equal(PIPER_VOICES.filter(voice => voice.standard).length, 3);
        assert.equal(PIPER_VOICES.filter(voice => !voice.standard).length, 2);
        assert.equal(new Set(PIPER_VOICES.map(voice => voice.id)).size, PIPER_VOICES.length);
        const service = new PiperTts('unused');
        assert.deepEqual(service.listVoices().map(voice => voice.value), PIPER_VOICES.map(voice => voice.id));
    });

    it('normalizes text and accepts synthesis parameters', () => {
        assert.deepEqual(parseSynthesizeRequest({ text: ' Guten  Tag\n', voice: 'de_DE-thorsten-low',
            speaker: 0, lengthScale: 1.2 }, 'en_US-kristin-medium'), {
            text: 'Guten Tag', voice: 'de_DE-thorsten-low', format: 'wav', speaker: 0,
            lengthScale: 1.2, noiseScale: undefined, noiseW: undefined,
        });
    });

    it('rejects unsupported voices, oversized text and unsafe parameters', () => {
        assert.throws(() => parseSynthesizeRequest({ text: 'Hi', voice: '../other' }, 'de_DE-thorsten-low'));
        assert.throws(() => parseSynthesizeRequest({ text: 'a'.repeat(1001) }, 'de_DE-thorsten-low'));
        assert.throws(() => parseSynthesizeRequest({ text: 'Hi', speaker: -1 }, 'de_DE-thorsten-low'));
        assert.throws(() => parseSynthesizeRequest({ text: 'Hi', format: 'mp3' }, 'de_DE-thorsten-low'));
    });

    it('has a pinned runtime for the supported operating systems', () => {
        for (const [platform, arch] of [['win32', 'x64'], ['linux', 'x64'], ['linux', 'arm64'],
            ['darwin', 'x64'], ['darwin', 'arm64']]) {
            assert.match(piperBinaryAsset(platform, arch)?.sha256 || '', /^[a-f0-9]{64}$/);
        }
        assert.equal(piperBinaryAsset('freebsd', 'x64'), null);
    });

    it('rejects WAV data changed after its RIFF header was written', () => {
        const wav = Buffer.alloc(48);
        wav.write('RIFF', 0);
        wav.writeUInt32LE(40, 4);
        wav.write('WAVEfmt ', 8);
        wav.writeUInt32LE(16, 16);
        wav.writeUInt16LE(1, 20);
        wav.writeUInt16LE(1, 22);
        wav.writeUInt32LE(16000, 24);
        wav.writeUInt32LE(32000, 28);
        wav.writeUInt16LE(2, 32);
        wav.writeUInt16LE(16, 34);
        wav.write('data', 36);
        wav.writeUInt32LE(4, 40);
        assert.deepEqual(inspectPiperWav(wav, 16000), { sampleRate: 16000, durationMs: 0 });
        assert.throws(() => inspectPiperWav(Buffer.concat([wav, Buffer.from([13])]), 16000),
            /invalid WAV audio/);
    });
});
