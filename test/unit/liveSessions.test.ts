import assert from 'node:assert/strict';

import { createCorrector } from '../../src/lib/corrections';
import type { EngineResult } from '../../src/lib/engine';
import { LiveSessions } from '../../src/lib/liveSessions';
import type { JobResult } from '../../src/lib/scheduler';
import { Transcriber, type EngineLike } from '../../src/lib/transcriber';
import { tone } from './helpers';

class FakeEngine implements EngineLike {
    public state: EngineLike['state'] = 'ready';
    public error = '';
    public threads = 2;

    public transcribe(pcm: Float32Array): Promise<EngineResult> {
        return Promise.resolve({ text: `io broker hat ${(pcm.length / 16000).toFixed(1)} sekunden`, inferenceMs: 5 });
    }
}

/** 16-bit PCM as base64, as the admin component sends it */
function pcm16(samples: Float32Array): string {
    const buffer = Buffer.alloc(samples.length * 2);
    samples.forEach((value, i) => buffer.writeInt16LE(Math.round(value * 32767), i * 2));
    return buffer.toString('base64');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Answer = Record<string, any>;

function create(options: { maxClients?: number; otherClients?: number; unavailable?: string } = {}): {
    live: LiveSessions;
    results: JobResult[];
} {
    const results: JobResult[] = [];
    const transcriber = new Transcriber({
        engine: new FakeEngine(),
        corrector: createCorrector([{ replacement: 'ioBroker', variants: 'io broker' }]),
        maxAudioSeconds: 20,
        ffmpegPath: () => '',
        useHints: true,
        unavailable: () => options.unavailable,
        onResult: result => results.push(result),
    });
    const live = new LiveSessions({
        transcriber,
        session: { threshold: 0.008, interval: 1, silence: 0.5 },
        maxClients: options.maxClients ?? 2,
        otherClients: () => options.otherClients ?? 0,
    });
    return { live, results };
}

/** Polls until the session sends `done` or `error` */
async function finish(live: LiveSessions, id: string, events: Answer[]): Promise<Answer[]> {
    for (let i = 0; i < 100 && !events.some(event => event.type === 'done' || event.type === 'error'); i++) {
        await new Promise(resolve => setTimeout(resolve, 10));
        events.push(...(live.handle({ action: 'poll', id }).events as Answer[]));
    }
    return events;
}

describe('LiveSessions', () => {
    let live: LiveSessions | undefined;
    afterEach(() => live?.closeAll());

    it('recognizes the audio of admin with intermediate and final results', async () => {
        const context = create();
        live = context.live;
        const start = live.handle({ action: 'start' });
        assert.equal(typeof start.id, 'string');
        assert.equal(start.sampleRate, 16000);
        assert.deepEqual(start.corrections, { enabled: true, rules: 1 });
        assert.equal(live.size, 1);

        const id = start.id as string;
        const speech = tone(1.2, 16000, 200, 0.3);
        const events: Answer[] = [];
        // in messages of 0.4 s, as the browser batches them
        let seq = 0;
        for (let i = 0; i < speech.length; i += 6400) {
            const answer = live.handle({ action: 'audio', id, seq: ++seq, pcm: pcm16(speech.slice(i, i + 6400)) });
            assert.equal(answer.error, undefined);
            events.push(...(answer.events as Answer[]));
        }
        events.push(...(live.handle({ action: 'stop', id, seq: ++seq }).events as Answer[]));
        await finish(live, id, events);

        const finals = events.filter(event => event.type === 'transcript' && event.final);
        assert.equal(finals.length, 1);
        assert.equal(finals[0].text, 'ioBroker hat 1.2 sekunden');
        assert.equal(finals[0].rawText, 'io broker hat 1.2 sekunden');
        assert.equal(events.at(-1)!.type, 'done');
        assert.equal(context.results.length, 1, 'final results are reported');
        // the session is forgotten after its last events
        assert.equal(live.size, 0);
        assert.match(String(live.handle({ action: 'poll', id }).error), /ended/);
    });

    it('fails on a lost audio message and on invalid audio', async () => {
        live = create().live;
        const lost = live.handle({ action: 'start' }).id as string;
        const answer = live.handle({ action: 'audio', id: lost, seq: 2, pcm: pcm16(tone(0.1, 16000)) });
        assert.match((answer.events as Answer[])[0].message, /lost/);

        const invalid = live.handle({ action: 'start' }).id as string;
        const odd = live.handle({
            action: 'audio',
            id: invalid,
            seq: 1,
            pcm: Buffer.from([1, 2, 3]).toString('base64'),
        });
        assert.equal((odd.events as Answer[])[0].type, 'error');
        assert.equal(live.size, 0);
    });

    it('limits the live tests together with the test page', () => {
        live = create({ maxClients: 2, otherClients: 1 }).live;
        assert.equal(typeof live.handle({ action: 'start' }).id, 'string');
        assert.match(String(live.handle({ action: 'start' }).error), /at the same time/);
    });

    it('does not start while the model is not available', () => {
        live = create({ unavailable: 'The model is being downloaded' }).live;
        assert.equal(live.handle({ action: 'start' }).error, 'The model is being downloaded');
    });

    it('cancels a session and rejects unknown actions', () => {
        live = create().live;
        const id = live.handle({ action: 'start' }).id as string;
        assert.match(String(live.handle({ action: 'nope', id }).error), /Unknown action/);
        assert.deepEqual(live.handle({ action: 'cancel', id }), {});
        assert.equal(live.size, 0);
        assert.match(String(live.handle({ action: 'poll', id }).error), /ended/);
        assert.match(String(live.handle(null).error), /ended/);
    });
});
