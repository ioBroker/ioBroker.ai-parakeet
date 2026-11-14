import type { WebComponentManifest } from '@iobroker/web-components';

const label = (en: string, de: string): { en: string; de: string } => ({ en, de });
const number = (en: string, de: string, value: number, min: number, max: number) =>
    ({ type: 'number' as const, label: label(en, de), default: value, min, max });

export const manifest: WebComponentManifest = {
    $schema: 'https://raw.githubusercontent.com/ioBroker/web-components/main/schemas/manifest.json',
    manifestVersion: 1,
    tag: 'iob-wakeword',
    name: label('Wake word microphone', 'Aktivierungswort-Mikrofon'),
    description: label('Local voice input through ai-parakeet', 'Lokale Spracheingabe über ai-parakeet'),
    icon: 'wakeword.svg',
    module: 'wakeword.js',
    size: { width: 320, height: 220 },
    settings: {
        type: 'panel',
        items: {
            parakeet: { type: 'instance', adapter: 'ai-parakeet', default: 'ai-parakeet.0', label: label('Parakeet instance', 'Parakeet-Instanz') },
            autoStart: { type: 'checkbox', default: false, label: label('Start microphone when loaded', 'Mikrofon beim Laden aktivieren') },
            mode: { type: 'select', default: 'wakeword', label: label('Activation mode', 'Aktivierungsmodus'), options: [
                { value: 'wakeword', label: label('Wake word', 'Aktivierungswort') },
                { value: 'ptt', label: label('Push to talk', 'Sprechtaste') },
                { value: 'combined', label: label('Both', 'Beide') },
            ] },
            microphone: { type: 'text', default: '', label: label('Microphone device ID (optional)', 'Mikrofon-Geräte-ID (optional)') },
            ringBufferMs: number('Ring buffer (ms)', 'Ringpuffer (ms)', 1000, 0, 3000),
            stripWakeword: { type: 'checkbox', default: false, label: label('Exclude wake word from sent audio', 'Aktivierungswort nicht übertragen') },
            threshold: number('VAD threshold (0–1)', 'VAD-Schwelle (0–1)', 0.015, 0.001, 1),
            minSpeechMs: number('Minimum speech (ms)', 'Minimale Sprachdauer (ms)', 250, 0, 5000),
            silenceMs: number('Trailing silence (ms)', 'Stille nach Sprache (ms)', 1200, 100, 10000),
            noSpeechMs: number('No-speech timeout (ms)', 'Wartezeit nach Aktivierung (ms)', 5000, 500, 20000),
            maxRecordMs: number('Maximum recording (ms)', 'Maximale Aufnahme (ms)', 15000, 1000, 60000),
            activationTone: { type: 'checkbox', default: false, label: label('Activation sound', 'Aktivierungston') },
            completionTone: { type: 'checkbox', default: false, label: label('Completion sound', 'Abschlusston') },
            showText: { type: 'checkbox', default: true, label: label('Show recognized text', 'Erkannten Text anzeigen') },
            showInterim: { type: 'checkbox', default: true, label: label('Show interim text', 'Zwischenresultate anzeigen') },
            compact: { type: 'checkbox', default: false, label: label('Compact view', 'Kompakte Darstellung') },
            language: { type: 'select', default: 'auto', label: label('Interface language', 'Sprache der Oberfläche'), options: [
                { value: 'auto', label: label('Automatic', 'Automatisch') }, { value: 'de', label: 'Deutsch' }, { value: 'en', label: 'English' },
            ] },
            accentColor: { type: 'color', default: '#2563eb', label: label('Accent color', 'Akzentfarbe') },
            fontSize: number('Font size override (0 = VIS CSS)', 'Schriftgröße überschreiben (0 = VIS-CSS)', 0, 0, 40),
            resultState: { type: 'objectId', label: label('Result state (optional)', 'Ergebnis-Datenpunkt (optional)') },
            statusState: { type: 'objectId', label: label('Status state (optional)', 'Status-Datenpunkt (optional)') },
            errorState: { type: 'objectId', label: label('Error state (optional)', 'Fehler-Datenpunkt (optional)') },
            processorType: { type: 'select', default: 'none', label: label('Text processor', 'Textverarbeitung'), options: [
                { value: 'none', label: label('None', 'Keine') },
                { value: 'smart-text2command', label: 'smart-text2command' },
            ] },
            processorInstance: { type: 'instance', adapter: 'smart-text2command',
                label: label('Processor instance', 'Instanz für Textverarbeitung'),
                hidden: "data.processorType !== 'smart-text2command'" },
            processorMode: { type: 'select', default: 'execute', label: label('Processing mode', 'Verarbeitungsmodus'),
                hidden: "data.processorType !== 'smart-text2command'", options: [
                    { value: 'execute', label: label('Execute approved commands', 'Freigegebene Befehle ausführen') },
                    { value: 'analyze', label: label('Analyze only', 'Nur analysieren') },
                ] },
            showChat: { type: 'checkbox', default: false, label: label('Show conversation', 'Chatverlauf anzeigen') },
            maxChatMessages: number('Chat messages to keep', 'Nachrichten im Chat behalten', 50, 1, 200),
            speechEnabled: { type: 'checkbox', default: false,
                label: label('Speak processor replies with a browser voice', 'Antworten mit Browserstimme vorlesen') },
            speechVoiceURI: { type: 'select', default: '', label: label('Speech voice', 'Sprachausgabe-Stimme'),
                hidden: '!data.speechEnabled', options: [
                    { value: '', label: label('Automatic (local)', 'Automatisch (lokal)') },
                    { value: 'Google Deutsch', label: 'Google Deutsch (remote)' },
                    { value: 'custom', label: label('Other browser voice', 'Andere Browserstimme') },
                ] },
            speechVoiceCustom: { type: 'text', default: '',
                label: label('Voice name or URI (as shown by the browser)', 'Stimmenname oder URI (laut Browser)'),
                hidden: "!data.speechEnabled || data.speechVoiceURI !== 'custom'",
                help: label('Enter a voice available in the browser used by the VIS page. A remote voice may transmit reply text to its provider.',
                    'Eine im Browser der VIS-Seite verfügbare Stimme eintragen. Eine Remote-Stimme kann den Antworttext an ihren Anbieter übertragen.') },
            forwardInstance: { type: 'text', default: '', label: label('Forward to adapter instance (optional)', 'An Adapter-Instanz weiterleiten (optional)') },
            forwardCommand: { type: 'text', default: '', label: label('Forward command', 'Weiterleitungsbefehl') },
        },
    },
};
