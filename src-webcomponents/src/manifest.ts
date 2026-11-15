import type { WebComponentManifest } from '@iobroker/web-components';
import { LANGUAGE_NAMES, widgetLabel as label, type WidgetTextKey } from './i18n';

const number = (key: WidgetTextKey, value: number, min: number, max: number) =>
    ({ type: 'number' as const, label: label(key), default: value, min, max });

export const manifest: WebComponentManifest = {
    $schema: 'https://raw.githubusercontent.com/ioBroker/web-components/main/schemas/manifest.json',
    manifestVersion: 1,
    tag: 'iob-wakeword',
    name: label('widgetName'),
    description: label('description'),
    icon: 'wakeword.svg',
    module: 'wakeword.js',
    size: { width: 320, height: 220 },
    settings: {
        type: 'tabs',
        items: {
            general: { type: 'panel', label: label('common'), items: {
                parakeet: { type: 'instance', adapter: 'ai-parakeet', default: 'ai-parakeet.0', label: label('parakeetInstance') },
                autoStart: { type: 'checkbox', default: false, label: label('autoStart') },
                mode: { type: 'select', default: 'wakeword', label: label('activationMode'), options: [
                    { value: 'wakeword', label: label('wakeword') },
                    { value: 'ptt', label: label('pushToTalk') },
                    { value: 'combined', label: label('both') },
                ] },
            } },
            audio: { type: 'panel', label: label('microphoneRecognition'), items: {
                activationTone: { type: 'checkbox', default: true, label: label('activationSound') },
                completionTone: { type: 'checkbox', default: true, label: label('completionSound') },
                microphone: { type: 'text', default: '', label: label('microphoneDevice') },
                ringBufferMs: number('ringBuffer', 1000, 0, 3000),
                stripWakeword: { type: 'checkbox', default: false, label: label('stripWakeword') },
                threshold: number('vadThreshold', 0.015, 0.001, 1),
                minSpeechMs: number('minSpeech', 250, 0, 5000),
                silenceMs: number('trailingSilence', 1200, 100, 10000),
                noSpeechMs: number('noSpeechTimeout', 5000, 500, 20000),
                maxRecordMs: number('maxRecording', 15000, 1000, 60000),
            } },
            display: { type: 'panel', label: label('displayChat'), items: {
                showText: { type: 'checkbox', default: true, label: label('showText') },
                showInterim: { type: 'checkbox', default: true, label: label('showInterim') },
                showChat: { type: 'checkbox', default: false, label: label('showChat') },
                maxChatMessages: number('chatLimit', 50, 1, 200),
                compact: { type: 'checkbox', default: false, label: label('compact') },
                language: { type: 'select', default: 'auto', label: label('interfaceLanguage'), options: [
                    { value: 'auto', label: label('automatic') },
                    ...Object.entries(LANGUAGE_NAMES).map(([value, name]) => ({ value, label: name })),
                ] },
                accentColor: { type: 'color', default: '#2563eb', label: label('accentColor') },
            } },
            processing: { type: 'panel', label: label('processingOutput'), items: {
                processorType: { type: 'select', default: 'none', label: label('textProcessor'), options: [
                    { value: 'none', label: label('none') },
                    { value: 'smart-text2command', label: 'smart-text2command' },
                ] },
                processorInstance: { type: 'instance', adapter: 'smart-text2command',
                    label: label('processorInstance'), hidden: "data.processorType !== 'smart-text2command'" },
            } },
            speech: { type: 'panel', label: label('speechOutput'), items: {
                speechEnabled: { type: 'checkbox', default: false, label: label('speakReplies') },
                speechEngine: { type: 'select', default: 'browser', label: label('speechOutput'),
                    hidden: '!data.speechEnabled', options: [
                        { value: 'browser', label: label('browserVoice') },
                        { value: 'server', label: label('piperOnAdapter') },
                    ] },
                speechServerVoice: { type: 'selectSendTo', default: '', label: label('piperVoice'),
                    hidden: "!data.speechEnabled || data.speechEngine !== 'server'",
                    command: 'piperVoices', instance: '${data.parakeet}', data: { includeDefault: true } },
            } },
        },
    },
};
