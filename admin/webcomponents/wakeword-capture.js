// Kept separate from React so the browser runs capture on the audio rendering thread.
class Capture extends AudioWorkletProcessor {
    constructor() {
        super();
        this.buffer = new Float32Array(1280);
        this.offset = 0;
        this.step = sampleRate / 16000;
        this.position = 0;
        this.sum = 0;
        this.weight = 0;
        this.stopped = false;
        this.port.onmessage = ({ data }) => {
            if (data === 'stop') {
                this.stopped = true;
                if (this.offset) this.emit(this.buffer.slice(0, this.offset));
                this.port.postMessage({ stopped: true });
            }
        };
    }
    emit(samples) { this.port.postMessage({ pcm: samples.buffer }, [samples.buffer]); }
    process(inputs) {
        if (this.stopped) return false;
        const channels = inputs[0];
        if (!channels?.length) return true;
        for (let i = 0; i < channels[0].length; i++) {
            let mono = 0;
            for (const channel of channels) mono += channel[i] / channels.length;
            // Streaming box average. A phase and partial sum survive each render quantum.
            let remaining = 1;
            while (remaining > 1e-9) {
                const take = Math.min(remaining, this.step - this.weight);
                this.sum += mono * take;
                this.weight += take;
                remaining -= take;
                if (this.weight >= this.step - 1e-9) {
                    this.buffer[this.offset++] = this.sum / this.step;
                    this.sum = 0;
                    this.weight = 0;
                    if (this.offset === this.buffer.length) {
                        this.emit(this.buffer);
                        this.buffer = new Float32Array(1280);
                        this.offset = 0;
                    }
                }
            }
        }
        return true; // The output is silent; connecting the node keeps processing alive.
    }
}
registerProcessor('wakeword-capture', Capture);
