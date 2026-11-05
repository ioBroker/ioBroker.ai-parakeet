import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { autoThreads, Engine, type EngineState } from '../../src/lib/engine';
import { silentLog } from './helpers';

/** A fake inference process: "loads" in 20 ms, answers with the number of samples, crashes on 13 samples */
const FAKE_SCRIPT = `
process.on('message', message => {
    if (message.type === 'load') {
        if (message.modelDir === 'broken') {
            process.send({ type: 'fatal', message: 'no model' });
            process.exit(1);
        }
        setTimeout(() => process.send({ type: 'ready', loadMs: 20 }), 20);
    } else if (message.type === 'transcribe') {
        if (message.pcm.length === 13) process.exit(3);
        if (message.pcm.length === 7) return; // hangs
        const isFloat = message.pcm instanceof Float32Array;
        process.send({ type: 'result', id: message.id, text: 'n=' + message.pcm.length + ' float=' + isFloat + ' threads=' + message.threads, inferenceMs: 1 });
    } else if (message.type === 'close') {
        process.exit(0);
    }
});
process.on('disconnect', () => process.exit(0));
`;

describe('Engine', () => {
    let dir: string;
    let script: string;
    const engines: Engine[] = [];

    before(async () => {
        dir = await mkdtemp(join(tmpdir(), 'parakeet-engine-'));
        script = join(dir, 'fake-inference.js');
        await writeFile(script, FAKE_SCRIPT);
    });
    afterEach(async () => {
        await Promise.all(engines.splice(0).map(engine => engine.stop()));
    });
    after(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    function create(options: Partial<ConstructorParameters<typeof Engine>[0]> = {}): {
        engine: Engine;
        states: EngineState[];
    } {
        const states: EngineState[] = [];
        const engine = new Engine({
            modelDir: 'model',
            threads: 2,
            memoryCheck: false,
            unloadAfterMs: 0,
            log: silentLog,
            script,
            onState: state => states.push(state),
            ...options,
        });
        engines.push(engine);
        return { engine, states };
    }

    it('chooses at most 4 threads and leaves one core free', () => {
        assert.equal(autoThreads(1), 1);
        assert.equal(autoThreads(4), 3);
        assert.equal(autoThreads(32), 4);
    });

    it('loads on the first request and sends the audio as Float32Array', async () => {
        const { engine, states } = create();
        const result = await engine.transcribe(new Float32Array(1600));
        assert.match(result.text, /^n=1600 float=true/);
        assert.deepEqual(states, ['loading', 'ready']);
        await engine.stop();
        assert.equal(engine.state, 'stopped');
    });

    it('reports a model that cannot be loaded and waits before the next try', async () => {
        const { engine } = create({ modelDir: 'broken' });
        await assert.rejects(engine.start(), /no model/);
        assert.equal(engine.state, 'error');
        await assert.rejects(engine.transcribe(new Float32Array(10)), /no model/);
    });

    it('rejects the running request if the process crashes', async () => {
        const { engine } = create();
        await engine.start();
        await assert.rejects(engine.transcribe(new Float32Array(13)), /ended \(exit code 3\)/);
        assert.equal(engine.state, 'error');
    });

    it('unloads after the idle time', async () => {
        const { engine, states } = create({ unloadAfterMs: 100 });
        await engine.transcribe(new Float32Array(5));
        await new Promise(resolve => setTimeout(resolve, 300));
        assert.equal(engine.state, 'stopped');
        await engine.transcribe(new Float32Array(5));
        assert.deepEqual(states.slice(0, 4), ['loading', 'ready', 'stopped', 'loading']);
    });

    it('starts with the memory check on a host with enough free memory', async () => {
        const { engine } = create({ memoryCheck: true });
        await engine.start();
        assert.equal(engine.state, 'ready');
    });
});
