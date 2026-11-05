import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { checkModel, downloadModel, MODEL, verifyModel, type ModelSpec } from '../../src/lib/modelFiles';
import { silentLog } from './helpers';

const content = {
    'a.onnx': Buffer.alloc(300_000, 7),
    'vocab.txt': Buffer.from('<blk> 0\nhallo 1\n'),
};
const sha = (data: Buffer): string => createHash('sha256').update(data).digest('hex');
const spec: ModelSpec = {
    repository: 'test/model',
    revision: 'abc',
    files: Object.entries(content).map(([name, data]) => ({ name, size: data.length, sha256: sha(data) })),
};

describe('model files', () => {
    let dir: string;
    let server: Server;
    let base: string;
    const requests: { path: string; range?: string }[] = [];
    /** Requests that are broken off after 100000 bytes */
    let breakNext = 0;

    before(async () => {
        server = createServer((request, response) => {
            requests.push({ path: request.url || '', range: request.headers.range });
            const name = (request.url || '').split('/').pop() as keyof typeof content;
            const data = content[name];
            if (!data || !request.url?.startsWith('/test/model/resolve/abc/')) {
                response.writeHead(404).end();
                return;
            }
            const start = Number(/bytes=(\d+)-/.exec(request.headers.range || '')?.[1] || 0);
            const body = data.subarray(start);
            response.writeHead(start ? 206 : 200, { 'Content-Length': body.length });
            if (breakNext > 0 && body.length > 100_000) {
                breakNext--;
                response.write(body.subarray(0, 100_000), () => setTimeout(() => response.destroy(), 20));
                return;
            }
            response.end(body);
        });
        await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
        const address = server.address();
        base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
    });
    beforeEach(async () => {
        dir = await mkdtemp(join(tmpdir(), 'parakeet-model-'));
        requests.length = 0;
        breakNext = 0;
    });
    afterEach(async () => {
        await rm(dir, { recursive: true, force: true });
    });
    after(() => {
        server.close();
    });

    it('pins the revision and checksums of the real model', () => {
        assert.match(MODEL.revision, /^[0-9a-f]{40}$/);
        assert.equal(MODEL.files.length, 3);
        for (const file of MODEL.files) {
            assert.match(file.sha256, /^[0-9a-f]{64}$/);
        }
    });

    it('downloads, verifies and writes the manifest', async () => {
        assert.equal(await checkModel(dir, spec), 'missing');
        const progress: number[] = [];
        await downloadModel(dir, {
            baseUrl: `${base}/`,
            log: silentLog,
            model: spec,
            onProgress: p => progress.push(p.percent),
        });
        assert.deepEqual(await readFile(join(dir, 'a.onnx')), content['a.onnx']);
        assert.equal(await checkModel(dir, spec), 'ok');
        assert.equal(progress.at(-1), 100);
        const manifest = JSON.parse(await readFile(join(dir, 'model.json'), 'utf8'));
        assert.equal(manifest.revision, 'abc');
    });

    it('continues a broken download with a Range request', async () => {
        breakNext = 1;
        await downloadModel(dir, { baseUrl: base, log: silentLog, model: spec, retryDelayMs: () => 10 });
        assert.deepEqual(await readFile(join(dir, 'a.onnx')), content['a.onnx']);
        const ranges = requests.filter(request => request.path.endsWith('a.onnx')).map(request => request.range);
        assert.deepEqual(ranges, [undefined, 'bytes=100000-']);
    });

    it('accepts files without manifest after checking the checksums', async () => {
        for (const [name, data] of Object.entries(content)) {
            await writeFile(join(dir, name), data);
        }
        assert.equal(await checkModel(dir, spec), 'unverified');
        await verifyModel(dir, undefined, spec);
        assert.equal(await checkModel(dir, spec), 'ok');
    });

    it('rejects a broken file', async () => {
        await writeFile(join(dir, 'a.onnx'), Buffer.alloc(300_000, 8));
        await writeFile(join(dir, 'vocab.txt'), content['vocab.txt']);
        await assert.rejects(verifyModel(dir, undefined, spec), /a\.onnx is broken/);
    });

    it('gives up after the attempts and can be aborted', async () => {
        const controller = new AbortController();
        const missing: ModelSpec = { ...spec, files: [{ name: 'nothing.onnx', size: 10, sha256: 'x' }] };
        setTimeout(() => controller.abort(new Error('stopped')), 100);
        await assert.rejects(
            downloadModel(dir, {
                baseUrl: base,
                log: silentLog,
                model: missing,
                signal: controller.signal,
                retryDelayMs: () => 30,
            }),
        );
    });
});
