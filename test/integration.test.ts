import assert from 'node:assert';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { tests } from '@iobroker/testing';

const PORT = 19999;

async function waitFor<T>(check: () => Promise<T | undefined | null | false>, timeoutMs: number): Promise<T> {
    const end = Date.now() + timeoutMs;
    for (;;) {
        const result = await check();
        if (result) {
            return result;
        }
        if (Date.now() > end) {
            throw new Error(`Timeout after ${timeoutMs} ms`);
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

// Runs the adapter in a temporary ioBroker installation. The model (670 MB) is not downloaded:
// the adapter must start, report the missing model and answer requests with an error.
tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        suite('without model', getHarness => {
            it('starts the server and reports the missing model', async function () {
                this.timeout(60_000);
                const harness = getHarness();
                const modelDir = mkdtempSync(path.join(tmpdir(), 'parakeet-empty-'));
                await harness.changeAdapterConfig('ai-parakeet', {
                    native: {
                        bind: '127.0.0.1',
                        port: PORT,
                        modelDir,
                        autoDownload: false,
                    },
                });
                await harness.startAdapterAndWait();

                await waitFor(async () => {
                    const state = await harness.states.getStateAsync('ai-parakeet.0.info.status');
                    return state?.val === 'error';
                }, 30_000);
                const connection = await harness.states.getStateAsync('ai-parakeet.0.info.connection');
                assert.strictEqual(connection?.val, false);
                const lastError = await harness.states.getStateAsync('ai-parakeet.0.info.lastError');
                assert.match(String(lastError?.val), /model files are missing/);

                const health = await fetch(`http://127.0.0.1:${PORT}/health`);
                assert.strictEqual(health.status, 503);

                const form = new FormData();
                form.append('file', new Blob([Buffer.alloc(100)], { type: 'audio/wav' }), 'a.wav');
                const response = await fetch(`http://127.0.0.1:${PORT}/v1/audio/transcriptions`, {
                    method: 'POST',
                    body: form,
                });
                assert.strictEqual(response.status, 503);

                const answer = await new Promise<{ error?: string }>(resolve =>
                    harness.sendTo('ai-parakeet.0', 'transcribe', { audio: 'AAAA' }, result =>
                        resolve(result as { error?: string }),
                    ),
                );
                assert.match(String(answer.error), /model files are missing/);

                const status = await new Promise<unknown>(resolve =>
                    harness.sendTo('ai-parakeet.0', 'status', {}, result => resolve(result)),
                );
                assert.match(String(status), /\/v1\/audio\/transcriptions/);
            });
        });
    },
});
