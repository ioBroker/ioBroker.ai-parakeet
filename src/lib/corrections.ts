import type { CorrectionRow } from '../types';

const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A character that belongs to a word: a match next to it is part of a longer word and is not replaced */
const WORD_CHAR = /[\p{L}\p{M}\p{N}_]/u;
/** Spaces and hyphens between the words of a variant: "io broker" also finds "io-broker" and "io  broker" */
const SEPARATORS = /[\s\-‐‑–]+/;
const SEPARATORS_GLOBAL = /[\s\-‐‑–]+/g;

function normalize(text: string): string {
    return text.normalize('NFC').trim().replace(SEPARATORS_GLOBAL, ' ').toLowerCase();
}

export interface Corrector {
    /** Number of variants that are replaced */
    readonly size: number;
    apply(text: string): string;
}

/**
 * Builds the correction dictionary. Variants are matched case-insensitively and as whole words,
 * longer variants first. A replaced text is not matched again.
 *
 * @param rows the rows of the instance settings
 * @param warn called for rows that are ignored
 */
export function createCorrector(rows: CorrectionRow[] | undefined, warn: (text: string) => void = () => {}): Corrector {
    const replacements = new Map<string, string>();
    for (const row of Array.isArray(rows) ? rows : []) {
        const replacement = typeof row?.replacement === 'string' ? row.replacement.trim() : '';
        const variants = (typeof row?.variants === 'string' ? row.variants : '')
            .split(/[,;\n]/)
            .map(variant => variant.trim())
            .filter(variant => variant);
        if (!replacement || !variants.length) {
            if (replacement || variants.length) {
                warn(`Correction "${replacement || variants.join(', ')}" needs a replacement and at least one variant`);
            }
            continue;
        }
        for (const variant of variants) {
            const key = normalize(variant);
            const existing = replacements.get(key);
            if (existing !== undefined && existing !== replacement) {
                warn(
                    `Variant "${variant}" is used for "${existing}" and "${replacement}". Only "${existing}" is used.`,
                );
                continue;
            }
            replacements.set(key, replacement);
        }
    }
    const alternatives = [...replacements.keys()]
        .sort((a, b) => b.length - a.length)
        .map(variant => variant.split(SEPARATORS).map(escapeRegex).join(SEPARATORS.source));
    const pattern = alternatives.length ? new RegExp(alternatives.join('|'), 'giu') : null;

    return {
        size: replacements.size,
        apply(text: string): string {
            if (!pattern || !text) {
                return text;
            }
            return text.replace(pattern, (match: string, offset: number) => {
                const before = [...text.slice(0, offset)].at(-1) || '';
                const after = String.fromCodePoint(text.codePointAt(offset + match.length) || 0);
                if (WORD_CHAR.test(before) || WORD_CHAR.test(after)) {
                    return match;
                }
                return replacements.get(normalize(match)) ?? match;
            });
        },
    };
}

/**
 * Splits the "prompt" of an OpenAI transcription request into vocabulary terms.
 * ioBroker.assistant sends device, room and scene names separated by commas.
 */
export function parseHints(prompt: string | undefined): string[] {
    const terms = new Set<string>();
    for (const part of (prompt || '').split(/[,;\n]/)) {
        const term = part.trim();
        // A whole sentence is no vocabulary
        if (term.length >= 2 && term.length <= 40 && term.split(/\s+/).length <= 4 && /\p{L}/u.test(term)) {
            terms.add(term);
        }
        if (terms.size >= 300) {
            break;
        }
    }
    return [...terms];
}

interface HintPattern {
    term: string;
    pattern: RegExp;
}

let cachedPrompt: string | undefined;
let cachedPatterns: HintPattern[] = [];

function hintPatterns(prompt: string): HintPattern[] {
    if (prompt === cachedPrompt) {
        return cachedPatterns;
    }
    const patterns: HintPattern[] = [];
    // Longer terms first, so "Licht Wohnzimmer" wins against "Licht"
    for (const term of parseHints(prompt).sort((a, b) => b.length - a.length)) {
        const letters = [...term.replace(SEPARATORS_GLOBAL, '')];
        // Terms from 4 characters may be split by the recognition: "io broker", "io-broker" -> "ioBroker"
        const body =
            letters.length >= 4
                ? letters.map(escapeRegex).join(`(?:${SEPARATORS.source})?`)
                : term.split(SEPARATORS).map(escapeRegex).join(SEPARATORS.source);
        patterns.push({
            term,
            pattern: new RegExp(`(?<![\\p{L}\\p{M}\\p{N}_])${body}(?![\\p{L}\\p{M}\\p{N}_])`, 'giu'),
        });
    }
    cachedPrompt = prompt;
    cachedPatterns = patterns;
    return patterns;
}

/**
 * Writes the vocabulary terms of the prompt as they are spelled there: "io broker" -> "ioBroker",
 * "wohnzimmer" -> "Wohnzimmer". Only spacing, hyphens and case are changed, never the letters.
 */
export function applyHints(text: string, prompt: string | undefined): string {
    if (!text || !prompt) {
        return text;
    }
    let result = text;
    for (const { term, pattern } of hintPatterns(prompt)) {
        result = result.replace(pattern, term);
    }
    return result;
}
