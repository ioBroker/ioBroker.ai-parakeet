import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AudioRingBuffer, pcmBase64, VoiceActivityDetector } from '../../src-webcomponents/src/audio';

test('PCM encoding uses signed 16-bit little endian values', () => {
    const bytes = Buffer.from(pcmBase64(new Float32Array([-1, 0, 1])), 'base64');
    assert.deepEqual([...bytes], [0, 128, 0, 0, 255, 127]);
});

test('ring buffer retains exactly the newest samples across chunk boundaries', () => {
    const ring = new AudioRingBuffer(5);
    ring.push(new Float32Array([1, 2, 3]));
    ring.push(new Float32Array([4, 5, 6]));
    assert.deepEqual([...ring.snapshot()], [2, 3, 4, 5, 6]);
    ring.clear();
    assert.equal(ring.snapshot().length, 0);
});

test('VAD waits for speech, then the configured trailing silence', () => {
    const vad = new VoiceActivityDetector({ threshold: 0.1, minSpeechMs: 160, silenceMs: 240, maxRecordMs: 2000, noSpeechMs: 500 });
    const voice = new Float32Array(1280).fill(0.3);
    const quiet = new Float32Array(1280);
    assert.equal(vad.push(voice), 'continue');
    assert.equal(vad.push(voice), 'continue');
    assert.equal(vad.push(quiet), 'continue');
    assert.equal(vad.push(quiet), 'continue');
    assert.equal(vad.push(quiet), 'done');
});

test('VAD ends an activation with no speech', () => {
    const vad = new VoiceActivityDetector({ threshold: 0.1, minSpeechMs: 160, silenceMs: 240, maxRecordMs: 2000, noSpeechMs: 160 });
    assert.equal(vad.push(new Float32Array(1280)), 'continue');
    assert.equal(vad.push(new Float32Array(1280)), 'no-speech');
});
