import assert from 'node:assert/strict';

import { applyHints, createCorrector, parseHints } from '../../src/lib/corrections';

describe('corrections', () => {
    const corrector = createCorrector([
        { replacement: 'ioBroker', variants: 'io broker, eio broker, iobokrer' },
        { replacement: 'Zigbee', variants: 'zig bee; sigbee' },
    ]);

    it('replaces variants case-insensitively, with spaces or hyphens', () => {
        assert.equal(corrector.size, 5);
        assert.equal(corrector.apply('Ich nutze IO Broker und Io-Broker'), 'Ich nutze ioBroker und ioBroker');
        assert.equal(corrector.apply('mit eio  broker und sigbee'), 'mit ioBroker und Zigbee');
        assert.equal(corrector.apply('io–broker'), 'ioBroker');
    });

    it('replaces only whole words', () => {
        assert.equal(corrector.apply('xio broker'), 'xio broker');
        assert.equal(corrector.apply('io brokers'), 'io brokers');
        assert.equal(corrector.apply('(io broker).'), '(ioBroker).');
    });

    it('warns about incomplete rows and conflicts', () => {
        const warnings: string[] = [];
        const result = createCorrector(
            [
                { replacement: 'A', variants: 'x' },
                { replacement: 'B', variants: 'X, y' },
                { replacement: '', variants: 'z' },
                { replacement: '', variants: '' },
            ],
            text => warnings.push(text),
        );
        assert.equal(result.size, 2);
        assert.equal(result.apply('x y'), 'A B');
        assert.equal(warnings.length, 2);
    });

    it('accepts missing settings', () => {
        assert.equal(createCorrector(undefined).apply('io broker'), 'io broker');
    });

    it('parses the prompt into vocabulary', () => {
        assert.deepEqual(parseHints('ioBroker, Wohnzimmer Licht; Bad\nx, ioBroker'), [
            'ioBroker',
            'Wohnzimmer Licht',
            'Bad',
        ]);
        assert.deepEqual(parseHints('This is a whole sentence that is no vocabulary at all'), []);
        assert.deepEqual(parseHints(undefined), []);
    });

    it('writes vocabulary as in the prompt', () => {
        const prompt = 'ioBroker, Licht Wohnzimmer, Bad, Zigbee-Stick';
        assert.equal(applyHints('schalte das licht wohnzimmer an', prompt), 'schalte das Licht Wohnzimmer an');
        assert.equal(applyHints('io broker und io-broker und iobroker', prompt), 'ioBroker und ioBroker und ioBroker');
        assert.equal(applyHints('das bad ist warm', prompt), 'das Bad ist warm');
        assert.equal(applyHints('der zigbee stick', prompt), 'der Zigbee-Stick');
        // only whole words, and short terms are not joined from parts
        assert.equal(applyHints('badezimmer und b ad', prompt), 'badezimmer und b ad');
        assert.equal(applyHints('nichts', ''), 'nichts');
    });
});
