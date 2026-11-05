import assert from 'node:assert/strict';
import { join } from 'node:path';

import WebSocket from 'ws';

import { ApiServer } from '../../src/lib/apiServer';
import { createCorrector } from '../../src/lib/corrections';
import type { EngineResult } from '../../src/lib/engine';
import type { JobResult } from '../../src/lib/scheduler';
import { Transcriber, type EngineLike } from '../../src/lib/transcriber';
import { makeWav, silentLog, tone } from './helpers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = (response: Response): Promise<any> => response.json();

class FakeEngine implements EngineLike {
    public state: EngineLike['state'] = 'ready';
    public error = '';
    public threads = 2;
    public calls: { samples: number; segments: boolean }[] = [];

    public transcribe(pcm: Float32Array, segments = false): Promise<EngineResult> {
        this.calls.push({ samples: pcm.length, segments });
        const seconds = pcm.length / 16000;
        return Promise.resolve({
            text: `io broker hat ${seconds.toFixed(1)} sekunden gehört`,
            segments: segments ? [{ text: 'io broker hat', start: 0.1, end: seconds }] : undefined,
            inferenceMs: 5,
        });
    }
}

async function startServer(
    apiKey = '',
    unavailable: () => string | undefined = () => undefined,
): Promise<{ server: ApiServer; engine: FakeEngine; base: string; results: JobResult[] }> {
    const engine = new FakeEngine();
    const results: JobResult[] = [];
    const transcriber = new Transcriber({
        engine,
        corrector: createCorrector([{ replacement: 'ioBroker', variants: 'io broker' }]),
        maxAudioSeconds: 20,
        ffmpegPath: '',
        useHints: true,
        unavailable,
        onResult: result => results.push(result),
    });
    const server = new ApiServer({
        bind: '127.0.0.1',
        port: 0,
        apiKey,
        testPage: true,
        publicDir: join(__dirname, '..', '..', 'public'),
        maxClients: 2,
        session: { threshold: 0.008, interval: 1, silence: 0.5 },
        transcriber,
        health: () => ({ ready: true, status: 'ready', threads: 2 }),
        log: silentLog,
    });
    await server.start();
    return { server, engine, base: `http://127.0.0.1:${server.address}`, results };
}

function form(file: Buffer, fields: Record<string, string> = {}): FormData {
    const data = new FormData();
    data.append('file', new Blob([file], { type: 'audio/wav' }), 'audio.wav');
    for (const [key, value] of Object.entries(fields)) {
        data.append(key, value);
    }
    return data;
}

describe('ApiServer', () => {
    let context: Awaited<ReturnType<typeof startServer>>;
    afterEach(async () => {
        await context?.server.stop();
    });

    it('answers /health and /v1/models', async () => {
        context = await startServer();
        const health = await json(await fetch(`${context.base}/health`));
        assert.equal(health.ready, true);
        assert.equal(health.auth, false);
        assert.equal(health.corrections.rules, 1);
        const models = await json(await fetch(`${context.base}/v1/models`));
        assert.equal(models.data[0].id, 'parakeet-tdt-0.6b-v3');
    });

    it('transcribes a WAV like the OpenAI API, with corrections', async () => {
        context = await startServer();
        const wav = makeWav([tone(2, 48000)], 48000);
        const response = await fetch(`${context.base}/v1/audio/transcriptions`, {
            method: 'POST',
            body: form(wav, { model: 'whisper-1', language: 'de' }),
        });
        assert.equal(response.status, 200);
        assert.deepEqual(await json(response), { text: 'ioBroker hat 2.0 sekunden gehört' });
        assert.equal(context.engine.calls[0].samples, 32000);
        assert.equal(context.results[0].rawText, 'io broker hat 2.0 sekunden gehört');
    });

    it('supports response_format, prompt and raw audio bodies', async () => {
        context = await startServer();
        const wav = makeWav([tone(1, 16000)], 16000);
        const srt = await fetch(`${context.base}/v1/audio/transcriptions`, {
            method: 'POST',
            body: form(wav, { response_format: 'srt', prompt: 'Sekunden, Gehört' }),
        });
        assert.equal(await srt.text(), '1\n00:00:00,100 --> 00:00:01,000\nioBroker hat\n');
        assert.equal(context.engine.calls[0].segments, true);

        const text = await fetch(`${context.base}/v1/audio/transcriptions?response_format=text&prompt=Sekunden`, {
            method: 'POST',
            headers: { 'Content-Type': 'audio/wav' },
            body: wav,
        });
        assert.equal(await text.text(), 'ioBroker hat 1.0 Sekunden gehört');
    });

    it('returns OpenAI errors', async () => {
        context = await startServer();
        const mp3 = await fetch(`${context.base}/v1/audio/transcriptions`, {
            method: 'POST',
            body: form(Buffer.from('ID3 something')),
        });
        assert.equal(mp3.status, 415);
        assert.equal((await json(mp3)).error.code, 'unsupported_format');

        const long = await fetch(`${context.base}/v1/audio/transcriptions`, {
            method: 'POST',
            body: form(makeWav([tone(25, 16000)], 16000)),
        });
        assert.equal(long.status, 413);

        const noFile = new FormData();
        noFile.append('model', 'x');
        const missing = await fetch(`${context.base}/v1/audio/transcriptions`, { method: 'POST', body: noFile });
        assert.equal(missing.status, 400);

        const format = await fetch(`${context.base}/v1/audio/transcriptions`, {
            method: 'POST',
            body: form(makeWav([tone(1, 16000)], 16000), { response_format: 'xml' }),
        });
        assert.equal(format.status, 400);
        assert.equal((await fetch(`${context.base}/v1/nothing`)).status, 404);
    });

    it('answers 503 while the model is not available', async () => {
        context = await startServer('', () => 'The model is being downloaded (42 %)');
        const response = await fetch(`${context.base}/v1/audio/transcriptions`, {
            method: 'POST',
            body: form(makeWav([tone(1, 16000)], 16000)),
        });
        assert.equal(response.status, 503);
        assert.match((await json(response)).error.message, /42 %/);
    });

    it('checks the API key', async () => {
        context = await startServer('secret-key');
        assert.equal((await fetch(`${context.base}/v1/models`)).status, 401);
        assert.equal(
            (await fetch(`${context.base}/v1/models`, { headers: { Authorization: 'Bearer wrong' } })).status,
            401,
        );
        assert.equal(
            (await fetch(`${context.base}/v1/models`, { headers: { Authorization: 'Bearer secret-key' } })).status,
            200,
        );
        // health needs no key, but tells that one is needed
        assert.equal((await json(await fetch(`${context.base}/health`))).auth, true);
    });

    it('serves the test page with a content security policy', async () => {
        context = await startServer();
        const page = await fetch(`${context.base}/`);
        assert.equal(page.status, 200);
        assert.match(page.headers.get('content-security-policy') || '', /default-src 'self'/);
        assert.match(await page.text(), /app\.js/);
        assert.equal((await fetch(`${context.base}/../io-package.json`)).status, 404);
    });

    it('streams microphone audio over the WebSocket', async () => {
        context = await startServer('stream-key');
        const socket = new WebSocket(`${context.base.replace('http', 'ws')}/audio`, { origin: context.base });
        const messages: { type: string; final?: boolean; text?: string; rawText?: string }[] = [];
        const done = new Promise<void>((resolve, reject) => {
            socket.on('message', raw => {
                const message = JSON.parse(raw.toString());
                messages.push(message);
                if (message.type === 'done') {
                    resolve();
                } else if (message.type === 'error') {
                    reject(new Error(message.message));
                }
            });
            socket.on('error', reject);
        });
        await new Promise(resolve => socket.once('open', resolve));
        socket.send(JSON.stringify({ type: 'hello', key: 'stream-key' }));
        await new Promise(resolve => setTimeout(resolve, 50));
        assert.equal(messages[0].type, 'ready');
        const speech = tone(1.2, 16000, 200, 0.3);
        for (let i = 0; i < speech.length; i += 1600) {
            socket.send(Buffer.from(speech.slice(i, i + 1600).buffer));
        }
        socket.send(JSON.stringify({ type: 'stop' }));
        await done;
        const finals = messages.filter(message => message.type === 'transcript' && message.final);
        assert.equal(finals.length, 1);
        assert.equal(finals[0].text, 'ioBroker hat 1.2 sekunden gehört');
        assert.equal(context.results.length, 1, 'final results are reported');
    });

    it('rejects WebSocket clients with a wrong key or another origin', async () => {
        context = await startServer('stream-key');
        const wrong = new WebSocket(`${context.base.replace('http', 'ws')}/audio`, { origin: context.base });
        await new Promise(resolve => wrong.once('open', resolve));
        wrong.send(JSON.stringify({ type: 'hello', key: 'nope' }));
        const code = await new Promise(resolve => wrong.once('close', resolve));
        assert.equal(code, 4401);

        const foreign = new WebSocket(`${context.base.replace('http', 'ws')}/audio`, { origin: 'http://evil.example' });
        await assert.rejects(
            new Promise((resolve, reject) => {
                foreign.once('open', resolve);
                foreign.once('error', reject);
            }),
        );
    });
});
