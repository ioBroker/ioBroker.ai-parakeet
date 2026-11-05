![Logo](admin/ai-parakeet.svg)

# ioBroker.ai-parakeet

[![NPM version](https://img.shields.io/npm/v/iobroker.ai-parakeet.svg)](https://www.npmjs.com/package/iobroker.ai-parakeet)
[![Downloads](https://img.shields.io/npm/dm/iobroker.ai-parakeet.svg)](https://www.npmjs.com/package/iobroker.ai-parakeet)
![Test and Release](https://github.com/ioBroker/ioBroker.ai-parakeet/workflows/Test%20and%20Release/badge.svg)

[Deutsche Beschreibung](docs/de/README.md)

Local, offline speech recognition for ioBroker with [NVIDIA Parakeet TDT 0.6B v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3). The model runs on the CPU of the ioBroker host with ONNX Runtime. No cloud, no GPU and no Docker are needed.

- **25 European languages**, the language is detected automatically (German, English, French, Italian, Spanish, Dutch, Polish, Russian, Ukrainian, Portuguese and more), with punctuation and capitalization
- **OpenAI-compatible API** `POST /v1/audio/transcriptions`: everything that can use the OpenAI Whisper API can use this adapter, e.g. [ioBroker.assistant](https://github.com/ioBroker/ioBroker.assistant)
- **sendTo** for scripts, e.g. to transcribe voice messages
- **Live test** of the microphone in the instance settings, and a **test page** with live recognition in the browser
- **Correction dictionary** for words the model does not know

## Speed and memory

The model is INT8 quantized (about 670 MB) and needs about **1.1 GB of memory**. Measured times for a command of 3 to 6 seconds:

| Host                                        | CPU threads | Computing time | Real-time factor  |
|---------------------------------------------|-------------|----------------|-------------------|
| Raspberry Pi 5 (8 GB), with Frigate running | 3           | 0.5 - 1.1 s    | about 0.2         |
| Intel Core i9-14900HX                       | 4           | 0.1 - 0.3 s    | about 0.03 - 0.05 |

The real-time factor is the computing time divided by the length of the audio: 0.2 means 10 seconds of speech are recognized in 2 seconds. A Raspberry Pi 4 should work too, but was not measured and is clearly slower. 32-bit systems are not supported.

## Requirements

- 64-bit Linux, Windows or macOS (x64 or arm64), Node.js 22 or newer
- At least 1.5 GB of free memory (better 4 GB or more in total)
- About 700 MB of disk space for the model. An SSD is recommended on a Raspberry Pi
- Access to `huggingface.co` for the first start (or copy the model files manually, see below)
- js-controller 6 or newer, admin 7.6.20 or newer

**Linux on x64:** during the installation, `onnxruntime-node` additionally downloads about 200 MB of CUDA libraries from nuget.org. The adapter does not use them. You can prevent the download by installing with the environment variable `ONNXRUNTIME_NODE_INSTALL=skip`. On ARM (Raspberry Pi) and Windows nothing is downloaded.

## Setup

1. Install the adapter and create an instance, on the host where the speech recognition should run. In a multihost system this can be another host than the one of ioBroker.assistant.
2. On the first start, the adapter downloads the model (about 670 MB) and checks its SHA-256 checksums. The tab **Server** of the instance settings shows the progress. An interrupted download continues where it stopped.
3. Then the model is loaded (a few seconds) and the status becomes `ready`.

If the host has no internet access, download the three files `encoder-model.int8.onnx`, `decoder_joint-model.int8.onnx` and `vocab.txt` from [ysdede/parakeet-tdt-0.6b-v3-onnx](https://huggingface.co/ysdede/parakeet-tdt-0.6b-v3-onnx/tree/e5356bf6e24bdb7a269536b0e9e7869bc034b893) and copy them into the model directory. The adapter checks them on the next start.

## Use it in ioBroker.assistant

1. In the settings of ioBroker.assistant select the speech recognition **OpenAI (Whisper)**.
2. Enter the address of this adapter as **speech recognition server**, e.g. `http://192.168.1.10:9999` (without `/v1`, the assistant adds it). The tab **Server** of the instance settings shows the right address.
3. If an API key is set in this adapter, enter it as **key of the server**.

The assistant sends the names of devices, rooms and scenes in the `prompt` field. With the option **Use the words of the prompt**, these names are written as in the prompt: `io broker` becomes `ioBroker`, `wohnzimmer` becomes `Wohnzimmer`. Only spaces, hyphens and case are changed, never letters.

## OpenAI-compatible API

```
POST http://<host>:9999/v1/audio/transcriptions
Authorization: Bearer <API key>        (only if a key is set)
Content-Type: multipart/form-data

file=<audio file>
response_format=json | text | verbose_json | srt | vtt   (optional, default json)
prompt=<names, separated by commas>                       (optional)
language=<ignored, the model detects the language>
model=<ignored>
```

Answer for `json`: `{"text": "Schalte das Licht im Wohnzimmer ein."}`

The audio can also be sent directly as body with `Content-Type: audio/wav`, the fields then go into the query string (`?response_format=text`).

- **WAV** (PCM 8/16/24/32 bit or float, any sample rate, mono or stereo) is read directly.
- **MP3, OGG/Opus, M4A, WebM, FLAC** need [ffmpeg](https://ffmpeg.org/). Either install it on the host (`sudo apt install ffmpeg`), or click **Download ffmpeg** on the tab **Recognition**: it downloads the static ffmpeg of [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static) (20-30 MB, about 80 MB unpacked, checked against a fixed SHA-256) into `iobroker-data/ai-parakeet.0/ffmpeg`, the same as ioBroker.assistant does. It is used at once, without a restart, while no path is entered. ioBroker.assistant sends WAV, so it does not need ffmpeg here.
- Recordings longer than **Maximal audio length** (default 300 s) are rejected. Recordings longer than 90 s are recognized in windows of 60 s.
- `GET /v1/models` lists the model, `GET /health` shows the status (without key).
- `/v1/audio/translations` is not supported: Parakeet only transcribes.

Example with curl:

```bash
curl http://192.168.1.10:9999/v1/audio/transcriptions -F file=@command.wav -F response_format=text
```

## sendTo

```js
// a file on the host of the instance (WAV, or any format with ffmpeg)
sendTo('ai-parakeet.0', 'transcribe', { file: '/opt/iobroker/voice.ogg' }, result => {
    if (result.error) {
        log(result.error, 'warn');
    } else {
        log(`${result.text} (${result.audioSeconds} s in ${result.inferenceMs} ms)`);
    }
});

// an audio file as Buffer or base64 text
sendTo('ai-parakeet.0', 'transcribe', { audio: fs.readFileSync('/tmp/a.wav'), prompt: 'ioBroker, Wohnzimmer' }, console.log);

// raw 16-bit mono PCM
sendTo('ai-parakeet.0', 'transcribe', { pcm: buffer, sampleRate: 16000 }, console.log);
```

The answer contains `text` (with corrections), `rawText` (as recognized by the model), `audioSeconds`, `inferenceMs` and `queueMs`. With `segments: true` it also contains the sentences with their start and end times.

`sendTo('ai-parakeet.0', 'getEndpoint', {}, console.log)` returns the address of the API.

## Live test in admin

The tab **Live test** of the instance settings records the microphone right there and shows the recognized text live, with intermediate results, the text with and without the correction dictionary and the computing times. The audio goes through the connection of admin (`sendTo`), not to the server of the adapter: the server needs neither HTTPS nor an API key for it, and it works while the port of the server is blocked. The browser still allows the microphone only if admin itself is opened over HTTPS or on `localhost`; otherwise the tab says so.

The tab is a web component of [`@iobroker/web-components`](https://github.com/ioBroker/web-components) (`admin/webcomponents/ai-parakeet-live.json`) and needs an admin that shows them. Other hosts of web components can show it as well; its setting **Instance** selects the instance.

The live test sends 16-bit audio in messages of about 0.2 s (about 32 KB/s) and gets the new results with every answer:

```js
sendTo('ai-parakeet.0', 'live', { action: 'start' });                   // → { id, sampleRate, corrections }
sendTo('ai-parakeet.0', 'live', { action: 'audio', id, seq: 1, pcm });  // pcm: 16 kHz mono 16-bit LE as base64 → { events }
sendTo('ai-parakeet.0', 'live', { action: 'stop', id, seq: 2 });        // → { events }
sendTo('ai-parakeet.0', 'live', { action: 'poll', id });                // → { events }, until an event "done" or "error"
```

A session without a message for 15 s is dropped.

## Test page

With the option **Enable test page**, the server shows a page at `http://<host>:9999/` that sends the audio of the microphone to the adapter and shows the recognized text live, with intermediate results. Browsers allow the microphone only on HTTPS pages or on `localhost`: enable **HTTPS** in the instance settings and select a certificate, or open the page through a reverse proxy with HTTPS.

The button **Open test page** in the instance settings uses the host name under which the browser reaches admin, if admin runs on the same host and is not behind a reverse proxy. If admin is opened as `http://localhost:8081`, the test page opens as `http://localhost:9999/` and the microphone works without HTTPS; a host name also matches the certificate better than the IP address. The status in the instance settings warns if the browser will block the microphone at the address of the test page, and the test page itself says so, too.

The page uses a simple level gate to find the end of a sentence (**Silence that ends a sentence**). On a Raspberry Pi an interval of 2-3 s for the intermediate results is better, because every intermediate result recognizes the whole sentence again.

## Correction dictionary

Words that the model regularly recognizes wrongly can be replaced. Each row has the correct text and the wrong variants, separated by commas. Case, spaces and hyphens do not matter (`io broker` also replaces `IO-Broker`), and only whole words are replaced.

## Settings

| Setting | Default | Meaning |
|---|---|---|
| IP address, port | 0.0.0.0, 9999 | Address of the server. 0.0.0.0 makes it reachable from the whole network |
| API key | empty | Clients must send it as `Authorization: Bearer <key>`. Recommended if the network is not trusted |
| HTTPS | off | Needed for the microphone of the test page on other computers |
| Model directory | `iobroker-data/ai-parakeet/models` | E.g. a directory on an SSD. It is not part of the ioBroker backup |
| CPU threads | 0 (automatic) | Cores - 1, at most 4. On a busy host fewer threads can be faster |
| Unload after idle minutes | 0 | Frees the memory when the model is not used. Loading it again takes a few seconds |
| Check free memory | on | Does not load the model with less than 1.1 GB of free memory |
| Maximal audio length | 300 s | |
| Path of ffmpeg | empty | For other formats than WAV. Empty: the downloaded ffmpeg, else `ffmpeg` from the search path. Buttons **Check ffmpeg** and **Download ffmpeg** |

## States

| State | Meaning |
|---|---|
| `info.connection` | The speech recognition can be used |
| `info.status` | `starting`, `downloading`, `verifying`, `loading`, `ready`, `idle` (unloaded) or `error` |
| `info.lastError` | Last error |
| `info.modelProgress` | Progress of the download in % |
| `info.endpoint` | Address of the API |
| `stats.lastText` | Last recognized text (can be disabled) |
| `stats.lastAudioSeconds`, `stats.lastInferenceMs`, `stats.lastRtf` | Length, computing time and real-time factor of the last recognition |
| `stats.requests` | Number of recognitions |
| `stats.queue` | Waiting requests |

## How it works

The adapter runs the model in a separate Node.js process. A crash of ONNX Runtime does not stop the adapter, and the memory is freed completely when the model is unloaded. Only one recognition runs at a time; complete recordings (API, sendTo) go before intermediate results of the test page. If a client gives up waiting, its request is removed from the queue.

## License and model

The adapter is licensed under the MIT license. The model [nvidia/parakeet-tdt-0.6b-v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3) is published by NVIDIA under [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/); the adapter uses the ONNX conversion [ysdede/parakeet-tdt-0.6b-v3-onnx](https://huggingface.co/ysdede/parakeet-tdt-0.6b-v3-onnx) and [parakeet.js](https://github.com/ysdede/parakeet.js) (MIT).

<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

## Changelog
### 0.1.1 (2026-11-05)

- (oweitman) Initial release: local speech recognition with NVIDIA Parakeet TDT 0.6B v3, OpenAI-compatible API, sendTo, live test of the microphone in the instance settings, test page with live streaming, correction dictionary, download of a static ffmpeg for MP3, OGG, M4A and WebM

## License

MIT License

Copyright (c) 2026 oweitman <oweitman@gmx.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
