import './WakewordElement';
import { voiceService, type ChatMessage } from './service';

const synthesis = new EventTarget() as SpeechSynthesis & { getVoices: () => SpeechSynthesisVoice[] };
synthesis.getVoices = () => [
    { name: 'Local German', lang: 'de-DE', voiceURI: 'local-de', localService: true } as SpeechSynthesisVoice,
    { name: 'Remote German', lang: 'de-DE', voiceURI: 'remote-de', localService: false } as SpeechSynthesisVoice,
];
Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synthesis });

let micCalls = 0;
Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
    getUserMedia: async () => { micCalls++; throw new Error('Mic must stay off in the editor'); },
} });

const element = document.createElement('iob-wakeword') as HTMLElement & {
    editMode: boolean;
    settings: Record<string, unknown>;
};
element.editMode = true;
element.settings = { autoStart: true, parakeet: 'ai-parakeet.0', fontSize: 16, showChat: true, speechEnabled: true };
const widget = document.createElement('div');
widget.className = 'vis-widget';
Object.assign(widget.style, {
    fontSize: '28px', color: 'rgb(17, 34, 51)', fontStyle: 'italic',
    fontWeight: '700', textAlign: 'right', backgroundColor: 'rgb(238, 239, 240)',
    border: '2px solid rgb(17, 34, 51)', padding: '9px',
    width: '320px', height: '220px',
});
widget.append(element);
document.body.append(widget);
const projectStyle = document.createElement('style');
projectStyle.textContent = 'iob-wakeword::part(microphone) { border: 3px solid rgb(90, 40, 20); }';
document.head.append(projectStyle);

setTimeout(async () => {
    const button = element.shadowRoot?.querySelector('button.mic') as HTMLButtonElement | null;
    const chat = element.shadowRoot?.querySelector('[part="chat"]') as HTMLElement | null;
    const noVoicePicker = !element.shadowRoot?.querySelector('.voice-picker');
    const content = element.shadowRoot?.querySelector('.wakeword') as HTMLElement | null;
    const status = element.shadowRoot?.querySelector('.status strong') as HTMLElement | null;
    const contentStyle = content && getComputedStyle(content);
    const statusStyle = status && getComputedStyle(status);
    const buttonStyle = button && getComputedStyle(button);
    const initialFontSize = contentStyle?.fontSize;
    widget.style.fontSize = '30px';
    const updatedFontSize = content && getComputedStyle(content).fontSize;
    const cssOkay = button?.disabled && micCalls === 0 && !!chat && noVoicePicker &&
        initialFontSize === '28px' && updatedFontSize === '30px' &&
        contentStyle?.color === 'rgb(17, 34, 51)' &&
        contentStyle.fontStyle === 'italic' && statusStyle?.fontWeight === '700' &&
        buttonStyle?.color === 'rgb(17, 34, 51)' && buttonStyle.borderTopWidth === '3px' &&
        getComputedStyle(widget).backgroundColor === 'rgb(238, 239, 240)';
    const publish = (voiceService as unknown as { publish(change: { chat: ChatMessage[] }): void }).publish.bind(voiceService);
    const messages: ChatMessage[] = Array.from({ length: 25 }, (_, index) => ({
        id: String(index), role: 'user', text: `Recognized command ${index + 1}`, timestamp: Date.now(),
    }));
    const nextFrame = async (): Promise<void> => new Promise(resolve => setTimeout(resolve, 80));
    publish({ chat: messages });
    await nextFrame();
    const atBottom = (): boolean => !!chat && chat.scrollHeight > chat.clientHeight &&
        Math.abs(chat.scrollTop - (chat.scrollHeight - chat.clientHeight)) <= 1;
    const initialScroll = atBottom();
    publish({ chat: [...messages, { id: 'reply', role: 'processor', text: 'The latest reply', timestamp: Date.now() }] });
    await nextFrame();
    const afterReply = atBottom();
    const beforeResizeHeight = chat?.clientHeight;
    widget.style.height = '180px';
    void chat?.clientHeight;
    await new Promise(resolve => setTimeout(resolve, 300));
    const afterResize = atBottom();
    const okay = cssOkay && initialScroll && afterReply && afterResize;
    document.body.dataset.result = okay ? 'pass' : 'fail';
    document.querySelector('#result')!.textContent = okay
        ? 'PASS: voice picker is absent, chat stays at bottom, microphone stays off in editor'
        : `FAIL: css=${cssOkay}, noVoicePicker=${noVoicePicker}, initialScroll=${initialScroll}, afterReply=${afterReply}, afterResize=${afterResize}, resizeObserver=${typeof ResizeObserver}, height=${beforeResizeHeight}/${chat?.clientHeight}, scrollHeight=${chat?.scrollHeight}, scrollTop=${chat?.scrollTop}`;
    widget.remove();
    projectStyle.remove();
}, 500);
