import { memo, useEffect, useLayoutEffect, useRef, useState, type JSX } from 'react';
import type { ChatMessage, Mode, Snapshot } from './service';
import { AUTO_LOCAL_VOICE_SELECTION, availableSpeechVoices, DEFAULT_VOICE_SELECTION } from './speech';

// Same Material microphone path used by ioBroker.assistant (Apache-2.0 icon source).
const MIC = 'M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3m5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72z';
const GEAR = 'M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96a7.2 7.2 0 0 0-1.63-.94l-.36-2.54a.49.49 0 0 0-.49-.42h-3.84a.49.49 0 0 0-.49.42l-.36 2.54c-.59.23-1.13.54-1.63.94l-2.39-.96a.5.5 0 0 0-.61.22L2.74 8.84a.5.5 0 0 0 .12.64l2.03 1.58a6.8 6.8 0 0 0 0 1.88l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.12.21.37.3.61.22l2.39-.96c.5.39 1.04.7 1.63.94l.36 2.54c.04.24.25.42.49.42h3.84c.24 0 .45-.18.49-.42l.36-2.54c.59-.23 1.13-.54 1.63-.94l2.39.96c.24.09.49 0 .61-.22l1.92-3.32a.5.5 0 0 0-.12-.64L19.14 12.94zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z';
const WORDS = {
    de: { disabled: 'Mikrofon aus', initializing: 'Initialisierung…', listening: 'Warte auf Aktivierungswort', activated: 'Aktiviert', recording: 'Aufnahme läuft', processing: 'Verarbeitung…', result: 'Ergebnis', error: 'Fehler', on: 'Mikrofon deaktivieren', off: 'Mikrofon aktivieren', ptt: 'Sprechen', stop: 'Aufnahme beenden', editor: 'Mikrofon im Editor deaktiviert', chat: 'Gesprächsverlauf', you: 'Du', pending: 'Antwort wird verarbeitet…', empty: 'Noch keine erkannten Texte' },
    en: { disabled: 'Microphone off', initializing: 'Initializing…', listening: 'Waiting for wake word', activated: 'Activated', recording: 'Recording', processing: 'Processing…', result: 'Result', error: 'Error', on: 'Disable microphone', off: 'Enable microphone', ptt: 'Speak', stop: 'Finish recording', editor: 'Microphone disabled in editor', chat: 'Conversation', you: 'You', pending: 'Processing reply…', empty: 'No recognized text yet' },
};
const VOICE_WORDS = {
    de: { voice: 'Stimme', settings: 'Stimme auswählen', widgetDefault: 'Widget-Vorgabe', automatic: 'Automatisch (lokal)', local: 'lokal', remote: 'remote',
        missing: 'Gewählte Stimme nicht verfügbar', none: 'Keine Browserstimmen verfügbar' },
    en: { voice: 'Voice', settings: 'Choose voice', widgetDefault: 'Widget default', automatic: 'Automatic (local)', local: 'local', remote: 'remote',
        missing: 'Selected voice unavailable', none: 'No browser voices available' },
};

const VoicePicker = memo(function VoicePicker({ language, voiceURI, configuredVoiceURI, onChange }: {
    language: 'de' | 'en'; voiceURI: string; configuredVoiceURI: string; onChange: (voiceURI: string) => void;
}): JSX.Element {
    const [voices, setVoices] = useState(availableSpeechVoices);
    useEffect(() => {
        const synthesis = window.speechSynthesis;
        if (!synthesis) return;
        const refresh = (): void => setVoices(availableSpeechVoices());
        refresh();
        synthesis.addEventListener('voiceschanged', refresh);
        return () => synthesis.removeEventListener('voiceschanged', refresh);
    }, []);
    const word = VOICE_WORDS[language];
    const available = voices.some(voice => voice.voiceURI === voiceURI);
    return <label part="voice-picker" className="voice-picker">{word.voice}
        <select aria-label={word.voice} value={voiceURI} onChange={event => onChange(event.target.value)}>
            <option value={DEFAULT_VOICE_SELECTION}>{word.widgetDefault}: {configuredVoiceURI || word.automatic}</option>
            <option value={AUTO_LOCAL_VOICE_SELECTION}>{word.automatic}</option>
            {voiceURI !== DEFAULT_VOICE_SELECTION && voiceURI !== AUTO_LOCAL_VOICE_SELECTION && !available
                ? <option value={voiceURI} disabled>{word.missing}</option> : null}
            {voices.map(voice => <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name} ({voice.localService === true ? word.local : word.remote}) — {voice.lang}
            </option>)}
        </select>
        {!voices.length ? <small>{word.none}</small> : null}
    </label>;
});

const ChatHistory = memo(function ChatHistory({ messages, language, maxMessages }: {
    messages: ChatMessage[]; language: 'de' | 'en'; maxMessages: number;
}): JSX.Element {
    const scrollRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const scrollToBottom = (): void => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    };
    useLayoutEffect(scrollToBottom, [messages, maxMessages]);
    useLayoutEffect(() => {
        if (!scrollRef.current || !contentRef.current || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(scrollToBottom);
        observer.observe(scrollRef.current);
        observer.observe(contentRef.current);
        const root = scrollRef.current.getRootNode();
        const widget = root instanceof ShadowRoot ? root.host.closest('.vis-widget') : null;
        const mutation = widget ? new MutationObserver(scrollToBottom) : null;
        if (widget && mutation) mutation.observe(widget, { attributes: true, attributeFilter: ['style', 'class'] });
        return () => { observer.disconnect(); mutation?.disconnect(); };
    }, []);
    const word = WORDS[language];
    return <section part="chat" className="chat" aria-label={word.chat} role="log" ref={scrollRef}>
        <div className="chat-content" ref={contentRef}>
        {messages.length ? messages.slice(-maxMessages).map(message => <div key={message.id}
            part={message.role === 'user' ? 'chat-user' : 'chat-reply'}
            className={`chat-entry ${message.role} ${message.status || ''}`}>
            <span className="chat-source">{message.role === 'user' ? word.you : message.source || 'smart-text2command'}</span>
            <p>{message.status === 'pending' ? word.pending : message.text}</p>
        </div>) : <p className="chat-empty">{word.empty}</p>}
        </div>
    </section>;
});

export function WakewordView(props: {
    snapshot: Snapshot; mode: Mode; language: 'de' | 'en'; compact: boolean; showText: boolean; showChat: boolean;
    maxChatMessages: number;
    speechEnabled: boolean; voiceURI: string; configuredVoiceURI: string; onVoiceChange: (voiceURI: string) => void;
    accentColor?: string; fontSize?: number; editMode: boolean;
    onToggle: () => void; onPtt: () => void; onStop: () => void;
}): JSX.Element {
    const { snapshot: state } = props;
    const word = WORDS[props.language];
    const active = state.enabled;
    return (
        <div part="content" className={`wakeword ${props.compact ? 'compact' : ''} ${props.showChat ? 'with-chat' : ''}`}
            style={{ ...(props.accentColor ? { '--wake-accent': props.accentColor } : {}),
                ...(props.fontSize ? { fontSize: props.fontSize } : {}) } as React.CSSProperties}>
            <div className="top">
                <button type="button" part="microphone" className={`mic ${active ? 'on' : ''}`} aria-pressed={active}
                    aria-label={active ? word.on : word.off} title={active ? word.on : word.off}
                    disabled={props.editMode || state.phase === 'initializing'} onClick={props.onToggle}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d={MIC} /></svg>
                </button>
                <div part="status" className="status"><strong>{props.editMode ? word.editor : word[state.phase]}</strong>
                    {state.wakeword && !props.compact ? <small>{state.wakeword}</small> : null}
                </div>
                {!props.editMode && props.speechEnabled ? <details className="voice-settings">
                    <summary part="settings-button" aria-label={VOICE_WORDS[props.language].settings}
                        title={VOICE_WORDS[props.language].settings}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={GEAR} /></svg>
                    </summary>
                    <div part="settings-panel" className="voice-panel">
                        <VoicePicker language={props.language} voiceURI={props.voiceURI}
                            configuredVoiceURI={props.configuredVoiceURI} onChange={props.onVoiceChange} />
                    </div>
                </details> : null}
            </div>
            <div part="meter" className="meter" role="meter" aria-label="Microphone level" aria-valuenow={Math.round(state.level * 100)} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${Math.round(state.level * 100)}%` }} />
            </div>
            {props.showText && state.text && !props.compact && (!props.showChat || state.phase !== 'result')
                ? <p part="transcript" className="text">{state.text}</p> : null}
            {state.error && !props.compact ? <p className="error" role="alert">{state.error}</p> : null}
            {props.showChat ? <ChatHistory messages={state.chat} language={props.language} maxMessages={props.maxChatMessages} /> : null}
            {(props.mode === 'ptt' || props.mode === 'combined') && !props.editMode ? (
                <div className="actions">
                    <button type="button" onClick={props.onPtt} disabled={state.phase === 'initializing' || state.phase === 'processing' || state.phase === 'recording'}>{word.ptt}</button>
                    {state.phase === 'recording' ? <button type="button" onClick={props.onStop}>{word.stop}</button> : null}
                </div>
            ) : null}
        </div>
    );
}
