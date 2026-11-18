import assert from 'node:assert/strict';

import { SPEECH_LANGUAGES, speechLanguage } from '../../src/lib/languages';

describe('speechLanguage', () => {
    it('knows the 25 languages of the models', () => {
        assert.equal(SPEECH_LANGUAGES.length, 25);
        assert.equal(speechLanguage('de'), 'de');
        assert.equal(speechLanguage('uk'), 'uk');
    });

    it('takes regional codes and other spellings', () => {
        assert.equal(speechLanguage('de-DE'), 'de');
        assert.equal(speechLanguage('pt_BR'), 'pt');
        assert.equal(speechLanguage(' RU '), 'ru');
    });

    it('ignores anything else, so no other special token gets into the prompt of Canary', () => {
        for (const value of ['', 'zh-cn', 'ja', 'endoftext', 'nopnc', 'emo:undefined', '<|de|>', 42, null, undefined]) {
            assert.equal(speechLanguage(value), undefined, String(value));
        }
    });
});
