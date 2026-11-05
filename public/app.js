// Test page of ioBroker.ai-parakeet: streams the microphone (16 kHz Float32) over a WebSocket to the adapter
const TEXTS = {
  en: {
    title: 'Live speech recognition',
    intro: 'German, English and 23 more European languages. The ioBroker host transcribes the audio of your microphone; it is not stored.',
    key: 'API key',
    start: 'Start microphone', stop: 'Stop microphone', clear: 'Clear text',
    applyCorrections: 'Apply the correction dictionary',
    original: 'Original recognition', originalHint: '· unchanged output of the model for comparison',
    note: 'When you stop the microphone, the remaining audio is still processed. Intermediate text may change until the sentence is finished.',
    checking: 'Checking the server…',
    needsSecure: 'The microphone needs a current browser and HTTPS (or localhost). Enable HTTPS in the instance settings.',
    ready: 'Ready · CPU · {threads} thread(s) · {clients} browser(s) connected',
    idle: 'Ready · the model is loaded with the first sentence',
    loading: 'The server loads the model…',
    downloading: 'The server downloads the model…',
    verifying: 'The server checks the model files…',
    starting: 'The server starts…',
    keyNeeded: 'Enter the API key of the instance.',
    askMic: 'Requesting the microphone…',
    active: 'Microphone on · audio is streamed to the server',
    stopping: 'Stopping the microphone · the remaining audio is processed…',
    done: 'Microphone off · transcription finished',
    error: 'Error: {message}',
    noAnswer: 'The server does not answer.',
    wsFailed: 'WebSocket connection failed. Is the server ready, or are too many browsers connected?',
    interrupted: 'Connection interrupted; the remaining audio was dropped.',
    tooSlow: 'The connection is too slow for the audio.',
    stopFailed: 'The recording could not be finished.',
    lostOnStop: 'The connection was lost while stopping.',
    finishTimeout: 'Finishing takes longer than 120 seconds; the server may be overloaded.',
    noMeasurement: 'No measurement yet.',
    rules: '{rules} correction(s) loaded. The switch shows the text with or without corrections; the recognition itself does not change.',
    noRules: 'The correction dictionary is empty.',
    withRules: 'Transcript with corrections', withoutRules: 'Transcript without corrections',
    mayChange: '· intermediate text may change',
    placeholder: 'The recognized text appears here…', placeholderOriginal: 'The unchanged output of the model appears here…',
    metrics: 'Inference: {inference} ms · queue: {queue} ms · audio: {audio} s · RTF: {rtf} · {kind}',
    final: 'sentence finished', partial: 'intermediate',
  },
  de: {
    title: 'Live-Spracherkennung',
    intro: 'Deutsch, Englisch und 23 weitere europäische Sprachen. Der ioBroker-Host transkribiert das Audio deines Mikrofons; es wird nicht gespeichert.',
    key: 'API-Schlüssel',
    start: 'Mikrofon starten', stop: 'Mikrofon stoppen', clear: 'Text löschen',
    applyCorrections: 'Korrekturwörterbuch anwenden',
    original: 'Originalerkennung', originalHint: '· unveränderte Modellausgabe zum Vergleich',
    note: 'Nach dem Stoppen wird das restliche Audio noch verarbeitet. Vorläufiger Text kann sich ändern, bis der Satz abgeschlossen ist.',
    checking: 'Server wird geprüft…',
    needsSecure: 'Das Mikrofon braucht einen aktuellen Browser und HTTPS (oder localhost). Aktiviere HTTPS in den Instanz-Einstellungen.',
    ready: 'Bereit · CPU · {threads} Thread(s) · {clients} Browser verbunden',
    idle: 'Bereit · das Modell wird mit dem ersten Satz geladen',
    loading: 'Der Server lädt das Modell…',
    downloading: 'Der Server lädt das Modell herunter…',
    verifying: 'Der Server prüft die Modelldateien…',
    starting: 'Der Server startet…',
    keyNeeded: 'Gib den API-Schlüssel der Instanz ein.',
    askMic: 'Mikrofonzugriff wird angefragt…',
    active: 'Mikrofon an · Audio wird zum Server gestreamt',
    stopping: 'Mikrofon wird gestoppt · restliches Audio wird verarbeitet…',
    done: 'Mikrofon aus · Transkription abgeschlossen',
    error: 'Fehler: {message}',
    noAnswer: 'Der Server antwortet nicht.',
    wsFailed: 'WebSocket-Verbindung fehlgeschlagen. Ist der Server bereit oder sind zu viele Browser verbunden?',
    interrupted: 'Verbindung unterbrochen; das restliche Audio wurde verworfen.',
    tooSlow: 'Die Verbindung ist zu langsam für das Audio.',
    stopFailed: 'Die Aufnahme konnte nicht abgeschlossen werden.',
    lostOnStop: 'Die Verbindung ging beim Stoppen verloren.',
    finishTimeout: 'Der Abschluss dauert länger als 120 Sekunden; der Server ist möglicherweise überlastet.',
    noMeasurement: 'Noch keine Messung.',
    rules: '{rules} Korrektur(en) geladen. Der Schalter zeigt den Text mit oder ohne Korrektur; die Erkennung selbst ändert sich nicht.',
    noRules: 'Das Korrekturwörterbuch ist leer.',
    withRules: 'Transkript mit Korrekturen', withoutRules: 'Transkript ohne Korrekturen',
    mayChange: '· vorläufiger Text kann sich ändern',
    placeholder: 'Hier erscheint der erkannte Text…', placeholderOriginal: 'Hier erscheint die unveränderte Modellausgabe…',
    metrics: 'Inferenz: {inference} ms · Warteschlange: {queue} ms · Audio: {audio} s · RTF: {rtf} · {kind}',
    final: 'Satz abgeschlossen', partial: 'vorläufig',
  },
};
const lang = (navigator.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en';
const t = (id, values = {}) => TEXTS[lang][id].replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
document.documentElement.lang = lang;
for (const element of document.querySelectorAll('[data-i18n]')) element.textContent = t(element.dataset.i18n);

const startButton = document.querySelector('#start');
const stopButton = document.querySelector('#stop');
const clearButton = document.querySelector('#clear');
const status = document.querySelector('#status');
const transcript = document.querySelector('#transcript');
const metrics = document.querySelector('#metrics');
const original = document.querySelector('#original');
const correctionToggle = document.querySelector('#corrections');
const correctionStatus = document.querySelector('#correction-status');
const transcriptLabel = document.querySelector('#transcript-label');
const keyRow = document.querySelector('#key-row');
const keyInput = document.querySelector('#key');
transcript.placeholder = t('placeholder');
original.placeholder = t('placeholderOriginal');
metrics.textContent = t('noMeasurement');
status.textContent = t('checking');
let active = null;
let displayedSession = null;
let checking = false;
let needsKey = false;

try { keyInput.value = sessionStorage.getItem('ai-parakeet-key') || ''; } catch { /* storage blocked */ }
keyInput.oninput = () => {
  try { sessionStorage.setItem('ai-parakeet-key', keyInput.value); } catch { /* storage blocked */ }
  void health();
};

function setCorrectionStatus(corrections) {
  correctionToggle.disabled = !corrections?.enabled;
  if (!corrections?.enabled) correctionToggle.checked = false;
  correctionStatus.textContent = corrections?.enabled ? t('rules', { rules: corrections.rules }) : t('noRules');
  render(displayedSession);
}

async function health() {
  if (active || checking) return;
  checking = true;
  try {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) {
      throw new Error(t('needsSecure'));
    }
    const response = await fetch('health');
    const data = await response.json();
    needsKey = !!data.auth;
    keyRow.hidden = !needsKey;
    // Do not reset the checkbox of the user while the model is still loading
    if (data.ready) setCorrectionStatus(data.corrections);
    const keyMissing = needsKey && !keyInput.value.trim();
    startButton.disabled = !data.ready || keyMissing;
    if (data.status === 'error') status.textContent = t('error', { message: data.error || '' });
    else if (!data.ready) status.textContent = t(TEXTS[lang][data.status] ? data.status : 'loading');
    else if (keyMissing) status.textContent = t('keyNeeded');
    else status.textContent = data.status === 'idle' ? t('idle') : t('ready', { threads: data.threads, clients: data.clients });
  } catch (error) { startButton.disabled = true; status.textContent = error.message; }
  finally { checking = false; }
}
void health(); setInterval(health, 5000);

async function releaseMicrophone(session) {
  session.stream?.getTracks().forEach(track => track.stop());
  session.node?.disconnect(); session.source?.disconnect();
  if (session.context && session.context.state !== 'closed') await session.context.close();
}
async function cleanup(session) {
  if (active !== session) return;
  clearTimeout(session.timeout);
  session.finished = true;
  await releaseMicrophone(session);
  if (session.socket && session.socket.readyState < WebSocket.CLOSING) session.socket.close();
  if (active === session) active = null;
  stopButton.disabled = true; clearButton.disabled = false;
  startButton.disabled = false;
}
async function fail(session, error) {
  if (active !== session || session.finished) return;
  status.textContent = t('error', { message: error.message });
  await cleanup(session);
}
function render(session) {
  const segments = [...(session?.segments || new Map()).entries()].sort(([a], [b]) => a - b).map(([, value]) => value);
  const raw = value => value.rawText ?? value.text;
  transcript.value = segments.map(value => correctionToggle.checked ? (value.correctedText ?? value.text) : raw(value)).filter(Boolean).join('\n');
  original.value = segments.map(raw).filter(Boolean).join('\n');
  transcriptLabel.textContent = `${correctionToggle.checked ? t('withRules') : t('withoutRules')} ${t('mayChange')}`;
  transcript.scrollTop = transcript.scrollHeight;
  original.scrollTop = original.scrollHeight;
}
render(null);
correctionToggle.onchange = () => render(displayedSession);
startButton.onclick = async () => {
  if (active) return;
  const session = { segments: new Map(), stopping: false, finished: false };
  displayedSession = session;
  active = session; startButton.disabled = true; clearButton.disabled = true;
  render(session); metrics.textContent = t('noMeasurement');
  status.textContent = t('askMic');
  try {
    session.context = new AudioContext({ sampleRate: 16000 });
    await session.context.resume();
    session.stream = await navigator.mediaDevices.getUserMedia({ audio: {
      channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true,
    } });
    if (session.finished) { await releaseMicrophone(session); return; }
    await session.context.audioWorklet.addModule('capture.js');
    const url = new URL('audio', location.href);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = session.socket = new WebSocket(url);
    socket.binaryType = 'arraybuffer';
    session.timeout = setTimeout(() => void fail(session, new Error(t('noAnswer'))), 15000);
    socket.onopen = () => socket.send(JSON.stringify({ type: 'hello', key: keyInput.value.trim() || undefined }));
    socket.onerror = () => void fail(session, new Error(t('wsFailed')));
    socket.onclose = () => {
      if (!session.finished) void fail(session, new Error(t('interrupted')));
    };
    socket.onmessage = async ({ data }) => {
      try {
        const message = JSON.parse(data);
        if (message.type === 'ready') {
          setCorrectionStatus(message.corrections);
          clearTimeout(session.timeout);
          session.node = new AudioWorkletNode(session.context, 'capture');
          session.node.port.onmessage = ({ data: audio }) => {
            if (audio.stopped) { session.flushed?.(); return; }
            if (session.finished || socket.readyState !== WebSocket.OPEN) return;
            if (socket.bufferedAmount > 256000) { void fail(session, new Error(t('tooSlow'))); return; }
            // Little-endian, independent of the client architecture
            const pcm = new Float32Array(audio.pcm);
            const bytes = new ArrayBuffer(pcm.byteLength); const view = new DataView(bytes);
            for (let i = 0; i < pcm.length; i++) view.setFloat32(i * 4, pcm[i], true);
            socket.send(bytes);
          };
          session.source = session.context.createMediaStreamSource(session.stream);
          session.source.connect(session.node); session.node.connect(session.context.destination);
          for (const track of session.stream.getAudioTracks()) track.onended = () => {
            if (!session.stopping && !session.finished) void stopRecording(session);
          };
          status.textContent = t('active'); stopButton.disabled = false;
        } else if (message.type === 'transcript') {
          const previous = session.segments.get(message.segment);
          if (!previous?.final) session.segments.set(message.segment, message);
          render(session);
          const rtf = message.inferenceMs / (message.audioSeconds * 1000);
          metrics.textContent = t('metrics', {
            inference: Math.round(message.inferenceMs), queue: Math.round(message.queueMs),
            audio: message.audioSeconds.toFixed(1), rtf: rtf.toFixed(2), kind: message.final ? t('final') : t('partial'),
          });
        } else if (message.type === 'done') {
          status.textContent = t('done'); await cleanup(session);
        } else if (message.type === 'error') {
          if (message.auth) { keyRow.hidden = false; keyInput.focus(); }
          throw new Error(message.message);
        }
      } catch (error) { await fail(session, error); }
    };
  } catch (error) { await fail(session, error); }
};
async function stopRecording(session) {
  if (active !== session || session.stopping || session.finished) return;
  session.stopping = true; stopButton.disabled = true;
  status.textContent = t('stopping');
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(t('stopFailed'))), 3000);
      session.flushed = () => { clearTimeout(timeout); resolve(); };
      session.node.port.postMessage('stop');
    });
    await releaseMicrophone(session);
    if (session.socket.readyState !== WebSocket.OPEN) throw new Error(t('lostOnStop'));
    session.socket.send(JSON.stringify({ type: 'stop' }));
    clearTimeout(session.timeout);
    session.timeout = setTimeout(() => void fail(session, new Error(t('finishTimeout'))), 120000);
  } catch (error) { await fail(session, error); }
}
stopButton.onclick = () => { if (active) void stopRecording(active); };
clearButton.onclick = () => { if (!active) { displayedSession = null; render(null); metrics.textContent = t('noMeasurement'); } };
window.addEventListener('pagehide', () => {
  if (!active) return;
  active.stream?.getTracks().forEach(track => track.stop()); active.socket?.close();
});
