import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { gzipSync } from 'node:zlib';

import {
    downloadFfmpegStatic,
    FFMPEG_STATIC_RELEASE,
    ffmpegStaticAsset,
    ffmpegStaticPath,
} from '../../src/lib/ffmpegStatic';

const BINARY = Buffer.from('#!/bin/sh\necho "ffmpeg version 6.1.1-static"\n'.repeat(2000));
const GZ = gzipSync(BINARY);
const SHA = createHash('sha256').update(GZ).digest('hex');
const ASSET = { name: 'ffmpeg-linux-x64.gz', sha256: SHA };

describe('ffmpegStatic', () => {
    let server: Server;
    let baseUrl: string;
    let dir: string;

    beforeEach(async () => {
        dir = mkdtempSync(join(tmpdir(), 'ffmpeg-static-'));
        server = createServer((request, response) => {
            if (request.url === `/${ASSET.name}`) {
                response.writeHead(200, { 'content-length': GZ.length });
                response.end(GZ);
            } else {
                response.writeHead(404);
                response.end();
            }
        });
        await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
        baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    afterEach(async () => {
        await new Promise(resolve => server.close(resolve));
        rmSync(dir, { recursive: true, force: true });
    });

    it('knows the file for each platform of ffmpeg-static, none elsewhere', () => {
        assert.equal(FFMPEG_STATIC_RELEASE, 'b6.1.1');
        assert.equal(ffmpegStaticAsset('linux', 'arm64')!.name, 'ffmpeg-linux-arm64.gz');
        assert.equal(ffmpegStaticAsset('linux', 'arm')!.name, 'ffmpeg-linux-arm.gz');
        assert.equal(ffmpegStaticAsset('win32', 'x64')!.name, 'ffmpeg-win32-x64.gz');
        assert.match(ffmpegStaticAsset('darwin', 'arm64')!.sha256, /^[0-9a-f]{64}$/);
        assert.equal(ffmpegStaticAsset('win32', 'arm64'), null);
        assert.equal(ffmpegStaticAsset('freebsd', 'x64'), null);
        assert.equal(basename(ffmpegStaticPath('/data', 'win32')), 'ffmpeg.exe');
        assert.equal(basename(ffmpegStaticPath('/data', 'linux')), 'ffmpeg');
    });

    it('downloads, checks and unpacks the binary', async () => {
        const logs: string[] = [];
        const file = await downloadFfmpegStatic(dir, {
            baseUrl,
            asset: ASSET,
            platform: 'linux',
            log: { info: message => logs.push(message) },
        });
        assert.equal(file, ffmpegStaticPath(dir, 'linux'));
        assert.deepEqual(readFileSync(file), BINARY);
        if (process.platform !== 'win32') {
            assert.equal(statSync(file).mode & 0o111, 0o111, 'executable');
        }
        assert.ok(!existsSync(`${file}.part`));
        assert.ok(
            logs.some(line => /Downloading ffmpeg \(ffmpeg-linux-x64\.gz, [\d.]+ MB\)/.test(line)),
            logs.join('\n'),
        );

        // a second download replaces the first
        writeFileSync(file, 'old');
        await downloadFfmpegStatic(dir, { baseUrl, asset: ASSET, platform: 'linux' });
        assert.deepEqual(readFileSync(file), BINARY);
    });

    it('refuses a file with the wrong checksum and leaves nothing behind', async () => {
        await assert.rejects(
            downloadFfmpegStatic(dir, {
                baseUrl,
                asset: { name: ASSET.name, sha256: '0'.repeat(64) },
                platform: 'linux',
            }),
            /wrong checksum/,
        );
        const file = ffmpegStaticPath(dir, 'linux');
        assert.ok(!existsSync(file));
        assert.ok(!existsSync(`${file}.part`));
    });

    it('reports HTTP errors, unsupported platforms and an abort', async () => {
        await assert.rejects(
            downloadFfmpegStatic(dir, { baseUrl, asset: { name: 'missing.gz', sha256: SHA }, platform: 'linux' }),
            /HTTP 404/,
        );
        await assert.rejects(downloadFfmpegStatic(dir, { asset: null }), /no ffmpeg download for/);
        const controller = new AbortController();
        controller.abort();
        await assert.rejects(
            downloadFfmpegStatic(dir, { baseUrl, asset: ASSET, platform: 'linux', signal: controller.signal }),
            /abort/i,
        );
        assert.ok(!existsSync(ffmpegStaticPath(dir, 'linux')));
    });
});
