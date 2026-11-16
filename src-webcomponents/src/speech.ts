/** Browser voices are device-specific; automatic selection stays local. */
export const AUTO_LOCAL_VOICE_SELECTION = '__auto_local__';

export const availableSpeechVoices = (): SpeechSynthesisVoice[] =>
    window.speechSynthesis?.getVoices() || [];

export const localSpeechVoices = (): SpeechSynthesisVoice[] =>
    availableSpeechVoices().filter(voice => voice.localService === true);

export class BrowserSpeechOutput {
    private utterance?: SpeechSynthesisUtterance;
    private activity?: (active: boolean) => void;
    private generation = 0;

    async speak(text: string, language: string, onActivity: (active: boolean) => void,
        voiceURI = '', onFailure?: (reason: string) => void): Promise<'spoken' | 'unavailable' | 'cancelled'> {
        const synthesis = window.speechSynthesis;
        if (!text.trim() || !synthesis || typeof SpeechSynthesisUtterance === 'undefined') return 'unavailable';
        this.cancel();
        const generation = ++this.generation;
        const locale = language.toLowerCase();
        const base = locale.split('-')[0];
        const findVoice = (): SpeechSynthesisVoice | undefined => {
            const voices = availableSpeechVoices();
            if (voiceURI) return voices.find(candidate => candidate.voiceURI === voiceURI || candidate.name === voiceURI);
            const localVoices = voices.filter(candidate => candidate.localService === true);
            return localVoices.find(candidate => candidate.lang.toLowerCase() === locale) ||
                localVoices.find(candidate => candidate.lang.toLowerCase().split('-')[0] === base);
        };
        let voice = findVoice();
        if (!voice && typeof synthesis.addEventListener === 'function') {
            await new Promise<void>(resolve => {
                const done = (): void => { clearTimeout(timer); synthesis.removeEventListener('voiceschanged', refresh); resolve(); };
                const refresh = (): void => { if (findVoice()) done(); };
                const timer = window.setTimeout(done, voiceURI ? 5000 : 1500);
                synthesis.addEventListener('voiceschanged', refresh);
                refresh();
            });
            voice = findVoice();
        }
        if (generation !== this.generation) return 'cancelled';
        if (!voice) return 'unavailable';

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = voice;
        utterance.lang = voice.lang;
        const finish = (): void => {
            if (generation !== this.generation) return;
            this.utterance = undefined;
            this.activity = undefined;
            onActivity(false);
        };
        utterance.onend = finish;
        utterance.onerror = event => {
            if (generation !== this.generation) return;
            finish();
            onFailure?.(event.error || 'unknown');
        };
        this.utterance = utterance;
        this.activity = onActivity;
        onActivity(true);
        try {
            synthesis.speak(utterance);
            return 'spoken';
        } catch {
            finish();
            return 'unavailable';
        }
    }

    cancel(): void {
        ++this.generation;
        if (!this.utterance) return;
        this.utterance.onend = null;
        this.utterance.onerror = null;
        this.utterance = undefined;
        this.activity?.(false);
        this.activity = undefined;
        window.speechSynthesis?.cancel();
    }
}
