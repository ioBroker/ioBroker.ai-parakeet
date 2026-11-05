import assert from 'node:assert/strict';

import { AudioSession } from '../../src/lib/audioSession';
import { Scheduler, type Job, type JobResult, type Owner } from '../../src/lib/scheduler';

const frame = (value = 0.1): Float32Array => new Float32Array(1600).fill(value);
const tick = (): Promise<void> => new Promise(resolve => setImmediate(resolve));

function owner(id: string, streaming = false): Owner & { results: JobResult[]; errors: Error[] } {
    const results: JobResult[] = [];
    const errors: Error[] = [];
    return {
        id,
        streaming,
        results,
        errors,
        result: result => results.push(result),
        fail: error => errors.push(error),
    };
}

describe('AudioSession', () => {
    it('emits intermediate results and ends the sentence after silence', () => {
        const jobs: { segment: number; final: boolean; pcm: Float32Array }[] = [];
        const session = new AudioSession(job => jobs.push(job));
        for (let i = 0; i < 15; i++) {
            session.push(frame());
        }
        assert.equal(jobs.length, 1);
        assert.equal(jobs[0].final, false);
        for (let i = 0; i < 8; i++) {
            session.push(frame(0));
        }
        assert.equal(jobs.at(-1)!.final, true);
        assert.equal(jobs.at(-1)!.segment, 1);
        session.flush();
        assert.equal(jobs.length, 2);
        session.push(frame());
        session.flush();
        assert.equal(jobs.at(-1)!.segment, 2);
    });

    it('keeps 0.3 s before the speech and ignores silence', () => {
        const jobs: { final: boolean; pcm: Float32Array }[] = [];
        const session = new AudioSession(job => jobs.push(job));
        for (let i = 0; i < 100; i++) {
            session.push(frame(0));
        }
        assert.equal(jobs.length, 0);
        assert.ok(session.preRollSamples <= 16000 * 0.3);
        session.push(frame());
        session.flush();
        assert.equal(jobs.length, 1);
        assert.ok(jobs[0].pcm.length > 1600);
    });

    it('cuts long speech', () => {
        const jobs: { final: boolean }[] = [];
        const session = new AudioSession(job => jobs.push(job), { maxSeconds: 12 });
        for (let i = 0; i < 130; i++) {
            session.push(frame());
        }
        assert.ok(jobs.some(job => job.final));
    });

    it('rejects invalid samples', () => {
        const session = new AudioSession(() => {});
        assert.throws(() => session.push(new Float32Array(10).fill(NaN)));
        assert.throws(() => session.push(new Float32Array(9000)));
    });
});

describe('Scheduler', () => {
    it('runs final jobs first and replaces waiting intermediate results', async () => {
        const order: string[] = [];
        let release: () => void = () => {};
        const scheduler = new Scheduler(async job => {
            order.push(`${job.segment}:${job.final}:${job.pcm.length}`);
            if (order.length === 1) {
                await new Promise<void>(resolve => (release = resolve));
            }
            return { text: 'x', rawText: 'x', inferenceMs: 1 };
        }, 600);
        const stream = owner('stream', true);
        const request = owner('request');
        const job = (segment: number, final: boolean, length: number): Job => ({
            segment,
            final,
            pcm: new Float32Array(length),
        });
        scheduler.enqueue(stream, job(1, false, 100));
        await tick();
        scheduler.enqueue(stream, job(1, false, 200));
        scheduler.enqueue(stream, job(1, false, 300));
        scheduler.enqueue(request, job(0, true, 50));
        release();
        await new Promise(resolve => setTimeout(resolve, 10));
        assert.deepEqual(order, ['1:false:100', '0:true:50', '1:false:300']);
        assert.equal(stream.results.length, 2);
        assert.equal(request.results[0].audioSeconds, 50 / 16000);
    });

    it('limits the queue of a stream to 45 s and of all to the maximum', async () => {
        const scheduler = new Scheduler(() => new Promise(() => {}), 60);
        const stream = owner('stream', true);
        scheduler.enqueue(stream, { segment: 1, final: true, pcm: new Float32Array(16000) });
        await tick();
        scheduler.enqueue(stream, { segment: 2, final: true, pcm: new Float32Array(40 * 16000) });
        assert.throws(
            () => scheduler.enqueue(stream, { segment: 3, final: true, pcm: new Float32Array(10 * 16000) }),
            /cannot keep up/,
        );
        const request = owner('request');
        assert.throws(
            () => scheduler.enqueue(request, { segment: 0, final: true, pcm: new Float32Array(30 * 16000) }),
            /busy/,
        );
    });

    it('cancels waiting jobs of an owner and fails all on stop', async () => {
        const scheduler = new Scheduler(() => new Promise(() => {}), 600);
        const a = owner('a');
        const b = owner('b');
        scheduler.enqueue(a, { segment: 0, final: true, pcm: new Float32Array(10) });
        await tick();
        scheduler.enqueue(a, { segment: 1, final: true, pcm: new Float32Array(10) });
        scheduler.enqueue(b, { segment: 0, final: true, pcm: new Float32Array(10) });
        assert.equal(scheduler.queued, 2);
        scheduler.cancel(a, new Error('client gone'));
        assert.equal(scheduler.queued, 1);
        assert.equal(a.errors[0].message, 'client gone', 'the waiting job of a is failed, not forgotten');
        assert.ok(scheduler.has(a), 'the running job still belongs to a');
        scheduler.cancelAll(new Error('stop'));
        assert.equal(b.errors[0].message, 'stop');
    });

    it('submit resolves with the result', async () => {
        const scheduler = new Scheduler(async job => ({ text: `n=${job.pcm.length}`, rawText: '', inferenceMs: 2 }), 600);
        const result = await scheduler.submit({ pcm: new Float32Array(32000) });
        assert.equal(result.text, 'n=32000');
        assert.equal(result.audioSeconds, 2);
        assert.equal(result.final, true);
    });
});
