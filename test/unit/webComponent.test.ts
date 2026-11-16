import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const DIR = join(ROOT, 'admin', 'webcomponents');

describe('web component of the live test', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const manifest: any = JSON.parse(readFileSync(join(DIR, 'voice-live.json'), 'utf8'));

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
        assert.ok(config.includes('"webComponent": "webcomponents/voice-live.json"'));
        // the number of the instance from the pattern variable `_instance` of JSON-Config
        assert.ok(config.includes('"instance": "voice.${_instance}"'));
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
    it('is published by voice and uses its instance for recognition and model settings', () => {
        const adapter = JSON.parse(readFileSync(join(ROOT, 'io-package.json'), 'utf8'));
        const manifest = JSON.parse(readFileSync(join(DIR, 'wakeword.json'), 'utf8'));
        assert.ok(adapter.common.webComponents.includes('webcomponents/wakeword.json'));
        assert.equal(manifest.tag, 'iob-wakeword');
        assert.equal(manifest.settings.type, 'tabs');
        const groups = manifest.settings.items;
        assert.deepEqual(Object.keys(groups), ['general', 'audio', 'display', 'processing', 'speech']);
        assert.deepEqual(Object.values(groups).map((group: any) => group.label.en),
            ['Common', 'Microphone and recognition', 'Display and chat', 'Text processing and output', 'Speech output']);
        const names = Object.values(groups).flatMap((group: any) => Object.keys(group.items));
        assert.equal(new Set(names).size, names.length, 'each setting must occur only once');
        assert.deepEqual(names.sort(), `parakeet autoStart mode microphone ringBufferMs stripWakeword threshold
            minSpeechMs silenceMs noSpeechMs maxRecordMs activationTone completionTone showText showInterim
            compact language accentColor processorType processorInstance assistantInstance showChat maxChatMessages speechEnabled
            speechEngine speechServerVoice`.split(/\s+/).sort());
        const settings = Object.assign({}, ...Object.values(groups).map((group: any) => group.items));
        assert.equal(settings.parakeet.adapter, 'voice');
        assert.equal(settings.wakewordAdapter, undefined);
        assert.equal(settings.processorInstance.type, 'instance');
        assert.equal(settings.processorInstance.adapter, 'smart-text2command');
        assert.equal(settings.assistantInstance.type, 'instance');
        assert.equal(settings.assistantInstance.adapter, 'assistant');
        assert.deepEqual(settings.processorType.options.map((option: any) => option.value), ['none', 'smart-text2command', 'assistant']);
        assert.equal(settings.showChat.type, 'checkbox');
        assert.equal(settings.maxChatMessages.type, 'number');
        assert.equal(settings.maxChatMessages.default, 50);
        assert.equal(settings.speechEnabled.type, 'checkbox');
        assert.equal(settings.speechEnabled.default, false);
        assert.deepEqual(Object.keys(groups.audio.items).slice(0, 2), ['activationTone', 'completionTone']);
        assert.equal(settings.activationTone.default, true);
        assert.equal(settings.completionTone.default, true);
        assert.equal(settings.speechServerVoice.type, 'selectSendTo');
        assert.equal(settings.speechServerVoice.command, 'piperVoices');
        assert.equal(settings.speechServerVoice.instance, '${data.parakeet}');
        assert.equal(settings.speechServerVoice.options, undefined);
        for (const language of ['en', 'de', 'ru', 'pt', 'nl', 'fr', 'it', 'es', 'pl', 'uk', 'zh-cn']) {
            assert.ok(groups.general.label[language]);
            assert.ok(settings.speechServerVoice.label[language]);
        }
        for (const file of [manifest.module, 'wakeword-capture.js', 'models/io_broker.onnx']) {
            assert.ok(existsSync(join(DIR, file)), file);
        }
    });
});
