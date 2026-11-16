import { OnnxWakewordEngine } from './wakeword';

const output = document.querySelector('#result')!;
const engine = new OnnxWakewordEngine();
try {
    await engine.initialize({
        names: ['io_broker'], threshold: 0.5, assetBase: `${location.origin}/`,
        getUploadedModel: async () => { throw new Error('unexpected upload'); },
    });
    const value = await engine.processAudio(new Float32Array(1280));
    if (value.detected || !Number.isFinite(value.confidence)) throw new Error('Invalid inference result');
    document.body.dataset.result = 'pass';
    output.textContent = `PASS: local ONNX/WASM inference, confidence ${value.confidence}`;
} catch (error) {
    document.body.dataset.result = 'fail';
    output.textContent = `FAIL: ${(error as Error).message}`;
} finally {
    await engine.dispose();
}
