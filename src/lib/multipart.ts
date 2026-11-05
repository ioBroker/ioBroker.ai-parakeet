import { RequestError } from './audio';

export interface MultipartPart {
    /** Field name from Content-Disposition */
    name: string;
    /** File name, if the part is a file */
    filename?: string;
    contentType?: string;
    data: Buffer;
}

/** Reads the boundary from "multipart/form-data; boundary=..." */
export function getBoundary(contentType: string | undefined): string | undefined {
    const match = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType || '');
    return match ? match[1] || match[2] : undefined;
}

function parseHeaders(text: string): { name?: string; filename?: string; contentType?: string } {
    const result: { name?: string; filename?: string; contentType?: string } = {};
    for (const line of text.split('\r\n')) {
        const colon = line.indexOf(':');
        if (colon < 0) {
            continue;
        }
        const key = line.slice(0, colon).trim().toLowerCase();
        const value = line.slice(colon + 1).trim();
        if (key === 'content-disposition') {
            result.name = /(?:^|;)\s*name="([^"]*)"/i.exec(value)?.[1] ?? /(?:^|;)\s*name=([^;\s]+)/i.exec(value)?.[1];
            result.filename =
                /(?:^|;)\s*filename="([^"]*)"/i.exec(value)?.[1] ?? /(?:^|;)\s*filename=([^;\s]+)/i.exec(value)?.[1];
        } else if (key === 'content-type') {
            result.contentType = value;
        }
    }
    return result;
}

/** Splits a complete multipart/form-data body (RFC 7578) into its parts */
export function parseMultipart(body: Buffer, boundary: string): MultipartPart[] {
    const delimiter = Buffer.from(`--${boundary}`);
    const parts: MultipartPart[] = [];
    let position = body.indexOf(delimiter);
    if (position < 0) {
        throw new RequestError('Malformed multipart body: boundary not found');
    }
    for (;;) {
        position += delimiter.length;
        // "--" after the delimiter ends the body
        if (body[position] === 0x2d && body[position + 1] === 0x2d) {
            break;
        }
        // skip the line break after the delimiter
        if (body[position] === 0x0d && body[position + 1] === 0x0a) {
            position += 2;
        } else {
            throw new RequestError('Malformed multipart body');
        }
        const headerEnd = body.indexOf('\r\n\r\n', position);
        if (headerEnd < 0) {
            throw new RequestError('Malformed multipart body: part without headers');
        }
        const headers = parseHeaders(body.toString('utf8', position, headerEnd));
        const dataStart = headerEnd + 4;
        const next = body.indexOf(Buffer.concat([Buffer.from('\r\n'), delimiter]), dataStart);
        if (next < 0) {
            throw new RequestError('Malformed multipart body: unexpected end');
        }
        if (headers.name !== undefined) {
            parts.push({
                name: headers.name,
                filename: headers.filename,
                contentType: headers.contentType,
                data: body.subarray(dataStart, next),
            });
        }
        position = next + 2;
    }
    return parts;
}
