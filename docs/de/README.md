![Logo](../../admin/ai-parakeet.svg)

# ioBroker.ai-parakeet

Lokale Offline-Spracherkennung für ioBroker mit [NVIDIA Parakeet TDT 0.6B v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3). Das Modell läuft mit ONNX Runtime auf der CPU des ioBroker-Hosts. Es braucht weder Cloud noch Grafikkarte noch Docker.

- **25 europäische Sprachen**, die Sprache wird automatisch erkannt (Deutsch, Englisch, Französisch, Italienisch, Spanisch, Niederländisch, Polnisch, Russisch, Ukrainisch, Portugiesisch und weitere), mit Satzzeichen und Groß-/Kleinschreibung
- **OpenAI-kompatible API** `POST /v1/audio/transcriptions`: Alles, was die Whisper-API von OpenAI nutzen kann, kann auch diesen Adapter nutzen, z. B. [ioBroker.assistant](https://github.com/ioBroker/ioBroker.assistant)
- **sendTo** für Skripte, z. B. um Sprachnachrichten zu transkribieren
- **Testseite** mit Live-Erkennung des Mikrofons im Browser
- **Korrekturwörterbuch** für Wörter, die das Modell nicht kennt

## Geschwindigkeit und Speicher

Das Modell ist INT8-quantisiert (etwa 670 MB) und braucht etwa **1,1 GB Arbeitsspeicher**. Gemessene Zeiten für einen Befehl von 3 bis 6 Sekunden:

| Host | CPU-Threads | Rechenzeit | Echtzeitfaktor |
|---|---|---|---|
| Raspberry Pi 5 (8 GB), mit laufendem Frigate | 3 | 0,5 - 1,1 s | etwa 0,2 |
| Intel Core i9-14900HX | 4 | 0,1 - 0,3 s | etwa 0,03 - 0,05 |

Der Echtzeitfaktor ist die Rechenzeit geteilt durch die Länge des Audios: 0,2 bedeutet, 10 Sekunden Sprache werden in 2 Sekunden erkannt. Ein Raspberry Pi 4 sollte auch gehen, wurde aber nicht gemessen und ist deutlich langsamer. 32-Bit-Systeme werden nicht unterstützt.

## Voraussetzungen

- 64-Bit Linux, Windows oder macOS (x64 oder arm64), Node.js 22 oder neuer
- Mindestens 1,5 GB freier Arbeitsspeicher (besser insgesamt 4 GB oder mehr)
- Etwa 700 MB Speicherplatz für das Modell. Auf einem Raspberry Pi ist eine SSD empfehlenswert
- Zugriff auf `huggingface.co` beim ersten Start (oder die Modelldateien von Hand kopieren, siehe unten)
- js-controller 6 oder neuer, admin 7.6.20 oder neuer

**Linux auf x64:** Bei der Installation lädt `onnxruntime-node` zusätzlich etwa 200 MB CUDA-Bibliotheken von nuget.org. Der Adapter nutzt sie nicht. Mit der Umgebungsvariablen `ONNXRUNTIME_NODE_INSTALL=skip` bei der Installation lässt sich das verhindern. Auf ARM (Raspberry Pi) und Windows wird nichts nachgeladen.

## Einrichtung

1. Adapter installieren und eine Instanz auf dem Host anlegen, auf dem die Spracherkennung laufen soll. In einem Multihost-System kann das ein anderer Host sein als der von ioBroker.assistant.
2. Beim ersten Start lädt der Adapter das Modell (etwa 670 MB) und prüft die SHA-256-Prüfsummen. Der Reiter **Server** der Instanz-Einstellungen zeigt den Fortschritt. Ein abgebrochener Download wird an der Abbruchstelle fortgesetzt.
3. Danach wird das Modell geladen (einige Sekunden), der Status wird `ready`.

Hat der Host keinen Internetzugang, die drei Dateien `encoder-model.int8.onnx`, `decoder_joint-model.int8.onnx` und `vocab.txt` von [ysdede/parakeet-tdt-0.6b-v3-onnx](https://huggingface.co/ysdede/parakeet-tdt-0.6b-v3-onnx/tree/e5356bf6e24bdb7a269536b0e9e7869bc034b893) herunterladen und in das Modellverzeichnis kopieren. Der Adapter prüft sie beim nächsten Start.

## Verwendung in ioBroker.assistant

1. In den Einstellungen von ioBroker.assistant die Spracherkennung **OpenAI (Whisper)** wählen.
2. Als **Spracherkennungs-Server** die Adresse dieses Adapters eintragen, z. B. `http://192.168.1.10:9999` (ohne `/v1`, das ergänzt der Assistant). Die richtige Adresse steht im Reiter **Server** der Instanz-Einstellungen.
3. Ist in diesem Adapter ein API-Schlüssel gesetzt, diesen als **Schlüssel des Servers** eintragen.

Der Assistant schickt die Namen von Geräten, Räumen und Szenen im Feld `prompt` mit. Mit der Option **Wörter aus dem Prompt verwenden** werden diese Namen so geschrieben wie im Prompt: aus `io broker` wird `ioBroker`, aus `wohnzimmer` wird `Wohnzimmer`. Dabei ändern sich nur Leerzeichen, Bindestriche und Groß-/Kleinschreibung, nie Buchstaben.

## OpenAI-kompatible API

```
POST http://<host>:9999/v1/audio/transcriptions
Authorization: Bearer <API-Schlüssel>     (nur wenn ein Schlüssel gesetzt ist)
Content-Type: multipart/form-data

file=<Audiodatei>
response_format=json | text | verbose_json | srt | vtt   (optional, Standard json)
prompt=<Namen, durch Kommas getrennt>                     (optional)
language=<wird ignoriert, das Modell erkennt die Sprache>
model=<wird ignoriert>
```

Antwort bei `json`: `{"text": "Schalte das Licht im Wohnzimmer ein."}`

Das Audio kann auch direkt als Body mit `Content-Type: audio/wav` geschickt werden, die Felder stehen dann im Query-String (`?response_format=text`).

- **WAV** (PCM 8/16/24/32 Bit oder Float, beliebige Abtastrate, mono oder stereo) wird direkt gelesen.
- **MP3, OGG/Opus, M4A, WebM, FLAC** brauchen [ffmpeg](https://ffmpeg.org/) auf dem Host (`sudo apt install ffmpeg`).
- Aufnahmen über der **maximalen Audiolänge** (Standard 300 s) werden abgelehnt. Aufnahmen über 90 s werden in Fenstern von 60 s erkannt.
- `GET /v1/models` listet das Modell, `GET /health` zeigt den Status (ohne Schlüssel).
- `/v1/audio/translations` wird nicht unterstützt: Parakeet transkribiert nur.

Beispiel mit curl:

```bash
curl http://192.168.1.10:9999/v1/audio/transcriptions -F file=@befehl.wav -F response_format=text
```

## sendTo

```js
// eine Datei auf dem Host der Instanz (WAV, mit ffmpeg jedes Format)
sendTo('ai-parakeet.0', 'transcribe', { file: '/opt/iobroker/sprachnachricht.ogg' }, result => {
    if (result.error) {
        log(result.error, 'warn');
    } else {
        log(`${result.text} (${result.audioSeconds} s in ${result.inferenceMs} ms)`);
    }
});

// eine Audiodatei als Buffer oder base64-Text
sendTo('ai-parakeet.0', 'transcribe', { audio: fs.readFileSync('/tmp/a.wav'), prompt: 'ioBroker, Wohnzimmer' }, console.log);

// rohes 16-Bit-Mono-PCM
sendTo('ai-parakeet.0', 'transcribe', { pcm: buffer, sampleRate: 16000 }, console.log);
```

Die Antwort enthält `text` (mit Korrekturen), `rawText` (wie vom Modell erkannt), `audioSeconds`, `inferenceMs` und `queueMs`. Mit `segments: true` zusätzlich die Sätze mit Start- und Endzeit.

`sendTo('ai-parakeet.0', 'getEndpoint', {}, console.log)` liefert die Adresse der API.

## Testseite

Mit der Option **Testseite aktivieren** zeigt der Server unter `http://<host>:9999/` eine Seite, die das Mikrofon-Audio an den Adapter schickt und den erkannten Text live anzeigt, mit Zwischenergebnissen. Browser erlauben das Mikrofon nur auf HTTPS-Seiten oder auf `localhost`: In den Instanz-Einstellungen **HTTPS** aktivieren und ein Zertifikat wählen, oder die Seite über einen Reverse-Proxy mit HTTPS öffnen.

Die Seite erkennt das Satzende über einen einfachen Pegel (**Stille, die einen Satz beendet**). Auf einem Raspberry Pi ist ein Intervall von 2-3 s für Zwischenergebnisse besser, weil jedes Zwischenergebnis den ganzen Satz neu erkennt.

## Korrekturwörterbuch

Wörter, die das Modell regelmäßig falsch erkennt, lassen sich ersetzen. Jede Zeile enthält den richtigen Text und die falschen Varianten, durch Kommas getrennt. Groß-/Kleinschreibung, Leerzeichen und Bindestriche spielen keine Rolle (`io broker` ersetzt auch `IO-Broker`), und es werden nur ganze Wörter ersetzt.

## Einstellungen

| Einstellung | Standard | Bedeutung |
|---|---|---|
| IP-Adresse, Port | 0.0.0.0, 9999 | Adresse des Servers. 0.0.0.0 macht ihn im ganzen Netzwerk erreichbar |
| API-Schlüssel | leer | Clients müssen ihn als `Authorization: Bearer <key>` senden. Empfohlen, wenn das Netzwerk nicht vertrauenswürdig ist |
| HTTPS | aus | Nötig für das Mikrofon der Testseite auf anderen Rechnern |
| Modellverzeichnis | `iobroker-data/ai-parakeet/models` | Z. B. ein Verzeichnis auf einer SSD. Es ist nicht Teil des ioBroker-Backups |
| CPU-Threads | 0 (automatisch) | Kerne - 1, höchstens 4. Auf einem ausgelasteten Host können weniger Threads schneller sein |
| Entladen nach Leerlauf-Minuten | 0 | Gibt den Speicher frei, wenn das Modell nicht genutzt wird. Erneutes Laden dauert einige Sekunden |
| Freien Speicher prüfen | an | Lädt das Modell nicht bei weniger als 1,1 GB freiem Speicher |
| Maximale Audiolänge | 300 s | |
| Pfad von ffmpeg | `ffmpeg` | Für andere Formate als WAV |

## Datenpunkte

| Datenpunkt | Bedeutung |
|---|---|
| `info.connection` | Die Spracherkennung ist nutzbar |
| `info.status` | `starting`, `downloading`, `verifying`, `loading`, `ready`, `idle` (entladen) oder `error` |
| `info.lastError` | Letzter Fehler |
| `info.modelProgress` | Fortschritt des Downloads in % |
| `info.endpoint` | Adresse der API |
| `stats.lastText` | Zuletzt erkannter Text (abschaltbar) |
| `stats.lastAudioSeconds`, `stats.lastInferenceMs`, `stats.lastRtf` | Länge, Rechenzeit und Echtzeitfaktor der letzten Erkennung |
| `stats.requests` | Anzahl der Erkennungen |
| `stats.queue` | Wartende Anfragen |

## Funktionsweise

Der Adapter führt das Modell in einem eigenen Node.js-Prozess aus. Ein Absturz von ONNX Runtime beendet den Adapter nicht, und beim Entladen wird der Speicher vollständig freigegeben. Es läuft immer nur eine Erkennung gleichzeitig; vollständige Aufnahmen (API, sendTo) kommen vor Zwischenergebnissen der Testseite. Gibt ein Client das Warten auf, wird seine Anfrage aus der Warteschlange entfernt.

## Lizenz und Modell

Der Adapter steht unter der MIT-Lizenz. Das Modell [nvidia/parakeet-tdt-0.6b-v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3) veröffentlicht NVIDIA unter [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/); der Adapter nutzt die ONNX-Umwandlung [ysdede/parakeet-tdt-0.6b-v3-onnx](https://huggingface.co/ysdede/parakeet-tdt-0.6b-v3-onnx) und [parakeet.js](https://github.com/ysdede/parakeet.js) (MIT).
