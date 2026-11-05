/** One row of the correction dictionary in the instance settings */
export interface CorrectionRow {
    /** Text that replaces the variants, e.g. "ioBroker" */
    replacement: string;
    /** Wrongly recognized spellings, separated by commas, e.g. "io broker, eio broker" */
    variants: string;
}

export interface AiParakeetConfig {
    /** IP address to listen on. "0.0.0.0" is all addresses */
    bind: string;
    port: number | string;
    /** Clients must send it as "Authorization: Bearer <key>". Empty = no key needed */
    apiKey: string;
    /** HTTPS with the certificates below */
    secure: boolean;
    certPublic: string;
    certPrivate: string;
    certChained: string;
    /** Serve the browser test page with live microphone streaming at "/" */
    testPage: boolean;

    /** Directory of the model files. Empty = <iobroker-data>/ai-parakeet/models */
    modelDir: string;
    /** Download the model if it is missing */
    autoDownload: boolean;
    /** Base address of Hugging Face or of a mirror */
    downloadUrl: string;
    /** CPU threads of the inference. 0 = automatic */
    threads: number | string;
    /** Unload the model after so many idle minutes. 0 = keep it loaded */
    unloadAfter: number | string;
    /** Do not load the model if the host has less free memory than needed */
    memoryCheck: boolean;

    /** Longer recordings are rejected */
    maxAudioSeconds: number | string;
    /** Converts other formats than WAV (MP3, OGG, M4A, WebM). Empty = only WAV */
    ffmpegPath: string;
    /** Use the words of the "prompt" field to fix their spelling */
    useHints: boolean;
    /** Correction dictionary */
    corrections: CorrectionRow[];
    /** Write the last recognized text into the state stats.lastText */
    publishText: boolean;

    /** Test page: level from which audio counts as speech (RMS, 0..1) */
    vadThreshold: number | string;
    /** Test page: seconds between intermediate results */
    partialInterval: number | string;
    /** Test page: seconds of silence that end a sentence */
    silenceSeconds: number | string;
    /** Test page: browsers at the same time */
    maxClients: number | string;
}
