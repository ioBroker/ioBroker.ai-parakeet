import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { OnnxWakewordEngine } from '../../src-webcomponents/src/wakeword';

test('bundled ioBroker wake word pipeline loads and processes local audio with WASM', async () => {
    const assetBase = pathToFileURL(`${resolve('admin/webcomponents')}/`).href;
    const engine = new OnnxWakewordEngine();
    try {
        await engine.initialize({ names: ['io_broker'], threshold: 0.5, assetBase,
            getUploadedModel: async () => { throw new Error('unexpected upload'); },
            loadAsset: async name => readFileSync(resolve('admin/webcomponents/models', name)),
        });
        const result = await engine.processAudio(new Float32Array(1280));
        assert.equal(result.detected, false);
        assert.ok(Number.isFinite(result.confidence));
    } finally { await engine.dispose(); }
});
