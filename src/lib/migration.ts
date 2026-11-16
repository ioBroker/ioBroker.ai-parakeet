import { existsSync } from 'node:fs';
import { mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';

/** Name of this adapter up to version 0.1.x. */
export const OLD_ADAPTER_NAME = 'ai-parakeet';

/** Folders of the ioBroker file storage that hold uploaded files (wake word models, Piper voices). */
export const UPLOAD_FOLDERS = ['wakeWords', 'ttsVoices'];

interface MigrationLog {
    info(message: string): void;
    warn(message: string): void;
}

/**
 * Moves a directory of ioBroker.ai-parakeet (the model of 670 MB, the Piper runtime and voices, ffmpeg) to the
 * place where ioBroker.voice expects it, so nothing is downloaded again. Nothing happens if the new directory
 * exists already or there is no old one. Returns the directory to use: the new one, or the old one if it could
 * not be moved.
 */
export async function moveOldDir(oldDir: string, newDir: string, log: MigrationLog): Promise<string> {
    if (existsSync(newDir) || !existsSync(oldDir)) {
        return newDir;
    }
    try {
        await mkdir(dirname(newDir), { recursive: true });
        await rename(oldDir, newDir);
        log.info(`Moved ${oldDir} of ${OLD_ADAPTER_NAME} to ${newDir}`);
        return newDir;
    } catch (error) {
        log.warn(`Could not move ${oldDir} to ${newDir}: ${(error as Error).message}. Using the old directory.`);
        return oldDir;
    }
}
