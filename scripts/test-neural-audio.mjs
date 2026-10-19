import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { transpileModule, ModuleKind } from 'typescript';

const storage = new Map(), audios = [], speech = [];
let rejectPlay = false, service;
class AudioMock {
  constructor(url) { this.src = url; audios.push(this); }
  pause() { this.paused = true; }
  removeAttribute() { this.src = ''; }
  load() {}
  play() { return rejectPlay ? Promise.reject(Error('HTTP')) : Promise.resolve(); }
}
const context = vm.createContext({ exports: {}, Audio: AudioMock,
  localStorage: { getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v) },
  window: { speechSynthesis: { getVoices: () => [], cancel() {} } },
  SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
  require: name => name.includes('studyTracking') ? { studyTracker: { media() {} } } : {
    cancelStudyAudio: () => service.cancelNeuralExampleAudio(),
    speakStudyAudio: u => speech.push(u)
  }
});
const source = fs.readFileSync('src/features/study/neuralExampleAudio.ts', 'utf8');
vm.runInContext(transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText, context);
service = context.exports;
const example = { id: 'example', exampleItem: 'Hello.', intent: 'Hello', mp3: {
  marin: '/audio/en-US/marin/registered-marin.mp3', cedar: '/audio/en-US/cedar/registered-cedar.mp3'
} };
let ended = 0, started = 0, errors = 0;
const play = (value = example, language = 'en-US') => service.playNeuralExampleAudio({ example: value, language,
  onEnd: () => ended++, onStart: () => started++, onError: () => errors++ });
assert.equal(service.getNeuralVoice(), 'cedar');
await play();
assert.equal(audios.at(-1).src, example.mp3.cedar);
audios.at(-1).onplaying(); assert.equal(started, 1);
const first = audios.at(-1);
await play(); assert.ok(first.paused); assert.equal(first.onplaying, null); assert.equal(ended, 1);
service.setNeuralVoice('marin'); assert.ok(audios.at(-1).paused);
assert.equal(storage.get('bej.tts.voice'), 'marin');
const count = audios.length; assert.equal(count, 2);
await play(); assert.equal(audios.at(-1).src, example.mp3.marin);
service.cancelNeuralExampleAudio(); assert.ok(audios.at(-1).paused);
await play({ ...example, mp3: undefined }); assert.equal(speech.at(-1).lang, 'en-US');
await play(example, 'fr-FR'); assert.equal(speech.at(-1).lang, 'fr-FR');
rejectPlay = true;
await play(); await Promise.resolve();
assert.equal(speech.at(-1).text, example.exampleItem);
assert.equal(errors, 0);
speech.at(-1).onerror(); assert.equal(errors, 1);
storage.set('bej.tts.voice', 'marin');
const restored = vm.createContext({ ...context, exports: {} });
vm.runInContext(transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText, restored);
assert.equal(restored.exports.getNeuralVoice(), 'marin');
console.log('PASS neural audio: voice persistence, registered URLs, cancellation, cleanup, locale fallback, HTTP rejection');
