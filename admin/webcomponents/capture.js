import { Resampler } from './resampler.js';

class Capture extends AudioWorkletProcessor {
  constructor() {
    super(); this.resampler = new Resampler(sampleRate); this.buffer = new Float32Array(1600); this.offset = 0;
    this.stopped = false;
    this.port.onmessage = ({ data }) => {
      if (data === 'stop') {
        this.stopped = true;
        if (this.offset) this.send(this.buffer.slice(0, this.offset));
        this.port.postMessage({ stopped: true });
      }
    };
  }
  send(pcm) { this.port.postMessage({ pcm: pcm.buffer }, [pcm.buffer]); }
  process(inputs) {
    if (this.stopped) return false;
    const channels = inputs[0];
    if (!channels?.length) return true;
    const mono = new Float32Array(channels[0].length);
    for (const channel of channels) for (let i = 0; i < mono.length; i++) mono[i] += channel[i] / channels.length;
    for (const sample of this.resampler.push(mono)) {
      this.buffer[this.offset++] = sample;
      if (this.offset === this.buffer.length) {
        this.send(this.buffer); this.buffer = new Float32Array(1600); this.offset = 0;
      }
    }
    // Outputs remain silent; connection keeps the worklet processing without mic playback.
    return true;
  }
}
registerProcessor('capture', Capture);
