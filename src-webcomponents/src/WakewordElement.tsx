import { createRoot, type Root } from 'react-dom/client';
import { defineWebComponent, IobWebComponent } from '@iobroker/web-components/element';
import type { WebComponentSocket } from '@iobroker/web-components';
import { WakewordView } from './WakewordView';
import { chatLimit, voiceService, type Mode, type Snapshot, type SocketLike, type WidgetOptions } from './service';
import { STYLES } from './styles';
import { AUTO_LOCAL_VOICE_SELECTION } from './speech';
import { widgetLanguage, type WidgetLanguage } from './i18n';

interface Settings {
    [key: string]: string | number | boolean | undefined;
    parakeet?: string; autoStart?: boolean; mode?: Mode; microphone?: string;
    ringBufferMs?: number; stripWakeword?: boolean; threshold?: number; minSpeechMs?: number;
    silenceMs?: number; noSpeechMs?: number; maxRecordMs?: number; showText?: boolean;
    activationTone?: boolean; completionTone?: boolean;
    showInterim?: boolean; compact?: boolean; language?: 'auto' | WidgetLanguage;
    accentColor?: string;
    processorType?: 'none' | 'smart-text2command'; processorInstance?: string;
    showChat?: boolean; maxChatMessages?: number;
    speechEnabled?: boolean;
    speechEngine?: 'browser' | 'server'; speechServerVoice?: string;
}
const instance = (value: string | undefined, adapter: string): string => {
    const id = (value || `${adapter}.0`).replace(/^system\.adapter\./, '');
    return new RegExp(`^${adapter.replaceAll('-', '\\-')}\\.\\d+$`).test(id) ? id : `${adapter}.0`;
};
const numeric = (value: number | undefined, fallback: number): number => Number.isFinite(Number(value)) ? Number(value) : fallback;
const selectedProcessorInstance = (value: string | undefined): string => {
    const id = (value || '').replace(/^system\.adapter\./, '');
    return /^smart-text2command\.\d+$/.test(id) ? id : '';
};

class WakewordElement extends IobWebComponent<Settings> {
    readonly #root: Root;
    #unsubscribe?: () => void;
    #autoStarted = false;
    #lastSocket: WebComponentSocket | null = null;
    #state: Snapshot = voiceService.state;
    #voiceURI = AUTO_LOCAL_VOICE_SELECTION;
    #voiceStorageKey = '';
    #voiceLoaded = false;
    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style'); style.textContent = STYLES;
        const mount = document.createElement('div'); mount.style.height = '100%';
        shadow.append(style, mount);
        this.#root = createRoot(mount);
    }
    override disconnectedCallback(): void {
        this.#unsubscribe?.(); this.#unsubscribe = undefined;
        this.#autoStarted = false;
        this.#lastSocket = null;
        this.#voiceLoaded = false;
        this.#voiceStorageKey = '';
        this.#voiceURI = AUTO_LOCAL_VOICE_SELECTION;
        super.disconnectedCallback();
    }
    protected override getStateIds(settings: Settings): string[] {
        return [`system.adapter.${instance(settings.parakeet, 'ai-parakeet')}.alive`];
    }
    protected override render(): void {
        if (!this.#voiceLoaded) {
            this.#voiceLoaded = true;
            const widgetId = this.closest<HTMLElement>('.vis-widget')?.id || this.id;
            if (widgetId) {
                this.#voiceStorageKey = `iob-wakeword:voice:${location.pathname}:${widgetId}`;
                try {
                    const saved = localStorage.getItem(this.#voiceStorageKey);
                    this.#voiceURI = saved && saved !== '__widget_default__' ? saved : AUTO_LOCAL_VOICE_SELECTION;
                } catch { /* storage unavailable */ }
            }
        }
        if (!this.#unsubscribe) this.#unsubscribe = voiceService.subscribe(state => { this.#state = state; this.#draw(); });
        voiceService.setChatLimit(this.settings.maxChatMessages ?? 50);
        if (this.editMode && voiceService.state.enabled) void voiceService.disable();
        if (!this.editMode && this.socket) voiceService.updateDeliveryOptions(this.#options());
        const parakeet = instance(this.settings.parakeet, 'ai-parakeet');
        if (this.states[`system.adapter.${parakeet}.alive`]?.val === false) {
            voiceService.connectionLost('Adapter is not running');
        }
        if (this.socket !== this.#lastSocket) {
            const oldSocket = this.#lastSocket;
            this.#lastSocket = this.socket;
            this.#autoStarted = false;
            if (oldSocket && voiceService.state.enabled) {
                void voiceService.disable().then(() => {
                    if (this.isConnected && !this.editMode && this.settings.autoStart && this.socket) {
                        this.#autoStarted = true;
                        void voiceService.enable(this.socket as unknown as SocketLike, this.#options());
                    }
                });
                this.#draw();
                return;
            }
        }
        if (!this.editMode && this.settings.autoStart && !this.#autoStarted && this.socket) {
            this.#autoStarted = true;
            void voiceService.enable(this.socket as unknown as SocketLike, this.#options());
        }
        this.#draw();
    }
    #options(): WidgetOptions {
        const s = this.settings;
        return {
            parakeet: instance(s.parakeet, 'ai-parakeet'),
            mode: s.mode || 'wakeword', microphone: s.microphone || '',
            ringBufferMs: numeric(s.ringBufferMs, 1000), stripWakeword: !!s.stripWakeword,
            threshold: numeric(s.threshold, 0.015), minSpeechMs: numeric(s.minSpeechMs, 250),
            silenceMs: numeric(s.silenceMs, 1200), noSpeechMs: numeric(s.noSpeechMs, 5000),
            maxRecordMs: numeric(s.maxRecordMs, 15000), showInterim: s.showInterim !== false,
            activationTone: s.activationTone !== false, completionTone: s.completionTone !== false,
            processorType: s.processorType === 'smart-text2command' ? 'smart-text2command' : 'none',
            processorInstance: selectedProcessorInstance(s.processorInstance),
            maxChatMessages: chatLimit(s.maxChatMessages),
            speechEnabled: !!s.speechEnabled,
            speechEngine: s.speechEngine === 'server' ? 'server' : 'browser',
            speechServerVoice: s.speechServerVoice || '',
            speechLanguage: this.#language(),
            speechVoiceURI: this.#voiceURI === AUTO_LOCAL_VOICE_SELECTION ? '' : this.#voiceURI,
        };
    }
    #language(): WidgetLanguage {
        return widgetLanguage(this.settings.language && this.settings.language !== 'auto'
            ? this.settings.language : this.systemLang || navigator.language);
    }
    #draw(): void {
        const accentColor = this.settings.accentColor === '#2563eb' ? undefined : this.settings.accentColor;
        this.#root.render(<WakewordView
            snapshot={this.#state} mode={this.settings.mode || 'wakeword'} language={this.#language()}
            compact={!!this.settings.compact} showText={this.settings.showText !== false}
            showChat={!!this.settings.showChat} maxChatMessages={chatLimit(this.settings.maxChatMessages)}
            speechEnabled={!!this.settings.speechEnabled && this.settings.speechEngine !== 'server'} voiceURI={this.#voiceURI}
            onVoiceChange={voiceURI => {
                this.#voiceURI = voiceURI;
                if (this.#voiceStorageKey) {
                    try {
                        if (voiceURI === AUTO_LOCAL_VOICE_SELECTION) localStorage.removeItem(this.#voiceStorageKey);
                        else localStorage.setItem(this.#voiceStorageKey, this.#voiceURI);
                    } catch { /* storage unavailable */ }
                }
                if (this.socket && voiceService.state.enabled) voiceService.updateDeliveryOptions(this.#options());
                this.#draw();
            }}
            accentColor={accentColor}
            editMode={this.editMode}
            onToggle={() => {
                if (voiceService.state.enabled) void voiceService.disable();
                else if (this.socket) void voiceService.enable(this.socket as unknown as SocketLike, this.#options());
            }}
            onPtt={() => { if (this.socket) void voiceService.pushToTalk(this.socket as unknown as SocketLike, this.#options()); }}
            onStop={() => voiceService.finishRecording()}
        />);
    }
}

defineWebComponent('iob-wakeword', WakewordElement);
