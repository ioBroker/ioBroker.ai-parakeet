import { AudioRingBuffer, RATE, VoiceActivityDetector, type VadOptions } from './audio';
import { ParakeetClient, type LiveAnswer, type LiveEvent } from './parakeet';
import { OnnxWakewordEngine, type WakewordEngine } from './wakeword';
import { createTextProcessor, type ProcessorStatus, type ProcessorType, type TextProcessor } from './processors';
import { BrowserSpeechOutput } from './speech';
import { ServerSpeechOutput } from './serverSpeech';

export type Phase = 'disabled' | 'initializing' | 'listening' | 'activated' | 'recording' | 'processing' | 'result' | 'error';
export type Mode = 'wakeword' | 'ptt' | 'combined';
export const chatLimit = (value: number | undefined): number => {
    const requested = Number(value);
    return Number.isFinite(requested) ? Math.max(1, Math.min(200, Math.floor(requested))) : 50;
};
export interface WidgetOptions extends VadOptions {
    mode: Mode; parakeet: string;
    ringBufferMs: number; stripWakeword: boolean; microphone: string;
    activationTone: boolean; completionTone: boolean;
    showInterim: boolean;
    processorType: ProcessorType; processorInstance: string;
    maxChatMessages: number;
    speechEnabled: boolean; speechLanguage: string; speechVoiceURI: string;
    speechEngine?: 'browser' | 'server'; speechServerVoice?: string;
}
export interface ChatMessage {
    id: string; role: 'user' | 'processor'; text: string; timestamp: number;
    status?: ProcessorStatus | 'pending'; source?: string;
}
export interface SocketLike {
    sendTo<T>(instance: string, command: string, message: Record<string, unknown>): Promise<T | undefined>;
    setState(id: string, state: { val: string; ack: false }): Promise<unknown>;
}
export interface Snapshot { phase: Phase; enabled: boolean; level: number; text: string; error: string; wakeword: string; chat: ChatMessage[] }
type Listener = (snapshot: Snapshot) => void;

interface WakeConfigAnswer { names?: string[]; threshold?: number; error?: string }
interface ModelAnswer { base64?: string; error?: string }

export class VoiceControlService {
    private listeners = new Set<Listener>();
    private snapshot: Snapshot = { phase: 'disabled', enabled: false, level: 0, text: '', error: '', wakeword: '', chat: [] };
    private socket?: SocketLike;
    private options?: WidgetOptions;
    private context?: AudioContext;
    private stream?: MediaStream;
    private source?: MediaStreamAudioSourceNode;
    private node?: AudioWorkletNode;
    private engine?: WakewordEngine;
    private ring?: AudioRingBuffer;
    private vad?: VoiceActivityDetector;
    private client?: ParakeetClient;
    private wakeQueue: Float32Array[] = [];
    private pumping = false;
    private afterWake: Float32Array[] = [];
    private generation = 0;
    private segments = new Map<number, { text: string; final: boolean }>();
    private lastLevelAt = 0;
    private activeAt = 0;
    private processor?: TextProcessor;
    private processorKey = '';
    private speechActive = false;
    private readonly serverSpeech = new ServerSpeechOutput();

    constructor(private readonly createEngine: () => WakewordEngine = () => new OnnxWakewordEngine(),
        private readonly speech = new BrowserSpeechOutput()) {}

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        listener(this.snapshot);
        return () => { this.listeners.delete(listener); if (!this.listeners.size) void this.disable(); };
    }
    get state(): Snapshot { return this.snapshot; }
    updateDeliveryOptions(options: WidgetOptions): void {
        if (!this.options || !this.snapshot.enabled) return;
        if (this.options.speechEnabled && (!options.speechEnabled || this.options.speechEngine !== options.speechEngine)) {
            this.speech.cancel();
            this.serverSpeech.cancel();
            this.speechActive = false;
            this.wakeQueue = [];
            this.ring?.clear();
            this.engine?.reset();
        }
        this.options = { ...this.options,
            processorType: options.processorType, processorInstance: options.processorInstance,
            maxChatMessages: options.maxChatMessages,
            speechEnabled: options.speechEnabled, speechLanguage: options.speechLanguage,
            speechVoiceURI: options.speechVoiceURI,
            speechEngine: options.speechEngine, speechServerVoice: options.speechServerVoice };
        this.trimChat();
    }
    setChatLimit(value: number): void {
        this.chatRetentionLimit = chatLimit(value);
        this.trimChat();
    }
    private chatRetentionLimit = 50;
    private trimChat(): void {
        if (this.snapshot.chat.length > this.chatRetentionLimit) {
            this.publish({ chat: this.snapshot.chat.slice(-this.chatRetentionLimit) });
        }
    }
    private publish(change: Partial<Snapshot>): void {
        this.snapshot = { ...this.snapshot, ...change };
        for (const listener of this.listeners) listener(this.snapshot);
    }

    async enable(socket: SocketLike, options: WidgetOptions): Promise<void> {
        if (this.snapshot.enabled || this.snapshot.phase === 'initializing') return;
        const run = ++this.generation;
        if (socket !== this.socket) { this.processor = undefined; this.processorKey = ''; }
        this.socket = socket; this.options = options;
        this.setChatLimit(options.maxChatMessages);
        this.publish({ phase: 'initializing', error: '', text: '', enabled: false });
        try {
            if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) {
                throw new Error('A secure browser context with microphone and AudioWorklet is required');
            }
            if (options.mode !== 'ptt') {
                const config = await socket.sendTo<WakeConfigAnswer>(options.parakeet, 'getWakewordConfig', {});
                if (!config || config.error) throw new Error(config?.error || 'Parakeet adapter unavailable');
                const engine = this.engine = this.createEngine();
                const assetBase = import.meta.url.slice(0, import.meta.url.lastIndexOf('/') + 1);
                await engine.initialize({
                    names: config.names?.length ? config.names : ['io_broker'],
                    threshold: config.threshold || 0.5,
                    assetBase,
                    getUploadedModel: async name => {
                        const result = await socket.sendTo<ModelAnswer>(options.parakeet, 'getWakewordModel', { name });
                        if (!result?.base64) throw new Error(result?.error || `Could not load ${name}`);
                        const binary = atob(result.base64);
                        return Uint8Array.from(binary, char => char.charCodeAt(0));
                    },
                });
                if (run !== this.generation) { await engine.dispose(); return; }
            }
            if (run !== this.generation) return;
            let context = new AudioContext({ sampleRate: RATE });
            this.context = context;
            await context.resume();
            const stream = await navigator.mediaDevices.getUserMedia({ audio: {
                deviceId: options.microphone ? { ideal: options.microphone } : undefined,
                channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true,
            } });
            this.stream = stream;
            if (run !== this.generation) { stream.getTracks().forEach(track => track.stop()); await context.close(); return; }
            let source: MediaStreamAudioSourceNode;
            try { source = context.createMediaStreamSource(stream); }
            catch {
                await context.close(); context = new AudioContext(); this.context = context; await context.resume();
                source = context.createMediaStreamSource(stream);
            }
            if (context.sampleRate < RATE) throw new Error('Microphone sample rate below 16 kHz is unsupported');
            const moduleBase = import.meta.url.slice(0, import.meta.url.lastIndexOf('/') + 1);
            await context.audioWorklet.addModule(new URL('wakeword-capture.js', moduleBase).href);
            if (run !== this.generation) { stream.getTracks().forEach(track => track.stop()); await context.close(); return; }
            const node = new AudioWorkletNode(context, 'wakeword-capture');
            node.port.onmessage = ({ data }: MessageEvent<{ pcm?: ArrayBuffer; stopped?: boolean }>) => {
                if (data.pcm && run === this.generation) this.onAudio(new Float32Array(data.pcm));
            };
            source.connect(node); node.connect(context.destination);
            stream.getAudioTracks().forEach(track => { track.onended = () => void this.disable(); });
            this.context = context; this.stream = stream; this.source = source; this.node = node;
            this.ring = new AudioRingBuffer(Math.round(RATE * options.ringBufferMs / 1000));
            this.publish({ enabled: true, phase: 'listening' });
        } catch (error) {
            if (run === this.generation) {
                await this.release();
                this.publish({ enabled: false, phase: 'error', error: (error as Error).message });
            }
        }
    }

    async disable(): Promise<void> {
        ++this.generation;
        await this.release();
        this.publish({ enabled: false, phase: 'disabled', level: 0, wakeword: '' });
    }
    connectionLost(message: string): void {
        if (this.snapshot.enabled || this.snapshot.phase === 'initializing') this.fail(new Error(message));
    }
    private async release(): Promise<void> {
        this.speech.cancel(); this.serverSpeech.cancel(); this.speechActive = false;
        this.wakeQueue = []; this.afterWake = [];
        const client = this.client; this.client = undefined;
        const cancel = client?.cancel();
        this.stream?.getTracks().forEach(track => track.stop()); this.stream = undefined;
        this.node?.port.postMessage('stop'); this.node?.disconnect(); this.node = undefined;
        this.source?.disconnect(); this.source = undefined;
        const context = this.context; this.context = undefined;
        if (context && context.state !== 'closed') await context.close().catch(() => {});
        const engine = this.engine; this.engine = undefined;
        if (engine) await engine.dispose();
        this.ring?.clear(); this.ring = undefined;
        this.vad = undefined;
        await cancel;
    }

    async pushToTalk(socket: SocketLike, options: WidgetOptions): Promise<void> {
        if (!this.snapshot.enabled) await this.enable(socket, options);
        if (this.snapshot.phase === 'listening') void this.activate('push-to-talk');
    }
    private onAudio(samples: Float32Array): void {
        this.ring?.push(samples);
        const now = Date.now();
        if (now - this.lastLevelAt >= 100) {
            this.lastLevelAt = now;
            this.publish({ level: Math.min(1, Math.sqrt(Math.sqrt(samples.reduce((a, b) => a + b * b, 0) / samples.length)) * 2.5) });
        }
        const phase = this.snapshot.phase;
        if (phase === 'listening' && this.speechActive) {
            this.ring?.clear();
            return;
        }
        if (phase === 'listening' && this.engine) {
            this.wakeQueue.push(samples);
            if (this.wakeQueue.length > 12) this.wakeQueue.shift();
            void this.pumpWake();
        } else if (phase === 'activated') {
            this.afterWake.push(samples);
            if (this.afterWake.length > 100) this.fail(new Error('Audio start is too slow'));
        } else if (phase === 'recording') this.record(samples);
    }
    private async pumpWake(): Promise<void> {
        if (this.pumping || !this.engine) return;
        this.pumping = true;
        try {
            while (this.wakeQueue.length && this.snapshot.phase === 'listening') {
                const result = await this.engine.processAudio(this.wakeQueue.shift()!);
                if (result.detected) { this.wakeQueue = []; void this.activate(result.name || 'wakeword'); break; }
            }
        } catch (error) { this.fail(error as Error); }
        finally { this.pumping = false; }
    }
    private async activate(wakeword: string): Promise<void> {
        const socket = this.socket, options = this.options;
        if (!socket || !options || this.snapshot.phase !== 'listening') return;
        this.publish({ phase: 'activated', wakeword, text: '' });
        if (options.activationTone) this.tone(880);
        this.activeAt = Date.now(); this.segments.clear();
        const run = this.generation;
        const preRoll = options.stripWakeword ? new Float32Array(0) : this.ring?.snapshot() || new Float32Array(0);
        const client = this.client = new ParakeetClient(
            request => socket.sendTo<LiveAnswer>(options.parakeet, 'live', request),
            event => this.onEvent(event),
            error => this.fail(error),
        );
        try {
            await client.start();
            if (run !== this.generation || this.client !== client) { await client.cancel(); return; }
            this.vad = new VoiceActivityDetector(options);
            this.publish({ phase: 'recording' });
            if (preRoll.length) client.push(preRoll);
            const pending = this.afterWake.splice(0);
            for (const chunk of pending) this.record(chunk);
        } catch (error) { this.fail(error as Error); }
    }
    private record(samples: Float32Array): void {
        this.client?.push(samples);
        const decision = this.vad?.push(samples);
        if (decision === 'done' || decision === 'no-speech') this.finishRecording();
    }
    finishRecording(): void {
        if (this.snapshot.phase !== 'recording') return;
        this.publish({ phase: 'processing' });
        if (this.options?.completionTone) this.tone(660);
        this.client?.stop();
    }
    private tone(frequency: number): void {
        const context = this.context;
        if (!context || context.state !== 'running') return;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine'; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.12);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(); oscillator.stop(context.currentTime + 0.13);
    }
    private onEvent(event: LiveEvent): void {
        if (event.type === 'transcript' && typeof event.segment === 'number') {
            const current = this.segments.get(event.segment);
            if (!current?.final) this.segments.set(event.segment, { text: event.correctedText || event.text || '', final: !!event.final });
            if (this.options?.showInterim || event.final) this.publish({ text: this.joinText() });
        } else if (event.type === 'done') {
            const text = this.joinText();
            this.publish({ phase: 'result', text });
            if (text) void this.deliver(text);
            this.client = undefined; this.vad = undefined; this.ring?.clear(); this.engine?.reset();
            window.setTimeout(() => {
                if (this.snapshot.phase === 'result') this.publish({ phase: 'listening', wakeword: '' });
            }, 1200);
        } else if (event.type === 'error') this.fail(new Error(event.message || 'Parakeet error'));
    }
    private joinText(): string {
        return [...this.segments].sort(([a], [b]) => a - b).map(([, value]) => value.text).filter(Boolean).join(' ').trim();
    }
    private async deliver(text: string): Promise<void> {
        const socket = this.socket, options = this.options;
        if (!socket || !options) return;
        this.appendChat({ role: 'user', text, timestamp: this.activeAt });
        if (options.processorType !== 'none') {
            const pendingId = this.appendChat({ role: 'processor', text: '', timestamp: Date.now(),
                status: 'pending', source: options.processorInstance || options.processorType });
            try {
                const key = `${options.processorType}/${options.processorInstance}/execute/${options.speechEnabled}`;
                if (this.processorKey !== key || !this.processor) {
                    this.processor = createTextProcessor(options.processorType, socket, options.processorInstance,
                        'execute', options.speechEnabled);
                    this.processorKey = key;
                }
                const reply = await this.processor!.process(text);
                this.updateChat(pendingId, { text: reply.text, status: reply.status });
                const speechOptions = this.options;
                if (speechOptions?.speechEnabled && this.snapshot.enabled && reply.text.trim()) {
                    const activity = (active: boolean): void => {
                        this.speechActive = active;
                        this.wakeQueue = [];
                        this.ring?.clear();
                        this.engine?.reset();
                    };
                    const failure = (reason: string): void => {
                        if (this.snapshot.enabled) this.publish({ error: `Speech synthesis failed (${reason})` });
                    };
                    const spoken = speechOptions.speechEngine === 'server'
                        ? await this.serverSpeech.speak(socket, speechOptions.parakeet, reply.text,
                            speechOptions.speechServerVoice || '', activity, failure)
                        : await this.speech.speak(reply.text, speechOptions.speechLanguage, activity,
                            speechOptions.speechVoiceURI, failure);
                    if (spoken === 'unavailable' && this.snapshot.enabled && speechOptions.speechEngine !== 'server') {
                        this.publish({ error: `Speech voice unavailable for ${speechOptions.speechVoiceURI || speechOptions.speechLanguage}` });
                    }
                }
            } catch (error) {
                this.updateChat(pendingId, { text: (error as Error).message, status: 'error' });
                this.publish({ error: (error as Error).message });
            }
        }
    }
    private appendChat(message: Omit<ChatMessage, 'id'>): string {
        const id = crypto.randomUUID();
        this.publish({ chat: [...this.snapshot.chat, { id, ...message }].slice(-this.chatRetentionLimit) });
        return id;
    }
    private updateChat(id: string, change: Partial<ChatMessage>): void {
        this.publish({ chat: this.snapshot.chat.map(message => message.id === id ? { ...message, ...change } : message) });
    }
    private fail(error: Error): void {
        this.publish({ phase: 'error', error: error.message });
        void this.disableAfterError();
    }
    private async disableAfterError(): Promise<void> {
        ++this.generation;
        await this.release();
        this.publish({ enabled: false, level: 0 });
    }
}

export const voiceService = new VoiceControlService();
