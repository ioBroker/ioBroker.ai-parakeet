// Live test of ioBroker.ai-parakeet as a web component (@iobroker/web-components), e.g. in the instance settings.
// It records the microphone and sends the audio with sendTo through the connection of the host (admin), so the
// server of the adapter needs no HTTPS - only the page of the host must run on HTTPS or on localhost.
// Plain JS without a build: it uses no base class, only the contract (socket, settings, theme, editMode).

const ADAPTER = 'ai-parakeet';
/** An answer of the instance takes longer: it does not run, or admin lost its connection */
const CALL_TIMEOUT = 15000;
/** Audio that waits for the previous message; more means the connection is too slow */
const MAX_PENDING_SAMPLES = 16000 * 8;
const FINISH_TIMEOUT = 120000;
const TICK = 200;
const POLL_INTERVAL = 400;

const TEXTS = {
    en: {
        start: 'Start microphone',
        stop: 'Stop microphone',
        clear: 'Clear text',
        applyCorrections: 'Apply the correction dictionary',
        withRules: 'Transcript with corrections',
        withoutRules: 'Transcript without corrections',
        mayChange: '· intermediate text may change until the sentence is finished',
        original: 'Original recognition · unchanged output of the model',
        placeholder: 'The recognized text appears here…',
        placeholderOriginal: 'The unchanged output of the model appears here…',
        needsSecure:
            'The browser blocks the microphone here: this page is opened over HTTP and not on localhost. Open admin over HTTPS, or as {local} in a browser on the ioBroker host.',
        needsBrowser: 'This browser cannot record the microphone (getUserMedia or AudioWorklet is missing).',
        noConnection: 'No connection to ioBroker.',
        noInstance: 'No instance of ai-parakeet found.',
        notRunning: 'The instance {instance} is not running.',
        editMode: 'The live test works outside of the editor.',
        ready: 'Ready · the audio goes through the connection of admin, no API key is needed',
        idle: 'Ready · the model is loaded with the first sentence',
        loading: 'The instance loads the model…',
        downloading: 'The instance downloads the model…',
        verifying: 'The instance checks the model files…',
        starting: 'The instance starts…',
        instanceError: 'The model cannot be used. See the status and the log of the instance.',
        askMic: 'Requesting the microphone…',
        active: 'Microphone on · the audio is recognized live',
        stopping: 'Stopping the microphone · the remaining audio is processed…',
        done: 'Microphone off · transcription finished',
        hidden: 'The microphone was stopped because the live test was hidden.',
        error: 'Error: {message}',
        noAnswer: 'The instance does not answer.',
        tooSlow: 'The connection is too slow for the audio.',
        stopFailed: 'The recording could not be finished.',
        finishTimeout: 'Finishing takes longer than 120 seconds; the instance may be overloaded.',
        noMeasurement: 'No measurement yet.',
        rules: '{rules} correction(s) loaded. The switch shows the text with or without them; the recognition itself does not change.',
        noRules: 'The correction dictionary is empty.',
        metrics: 'Inference: {inference} ms · queue: {queue} ms · audio: {audio} s · RTF: {rtf} · {kind}',
        final: 'sentence finished',
        partial: 'intermediate',
    },
    de: {
        start: 'Mikrofon starten',
        stop: 'Mikrofon stoppen',
        clear: 'Text löschen',
        applyCorrections: 'Korrekturwörterbuch anwenden',
        withRules: 'Transkript mit Korrekturen',
        withoutRules: 'Transkript ohne Korrekturen',
        mayChange: '· vorläufiger Text kann sich ändern, bis der Satz abgeschlossen ist',
        original: 'Originalerkennung · unveränderte Ausgabe des Modells',
        placeholder: 'Hier erscheint der erkannte Text…',
        placeholderOriginal: 'Hier erscheint die unveränderte Ausgabe des Modells…',
        needsSecure:
            'Der Browser sperrt hier das Mikrofon: Diese Seite ist über HTTP und nicht auf localhost geöffnet. Öffnen Sie den Admin über HTTPS oder als {local} in einem Browser auf dem ioBroker-Host.',
        needsBrowser: 'Dieser Browser kann das Mikrofon nicht aufnehmen (getUserMedia oder AudioWorklet fehlt).',
        noConnection: 'Keine Verbindung zu ioBroker.',
        noInstance: 'Keine Instanz von ai-parakeet gefunden.',
        notRunning: 'Die Instanz {instance} läuft nicht.',
        editMode: 'Der Live-Test funktioniert außerhalb des Editors.',
        ready: 'Bereit · das Audio läuft über die Verbindung des Admins, kein API-Schlüssel nötig',
        idle: 'Bereit · das Modell wird mit dem ersten Satz geladen',
        loading: 'Die Instanz lädt das Modell…',
        downloading: 'Die Instanz lädt das Modell herunter…',
        verifying: 'Die Instanz prüft die Modelldateien…',
        starting: 'Die Instanz startet…',
        instanceError: 'Das Modell kann nicht verwendet werden. Siehe Status und Log der Instanz.',
        askMic: 'Mikrofonzugriff wird angefragt…',
        active: 'Mikrofon an · das Audio wird live erkannt',
        stopping: 'Mikrofon wird gestoppt · restliches Audio wird verarbeitet…',
        done: 'Mikrofon aus · Transkription abgeschlossen',
        hidden: 'Das Mikrofon wurde gestoppt, weil der Live-Test ausgeblendet wurde.',
        error: 'Fehler: {message}',
        noAnswer: 'Die Instanz antwortet nicht.',
        tooSlow: 'Die Verbindung ist zu langsam für das Audio.',
        stopFailed: 'Die Aufnahme konnte nicht abgeschlossen werden.',
        finishTimeout: 'Der Abschluss dauert länger als 120 Sekunden; die Instanz ist möglicherweise überlastet.',
        noMeasurement: 'Noch keine Messung.',
        rules: '{rules} Korrektur(en) geladen. Der Schalter zeigt den Text mit oder ohne sie; die Erkennung selbst ändert sich nicht.',
        noRules: 'Das Korrekturwörterbuch ist leer.',
        metrics: 'Inferenz: {inference} ms · Warteschlange: {queue} ms · Audio: {audio} s · RTF: {rtf} · {kind}',
        final: 'Satz abgeschlossen',
        partial: 'vorläufig',
    },
};

/** The fields of the theme of the host and their CSS variables */
const THEME_VARIABLES = {
    primary: '--iob-primary',
    primaryContrast: '--iob-primary-contrast',
    secondary: '--iob-secondary',
    background: '--iob-background',
    paper: '--iob-paper',
    text: '--iob-text',
    textSecondary: '--iob-text-secondary',
    divider: '--iob-divider',
    error: '--iob-error',
    warning: '--iob-warning',
    success: '--iob-success',
    fontFamily: '--iob-font-family',
    fontSize: '--iob-font-size',
    borderRadius: '--iob-border-radius',
};

const STYLE = `
:host { display: block; width: 100%; height: 100%; color: var(--iob-text, inherit); font-family: var(--iob-font-family, inherit); font-size: var(--iob-font-size, inherit); }
* { box-sizing: border-box; }
.wrap { display: flex; flex-direction: column; gap: 6px; height: 100%; min-height: 0; }
.bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
button { font: inherit; font-weight: 500; padding: 6px 16px; border: 1px solid var(--iob-primary, #3399cc); border-radius: var(--iob-border-radius, 4px); background: var(--iob-primary, #3399cc); color: var(--iob-primary-contrast, #fff); cursor: pointer; }
button.secondary { background: transparent; color: var(--iob-primary, #3399cc); }
button:disabled { opacity: .45; cursor: default; }
button:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid var(--iob-secondary, #164477); outline-offset: 2px; }
.option { display: inline-flex; align-items: center; gap: 6px; margin-left: 4px; }
.status { min-height: 1.4em; }
.status.error { color: var(--iob-error, #d32f2f); }
.status.warning { color: var(--iob-warning, #ed6c02); }
.level { height: 4px; border-radius: 2px; background: var(--iob-divider, rgba(128, 128, 128, .25)); overflow: hidden; }
.level > div { height: 100%; width: 0; background: var(--iob-success, #2e7d32); transition: width .1s linear; }
.title { font-size: .85em; color: var(--iob-text-secondary, inherit); margin-top: 4px; }
textarea { width: 100%; resize: none; padding: 8px 10px; border: 1px solid var(--iob-divider, rgba(128, 128, 128, .4)); border-radius: var(--iob-border-radius, 4px); background: var(--iob-paper, transparent); color: inherit; font: inherit; line-height: 1.5; }
#text { flex: 2 1 0; min-height: 60px; }
#raw { flex: 1 1 0; min-height: 40px; }
.note { font-size: .8em; color: var(--iob-text-secondary, inherit); }
`;

const TEMPLATE = `
<div class="wrap">
  <div class="bar">
    <button id="start" disabled></button>
    <button id="stop" class="secondary" disabled></button>
    <button id="clear" class="secondary"></button>
    <label class="option"><input id="corrections" type="checkbox" checked disabled><span id="corrections-label"></span></label>
  </div>
  <div id="status" class="status" role="status"></div>
  <div class="level" aria-hidden="true"><div id="level"></div></div>
  <div id="correction-status" class="note"></div>
  <label id="text-label" class="title" for="text"></label>
  <textarea id="text" readonly></textarea>
  <label id="raw-label" class="title" for="raw"></label>
  <textarea id="raw" readonly></textarea>
  <div id="metrics" class="note"></div>
</div>
`;

/** 16-bit little-endian PCM as base64 */
function toBase64(samples) {
    const bytes = new Uint8Array(samples.length * 2);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < samples.length; i++) {
        const value = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(i * 2, Math.round(value < 0 ? value * 32768 : value * 32767), true);
    }
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
}

class AiParakeetLive extends HTMLElement {
    #socket = null;
    #settings = {};
    #theme = null;
    #editMode = false;
    #instance = '';
    /** The instance found for these settings and this socket */
    #resolved = '';
    #alive = null;
    #status = '';
    /** Text of a running or finished live test, shown instead of the status of the instance */
    #message = null;
    #session = null;
    #shown = null;
    #corrections = null;
    #subscribed = [];
    #onState = (id, state) => {
        if (id.endsWith('.alive')) {
            this.#alive = state ? !!state.val : null;
        } else {
            this.#status = state?.val ? String(state.val) : '';
        }
        this.#update();
    };

    constructor() {
        super();
        const root = this.attachShadow({ mode: 'open' });
        root.innerHTML = `<style>${STYLE}</style>${TEMPLATE}`;
        this.$ = id => root.getElementById(id);
        this.$('start').onclick = () => void this.#start();
        this.$('stop').onclick = () => this.#session && void this.#stop(this.#session);
        this.$('clear').onclick = () => {
            if (!this.#session) {
                this.#shown = null;
                this.#message = null;
                this.#render();
                this.#update();
                this.$('metrics').textContent = this.#t('noMeasurement');
            }
        };
        this.$('corrections').onchange = () => this.#render();
        // properties the host set before this class was defined
        for (const name of ['socket', 'settings', 'theme', 'editMode', 'dialogs', 'value']) {
            if (Object.prototype.hasOwnProperty.call(this, name)) {
                const value = this[name];
                delete this[name];
                this[name] = value;
            }
        }
    }

    get socket() {
        return this.#socket;
    }
    set socket(socket) {
        if (socket !== this.#socket) {
            this.#unsubscribe();
            this.#socket = socket || null;
            this.#resolved = '';
            this.#connect();
        }
    }

    get settings() {
        return this.#settings;
    }
    set settings(settings) {
        const previous = this.#settings?.instance;
        this.#settings = settings && typeof settings === 'object' ? settings : {};
        if (this.#settings.instance !== previous) {
            this.#unsubscribe();
            this.#resolved = '';
            this.#connect();
        }
    }

    get theme() {
        return this.#theme;
    }
    set theme(theme) {
        this.#theme = theme;
        if (theme && typeof theme === 'object') {
            for (const [field, name] of Object.entries(THEME_VARIABLES)) {
                const value = theme[field];
                if (value === undefined || value === null || value === '') {
                    this.style.removeProperty(name);
                } else {
                    this.style.setProperty(name, typeof value === 'number' ? `${value}px` : String(value));
                }
            }
        }
        const type = typeof theme === 'string' ? theme : theme?.type;
        this.style.colorScheme = type === 'dark' ? 'dark' : type === 'light' ? 'light' : '';
    }

    get editMode() {
        return this.#editMode;
    }
    set editMode(editMode) {
        this.#editMode = !!editMode;
        this.#update();
    }

    // `dialogs` and `value` of the contract are not used

    connectedCallback() {
        this.#applyTexts();
        this.#connect();
    }

    disconnectedCallback() {
        // no microphone while nobody sees it: e.g. another tab of the settings
        if (this.#session) {
            this.#fail(this.#session, null, this.#t('hidden'));
        }
        this.#unsubscribe();
    }

    get #lang() {
        const lang = this.#socket?.systemLang || document.documentElement.lang || navigator.language || 'en';
        return lang.toLowerCase().startsWith('de') ? 'de' : 'en';
    }

    #t(id, values = {}) {
        return (TEXTS[this.#lang][id] ?? TEXTS.en[id]).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
    }

    #applyTexts() {
        this.$('start').textContent = this.#t('start');
        this.$('stop').textContent = this.#t('stop');
        this.$('clear').textContent = this.#t('clear');
        this.$('corrections-label').textContent = this.#t('applyCorrections');
        this.$('raw-label').textContent = this.#t('original');
        this.$('text').placeholder = this.#t('placeholder');
        this.$('raw').placeholder = this.#t('placeholderOriginal');
        if (!this.$('metrics').textContent) {
            this.$('metrics').textContent = this.#t('noMeasurement');
        }
        this.#setCorrections(this.#corrections);
        this.#render();
        this.#update();
    }

    /** Finds the instance and subscribes its status */
    async #connect() {
        const socket = this.#socket;
        if (!socket || !this.isConnected || this.#resolved) {
            this.#update();
            return;
        }
        this.#applyTexts();
        let instance = '';
        try {
            instance = await this.#findInstance(socket);
        } catch {
            // no instance
        }
        // the socket or the settings changed meanwhile
        if (socket !== this.#socket || !this.isConnected || this.#resolved) {
            return;
        }
        this.#instance = instance;
        this.#resolved = instance || '-';
        if (instance) {
            this.#subscribed = [`system.adapter.${instance}.alive`, `${instance}.info.status`];
            for (const id of this.#subscribed) {
                Promise.resolve(socket.getState(id)).then(
                    state => this.#onState(id, state),
                    () => {},
                );
            }
            Promise.resolve(socket.subscribeState(this.#subscribed, this.#onState)).catch(() => {});
        }
        this.#update();
    }

    async #findInstance(socket) {
        const setting = String(this.#settings?.instance || '').replace(/^system\.adapter\./, '');
        if (new RegExp(`^${ADAPTER}\\.\\d+$`).test(setting)) {
            return setting;
        }
        // jsonConfig gives "ai-parakeet.${_instance}"; an admin without `_instance` in its patterns sends the
        // pattern as it is, then the address tells the settings of which instance are open
        const match = new RegExp(`system\\.adapter\\.${ADAPTER}\\.(\\d+)`).exec(decodeURIComponent(location.href));
        if (match) {
            return `${ADAPTER}.${match[1]}`;
        }
        const instances = await socket.getObjectViewSystem(
            'instance',
            `system.adapter.${ADAPTER}.`,
            `system.adapter.${ADAPTER}.香`,
        );
        const first = Object.keys(instances || {}).sort()[0];
        return first ? first.replace(/^system\.adapter\./, '') : '';
    }

    #unsubscribe() {
        if (this.#subscribed.length) {
            try {
                this.#socket?.unsubscribeState(this.#subscribed, this.#onState);
            } catch {
                // the connection is gone
            }
        }
        this.#subscribed = [];
        this.#alive = null;
        this.#status = '';
        // found again on the next connect: the element may come back with another socket
        this.#resolved = '';
    }

    /** Why the live test cannot start, '' if it can */
    #blocker() {
        if (this.#editMode) {
            return ['editMode', 'warning'];
        }
        if (!window.isSecureContext) {
            const local = `http://localhost${location.port ? `:${location.port}` : ''}/`;
            return [this.#t('needsSecure', { local }), 'warning', true];
        }
        if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) {
            return ['needsBrowser', 'error'];
        }
        if (!this.#socket) {
            return ['noConnection', 'warning'];
        }
        if (this.#resolved === '-') {
            return ['noInstance', 'error'];
        }
        if (!this.#resolved) {
            return ['starting', ''];
        }
        if (this.#alive === false) {
            return [this.#t('notRunning', { instance: this.#instance }), 'warning', true];
        }
        if (this.#status === 'error') {
            return ['instanceError', 'error'];
        }
        if (this.#status && this.#status !== 'ready' && this.#status !== 'idle') {
            return [TEXTS.en[this.#status] ? this.#status : 'loading', ''];
        }
        return null;
    }

    /** Buttons and status line: the running test, else what blocks a test, else the result of the last one */
    #update() {
        const blocker = this.#session ? null : this.#blocker();
        let text;
        let kind;
        if (this.#session) {
            [text, kind] = this.#message || ['', ''];
        } else if (blocker) {
            text = blocker[2] ? blocker[0] : this.#t(blocker[0]);
            kind = blocker[1];
        } else if (this.#message) {
            [text, kind] = this.#message;
        } else {
            text = this.#t(this.#status === 'idle' ? 'idle' : 'ready');
            kind = '';
        }
        const status = this.$('status');
        status.textContent = text;
        status.className = `status ${kind}`;
        this.$('start').disabled = !!this.#session || !!blocker;
        this.$('stop').disabled = !this.#session?.node || this.#session.stopping;
        this.$('clear').disabled = !!this.#session;
    }

    #say(text, kind = '') {
        this.#message = [text, kind];
        this.#update();
    }

    #setCorrections(corrections) {
        this.#corrections = corrections || null;
        const toggle = this.$('corrections');
        toggle.disabled = !corrections?.enabled;
        if (corrections && !corrections.enabled) {
            toggle.checked = false;
        }
        this.$('correction-status').textContent = corrections
            ? corrections.enabled
                ? this.#t('rules', { rules: corrections.rules })
                : this.#t('noRules')
            : '';
        this.#render();
    }

    /** Both text fields from the sentences of the shown test */
    #render() {
        const segments = [...(this.#shown?.segments || new Map()).entries()]
            .sort(([a], [b]) => a - b)
            .map(([, value]) => value);
        const corrected = this.$('corrections').checked;
        const raw = value => value.rawText ?? value.text;
        const text = this.$('text');
        const original = this.$('raw');
        text.value = segments
            .map(value => (corrected ? (value.correctedText ?? value.text) : raw(value)))
            .filter(Boolean)
            .join('\n');
        original.value = segments.map(raw).filter(Boolean).join('\n');
        this.$('text-label').textContent =
            `${this.#t(corrected ? 'withRules' : 'withoutRules')} ${this.#t('mayChange')}`;
        text.scrollTop = text.scrollHeight;
        original.scrollTop = original.scrollHeight;
    }

    /** sendTo to the instance, with a timeout: the connection of the host has none */
    #call(data) {
        const socket = this.#socket;
        if (!socket || !this.#instance) {
            return Promise.reject(new Error(this.#t('noConnection')));
        }
        let timer;
        return Promise.race([
            socket.sendTo(this.#instance, 'live', data),
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error(this.#t('noAnswer'))), CALL_TIMEOUT);
            }),
        ]).finally(() => clearTimeout(timer));
    }

    async #start() {
        if (this.#session || this.#blocker()) {
            return;
        }
        const session = {
            id: '',
            seq: 0,
            pending: [],
            pendingSamples: 0,
            inFlight: false,
            lastCall: 0,
            stopping: false,
            stopRequested: false,
            stopSent: false,
            finished: false,
            segments: new Map(),
        };
        this.#session = session;
        this.#shown = session;
        this.#render();
        this.$('metrics').textContent = this.#t('noMeasurement');
        this.#say(this.#t('askMic'));
        try {
            // created in the click, so that the browser lets it play
            session.context = new AudioContext({ sampleRate: 16000 });
            await session.context.resume();
            session.stream = await navigator.mediaDevices.getUserMedia({
                audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            });
            if (session.finished) {
                await this.#releaseMicrophone(session);
                return;
            }
            const answer = await this.#call({ action: 'start' });
            if (answer?.error) {
                throw new Error(answer.error);
            }
            if (session.finished) {
                this.#call({ action: 'cancel', id: answer.id }).catch(() => {});
                return;
            }
            session.id = answer.id;
            this.#setCorrections(answer.corrections);
            try {
                session.source = session.context.createMediaStreamSource(session.stream);
            } catch {
                // Firefox does not connect a microphone to a context with another sample rate: the worklet resamples
                await session.context.close();
                session.context = new AudioContext();
                await session.context.resume();
                session.source = session.context.createMediaStreamSource(session.stream);
            }
            await session.context.audioWorklet.addModule(new URL('./capture.js', import.meta.url).href);
            if (session.finished) {
                return;
            }
            session.node = new AudioWorkletNode(session.context, 'capture');
            session.node.port.onmessage = ({ data }) => this.#onAudio(session, data);
            session.source.connect(session.node);
            session.node.connect(session.context.destination);
            for (const track of session.stream.getAudioTracks()) {
                track.onended = () => void this.#stop(session);
            }
            session.timer = setInterval(() => void this.#tick(session), TICK);
            this.#say(this.#t('active'));
        } catch (error) {
            this.#fail(session, error);
        }
    }

    #onAudio(session, data) {
        if (data.stopped) {
            session.flushed?.();
            return;
        }
        if (session.finished || session.stopRequested) {
            return;
        }
        const pcm = new Float32Array(data.pcm);
        let energy = 0;
        for (const sample of pcm) {
            energy += sample * sample;
        }
        const level = Math.min(1, Math.sqrt(Math.sqrt(energy / (pcm.length || 1))) * 2.5);
        this.$('level').style.width = `${Math.round(level * 100)}%`;
        session.pending.push(pcm);
        session.pendingSamples += pcm.length;
        if (session.pendingSamples > MAX_PENDING_SAMPLES) {
            this.#fail(session, new Error(this.#t('tooSlow')));
        }
    }

    /** Sends one message at a time: the audio that came meanwhile, then `stop`, then polls for the rest */
    async #tick(session) {
        if (session.inFlight || session.finished || !session.id) {
            return;
        }
        let request;
        if (session.pending.length) {
            const pcm = new Float32Array(session.pendingSamples);
            let offset = 0;
            for (const chunk of session.pending) {
                pcm.set(chunk, offset);
                offset += chunk.length;
            }
            session.pending = [];
            session.pendingSamples = 0;
            request = { action: 'audio', id: session.id, seq: ++session.seq, pcm: toBase64(pcm) };
        } else if (session.stopRequested && !session.stopSent) {
            session.stopSent = true;
            request = { action: 'stop', id: session.id, seq: ++session.seq };
        } else if (Date.now() - session.lastCall >= POLL_INTERVAL) {
            request = { action: 'poll', id: session.id };
        } else {
            return;
        }
        session.inFlight = true;
        try {
            const answer = await this.#call(request);
            if (session.finished) {
                return;
            }
            if (answer?.error) {
                throw new Error(answer.error);
            }
            for (const event of answer?.events || []) {
                this.#onEvent(session, event);
            }
        } catch (error) {
            this.#fail(session, error);
        } finally {
            session.inFlight = false;
            session.lastCall = Date.now();
        }
    }

    #onEvent(session, event) {
        if (session.finished) {
            return;
        }
        if (event.type === 'transcript') {
            if (!session.segments.get(event.segment)?.final) {
                session.segments.set(event.segment, event);
            }
            if (this.#shown === session) {
                this.#render();
            }
            const rtf = event.inferenceMs / (event.audioSeconds * 1000);
            this.$('metrics').textContent = this.#t('metrics', {
                inference: Math.round(event.inferenceMs),
                queue: Math.round(event.queueMs),
                audio: event.audioSeconds.toFixed(1),
                rtf: rtf.toFixed(2),
                kind: this.#t(event.final ? 'final' : 'partial'),
            });
        } else if (event.type === 'done') {
            this.#finish(session, false);
            this.#say(this.#t('done'));
        } else if (event.type === 'error') {
            throw new Error(event.message);
        }
    }

    async #stop(session) {
        if (this.#session !== session || session.stopping || session.finished || !session.node) {
            return;
        }
        session.stopping = true;
        this.#say(this.#t('stopping'));
        try {
            // the worklet sends what it still has, then `stopped`
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error(this.#t('stopFailed'))), 3000);
                session.flushed = () => {
                    clearTimeout(timeout);
                    resolve();
                };
                session.node.port.postMessage('stop');
            });
            session.stopRequested = true;
            await this.#releaseMicrophone(session);
            session.finishTimer = setTimeout(
                () => this.#fail(session, new Error(this.#t('finishTimeout'))),
                FINISH_TIMEOUT,
            );
        } catch (error) {
            this.#fail(session, error);
        }
    }

    /**
     * Ends the test with an error
     *
     * @param session the test
     * @param error the error, or null with `text`
     * @param text a text instead of the error
     */
    #fail(session, error, text) {
        if (this.#session !== session || session.finished) {
            return;
        }
        this.#finish(session, true);
        this.#say(text || this.#t('error', { message: error?.message || String(error) }), text ? 'warning' : 'error');
    }

    /** Releases everything; `cancel` tells the instance to drop the session */
    #finish(session, cancel) {
        session.finished = true;
        clearInterval(session.timer);
        clearTimeout(session.finishTimer);
        void this.#releaseMicrophone(session);
        if (cancel && session.id) {
            this.#call({ action: 'cancel', id: session.id }).catch(() => {});
        }
        if (this.#session === session) {
            this.#session = null;
        }
        this.$('level').style.width = '0';
        this.#update();
    }

    async #releaseMicrophone(session) {
        session.stream?.getTracks().forEach(track => track.stop());
        session.node?.disconnect();
        session.source?.disconnect();
        if (session.context && session.context.state !== 'closed') {
            await session.context.close().catch(() => {});
        }
    }
}

if (!customElements.get('ai-parakeet-live')) {
    customElements.define('ai-parakeet-live', AiParakeetLive);
}
