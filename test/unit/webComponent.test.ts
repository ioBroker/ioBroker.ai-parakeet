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

describe('VIS-2 wake word web component', () => {
    it('is published by ai-parakeet and uses its instance for recognition and model settings', () => {
        const adapter = JSON.parse(readFileSync(join(ROOT, 'io-package.json'), 'utf8'));
        const manifest = JSON.parse(readFileSync(join(DIR, 'wakeword.json'), 'utf8'));
        assert.ok(adapter.common.webComponents.includes('webcomponents/wakeword.json'));
        assert.equal(manifest.tag, 'iob-wakeword');
        assert.equal(manifest.settings.items.parakeet.adapter, 'ai-parakeet');
        assert.equal(manifest.settings.items.wakewordAdapter, undefined);
        assert.equal(manifest.settings.items.processorInstance.type, 'instance');
        assert.equal(manifest.settings.items.processorInstance.adapter, 'smart-text2command');
        assert.equal(manifest.settings.items.showChat.type, 'checkbox');
        assert.equal(manifest.settings.items.maxChatMessages.type, 'number');
        assert.equal(manifest.settings.items.maxChatMessages.default, 50);
        assert.equal(manifest.settings.items.speechEnabled.type, 'checkbox');
        assert.equal(manifest.settings.items.speechEnabled.default, false);
        assert.equal(manifest.settings.items.speechVoiceURI.type, 'select');
        assert.ok(manifest.settings.items.speechVoiceURI.options.some((option: { value: string; label: string }) =>
            option.value === 'Google Deutsch' && option.label.includes('(remote)')));
        assert.equal(manifest.settings.items.speechVoiceCustom.type, 'text');
        for (const file of [manifest.module, 'wakeword-capture.js', 'models/io_broker.onnx']) {
            assert.ok(existsSync(join(DIR, file)), file);
        }
    });
});
