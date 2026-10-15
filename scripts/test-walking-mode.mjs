import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transpileModule } from 'typescript';

async function load(path) {
  const { outputText } = transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'),
    { compilerOptions: { target: 9, module: 99 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const { WalkingAudio, repetitionText } = await load('../src/utils/walkingAudio.ts');
const { isMobileDevice } = await load('../src/utils/mobileDevice.ts');
for (const [userAgent, platform, maxTouchPoints, expected] of [
  ['Mozilla iPhone', 'iPhone', 5, true], ['Mozilla Android', 'Linux', 5, true],
  ['Mozilla Macintosh', 'MacIntel', 5, true], ['Mozilla Macintosh', 'MacIntel', 0, false],
  ['Mozilla Windows Chrome', 'Win32', 0, false], ['Mozilla Windows Firefox', 'Win32', 0, false]
]) {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent, platform, maxTouchPoints } });
  assert.equal(isMobileDevice(), expected);
}
let utterances = [];
let pending = [];
globalThis.setTimeout = (callback, ms) => { const entry = { callback, ms }; pending.push(entry); return entry; };
globalThis.clearTimeout = entry => { pending = pending.filter(v => v !== entry); };
globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
globalThis.window = { speechSynthesis: {
  cancel() {}, getVoices: () => [{ lang: 'fr-FR' }, { lang: 'es-ES' }, { lang: 'en-US' }],
  speak: value => utterances.push(value)
} };
for (const language of ['en-US', 'fr-FR', 'es-ES']) {
  const audio = new WalkingAudio();
  let spoken = 0, done = 0, errors = 0;
  for (let index = 0; index < 5; index++) {
    audio.play(repetitionText('CHUNK', language, index, 5), language, .9, 3000,
      () => spoken++, () => done++, () => errors++);
    const utterance = utterances.at(-1);
    assert.equal(utterance.lang, language);
    assert.equal(utterance.voice.lang, language);
    assert.equal(utterance.rate, .9);
    assert.equal(utterance.text.split('CHUNK').length - 1, 1);
    assert.equal(done, index);
    utterance.onend();
    assert.equal(spoken, index + 1);
    assert.equal(done, index);
    const timer = pending.pop();
    assert.equal(timer.ms, 3000);
    timer.callback();
  }
  assert.equal(done, 5);
  assert.equal(errors, 0);
}
assert.equal(repetitionText('Go ahead!', 'en-US', 4, 5), 'Last time. Go ahead!');
assert.equal(repetitionText('Allez-y !', 'fr-FR', 1, 5), 'Répétez avec moi. Allez-y !');
assert.equal(repetitionText('¡Adelante!', 'es-ES', 2, 3), 'Una última vez. ¡Adelante!');
const audio = new WalkingAudio();
let callbacks = 0;
audio.play('test', 'en-US', 1, 2000, () => callbacks++, () => callbacks++, () => callbacks++);
const old = utterances.at(-1);
audio.cancel(); old.onend(); old.onerror();
assert.equal(callbacks, 0);
audio.play('test', 'en-US', 1, 2000, () => {}, () => callbacks++, () => {});
utterances.at(-1).onend();
const staleTimer = pending.at(-1);
audio.cancel(); staleTimer.callback();
assert.equal(callbacks, 0);
audio.play('test', 'en-US', 1, 2000, () => {}, () => callbacks++, () => callbacks += 10);
utterances.at(-1).onerror();
assert.equal(callbacks, 10);
assert.equal(pending.length, 0);
console.log('Walking Mode: mobile detection, localized speech, five repetitions, timing, voice/rate, errors and cancellation passed.');
