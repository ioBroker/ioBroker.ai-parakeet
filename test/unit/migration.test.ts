import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { moveOldDir } from '../../src/lib/migration';

describe('migration from ai-parakeet', () => {
    let root = '';
    const messages: string[] = [];
    const log = { info: (text: string) => messages.push(text), warn: (text: string) => messages.push(`warn ${text}`) };

    beforeEach(async () => {
        root = await mkdtemp(join(tmpdir(), 'voice-migration-'));
        messages.length = 0;
    });
    afterEach(() => rm(root, { recursive: true, force: true }));

    it('moves the old model directory into the new place', async () => {
        const oldDir = join(root, 'ai-parakeet', 'models');
        const newDir = join(root, 'voice', 'models');
        await mkdir(oldDir, { recursive: true });
        await writeFile(join(oldDir, 'vocab.txt'), 'tokens');

        assert.equal(await moveOldDir(oldDir, newDir, log), newDir);
        assert.equal(await readFile(join(newDir, 'vocab.txt'), 'utf8'), 'tokens');
        assert.equal(existsSync(oldDir), false);
        assert.equal(messages.length, 1);
    });

    it('keeps an existing new directory and leaves the old one alone', async () => {
        const oldDir = join(root, 'ai-parakeet.0');
        const newDir = join(root, 'voice.0');
        await mkdir(oldDir, { recursive: true });
        await mkdir(newDir, { recursive: true });

        assert.equal(await moveOldDir(oldDir, newDir, log), newDir);
        assert.equal(existsSync(oldDir), true);
        assert.deepEqual(messages, []);
    });

    it('does nothing without an old directory', async () => {
        const newDir = join(root, 'voice.0');
        assert.equal(await moveOldDir(join(root, 'ai-parakeet.0'), newDir, log), newDir);
        assert.equal(existsSync(newDir), false);
        assert.deepEqual(messages, []);
    });

    it('uses the old directory if it cannot be moved', async () => {
        const oldDir = join(root, 'ai-parakeet.0');
        await mkdir(oldDir, { recursive: true });
        // The parent of the new directory is a file, so it cannot be created.
        await writeFile(join(root, 'blocked'), '');

        assert.equal(await moveOldDir(oldDir, join(root, 'blocked', 'voice.0'), log), oldDir);
        assert.match(messages[0], /^warn Could not move/);
    });
});
