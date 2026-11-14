import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SmartText2CommandProcessor, type ProcessorTransport } from '../../src-webcomponents/src/processors';

test('smart-text2command keeps one session and continues a clarification with a fresh request ID', async () => {
    const requests: Record<string, unknown>[] = [];
    const transport: ProcessorTransport = {
        async sendTo<T>(instance: string, command: string, message: Record<string, unknown>): Promise<T> {
            assert.equal(instance, 'smart-text2command.2');
            assert.equal(command, 'processText');
            requests.push(message);
            return (requests.length === 1
                ? { status: 'clarification', response: 'Welcher Raum?', clarification: { id: 'question-1' } }
                : { status: 'success', response: 'Die Temperatur ist 21 Grad.' }) as T;
        },
    };
    const processor = new SmartText2CommandProcessor(transport, 'smart-text2command.2', 'execute');
    assert.deepEqual(await processor.process('Welche Temperatur?'), { text: 'Welcher Raum?', status: 'clarification' });
    assert.deepEqual(await processor.process('Wohnzimmer'), { text: 'Die Temperatur ist 21 Grad.', status: 'success' });
    assert.equal(requests[0].mode, 'execute');
    assert.equal(requests[0].text, 'Welche Temperatur?');
    assert.equal(requests[0].clarificationId, undefined);
    assert.equal(requests[1].clarificationId, 'question-1');
    assert.equal(requests[0].sessionId, requests[1].sessionId);
    assert.notEqual(requests[0].requestId, requests[1].requestId);
});

test('smart-text2command handles the callback envelope and router errors', async () => {
    let count = 0;
    const transport: ProcessorTransport = {
        async sendTo<T>(): Promise<T> {
            count++;
            return (count === 1
                ? { message: { status: 'success', response: 'Fertig.' } }
                : { error: 'RATE_LIMITED' }) as T;
        },
    };
    const processor = new SmartText2CommandProcessor(transport, 'smart-text2command.0', 'analyze');
    assert.deepEqual(await processor.process('Test'), { text: 'Fertig.', status: 'success' });
    await assert.rejects(processor.process('Noch einmal'), /RATE_LIMITED/);
});

test('smart-text2command rejects invalid targets and overlong recognition before sendTo', async () => {
    const transport: ProcessorTransport = { async sendTo<T>(): Promise<T> { throw new Error('Unexpected call'); } };
    assert.throws(() => new SmartText2CommandProcessor(transport, 'other-adapter.0', 'execute'), /Invalid/);
    const processor = new SmartText2CommandProcessor(transport, 'smart-text2command.0', 'execute');
    await assert.rejects(processor.process('x'.repeat(1001)), /1000/);
});
