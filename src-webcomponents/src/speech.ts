/** Browser voices are device-specific; automatic selection stays local. */
export const availableSpeechVoices = (): SpeechSynthesisVoice[] =>
    window.speechSynthesis?.getVoices() || [];

export const localSpeechVoices = (): SpeechSynthesisVoice[] =>
    availableSpeechVoices().filter(voice => voice.localService === true);

export class BrowserSpeechOutput {
    private utterance?: SpeechSynthesisUtterance;
    private activity?: (active: boolean) => void;
    private generation = 0;

    async speak(text: string, language: string, onActivity: (active: boolean) => void,
        voiceURI = ''): Promise<'spoken' | 'unavailable' | 'cancelled'> {
        const synthesis = window.speechSynthesis;
        if (!text.trim() || !synthesis || typeof SpeechSynthesisUtterance === 'undefined') return 'unavailable';
        this.cancel();
        const generation = ++this.generation;
        const locale = language.toLowerCase();
        const base = locale.split('-')[0];
        let voices = availableSpeechVoices();
        if (!voices.length) {
            await new Promise<void>(resolve => {
                const done = (): void => { clearTimeout(timer); synthesis.removeEventListener('voiceschanged', done); resolve(); };
                const timer = window.setTimeout(done, 1500);
                synthesis.addEventListener('voiceschanged', done);
                if (synthesis.getVoices().length) done();
            });
            voices = availableSpeechVoices();
        }
        if (generation !== this.generation) return 'cancelled';
        const voice = voiceURI
            ? voices.find(candidate => candidate.voiceURI === voiceURI || candidate.name === voiceURI)
            : voices.filter(candidate => candidate.localService === true)
                .find(candidate => candidate.lang.toLowerCase() === locale) ||
                voices.filter(candidate => candidate.localService === true)
                    .find(candidate => candidate.lang.toLowerCase().split('-')[0] === base);
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
        utterance.onerror = finish;
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
