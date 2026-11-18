/**
 * The 25 European languages of the speech recognition models (ISO 639-1). Parakeet TDT 0.6B v3 and Canary 1B v2
 * know the same ones.
 */
export const SPEECH_LANGUAGES = [
    'bg',
    'cs',
    'da',
    'de',
    'el',
    'en',
    'es',
    'et',
    'fi',
    'fr',
    'hr',
    'hu',
    'it',
    'lt',
    'lv',
    'mt',
    'nl',
    'pl',
    'pt',
    'ro',
    'ru',
    'sk',
    'sl',
    'sv',
    'uk',
] as const;

export type SpeechLanguage = (typeof SPEECH_LANGUAGES)[number];

/**
 * The language of a request as code of the model: `de-DE`, `de_DE` and `DE` become `de`.
 *
 * @param value language of a request or of the system
 * @returns undefined for anything else (empty, not a string, a language the models do not know)
 */
export function speechLanguage(value: unknown): SpeechLanguage | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }
    const code = value.trim().toLowerCase().split(/[-_]/)[0];
    return (SPEECH_LANGUAGES as readonly string[]).includes(code) ? (code as SpeechLanguage) : undefined;
}
