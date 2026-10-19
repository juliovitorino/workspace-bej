import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { transpileModule } from 'typescript';

function fixture(gap = 1000, options = {}) {
  let now = 0, serial = 0;
  const timers = new Map(), speech = [], media = [], events = [];
  const synth = { getVoices: () => [], resume() {},
    speak(u) { speech.push(u); events.push(u.text); },
    cancel() { events.push('cancel'); speech.at(-1)?.onerror?.({ error: 'canceled' }); }
  };
  const context = vm.createContext({ exports: {}, console, localStorage: { getItem: () => null },
    window: { speechSynthesis: synth },
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    Audio: class {
      constructor(src) { if (options.prepareError) throw Error("prepare"); this.src = src; media.push(this); }
      pause() {}
      play() { events.push('MP3'); return options.reject ? Promise.reject(options.reject) : Promise.resolve(); }
    },
    setTimeout(fn, ms) { const id = ++serial; timers.set(id, { fn, at: now + ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    require(name) { return name.includes('studyTracking') ? { studyTracker: { media() {} } } : {
      speakStudyAudio: u => synth.speak(u), cancelStudyAudio: () => synth.cancel()
    }; }
  });
  vm.runInContext(transpileModule(fs.readFileSync('src/utils/walkingAudio.ts', 'utf8'), {
    compilerOptions: { module: 1, target: 9 }
  }).outputText, context);
  const audio = new context.exports.WalkingAudio(gap);
  function tick(ms) {
    const end = now + ms;
    for (;;) {
      const next = [...timers].filter(([, t]) => t.at <= end).sort((a,b) => a[1].at-b[1].at)[0];
      if (!next) break;
      timers.delete(next[0]); now = next[1].at; next[1].fn();
    }
    now = end;
  }
  const chunk = (index, { url = '/audio/en-US/cedar/example.mp3', start = () => {}, spoken = () => {}, done = () => {}, error = () => assert.fail('unexpected audio failure') } = {}) =>
    audio.playChunk('Hello', 'en-US', .9, 2000, url, index, 5, spoken, done, error, start, 'pt-BR');
  return { audio, chunk, tick, speech, media, events, timers };
}
let cases = 0;
for (const gap of [650, 1000, 1500]) {
  for (const translated of [false, true]) {
    const f = fixture(gap); let done = 0, started = 0, spoken = 0;
    for (let i = 0; i < 5; i++) {
      f.chunk(i, { start: () => started++, spoken: () => spoken++, done: () => {
        if (translated) f.audio.play('Olá', 'pt-BR', .9, 2000, () => {}, () => done++, assert.fail);
        else done++;
      } });
      if (i) {
        assert.equal(f.speech.at(-1).lang, 'pt-BR');
        const prompt = f.speech.at(-1); prompt.onend(); prompt.onend();
        const count = f.events.filter(e => e === 'MP3').length;
        f.tick(gap - 1); assert.equal(f.events.filter(e => e === 'MP3').length, count);
        f.tick(1);
      }
      const media = f.media.at(-1); media.onplaying(); media.onended(); media.onended();
      f.tick(2000);
      if (translated) { assert.equal(f.speech.at(-1).text, 'Olá'); f.speech.at(-1).onend(); f.tick(2000); }
      assert.equal(done, i + 1);
    }
    assert.equal(started, 5); assert.equal(spoken, 5);
    assert.deepEqual(f.events.filter(e => !['MP3', 'Olá'].includes(e)), ['Repita comigo', 'De novo', 'Mais uma vez', 'Última vez']);
    assert.equal(f.media.length, 1, 'reuse unlocked element');
    f.audio.cancel(); assert.equal(f.timers.size, 0); cases++;
  }
  // Missing MP3 retains onStart after the internal generation changes.
  const f = fixture(gap); let started = 0, done = 0;
  f.chunk(1, { url: undefined, start: () => started++, done: () => done++ });
  // Explicitly absent URL (the wrapper default would supply a URL).
  f.audio.playChunk('Hello', 'en-US', 1, 2000, undefined, 1, 5, () => {}, () => done++, assert.fail, () => started++, 'pt-BR');
  f.speech.at(-1).onend(); f.tick(gap);
  assert.equal(f.speech.at(-1).lang, 'en-US'); f.speech.at(-1).onstart();
  assert.equal(started, 1); f.speech.at(-1).onend(); f.tick(2000); assert.equal(done, 1); cases++;
}
{
  const f = fixture(); let starts = 0, done = 0;
  f.chunk(0, { start: () => starts++, done: () => done++ });
  const media = f.media.at(-1), staleEnd = media.onended, staleError = media.onerror;
  media.onerror(); staleError();
  assert.equal(f.speech.length, 1); staleEnd();
  f.speech[0].onstart(); f.speech[0].onend(); f.tick(2000);
  assert.equal(starts, 1); assert.equal(done, 1); cases++;
}
{
  const f = fixture();
  f.chunk(1); const stale = f.speech.at(-1);
  f.audio.play('Tradução', 'pt-BR', 1, 1000, () => {}, () => {}, assert.fail);
  const current = f.speech.at(-1);
  stale.onerror({ error: 'interrupted' });
  const cancels = f.events.filter(e => e === 'cancel').length;
  f.audio.cancel();
  assert.equal(f.events.filter(e => e === 'cancel').length, cancels + 1, 'stale error must not clear speaking');
  current.onend(); f.tick(30000); assert.equal(f.timers.size, 0); cases++;
}
{
  const f = fixture(); let failed = 0;
  f.audio.play('Sem evento final', 'pt-BR', 1, 1000, assert.fail, assert.fail, () => failed++);
  f.tick(15000); assert.equal(failed, 1); assert.equal(f.timers.size, 0); cases++;
}
{
  const f = fixture(); let done = 0;
  f.chunk(1, { done: () => done++ });
  f.tick(12000); f.tick(1000); assert.equal(f.events.at(-1), 'MP3');
  f.media.at(-1).onended(); f.tick(2000); assert.equal(done, 1); cases++;
}
{
  const f = fixture(); f.chunk(1); f.speech.at(-1).onend();
  f.audio.cancel(); f.tick(30000); assert.equal(f.media.length, 0); cases++;
}
for (const options of [{ prepareError: true }, { reject: Error('network') }, { reject: { name: 'NotAllowedError' } }]) {
  const f = fixture(1000, options); let failed = 0;
  f.chunk(0, { error: () => failed++ }); await Promise.resolve();
  if (options.reject?.name === 'NotAllowedError') { assert.equal(failed, 1); assert.equal(f.timers.size, 0); }
  else { assert.equal(f.speech.at(-1).text, 'Hello'); f.audio.cancel(); }
  cases++;
}
{
  const f = fixture(); let failed = 0;
  f.chunk(0, { error: () => failed++ }); f.tick(30000);
  assert.equal(failed, 1); assert.equal(f.timers.size, 0); cases++;
}
console.log(`PASS walking audio races: ${cases} scenarios (650/1000/1500 ms, translation, fallback, stale events, cancellation, missing TTS end)`);
export { fixture };
