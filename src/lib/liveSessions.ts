import { randomBytes } from 'node:crypto';

import { pcm16ToFloat, SAMPLE_RATE } from './audio';
import type { SessionOptions } from './audioSession';
import { correctionInfo, LiveStream, type LiveEvent } from './liveStream';
import type { Transcriber } from './transcriber';
import { adapterTimers } from './timers';

/** A session without a message for so long is dropped: the browser was closed */
export const LIVE_IDLE_TIMEOUT_MS = 15_000;
/** Audio per message: the browser sends what came together while the previous message was on its way */
const MAX_MESSAGE_SECONDS = 10;
/** The audio is pushed in pieces of 100 ms, as the test page sends it */
const PIECE = SAMPLE_RATE / 10;

export interface LiveSessionsOptions {
    transcriber: Transcriber;
    session: SessionOptions;
    maxClients: number;
    /** Live tests of other transports (WebSocket of the test page): they count for `maxClients` too */
    otherClients?: () => number;
}

/** The message of `sendTo(instance, 'live', ...)` */
export interface LiveRequest {
    action?: unknown;
    id?: unknown;
    /** Counts `audio` and `stop` from 1, so a lost or doubled message is noticed */
    seq?: unknown;
    /** 16 kHz mono, 16-bit little-endian PCM as base64 */
    pcm?: unknown;
}

interface Session {
    stream: LiveStream;
    events: LiveEvent[];
    seq: number;
    lastSeen: number;
    ended: boolean;
}

/**
 * Live test of admin over `sendTo`: admin has no WebSocket to the server of the adapter, and its page may be
 * HTTPS while the server is not. The browser sends one message at a time and gets the events since its previous
 * message as answer:
 *
 * - `{ action: 'start' }` → `{ id, sampleRate, corrections }`
 * - `{ action: 'audio', id, seq, pcm }` → `{ events }`
 * - `{ action: 'stop', id, seq }` → `{ events }`, then `poll` until an event `done` or `error`
 * - `{ action: 'poll', id }` → `{ events }`
 * - `{ action: 'cancel', id }` → `{}`
 */
export class LiveSessions {
    private readonly sessions = new Map<string, Session>();
    private timer: NodeJS.Timeout | null = null;

    public constructor(private readonly options: LiveSessionsOptions) {}

    /** Running live tests */
    public get size(): number {
        let count = 0;
        for (const session of this.sessions.values()) {
            if (!session.ended) {
                count++;
            }
        }
        return count;
    }

    public handle(message: unknown): Record<string, unknown> {
        const request = (message && typeof message === 'object' ? message : {}) as LiveRequest;
        if (request.action === 'start') {
            return this.start();
        }
        const id = typeof request.id === 'string' ? request.id : '';
        const session = this.sessions.get(id);
        if (!session) {
            return { error: 'The live test has ended. Start it again.' };
        }
        session.lastSeen = Date.now();
        switch (request.action) {
            case 'audio':
            case 'stop':
                if (this.nextSeq(session, request.seq)) {
                    if (request.action === 'audio') {
                        this.push(session, request.pcm);
                    } else {
                        session.stream.stop();
                    }
                }
                return this.collect(id, session);
            case 'poll':
                return this.collect(id, session);
            case 'cancel':
                session.stream.close();
                this.sessions.delete(id);
                return {};
            default:
                return { error: `Unknown action ${String(request.action)}` };
        }
    }

    /** Ends all live tests, e.g. when the adapter stops */
    public closeAll(): void {
        for (const session of this.sessions.values()) {
            session.stream.close();
        }
        this.sessions.clear();
        this.stopTimer();
    }

    private start(): Record<string, unknown> {
        const { transcriber } = this.options;
        const reason = transcriber.unavailableReason;
        if (reason) {
            return { error: reason };
        }
        if (this.size + (this.options.otherClients?.() ?? 0) >= this.options.maxClients) {
            return { error: `At most ${this.options.maxClients} live tests can run at the same time` };
        }
        const id = randomBytes(12).toString('base64url');
        const events: LiveEvent[] = [];
        const session: Session = {
            events,
            seq: 0,
            lastSeen: Date.now(),
            ended: false,
            stream: new LiveStream({
                transcriber,
                session: this.options.session,
                send: event => events.push(event),
                end: () => (session.ended = true),
            }),
        };
        this.sessions.set(id, session);
        this.timer ??= adapterTimers.setInterval(() => this.sweep(), 5_000);
        this.timer.unref?.();
        return { id, sampleRate: SAMPLE_RATE, corrections: correctionInfo(transcriber) };
    }

    private nextSeq(session: Session, seq: unknown): boolean {
        if (seq !== session.seq + 1) {
            session.stream.fail(new Error('An audio message was lost'));
            return false;
        }
        session.seq++;
        return true;
    }

    private push(session: Session, data: unknown): void {
        const buffer = typeof data === 'string' ? Buffer.from(data, 'base64') : undefined;
        if (!buffer?.length || buffer.length % 2 || buffer.length / 2 > MAX_MESSAGE_SECONDS * SAMPLE_RATE) {
            session.stream.fail(new Error(`Expected up to ${MAX_MESSAGE_SECONDS} s of 16-bit PCM as base64`));
            return;
        }
        const pcm = pcm16ToFloat(buffer);
        for (let offset = 0; offset < pcm.length && !session.stream.closed; offset += PIECE) {
            session.stream.push(pcm.subarray(offset, offset + PIECE));
        }
    }

    /** The events since the previous message; a finished session is forgotten once its last events are fetched */
    private collect(id: string, session: Session): Record<string, unknown> {
        const events = session.events.splice(0);
        if (session.ended) {
            this.sessions.delete(id);
            if (!this.sessions.size) {
                this.stopTimer();
            }
        }
        return { events };
    }

    private sweep(): void {
        const limit = Date.now() - LIVE_IDLE_TIMEOUT_MS;
        for (const [id, session] of this.sessions) {
            if (session.lastSeen < limit) {
                session.stream.close();
                this.sessions.delete(id);
            }
        }
        if (!this.sessions.size) {
            this.stopTimer();
        }
    }

    private stopTimer(): void {
        if (this.timer) {
            adapterTimers.clearInterval(this.timer);
            this.timer = null;
        }
    }
}
