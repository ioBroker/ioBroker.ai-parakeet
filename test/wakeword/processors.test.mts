import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AssistantProcessor, ASSISTANT_SOURCE, createTextProcessor, SmartText2CommandProcessor, type ProcessorTransport } from '../../src-webcomponents/src/processors';

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

test('assistant asks with the widget source and the spoken flag and returns the answer', async () => {
    const requests: Record<string, unknown>[] = [];
    const transport: ProcessorTransport = {
        async sendTo<T>(instance: string, command: string, message: Record<string, unknown>): Promise<T> {
            assert.equal(instance, 'assistant.1');
            assert.equal(command, 'ask');
            requests.push(message);
            return (requests.length === 1
                ? { answer: 'Im Wohnzimmer sind es 21 Grad.', journaled: true }
                : { message: { answer: 'Erledigt.' } }) as T;
        },
    };
    const processor = new AssistantProcessor(transport, 'assistant.1', true);
    assert.deepEqual(await processor.process(' Wie warm ist es? '), { text: 'Im Wohnzimmer sind es 21 Grad.', status: 'success' });
    assert.deepEqual(await processor.process('Licht an'), { text: 'Erledigt.', status: 'success' });
    assert.deepEqual(requests[0], { text: 'Wie warm ist es?', source: ASSISTANT_SOURCE, spoken: true });
});

test('assistant reports adapter errors and invalid replies', async () => {
    let count = 0;
    const transport: ProcessorTransport = {
        async sendTo<T>(): Promise<T> {
            count++;
            return (count === 1 ? { error: 'agent not ready' } : { journaled: false }) as T;
        },
    };
    const processor = createTextProcessor('assistant', transport, 'assistant.0', 'execute');
    assert.ok(processor instanceof AssistantProcessor);
    await assert.rejects(processor.process('Hallo'), /assistant: agent not ready/);
    await assert.rejects(processor.process('Hallo'), /Invalid assistant response/);
});

test('assistant rejects invalid targets and overlong recognition before sendTo', async () => {
    const transport: ProcessorTransport = { async sendTo<T>(): Promise<T> { throw new Error('Unexpected call'); } };
    assert.throws(() => new AssistantProcessor(transport, 'smart-text2command.0', false), /Invalid/);
    const processor = new AssistantProcessor(transport, 'assistant.0', false);
    await assert.rejects(processor.process('x'.repeat(1001)), /1000/);
});
