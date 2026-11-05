import { createHash, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { join } from 'node:path';

import { WebSocketServer, WebSocket, type RawData } from 'ws';

import { RequestError, SAMPLE_RATE } from './audio';
import { AudioSession, type SessionOptions } from './audioSession';
import type { EngineLogger } from './engine';
import { formatResponse, needsSegments, parseResponseFormat } from './formats';
import { MODEL } from './modelFiles';
import { getBoundary, parseMultipart } from './multipart';
import type { JobResult, Owner } from './scheduler';
import type { Transcriber } from './transcriber';

/** Same limit as the OpenAI API has. 5 minutes of 48 kHz stereo WAV are 58 MB, so it is a bit higher */
const MAX_BODY_BYTES = 64 * 1024 * 1024;
const MAX_STREAM_MINUTES = 30;

export interface ApiServerOptions {
    bind: string;
    port: number;
    tls?: { key: string; cert: string; ca?: string };
    /** '' = no key needed */
    apiKey: string;
    testPage: boolean;
    /** Directory of the test page */
    publicDir: string;
    maxClients: number;
    session: SessionOptions;
    transcriber: Transcriber;
    /** Status for /health */
    health: () => { ready: boolean; status: string; error?: string; threads: number };
    log: EngineLogger;
}

const STATIC_FILES = new Map([
    ['/', ['index.html', 'text/html; charset=utf-8']],
    ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
    ['/capture.js', ['capture.js', 'text/javascript; charset=utf-8']],
    ['/resampler.js', ['resampler.js', 'text/javascript; charset=utf-8']],
    ['/style.css', ['style.css', 'text/css; charset=utf-8']],
]);

function digest(text: string): Buffer {
    return createHash('sha256').update(text).digest();
}

/** Compares in constant time */
export function keyMatches(given: string | undefined, expected: string): boolean {
    return !!given && timingSafeEqual(digest(given), digest(expected));
}

function bearer(request: IncomingMessage): string | undefined {
    const header = request.headers.authorization || '';
    const match = /^Bearer\s+(.+)$/i.exec(header);
    return match ? match[1].trim() : undefined;
}

function sendJson(response: ServerResponse, status: number, data: unknown): void {
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(data));
}

/** Error in the format of the OpenAI API */
function sendError(response: ServerResponse, status: number, message: string, code = 'invalid_request'): void {
    if (response.headersSent) {
        response.destroy();
        return;
    }
    sendJson(response, status, {
        error: {
            message,
            type: status >= 500 ? 'server_error' : 'invalid_request_error',
            param: null,
            code,
        },
    });
}

function rawToBuffer(data: RawData): Buffer {
    if (Buffer.isBuffer(data)) {
        return data;
    }
    return Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data);
}

function readBody(request: IncomingMessage, limit: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const declared = Number(request.headers['content-length']);
        if (declared > limit) {
            reject(new RequestError(`The request is larger than ${limit / 1024 / 1024} MB`, 413, 'file_too_large'));
            return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        request.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > limit) {
                reject(new RequestError(`The request is larger than ${limit / 1024 / 1024} MB`, 413, 'file_too_large'));
                request.destroy();
                return;
            }
            chunks.push(chunk);
        });
        request.on('end', () => resolve(Buffer.concat(chunks)));
        request.on('error', reject);
    });
}

/**
 * HTTP server with
 * - POST /v1/audio/transcriptions: OpenAI-compatible (multipart/form-data with "file", or the audio as body)
 * - GET /v1/models
 * - GET /health
 * - the test page at / with live streaming over the WebSocket /audio
 */
export class ApiServer {
    private server: Server | null = null;
    private wss: WebSocketServer | null = null;

    public constructor(private readonly options: ApiServerOptions) {}

    /** Port the server listens on (useful with port 0) */
    public get address(): number {
        const address = this.server?.address();
        return address && typeof address === 'object' ? address.port : 0;
    }

    public get clients(): number {
        return this.wss?.clients.size ?? 0;
    }

    public async start(): Promise<void> {
        const { tls } = this.options;
        const handler = (request: IncomingMessage, response: ServerResponse): void => {
            this.handle(request, response).catch(error => {
                this.options.log.warn(`Request ${request.method} ${request.url}: ${error.message}`);
                sendError(response, 500, error.message, 'server_error');
            });
        };
        const server = tls
            ? createHttpsServer({ key: tls.key, cert: tls.cert, ca: tls.ca }, handler)
            : createHttpServer(handler);
        // Only the upload is limited: the transcription of a long recording on a slow CPU may take longer
        server.requestTimeout = 5 * 60_000;
        server.headersTimeout = 60_000;
        this.server = server;

        if (this.options.testPage) {
            this.wss = new WebSocketServer({ noServer: true, maxPayload: 32_000, perMessageDeflate: false });
            this.wss.on('connection', socket => this.onStream(socket));
            server.on('upgrade', (request, socket, head) => {
                const origin = request.headers.origin;
                let sameOrigin = false;
                try {
                    sameOrigin = !!origin && new URL(origin).host === request.headers.host;
                } catch {
                    // invalid origin
                }
                const path = new URL(request.url || '/', 'http://localhost').pathname;
                if (path !== '/audio' || !sameOrigin || this.clients >= this.options.maxClients) {
                    socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
                    return;
                }
                this.wss!.handleUpgrade(request, socket, head, ws => this.wss!.emit('connection', ws, request));
            });
        } else {
            server.on('upgrade', (_request, socket) =>
                socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n'),
            );
        }

        await new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen(this.options.port, this.options.bind || undefined, () => {
                server.off('error', reject);
                server.on('error', error => this.options.log.error(`Server: ${error.message}`));
                resolve();
            });
        });
    }

    public async stop(): Promise<void> {
        for (const socket of this.wss?.clients ?? []) {
            socket.terminate();
        }
        this.wss?.close();
        this.wss = null;
        const server = this.server;
        this.server = null;
        if (server) {
            await new Promise<void>(resolve => {
                server.close(() => resolve());
                server.closeAllConnections();
            });
        }
    }

    private authorized(request: IncomingMessage): boolean {
        return !this.options.apiKey || keyMatches(bearer(request), this.options.apiKey);
    }

    private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('X-Content-Type-Options', 'nosniff');
        const url = new URL(request.url || '/', 'http://localhost');
        const path = url.pathname.replace(/\/+$/, '') || '/';

        if (path === '/health' && request.method === 'GET') {
            const health = this.options.health();
            const { scheduler, corrector } = this.options.transcriber;
            sendJson(response, health.ready ? 200 : 503, {
                ...health,
                model: `${MODEL.id} int8`,
                backend: 'cpu',
                auth: !!this.options.apiKey,
                clients: this.clients,
                queued: scheduler.queued,
                busy: scheduler.isBusy,
                corrections: { enabled: corrector.size > 0, rules: corrector.size },
            });
            return;
        }

        if (path.startsWith('/v1/')) {
            if (!this.authorized(request)) {
                sendError(
                    response,
                    401,
                    'Invalid API key. Send it as "Authorization: Bearer <key>".',
                    'invalid_api_key',
                );
                return;
            }
            if (path === '/v1/models' && request.method === 'GET') {
                sendJson(response, 200, {
                    object: 'list',
                    data: [{ id: MODEL.id, object: 'model', created: 0, owned_by: 'nvidia' }],
                });
                return;
            }
            if (path === '/v1/audio/transcriptions') {
                if (request.method !== 'POST') {
                    sendError(response, 405, 'Use POST');
                    return;
                }
                await this.transcription(request, response, url);
                return;
            }
            if (path === '/v1/audio/translations') {
                sendError(response, 400, 'Parakeet cannot translate, only transcribe', 'unsupported');
                return;
            }
            sendError(response, 404, `Unknown endpoint ${path}`, 'not_found');
            return;
        }

        const file = this.options.testPage && request.method === 'GET' ? STATIC_FILES.get(path) : undefined;
        if (!file) {
            response.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
            return;
        }
        response.setHeader(
            'Content-Security-Policy',
            "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; worker-src 'self'; frame-ancestors 'none'",
        );
        try {
            const body = await readFile(join(this.options.publicDir, file[0]));
            response.writeHead(200, { 'Content-Type': file[1] }).end(body);
        } catch {
            response.writeHead(500).end('Cannot load the page');
        }
    }

    private async transcription(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
        let owner: Owner | undefined;
        // The client gave up (e.g. its timeout): do not transcribe for nobody
        response.on('close', () => {
            if (!response.writableFinished && owner) {
                this.options.transcriber.scheduler.cancel(owner, new Error('The client closed the connection'));
            }
        });
        try {
            const contentType = request.headers['content-type'] || '';
            const body = await readBody(request, MAX_BODY_BYTES);
            const fields = new Map<string, string>(url.searchParams);
            let file: Buffer | undefined;
            if (/^multipart\/form-data/i.test(contentType)) {
                const boundary = getBoundary(contentType);
                if (!boundary) {
                    throw new RequestError('multipart/form-data without boundary');
                }
                for (const part of parseMultipart(body, boundary)) {
                    if (part.name === 'file') {
                        file = part.data;
                    } else if (part.filename === undefined) {
                        fields.set(part.name, part.data.toString('utf8'));
                    }
                }
                if (!file) {
                    throw new RequestError('The field "file" is missing', 400, 'missing_file');
                }
            } else if (/^(audio\/|application\/octet-stream)/i.test(contentType)) {
                file = body;
            } else {
                throw new RequestError('Send multipart/form-data with the field "file", or the audio as body', 415);
            }
            const format = parseResponseFormat(fields.get('response_format'));
            const start = performance.now();
            const result: JobResult = await this.options.transcriber.transcribeFile(file, {
                prompt: fields.get('prompt'),
                segments: needsSegments(format),
                register: registered => (owner = registered),
            });
            this.options.log.debug(
                `Transcribed ${result.audioSeconds.toFixed(1)} s in ${Math.round(performance.now() - start)} ms (inference ${Math.round(result.inferenceMs)} ms): ${result.text.slice(0, 200)}`,
            );
            const { contentType: type, body: text } = formatResponse(format, result, fields.get('language'));
            response.writeHead(200, { 'Content-Type': type }).end(text);
        } catch (error) {
            if (response.destroyed) {
                return;
            }
            if (error instanceof RequestError) {
                sendError(response, error.status, error.message, error.code);
            } else {
                this.options.log.warn(`Transcription failed: ${error.message}`);
                sendError(response, 500, error.message, 'server_error');
            }
        }
    }

    /** Live streaming of the test page */
    private onStream(socket: WebSocket): void {
        const { transcriber, log } = this.options;
        let state: 'hello' | 'recording' | 'stopping' | 'closed' = 'hello';
        let completed = false;
        let started = 0;
        let received = 0;
        const send = (data: unknown): void => {
            if (socket.readyState !== WebSocket.OPEN) {
                return;
            }
            if (socket.bufferedAmount > 1024 * 1024) {
                socket.close(1013, 'Client too slow');
                return;
            }
            socket.send(JSON.stringify(data));
        };
        // Created below: the session and the owner need each other
        const ref: { audio?: AudioSession } = {};
        const owner: Owner = {
            id: `ws-${Math.random().toString(36).slice(2)}`,
            streaming: true,
            result(result) {
                if (state === 'closed') {
                    return;
                }
                send({ type: 'transcript', ...result, correctedText: result.text });
                if (result.final) {
                    transcriber.reportResult(result);
                }
            },
            idle() {
                if (state === 'stopping' && !completed && !transcriber.scheduler.has(owner)) {
                    completed = true;
                    send({ type: 'done' });
                    socket.close(1000);
                }
            },
            fail(error) {
                if (state === 'closed') {
                    return;
                }
                state = 'closed';
                ref.audio?.reset();
                transcriber.scheduler.cancel(owner);
                send({ type: 'error', message: error.message });
                socket.close(1011);
            },
        };
        const session = new AudioSession(job => transcriber.enqueue(owner, job), this.options.session);
        ref.audio = session;
        const timer = setTimeout(
            () => owner.fail(new Error(`The maximal session length is ${MAX_STREAM_MINUTES} minutes`)),
            MAX_STREAM_MINUTES * 60_000,
        );
        const helloTimer = setTimeout(() => {
            if (state === 'hello') {
                owner.fail(new Error('No hello message'));
            }
        }, 10_000);

        socket.on('message', (data: RawData, binary: boolean) => {
            try {
                if (!binary) {
                    const message = JSON.parse(rawToBuffer(data).toString('utf8')) as { type?: string; key?: string };
                    if (state === 'hello' && message.type === 'hello') {
                        if (this.options.apiKey && !keyMatches(message.key, this.options.apiKey)) {
                            send({ type: 'error', message: 'Invalid API key', auth: true });
                            state = 'closed';
                            socket.close(4401);
                            return;
                        }
                        clearTimeout(helloTimer);
                        state = 'recording';
                        started = performance.now();
                        send({
                            type: 'ready',
                            sampleRate: SAMPLE_RATE,
                            corrections: { enabled: transcriber.corrector.size > 0, rules: transcriber.corrector.size },
                        });
                        return;
                    }
                    if (state === 'recording' && message.type === 'stop') {
                        state = 'stopping';
                        session.flush();
                        owner.idle?.();
                        return;
                    }
                    throw new Error('Unexpected control message');
                }
                if (state !== 'recording') {
                    throw new Error(state === 'hello' ? 'Send hello first' : 'Recording already stopped');
                }
                const buffer = rawToBuffer(data);
                if (!buffer.length || buffer.length % 4) {
                    throw new Error('Expected Float32 little-endian PCM');
                }
                const pcm = new Float32Array(buffer.length / 4);
                for (let i = 0; i < pcm.length; i++) {
                    pcm[i] = buffer.readFloatLE(i * 4);
                }
                received += pcm.length;
                if (received > ((performance.now() - started) / 1000 + 3) * SAMPLE_RATE) {
                    throw new Error('Audio sent faster than real time');
                }
                session.push(pcm);
            } catch (error) {
                owner.fail(error);
            }
        });
        socket.on('error', error => log.debug(`WebSocket: ${error.message}`));
        socket.on('close', () => {
            state = 'closed';
            clearTimeout(timer);
            clearTimeout(helloTimer);
            transcriber.scheduler.cancel(owner);
            session.reset();
        });
    }
}
