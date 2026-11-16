export type ProcessorType = 'none' | 'smart-text2command';
export type ProcessorMode = 'analyze' | 'execute';
export type ProcessorStatus = 'success' | 'clarification' | 'cancelled' | 'rejected' | 'error';

export interface ProcessorReply {
    text: string;
    status: ProcessorStatus;
}

export interface ProcessorTransport {
    sendTo<T>(instance: string, command: string, message: Record<string, unknown>): Promise<T | undefined>;
}

export interface TextProcessor {
    process(text: string): Promise<ProcessorReply>;
}

interface SmartResult {
    status?: unknown;
    response?: unknown;
    error?: unknown;
    clarification?: { id?: unknown };
}

const STATUSES = new Set<ProcessorStatus>(['success', 'clarification', 'cancelled', 'rejected', 'error']);

/** Browser socket.sendTo resolves with reply.message; accept an envelope from test or alternate hosts too. */
function resultMessage(value: unknown): SmartResult {
    if (!value || typeof value !== 'object') throw new Error('No response from smart-text2command');
    const answer = value as SmartResult & { message?: unknown };
    if (!('status' in answer) && 'message' in answer && answer.message && typeof answer.message === 'object') {
        return answer.message as SmartResult;
    }
    return answer;
}

export class SmartText2CommandProcessor implements TextProcessor {
    private readonly sessionId = crypto.randomUUID();
    private clarificationId = '';
    private pending: Promise<void> = Promise.resolve();

    constructor(
        private readonly transport: ProcessorTransport,
        private readonly instance: string,
        private readonly mode: ProcessorMode,
    ) {
        if (!/^smart-text2command\.\d+$/.test(instance)) throw new Error('Invalid smart-text2command instance');
    }

    process(text: string): Promise<ProcessorReply> {
        const task = this.pending.then(() => this.processOne(text));
        this.pending = task.then(() => undefined, () => undefined);
        return task;
    }

    private async processOne(text: string): Promise<ProcessorReply> {
        const normalized = text.trim();
        if (!normalized || normalized.length > 1000) throw new Error('Recognized text must contain 1 to 1000 characters');
        const request: Record<string, unknown> = {
            requestId: crypto.randomUUID(),
            sessionId: this.sessionId,
            text: normalized,
            mode: this.mode,
        };
        if (this.clarificationId) request.clarificationId = this.clarificationId;

        let timer: ReturnType<typeof setTimeout> | undefined;
        let raw: unknown;
        try {
            raw = await Promise.race([
                this.transport.sendTo<unknown>(this.instance, 'processText', request),
                new Promise<never>((_, reject) => {
                    timer = setTimeout(() => reject(new Error('smart-text2command timed out')), 30_000);
                }),
            ]);
        } catch (error) {
            this.clarificationId = '';
            throw error;
        } finally {
            if (timer) clearTimeout(timer);
        }

        let result: SmartResult;
        try {
            result = resultMessage(raw);
        } catch (error) {
            this.clarificationId = '';
            throw error;
        }
        if (typeof result.error === 'string') {
            this.clarificationId = '';
            throw new Error(`smart-text2command: ${result.error}`);
        }
        if (!STATUSES.has(result.status as ProcessorStatus) || typeof result.response !== 'string') {
            this.clarificationId = '';
            throw new Error('Invalid smart-text2command response');
        }
        const status = result.status as ProcessorStatus;
        if (status === 'clarification' && typeof result.clarification?.id !== 'string') {
            this.clarificationId = '';
            throw new Error('Invalid smart-text2command clarification');
        }
        this.clarificationId = status === 'clarification' && typeof result.clarification?.id === 'string'
            ? result.clarification.id : '';
        return { text: result.response, status };
    }
}

/** Add future adapter protocols here without changing the voice capture pipeline. */
export function createTextProcessor(
    type: ProcessorType,
    transport: ProcessorTransport,
    instance: string,
    mode: ProcessorMode,
): TextProcessor | undefined {
    if (type === 'smart-text2command') return new SmartText2CommandProcessor(transport, instance, mode);
    return undefined;
}
