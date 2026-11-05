import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const DIR = join(ROOT, 'admin', 'webcomponents');

describe('web component of the live test', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const manifest: any = JSON.parse(readFileSync(join(DIR, 'ai-parakeet-live.json'), 'utf8'));

    it('has a manifest that names its module and tag', () => {
        for (const key of ['manifestVersion', 'tag', 'name', 'module', 'settings']) {
            assert.ok(manifest[key] !== undefined, key);
        }
        assert.match(manifest.tag, /^[a-z][a-z0-9]*-[a-z0-9-]+$/);
        const module = readFileSync(join(DIR, manifest.module), 'utf8');
        assert.ok(module.includes(`customElements.define('${manifest.tag}'`), 'the module defines the tag');
    });

    it('is used by the instance settings', () => {
        const config = readFileSync(join(ROOT, 'admin', 'jsonConfig.json'), 'utf8');
        assert.ok(config.includes('"webComponent": "webcomponents/ai-parakeet-live.json"'));
        // the number of the instance from the pattern variable `_instance` of JSON-Config
        assert.ok(config.includes('"instance": "ai-parakeet.${_instance}"'));
    });

    it('brings the same audio worklet as the test page', () => {
        // admin serves only the admin folder, so the worklet is a copy
        for (const file of ['capture.js', 'resampler.js']) {
            assert.ok(existsSync(join(DIR, file)), file);
            assert.equal(
                readFileSync(join(DIR, file), 'utf8'),
                readFileSync(join(ROOT, 'public', file), 'utf8'),
                `admin/webcomponents/${file} differs from public/${file}`,
            );
        }
    });
});
