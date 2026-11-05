import assert from 'node:assert/strict';

import { joinTokens } from '../../src/lib/tokenText';

describe('joinTokens', () => {
    it('keeps the spaces between Cyrillic words', () => {
        assert.equal(joinTokens(['▁Т', 'ест', '▁раз', ',', '▁два', ',', '▁три', '.']), 'Тест раз, два, три.');
    });

    it('keeps the spaces before words that start with a letter outside of ASCII', () => {
        assert.equal(joinTokens(['▁Das', '▁ist', '▁über', '▁Ärger', '.']), 'Das ist über Ärger.');
        assert.equal(joinTokens(['▁C', "'", 'est', '▁été', '▁à', '▁Paris']), "C'est été à Paris");
    });

    it('removes the spaces before punctuation and at the start and end', () => {
        assert.equal(joinTokens(['▁Hallo', '▁', ',', '▁Welt', '▁', '!', '▁']), 'Hallo, Welt!');
        assert.equal(joinTokens([]), '');
    });

    it('keeps digits as words', () => {
        assert.equal(joinTokens(['▁Stufe', '▁5', '▁und', '▁', '2', '0']), 'Stufe 5 und 20');
    });
});
