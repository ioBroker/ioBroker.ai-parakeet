import assert from 'node:assert/strict';
import { test } from 'node:test';
import { availableSpeechVoices, BrowserSpeechOutput, localSpeechVoices } from '../../src-webcomponents/src/speech';

test('browser speech uses only a matching local voice and stops its own utterance', async () => {
    const remote = { name: 'remote', lang: 'de-DE', localService: false } as SpeechSynthesisVoice;
    const local = { name: 'local', lang: 'de-DE', localService: true } as SpeechSynthesisVoice;
    const spoken: SpeechSynthesisUtterance[] = [];
    let cancelled = 0;
    class Utterance {
        voice?: SpeechSynthesisVoice;
        lang = '';
        onend?: () => void;
        onerror?: () => void;
        constructor(public text: string) {}
    }
    const synthesis = {
        getVoices: () => [remote, local],
        speak: (utterance: SpeechSynthesisUtterance) => spoken.push(utterance),
        cancel: () => { cancelled++; },
    };
    Object.assign(globalThis, { window: globalThis, SpeechSynthesisUtterance: Utterance, speechSynthesis: synthesis });
    const output = new BrowserSpeechOutput();
    const activity: boolean[] = [];
    assert.equal(await output.speak('Hallo', 'de', active => activity.push(active)), 'spoken');
    assert.equal(spoken[0].voice, local);
    assert.deepEqual(activity, [true]);
    output.cancel();
    assert.equal(cancelled, 1);
    assert.deepEqual(activity, [true, false]);
    assert.equal(await output.speak('Hello', 'en', active => activity.push(active)), 'unavailable');
    assert.equal(spoken.length, 1);
});

test('automatic browser speech rejects remote-only voices', async () => {
    const remote = { name: 'remote', lang: 'de-DE', localService: false } as SpeechSynthesisVoice;
    let spoken = false;
    Object.assign(globalThis, { window: globalThis, speechSynthesis: {
        getVoices: () => [remote], speak: () => { spoken = true; }, cancel: () => {},
    } });
    const output = new BrowserSpeechOutput();
    assert.equal(await output.speak('Hallo', 'de', () => {}), 'unavailable');
    assert.equal(spoken, false);
});

test('an explicitly selected voice can be local or remote', async () => {
    const remote = { name: 'Google Deutsch', lang: 'de-DE', voiceURI: 'chrome-network-de', localService: false } as SpeechSynthesisVoice;
    const german = { name: 'German', lang: 'de-DE', voiceURI: 'german', localService: true } as SpeechSynthesisVoice;
    const english = { name: 'English', lang: 'en-US', voiceURI: 'english', localService: true } as SpeechSynthesisVoice;
    const spoken: SpeechSynthesisUtterance[] = [];
    class Utterance {
        voice?: SpeechSynthesisVoice;
        lang = '';
        onend?: () => void;
        onerror?: () => void;
        constructor(public text: string) {}
    }
    Object.assign(globalThis, { window: globalThis, SpeechSynthesisUtterance: Utterance, speechSynthesis: {
        getVoices: () => [remote, german, english],
        speak: (utterance: SpeechSynthesisUtterance) => spoken.push(utterance), cancel: () => {},
    } });
    assert.deepEqual(localSpeechVoices(), [german, english]);
    assert.deepEqual(availableSpeechVoices(), [remote, german, english]);
    const output = new BrowserSpeechOutput();
    assert.equal(await output.speak('Hello', 'de', () => {}, 'english'), 'spoken');
    assert.equal(spoken[0].voice, english);
    assert.equal(spoken[0].lang, 'en-US');
    assert.equal(await output.speak('Hallo', 'de', () => {}, 'Google Deutsch'), 'spoken');
    assert.equal(spoken[1].voice, remote);
    assert.equal(await output.speak('Hello', 'de', () => {}, 'missing'), 'unavailable');
    assert.equal(spoken.length, 2);
});

test('waits for a selected remote voice that arrives after local voices', async () => {
    const local = { name: 'local', lang: 'de-DE', voiceURI: 'local', localService: true } as SpeechSynthesisVoice;
    const remote = { name: 'Google Deutsch', lang: 'de-DE', voiceURI: 'Google Deutsch', localService: false } as SpeechSynthesisVoice;
    const voices = [local];
    const synthesis = new EventTarget() as SpeechSynthesis & { getVoices: () => SpeechSynthesisVoice[]; speak: (utterance: SpeechSynthesisUtterance) => void };
    synthesis.getVoices = () => voices;
    let spokenVoice: SpeechSynthesisVoice | undefined;
    synthesis.speak = utterance => { spokenVoice = utterance.voice || undefined; };
    class Utterance {
        voice?: SpeechSynthesisVoice;
        lang = '';
        onend?: () => void;
        onerror?: () => void;
        constructor(public text: string) {}
    }
    Object.assign(globalThis, { window: globalThis, SpeechSynthesisUtterance: Utterance, speechSynthesis: synthesis });
    const pending = new BrowserSpeechOutput().speak('Hallo', 'de', () => {}, 'Google Deutsch');
    voices.push(remote);
    synthesis.dispatchEvent(new Event('voiceschanged'));
    assert.equal(await pending, 'spoken');
    assert.equal(spokenVoice, remote);
});

test('reports asynchronous speech synthesis errors', async () => {
    const remote = { name: 'Google Deutsch', lang: 'de-DE', voiceURI: 'Google Deutsch', localService: false } as SpeechSynthesisVoice;
    let spoken: SpeechSynthesisUtterance | undefined;
    class Utterance {
        voice?: SpeechSynthesisVoice;
        lang = '';
        onend?: () => void;
        onerror?: (event: { error: string }) => void;
        constructor(public text: string) {}
    }
    Object.assign(globalThis, { window: globalThis, SpeechSynthesisUtterance: Utterance, speechSynthesis: {
        getVoices: () => [remote], speak: (utterance: SpeechSynthesisUtterance) => { spoken = utterance; }, cancel: () => {},
    } });
    const activity: boolean[] = [];
    const errors: string[] = [];
    const result = await new BrowserSpeechOutput().speak('Hallo', 'de', active => activity.push(active), 'Google Deutsch',
        error => errors.push(error));
    assert.equal(result, 'spoken');
    spoken?.onerror?.({ error: 'network' } as SpeechSynthesisErrorEvent);
    assert.deepEqual(activity, [true, false]);
    assert.deepEqual(errors, ['network']);
});
