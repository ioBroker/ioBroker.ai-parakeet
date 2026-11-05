/** SentencePiece marks the start of a word with this character */
const WORD_START = /▁/g;

/**
 * Whitespace before a character that is no word character, or at the end.
 * Word characters are the letters, marks and digits of all scripts:
 * `\w` of JavaScript knows only ASCII and would glue Cyrillic or "über" to the previous word.
 */
const SPACE_BEFORE_NON_WORD = /\s+(?=[^\p{L}\p{M}\p{N}_\s]|$)/gu;

/**
 * Joins the tokens of the model into the text.
 * Implements the rule of the Python reference `re.sub(r"\A\s|\s\B|(\s)\b", r"\1", text)`,
 * where `\w` and `\b` work with all scripts. Replaces `ParakeetTokenizer.decode` of parakeet.js 1.4.4,
 * which uses the ASCII `\w` and returns "Тестраз,два,три." for "Тест раз, два, три."
 *
 * @param tokens tokens without the blank token
 */
export function joinTokens(tokens: readonly string[]): string {
    return tokens.join('').replace(WORD_START, ' ').replace(SPACE_BEFORE_NON_WORD, '').replace(/\s+/g, ' ').trim();
}
