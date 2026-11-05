import assert from 'node:assert/strict';

import { getBoundary, parseMultipart } from '../../src/lib/multipart';

/** Encodes a form exactly as fetch (and the OpenAI SDK) does */
async function encode(form: FormData): Promise<{ body: Buffer; contentType: string }> {
    const request = new Request('http://localhost/', { method: 'POST', body: form });
    return {
        body: Buffer.from(await request.arrayBuffer()),
        contentType: request.headers.get('content-type')!,
    };
}

describe('multipart', () => {
    it('parses a form with a binary file and text fields', async () => {
        const audio = Buffer.from([0, 1, 2, 13, 10, 45, 45, 255, 254, 13, 10]);
        const form = new FormData();
        form.append('file', new Blob([audio], { type: 'audio/wav' }), 'audio.wav');
        form.append('model', 'parakeet');
        form.append('prompt', 'ioBroker, Wohnzimmer, Licht äöü');
        const { body, contentType } = await encode(form);
        const boundary = getBoundary(contentType);
        assert.ok(boundary);
        const parts = parseMultipart(body, boundary);
        const file = parts.find(part => part.name === 'file');
        assert.equal(file?.filename, 'audio.wav');
        assert.equal(file?.contentType, 'audio/wav');
        assert.deepEqual(file?.data, audio);
        assert.equal(parts.find(part => part.name === 'model')?.data.toString(), 'parakeet');
        assert.equal(parts.find(part => part.name === 'prompt')?.data.toString(), 'ioBroker, Wohnzimmer, Licht äöü');
    });

    it('reads quoted boundaries', () => {
        assert.equal(getBoundary('multipart/form-data; boundary="abc def"'), 'abc def');
        assert.equal(getBoundary('multipart/form-data; boundary=xyz; charset=utf-8'), 'xyz');
        assert.equal(getBoundary('multipart/form-data'), undefined);
    });

    it('rejects broken bodies', () => {
        assert.throws(() => parseMultipart(Buffer.from('nothing here'), 'b'));
        assert.throws(() => parseMultipart(Buffer.from('--b\r\nContent-Disposition: form-data; name="x"\r\n\r\nabc'), 'b'));
    });
});
