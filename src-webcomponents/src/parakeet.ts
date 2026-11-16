import { pcmBase64, RATE } from './audio';

export interface LiveEvent {
    type: 'transcript' | 'done' | 'error';
    segment?: number; text?: string; rawText?: string; correctedText?: string;
    final?: boolean; message?: string;
}
export interface LiveAnswer { id?: string; sampleRate?: number; events?: LiveEvent[]; error?: string }
export type LiveCall = (request: Record<string, unknown>) => Promise<LiveAnswer | undefined>;

export class ParakeetClient {
    private id = '';
    private seq = 0;
    private queue: Float32Array[] = [];
    private queuedSamples = 0;
    private timer: number | undefined;
    private busy = false;
    private stopping = false;
    private stopSent = false;
    private finished = false;
    private lastCall = 0;
    constructor(
        private readonly call: LiveCall,
        private readonly onEvent: (event: LiveEvent) => void,
        private readonly onFailure: (error: Error) => void,
    ) {}
    get sessionId(): string { return this.id; }
    async start(): Promise<void> {
        const answer = await this.request({ action: 'start' });
        if (!answer.id || answer.sampleRate !== RATE) throw new Error('Invalid Parakeet live start response');
        this.id = answer.id;
        this.timer = window.setInterval(() => void this.tick(), 200);
    }
    push(samples: Float32Array): void {
        if (!this.id || this.stopping || this.finished) return;
        this.queue.push(samples.slice());
        this.queuedSamples += samples.length;
        if (this.queuedSamples > RATE * 8) this.fail(new Error('Audio connection is too slow'));
    }
    stop(): void { this.stopping = true; void this.tick(); }
    async cancel(): Promise<void> {
        this.finished = true;
        if (this.timer) window.clearInterval(this.timer);
        this.queue = [];
        if (this.id) await this.request({ action: 'cancel', id: this.id }).catch(() => {});
    }
    private async request(payload: Record<string, unknown>): Promise<LiveAnswer> {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            const answer = await Promise.race([
                this.call(payload),
                new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Parakeet timeout')), 15000); }),
            ]);
            if (!answer || answer.error) throw new Error(answer?.error || 'Empty Parakeet response');
            return answer;
        } finally { if (timer) clearTimeout(timer); }
    }
    private async tick(): Promise<void> {
        if (!this.id || this.busy || this.finished) return;
        let payload: Record<string, unknown> | undefined;
        if (this.queue.length) {
            const all = new Float32Array(this.queuedSamples);
            let offset = 0;
            for (const chunk of this.queue) { all.set(chunk, offset); offset += chunk.length; }
            this.queue = []; this.queuedSamples = 0;
            payload = { action: 'audio', id: this.id, seq: ++this.seq, pcm: pcmBase64(all) };
        } else if (this.stopping && !this.stopSent) {
            this.stopSent = true;
            payload = { action: 'stop', id: this.id, seq: ++this.seq };
        } else if (Date.now() - this.lastCall >= 400) payload = { action: 'poll', id: this.id };
        if (!payload) return;
        this.busy = true;
        try {
            const answer = await this.request(payload);
            this.lastCall = Date.now();
            for (const event of answer.events || []) {
                this.onEvent(event);
                if (event.type === 'done') { this.finished = true; if (this.timer) clearInterval(this.timer); }
                if (event.type === 'error') throw new Error(event.message || 'Parakeet error');
            }
        } catch (error) { this.fail(error as Error); }
        finally { this.busy = false; }
    }
    private fail(error: Error): void {
        if (this.finished) return;
        this.finished = true;
        if (this.timer) clearInterval(this.timer);
        this.onFailure(error);
        if (this.id) void this.request({ action: 'cancel', id: this.id }).catch(() => {});
    }
}
