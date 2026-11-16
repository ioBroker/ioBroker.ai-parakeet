import { memo, useEffect, useLayoutEffect, useRef, useState, type JSX } from 'react';
import type { ChatMessage, Mode, Phase, Snapshot } from './service';
import { AUTO_LOCAL_VOICE_SELECTION, availableSpeechVoices } from './speech';
import { widgetText, type WidgetLanguage, type WidgetTextKey } from './i18n';

// Same Material microphone path used by ioBroker.assistant (Apache-2.0 icon source).
const MIC = 'M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3m5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72z';
const GEAR = 'M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96a7.2 7.2 0 0 0-1.63-.94l-.36-2.54a.49.49 0 0 0-.49-.42h-3.84a.49.49 0 0 0-.49.42l-.36 2.54c-.59.23-1.13.54-1.63.94l-2.39-.96a.5.5 0 0 0-.61.22L2.74 8.84a.5.5 0 0 0 .12.64l2.03 1.58a6.8 6.8 0 0 0 0 1.88l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.12.21.37.3.61.22l2.39-.96c.5.39 1.04.7 1.63.94l.36 2.54c.04.24.25.42.49.42h3.84c.24 0 .45-.18.49-.42l.36-2.54c.59-.23 1.13-.54 1.63-.94l2.39.96c.24.09.49 0 .61-.22l1.92-3.32a.5.5 0 0 0-.12-.64L19.14 12.94zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z';
const phaseWords: Record<Phase, WidgetTextKey> = {
    disabled: 'micOff', initializing: 'initializing', listening: 'listening', activated: 'activated',
    recording: 'recording', processing: 'processing', result: 'result', error: 'error',
};

const VoicePicker = memo(function VoicePicker({ language, voiceURI, onChange }: {
    language: WidgetLanguage; voiceURI: string; onChange: (voiceURI: string) => void;
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
    const word = (key: WidgetTextKey): string => widgetText(key, language);
    const available = voices.some(voice => voice.voiceURI === voiceURI);
    return <label part="voice-picker" className="voice-picker">{word('voice')}
        <select aria-label={word('voice')} value={voiceURI} onChange={event => onChange(event.target.value)}>
            <option value={AUTO_LOCAL_VOICE_SELECTION}>{word('automaticLocal')}</option>
            {voiceURI !== AUTO_LOCAL_VOICE_SELECTION && !available
                ? <option value={voiceURI} disabled>{word('missingVoice')}</option> : null}
            {voices.map(voice => <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name} ({voice.localService === true ? word('local') : word('remote')}) — {voice.lang}
            </option>)}
        </select>
        {!voices.length ? <small>{word('noBrowserVoices')}</small> : null}
    </label>;
});

const ChatHistory = memo(function ChatHistory({ messages, language, maxMessages }: {
    messages: ChatMessage[]; language: WidgetLanguage; maxMessages: number;
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
    const word = (key: WidgetTextKey): string => widgetText(key, language);
    return <section part="chat" className="chat" aria-label={word('conversation')} role="log" ref={scrollRef}>
        <div className="chat-content" ref={contentRef}>
        {messages.length ? messages.slice(-maxMessages).map(message => <div key={message.id}
            part={message.role === 'user' ? 'chat-user' : 'chat-reply'}
            className={`chat-entry ${message.role} ${message.status || ''}`}>
            <span className="chat-source">{message.role === 'user' ? word('you') : message.source || ''}</span>
            <p>{message.status === 'pending' ? word('pendingReply') : message.text}</p>
        </div>) : <p className="chat-empty">{word('emptyChat')}</p>}
        </div>
    </section>;
});

export function WakewordView(props: {
    snapshot: Snapshot; mode: Mode; language: WidgetLanguage; compact: boolean; showText: boolean; showChat: boolean;
    maxChatMessages: number;
    speechEnabled: boolean; voiceURI: string; onVoiceChange: (voiceURI: string) => void;
    accentColor?: string; editMode: boolean;
    onToggle: () => void; onPtt: () => void; onStop: () => void;
}): JSX.Element {
    const { snapshot: state } = props;
    const word = (key: WidgetTextKey): string => widgetText(key, props.language);
    const active = state.enabled;
    return (
        <div part="content" className={`wakeword ${props.compact ? 'compact' : ''} ${props.showChat ? 'with-chat' : ''}`}
            style={{ ...(props.accentColor ? { '--wake-accent': props.accentColor } : {}) } as React.CSSProperties}>
            <div className="top">
                <button type="button" part="microphone" className={`mic ${active ? 'on' : ''}`} aria-pressed={active}
                    aria-label={active ? word('disableMic') : word('enableMic')} title={active ? word('disableMic') : word('enableMic')}
                    disabled={props.editMode || state.phase === 'initializing'} onClick={props.onToggle}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d={MIC} /></svg>
                </button>
                <div part="status" className="status"><strong>{props.editMode ? word('editorDisabled') : word(phaseWords[state.phase])}</strong>
                    {state.wakeword && !props.compact ? <small>{state.wakeword}</small> : null}
                </div>
                {!props.editMode && props.speechEnabled ? <details className="voice-settings">
                    <summary part="settings-button" aria-label={word('chooseVoice')}
                        title={word('chooseVoice')}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={GEAR} /></svg>
                    </summary>
                    <div part="settings-panel" className="voice-panel">
                        <VoicePicker language={props.language} voiceURI={props.voiceURI} onChange={props.onVoiceChange} />
                    </div>
                </details> : null}
            </div>
            <div part="meter" className="meter" role="meter" aria-label={word('microphoneLevel')} aria-valuenow={Math.round(state.level * 100)} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${Math.round(state.level * 100)}%` }} />
            </div>
            {props.showText && state.text && !props.compact && (!props.showChat || state.phase !== 'result')
                ? <p part="transcript" className="text">{state.text}</p> : null}
            {state.error && !props.compact ? <p className="error" role="alert">{state.error}</p> : null}
            {props.showChat ? <ChatHistory messages={state.chat} language={props.language} maxMessages={props.maxChatMessages} /> : null}
            {(props.mode === 'ptt' || props.mode === 'combined') && !props.editMode ? (
                <div className="actions">
                    <button type="button" onClick={props.onPtt} disabled={state.phase === 'initializing' || state.phase === 'processing' || state.phase === 'recording'}>{word('speak')}</button>
                    {state.phase === 'recording' ? <button type="button" onClick={props.onStop}>{word('finishRecording')}</button> : null}
                </div>
            ) : null}
        </div>
    );
}
