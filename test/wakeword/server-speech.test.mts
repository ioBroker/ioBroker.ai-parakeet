import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ServerSpeechOutput } from '../../src-webcomponents/src/serverSpeech';
import type { SocketLike } from '../../src-webcomponents/src/service';

test('server speech requests WAV and releases playback resources', async () => {
    const created: string[] = [];
    const revoked: string[] = [];
    const activities: boolean[] = [];
    let audio: { onended: (() => void) | null; onerror: (() => void) | null; pause(): void; play(): Promise<void> } | undefined;
    class FakeAudio {
        onended: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(_url: string) { audio = this; }
        pause() {}
        async play() {}
    }
    Object.assign(globalThis, { Audio: FakeAudio, atob: (value: string) => Buffer.from(value, 'base64').toString('binary') });
    Object.assign(URL, { createObjectURL: () => { created.push('blob:audio'); return 'blob:audio'; },
        revokeObjectURL: (url: string) => revoked.push(url) });
    const calls: Array<{ instance: string; command: string; message: Record<string, unknown> }> = [];
    const socket = { sendTo: async (instance: string, command: string, message: Record<string, unknown>) => {
        calls.push({ instance, command, message });
        return { audio: Buffer.from('RIFF----WAVEaudio').toString('base64'), mimeType: 'audio/wav' };
    }, setState: async () => undefined } as SocketLike;
    const speech = new ServerSpeechOutput();
    const failures: string[] = [];
    assert.equal(await speech.speak(socket, 'voice.0', 'Hallo', 'de_DE-thorsten-low',
        value => activities.push(value), reason => failures.push(reason)), 'spoken');
    assert.deepEqual(calls, [{ instance: 'voice.0', command: 'synthesize',
        message: { text: 'Hallo', voice: 'de_DE-thorsten-low' } }]);
    assert.deepEqual(activities, [true]);
    audio?.onended?.();
    assert.deepEqual(activities, [true, false]);
    assert.deepEqual(revoked, created);
    assert.deepEqual(failures, []);
});

test('server speech cancels an outstanding synthesis response', async () => {
    let finish: ((value: { audio: string; mimeType: string }) => void) | undefined;
    const socket: SocketLike = { sendTo: <T,>() => new Promise<T | undefined>(resolve => {
        finish = value => resolve(value as T);
    }), setState: async () => undefined };
    const speech = new ServerSpeechOutput();
    const activities: boolean[] = [];
    const pending = speech.speak(socket, 'voice.0', 'Hallo', '', value => activities.push(value), () => {});
    speech.cancel();
    finish?.({ audio: '', mimeType: 'audio/wav' });
    assert.equal(await pending, 'cancelled');
    assert.deepEqual(activities, [true, false]);
});
