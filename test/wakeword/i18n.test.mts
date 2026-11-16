import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LANGUAGE_NAMES, widgetLabel, widgetLanguage, widgetText } from '../../src-webcomponents/src/i18n';

test('widget editor and runtime texts cover all ioBroker languages', () => {
    const languages = Object.keys(LANGUAGE_NAMES);
    assert.deepEqual(languages, ['en', 'de', 'ru', 'pt', 'nl', 'fr', 'it', 'es', 'pl', 'uk', 'zh-cn']);
    for (const language of languages) {
        const code = widgetLanguage(language);
        assert.ok(widgetText('micOff', code).trim(), language);
        assert.ok(widgetLabel('piperVoice')[code].trim(), language);
    }
    assert.equal(widgetLanguage('de-DE'), 'de');
    assert.equal(widgetLanguage('pt-BR'), 'pt');
    assert.equal(widgetLanguage('zh-CN'), 'zh-cn');
    assert.equal(widgetLanguage('unknown'), 'en');
});
