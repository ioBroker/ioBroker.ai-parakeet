import type { SocketLike } from './service';

interface SynthesisAnswer { audio?: string; mimeType?: string; error?: string }

/** Plays generic WAV returned by the adapter's sendTo('synthesize') API. */
export class ServerSpeechOutput {
    private audio?: HTMLAudioElement;
    private url?: string;
    private activity?: (active: boolean) => void;
    private generation = 0;

    async speak(socket: SocketLike, instance: string, text: string, voice: string,
        onActivity: (active: boolean) => void, onFailure: (reason: string) => void): Promise<'spoken' | 'unavailable' | 'cancelled'> {
        if (!text.trim()) return 'unavailable';
        this.cancel();
        const generation = ++this.generation;
        this.activity = onActivity;
        onActivity(true);
        try {
            const answer = await socket.sendTo<SynthesisAnswer>(instance, 'synthesize', { text, ...(voice ? { voice } : {}) });
            if (generation !== this.generation) return 'cancelled';
            if (answer?.error) throw new Error(answer.error);
            if (!answer?.audio || answer.mimeType !== 'audio/wav') throw new Error('Piper returned no WAV audio');
            const bytes = Uint8Array.from(atob(answer.audio), char => char.charCodeAt(0));
            if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw new Error('Piper WAV size is invalid');
            this.url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: 'audio/wav' }));
            const audio = new Audio(this.url);
            this.audio = audio;
            const finish = (): void => {
                if (generation !== this.generation) return;
                this.audio = undefined;
                this.activity = undefined;
                if (this.url) URL.revokeObjectURL(this.url);
                this.url = undefined;
                onActivity(false);
            };
            audio.onended = finish;
            audio.onerror = () => {
                if (generation !== this.generation) return;
                finish();
                onFailure('Audio playback failed');
            };
            await audio.play();
            return generation === this.generation ? 'spoken' : 'cancelled';
        } catch (error) {
            if (generation !== this.generation) return 'cancelled';
            this.cancel();
            onFailure((error as Error).message);
            return 'unavailable';
        }
    }

    cancel(): void {
        ++this.generation;
        if (this.audio) {
            this.audio.pause();
            this.audio.onended = null;
            this.audio.onerror = null;
            this.audio = undefined;
        }
        if (this.url) URL.revokeObjectURL(this.url);
        this.url = undefined;
        this.activity?.(false);
        this.activity = undefined;
    }
}
