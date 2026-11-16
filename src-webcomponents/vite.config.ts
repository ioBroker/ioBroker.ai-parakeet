import react from '@vitejs/plugin-react';
import { checkManifest, getReactImportPath, REACT_SPECIFIERS } from '@iobroker/web-components';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { manifest } from './src/manifest.js';

function componentAssets(): Plugin {
    return {
        name: 'wakeword-component-assets',
        generateBundle() {
            const problem = checkManifest(manifest);
            if (problem) this.error(`wakeword.json: ${problem}`);
            this.emitFile({ type: 'asset', fileName: 'wakeword.json', source: `${JSON.stringify(manifest, null, 2)}\n` });
            const dist = resolve('node_modules/onnxruntime-web/dist');
            for (const name of ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']) {
                this.emitFile({ type: 'asset', fileName: `wasm/${name}`, source: readFileSync(resolve(dist, name)) });
            }
        },
    };
}

const reactImport = getReactImportPath('webcomponents/wakeword.js');
export default defineConfig(({ command }) => ({
    publicDir: command === 'serve' ? resolve('../admin/webcomponents') : false,
    resolve: { conditions: ['onnxruntime-web-use-extern-wasm'] },
    plugins: [react(), componentAssets()],
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
        target: 'es2022',
        outDir: '../admin/webcomponents',
        emptyOutDir: false,
        lib: { entry: 'src/WakewordElement.tsx', formats: ['es'], fileName: () => 'wakeword.js' },
        rollupOptions: {
            external: [...REACT_SPECIFIERS],
            output: { paths: Object.fromEntries(REACT_SPECIFIERS.map(name => [name, reactImport])), codeSplitting: false },
        },
    },
}));
