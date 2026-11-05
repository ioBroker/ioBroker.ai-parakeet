/**
 * Texts that the adapter sends to the configuration dialog. Admin shows them as they are,
 * so they are translated here into the language of the system (German or English).
 */
const TEXTS = {
    status: { en: 'Status', de: 'Status' },
    ready: { en: 'ready', de: 'bereit' },
    idle: {
        en: 'model unloaded, it is loaded with the next request',
        de: 'Modell entladen, es wird mit der nächsten Anfrage geladen',
    },
    loading: { en: 'loading the model…', de: 'Modell wird geladen…' },
    downloading: { en: 'downloading the model: %s %', de: 'Modell wird heruntergeladen: %s %' },
    verifying: { en: 'checking the model files…', de: 'Modelldateien werden geprüft…' },
    starting: { en: 'starting…', de: 'startet…' },
    error: { en: 'error', de: 'Fehler' },
    modelDir: { en: 'Model directory', de: 'Modellverzeichnis' },
    threads: { en: 'CPU threads', de: 'CPU-Threads' },
    endpoint: { en: 'OpenAI-compatible API', de: 'OpenAI-kompatible API' },
    testPage: { en: 'Test page', de: 'Testseite' },
    testPageOff: { en: 'disabled', de: 'deaktiviert' },
    testPageInsecure: {
        en: 'At this address the browser blocks the microphone: it allows it only with HTTPS or on localhost. Enable HTTPS in the tab "Server", or open %s in a browser on the ioBroker host.',
        de: 'Unter dieser Adresse sperrt der Browser das Mikrofon: Er erlaubt es nur mit HTTPS oder auf localhost. Aktivieren Sie HTTPS im Tab "Server" oder öffnen Sie %s in einem Browser auf dem ioBroker-Host.',
    },
    queue: { en: 'Waiting requests', de: 'Wartende Anfragen' },
    assistantTitle: { en: 'Use it in ioBroker.assistant', de: 'Verwendung in ioBroker.assistant' },
    assistantText: {
        en: 'In the settings of ioBroker.assistant select the speech recognition "OpenAI (Whisper)" and enter %s as address of the speech recognition server.',
        de: 'Wählen Sie in den Einstellungen von ioBroker.assistant die Spracherkennung "OpenAI (Whisper)" und tragen Sie %s als Adresse des Spracherkennungs-Servers ein.',
    },
    assistantKey: {
        en: 'Enter the API key of this instance as key of the server.',
        de: 'Tragen Sie den API-Schlüssel dieser Instanz als Schlüssel des Servers ein.',
    },
    notRunning: {
        en: 'The server is not running. Look into the log of the instance.',
        de: 'Der Server läuft nicht. Sehen Sie im Log der Instanz nach.',
    },
    notReady: {
        en: 'The instance is still starting. Try again in a moment.',
        de: 'Die Instanz startet noch. Versuchen Sie es gleich noch einmal.',
    },
    testPageDisabled: {
        en: 'The test page is disabled in the instance settings.',
        de: 'Die Testseite ist in den Instanz-Einstellungen deaktiviert.',
    },
} as const;

export type TextId = keyof typeof TEXTS;

export function translate(language: string | undefined, id: TextId, ...args: (string | number)[]): string {
    const texts = TEXTS[id] as { en: string; de?: string };
    let text: string = (language === 'de' && texts.de) || texts.en;
    for (const arg of args) {
        text = text.replace('%s', String(arg));
    }
    return text;
}
