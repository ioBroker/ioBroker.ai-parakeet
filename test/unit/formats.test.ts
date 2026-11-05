import assert from 'node:assert/strict';

import { formatResponse, needsSegments, parseResponseFormat } from '../../src/lib/formats';
import type { JobResult } from '../../src/lib/scheduler';

const result: JobResult = {
    text: 'Hallo Welt. Wie geht es?',
    rawText: 'hallo welt. wie geht es?',
    segments: [
        { text: 'Hallo Welt.', start: 0.32, end: 1.5 },
        { text: 'Wie geht es?', start: 1.9, end: 3661.25 },
    ],
    inferenceMs: 100,
    queueMs: 0,
    audioSeconds: 3662,
    segment: 0,
    final: true,
};

describe('formats', () => {
    it('validates response_format', () => {
        assert.equal(parseResponseFormat(undefined), 'json');
        assert.equal(parseResponseFormat('srt'), 'srt');
        assert.throws(() => parseResponseFormat('diarized_json'), /not supported/);
        assert.equal(needsSegments('json'), false);
        assert.equal(needsSegments('vtt'), true);
    });

    it('builds json, text, srt, vtt and verbose_json', () => {
        assert.deepEqual(JSON.parse(formatResponse('json', result, 'de').body), { text: result.text });
        assert.equal(formatResponse('text', result, 'de').body, result.text);
        assert.equal(
            formatResponse('srt', result, 'de').body,
            '1\n00:00:00,320 --> 00:00:01,500\nHallo Welt.\n\n2\n00:00:01,900 --> 01:01:01,250\nWie geht es?\n',
        );
        assert.match(formatResponse('vtt', result, 'de').body, /^WEBVTT\n\n00:00:00\.320 --> 00:00:01\.500\nHallo Welt\./);
        const verbose = JSON.parse(formatResponse('verbose_json', result, 'de').body);
        assert.equal(verbose.language, 'de');
        assert.equal(verbose.duration, 3662);
        assert.equal(verbose.segments.length, 2);
        assert.equal(verbose.segments[1].start, 1.9);
    });

    it('builds one segment if the model returned none', () => {
        const plain = { ...result, segments: undefined, audioSeconds: 2 };
        assert.equal(formatResponse('srt', plain, '').body, `1\n00:00:00,000 --> 00:00:02,000\n${result.text}\n`);
        assert.equal(JSON.parse(formatResponse('verbose_json', plain, '').body).language, 'unknown');
    });
});
