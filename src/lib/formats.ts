import { RequestError } from './audio';
import type { JobResult, Segment } from './scheduler';

export const RESPONSE_FORMATS = ['json', 'text', 'verbose_json', 'srt', 'vtt'] as const;
export type ResponseFormat = (typeof RESPONSE_FORMATS)[number];

export function parseResponseFormat(value: string | undefined): ResponseFormat {
    const format = (value || 'json').trim();
    if (!(RESPONSE_FORMATS as readonly string[]).includes(format)) {
        throw new RequestError(
            `response_format "${format}" is not supported. Use ${RESPONSE_FORMATS.join(', ')}.`,
            400,
            'invalid_value',
        );
    }
    return format as ResponseFormat;
}

/** True if the format needs the sentences with times */
export function needsSegments(format: ResponseFormat): boolean {
    return format === 'verbose_json' || format === 'srt' || format === 'vtt';
}

function segmentsOf(result: JobResult): Segment[] {
    const segments = result.segments?.filter(segment => segment.text);
    if (segments?.length) {
        return segments;
    }
    return result.text ? [{ text: result.text, start: 0, end: result.audioSeconds }] : [];
}

function timestamp(seconds: number, separator: ',' | '.'): string {
    const ms = Math.max(0, Math.round(seconds * 1000));
    const pad = (value: number, length = 2): string => String(value).padStart(length, '0');
    return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}${separator}${pad(ms % 1000, 3)}`;
}

/**
 * Builds the response like the OpenAI transcription API does.
 *
 * @param format response_format of the request
 * @param result result of the transcription
 * @param language language of the request (the model detects it, but does not report it)
 */
export function formatResponse(
    format: ResponseFormat,
    result: JobResult,
    language: string | undefined,
): { contentType: string; body: string } {
    switch (format) {
        case 'text':
            return { contentType: 'text/plain; charset=utf-8', body: result.text };
        case 'srt':
            return {
                contentType: 'text/plain; charset=utf-8',
                body: segmentsOf(result)
                    .map(
                        (segment, i) =>
                            `${i + 1}\n${timestamp(segment.start, ',')} --> ${timestamp(segment.end, ',')}\n${segment.text}\n`,
                    )
                    .join('\n'),
            };
        case 'vtt':
            return {
                contentType: 'text/vtt; charset=utf-8',
                body: `WEBVTT\n\n${segmentsOf(result)
                    .map(
                        segment =>
                            `${timestamp(segment.start, '.')} --> ${timestamp(segment.end, '.')}\n${segment.text}\n`,
                    )
                    .join('\n')}`,
            };
        case 'verbose_json':
            return {
                contentType: 'application/json',
                body: JSON.stringify({
                    task: 'transcribe',
                    language: language || 'unknown',
                    duration: Math.round(result.audioSeconds * 1000) / 1000,
                    text: result.text,
                    segments: segmentsOf(result).map((segment, id) => ({
                        id,
                        seek: 0,
                        start: segment.start,
                        end: segment.end,
                        text: segment.text,
                        tokens: [],
                        temperature: 0,
                        avg_logprob: 0,
                        compression_ratio: 0,
                        no_speech_prob: 0,
                    })),
                }),
            };
        default:
            return {
                contentType: 'application/json',
                body: JSON.stringify({ text: result.text }),
            };
    }
}
