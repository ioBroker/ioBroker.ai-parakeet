// Streaming box-filter resampler, preserving fractional position across render quanta.
export class Resampler {
  constructor(inputRate, outputRate = 16000) {
    if (inputRate < outputRate) throw new Error('Input sample rate must be at least 16000 Hz');
    this.ratio = inputRate / outputRate; this.weight = 0; this.sum = 0;
  }
  push(input) {
    const output = [];
    for (const sample of input) {
      let remaining = 1;
      while (remaining > 1e-9) {
        const take = Math.min(remaining, this.ratio - this.weight);
        this.sum += sample * take; this.weight += take; remaining -= take;
        if (this.weight >= this.ratio - 1e-9) {
          output.push(this.sum / this.ratio); this.weight = 0; this.sum = 0;
        }
      }
    }
    return output;
  }
}
