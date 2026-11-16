import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ParakeetClient } from '../../src-webcomponents/src/parakeet';

Object.assign(globalThis, { window: globalThis });

test('live client serializes audio and stop with consecutive sequence numbers', async () => {
    const sent: Record<string, unknown>[] = [];
    const events: string[] = [];
    const client = new ParakeetClient(async request => {
        sent.push(request);
        if (request.action === 'start') return { id: 'session', sampleRate: 16000 };
        if (request.action === 'stop') return { events: [{ type: 'done' }] };
        return { events: [] };
    }, event => events.push(event.type), error => { throw error; });
    await client.start();
    client.push(new Float32Array(1280));
    client.stop();
    await new Promise(resolve => setTimeout(resolve, 450));
    assert.deepEqual(sent.filter(x => x.action === 'audio' || x.action === 'stop').map(x => [x.action, x.seq]), [
        ['audio', 1], ['stop', 2],
    ]);
    assert.deepEqual(events, ['done']);
});

test('live client does not send audio before a session is started', async () => {
    const sent: Record<string, unknown>[] = [];
    const client = new ParakeetClient(async request => { sent.push(request); return { id: 'session', sampleRate: 16000 }; }, () => {}, () => {});
    client.push(new Float32Array(1280));
    assert.equal(sent.length, 0);
    await client.start();
    await client.cancel();
    assert.equal(sent.some(x => x.action === 'audio'), false);
});

test('live client reports an unreachable adapter before recording begins', async () => {
    const client = new ParakeetClient(async () => ({ error: 'notReady' }), () => {}, () => {});
    await assert.rejects(client.start(), /notReady/);
    client.push(new Float32Array(1280));
    await client.cancel();
});
