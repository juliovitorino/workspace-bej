import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transpileModule, ModuleKind, JsxEmit, ScriptTarget } from 'typescript';

// Run the real component handlers/effects with deterministic hook state and
// browser APIs. Static rendering below separately uses React's real renderer.
const require = createRequire(import.meta.url);
const cache = new Map();
const translations = JSON.parse(readFileSync('src/i18n/locales/pt-BR.json', 'utf8'));
const translate = (key, values = {}) => String(key.split('.').reduce((value, part) => value?.[part], translations) ?? key)
  .replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? ''));
let currentHarness = null;
const hooks = { ...React };
for (const name of ['useState', 'useRef', 'useMemo', 'useEffect']) {
  hooks[name] = (...args) => currentHarness ? currentHarness[name](...args) : React[name](...args);
}
function load(file) {
  file = resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  if (file.endsWith('.json')) return module.exports = JSON.parse(readFileSync(file, 'utf8'));
  const source = readFileSync(file, 'utf8').replaceAll('import.meta.env', 'globalThis.__storyTestEnv');
  const { outputText } = transpileModule(source, { compilerOptions: {
    module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX, target: ScriptTarget.ES2022, esModuleInterop: true
  } });
  const localRequire = id => {
    if (id === 'react') return hooks;
    if (id === 'react-i18next') return { useTranslation: () => ({ t: translate }) };
    if (id.endsWith('/i18n')) return { t: translate, languageName: value => value };
    if (!id.startsWith('.')) return require(id);
    const base = resolve(dirname(file), id);
    return load([base, `${base}.ts`, `${base}.tsx`].find(existsSync));
  };
  vm.runInThisContext(`(function(require,module,exports){${outputText}\n})`, { filename: file })(localRequire, module, module.exports);
  return module.exports;
}
const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
class Harness {
  constructor(component, props) { this.component = component; this.props = props; this.slots = []; this.dirty = true; }
  useState(initial) {
    const i = this.cursor++;
    if (!this.slots[i]) this.slots[i] = { value: typeof initial === 'function' ? initial() : initial };
    return [this.slots[i].value, value => {
      const next = typeof value === 'function' ? value(this.slots[i].value) : value;
      if (!Object.is(next, this.slots[i].value)) { this.slots[i].value = next; this.dirty = true; }
    }];
  }
  useRef(initial) { const i = this.cursor++; return this.slots[i] ??= { current: initial }; }
  useMemo(fn, deps) {
    const i = this.cursor++;
    if (!same(this.slots[i]?.deps, deps)) this.slots[i] = { value: fn(), deps };
    return this.slots[i].value;
  }
  useEffect(fn, deps) {
    const i = this.cursor++;
    if (!same(this.slots[i]?.deps, deps)) this.effects.push(() => {
      this.slots[i]?.cleanup?.();
      this.slots[i] = { deps, cleanup: fn() };
    });
  }
  flush(props = this.props) {
    if (props !== this.props) { this.props = props; this.dirty = true; }
    for (let n = 0; this.dirty; n++) {
      assert.ok(n < 30, 'Component must settle');
      this.dirty = false; this.cursor = 0; this.effects = [];
      currentHarness = this;
      try { this.tree = this.component(this.props); } finally { currentHarness = null; }
      for (const effect of this.effects) effect();
    }
    return this.tree;
  }
  dispose() { for (const slot of this.slots) slot?.cleanup?.(); }
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  for (const child of React.Children.toArray(node.props?.children)) {
    const found = find(child, predicate); if (found) return found;
  }
  return null;
}
const named = (tree, name) => find(tree, node => node.props?.['aria-label'] === name);
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) :
  React.Children.toArray(node?.props?.children).map(text).join('');

let now = 0, canceled = 0;
const timers = new Map(), intervals = new Map(), listeners = new Map();
let nextTimer = 0;
Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => now } });
globalThis.setTimeout = (fn, ms) => { const id = ++nextTimer; timers.set(id, { fn, ms }); return id; };
globalThis.clearTimeout = id => timers.delete(id);
globalThis.setInterval = fn => { const id = ++nextTimer; intervals.set(id, fn); return id; };
globalThis.clearInterval = id => intervals.delete(id);
const utterances = [];
let voices = [{ lang: 'en-US' }];
globalThis.SpeechSynthesisUtterance = class { constructor(value) { this.text = value; } };
globalThis.window = { speechSynthesis: {
  cancel() { canceled++; }, getVoices: () => voices, speak: value => utterances.push(value),
  addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name)
} };
globalThis.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
const { searchShadowingStories } = load('src/services/localStoryService.ts');
const { defaultShadowingSettings: defaults, practiceSteps, sentenceSegments, responsePause, formatPracticeTime } = load('src/utils/storyShadowing.ts');
const { useStoryShadowing } = load('src/hooks/useStoryShadowing.ts');
const { StoryShadowing } = load('src/components/StoryShadowing.tsx');
const { Sidebar } = load('src/components/Sidebar.tsx');
assert.equal(searchShadowingStories('en-US').length, 42);
for (const level of ['A1', 'B2']) assert.ok(searchShadowingStories('en-US', level).every(story => story.englishLevel === level));
assert.equal(searchShadowingStories('fr-FR').length, 42);
assert.equal(searchShadowingStories('es-ES').length, 42);
assert.equal(searchShadowingStories('en-US', 'all', 'no-such-story-9876').length, 0);
const first = searchShadowingStories('en-US')[0];
assert.ok(searchShadowingStories('en-US', 'all', first.titleEn.toUpperCase()).includes(first));
assert.ok(searchShadowingStories('en-US', 'all', first.titlePt.normalize('NFD').replace(/[\u0300-\u036f]/g, '')).includes(first));
assert.deepEqual(practiceSteps(defaults).map(s => s.technique), ['listen', 'repeat', 'repeat', 'shadow', 'shadow']);
assert.ok(responsePause('word '.repeat(100), .9) > responsePause('Short text.', .9));
assert.equal(formatPracticeTime(3661000), '01:01:01');
const original = 'Dr. Smith arrived. Hello!  Next?';
assert.equal(sentenceSegments(original, 'en-US').join(''), original);
const savedSegmenter = Intl.Segmenter;
Intl.Segmenter = undefined;
assert.deepEqual(sentenceSegments(original, 'en-US'), [original]);
Intl.Segmenter = savedSegmenter;
assert.match(renderToStaticMarkup(React.createElement(Sidebar, { currentView: 'shadowing', onViewChange() {} })), /Shadowing/);
assert.match(renderToStaticMarkup(React.createElement(StoryShadowing, { language: 'fr-FR', onMenu() {} })), /Un samedi/);
const story = { titleEn: 'Test story', englishLevel: 'A1', paragraphs: [
  { en: 'First paragraph.', pt: 'Primeiro parágrafo.' }, { en: 'Second paragraph.', pt: 'Segundo parágrafo.' }
] };
function session(settings = {}, selected = 0, language = 'en-US', source = story) {
  const props = { settings: { ...defaults, keepAwake: false, interval: 0, ...settings } };
  const harness = new Harness(({ settings }) => useStoryShadowing(source, language, settings, selected), props);
  harness.flush(); return harness;
}
function speakEnd(h) { utterances.at(-1).onend(); h.flush(); }
function timerEnd(h) {
  const [id, timer] = timers.entries().next().value;
  timers.delete(id); now += timer.ms; timer.fn(); h.flush();
}
function drain(h, limit = 100) {
  for (let i = 0; h.tree.playing; i++) {
    assert.ok(i < limit, 'Session must terminate');
    if (h.tree.phase === 'wait') timerEnd(h);
    else { speakEnd(h); if (timers.size && h.tree.phase !== 'wait') timerEnd(h); }
  }
}
// All techniques finish the full story without infinite playback.
for (const technique of ['listen', 'repeat', 'shadow', 'combined']) {
  const h = session({ technique }); h.tree.play(); h.flush(); drain(h);
  assert.equal(h.tree.complete, true); assert.equal(h.tree.completed, 2);
  h.dispose(); assert.equal(timers.size, 0);
}
// Single paragraph scope never advances to another paragraph.
for (const control of ['automatic', 'manual']) {
  const h = session({ scope: 'paragraph', control, technique: 'listen' }, 1);
  h.tree.play(); h.flush(); drain(h);
  assert.equal(h.tree.paragraph, 1); assert.equal(h.tree.completed, 1); assert.equal(h.tree.complete, true);
  h.dispose();
}
// Manual navigation preserves pause state; repeated requests cannot revive old speech.
const h = session({ technique: 'listen', control: 'manual' });
h.tree.play(); h.flush(); const stale = utterances.at(-1);
now += 2000; h.tree.pause(); h.flush();
assert.equal(h.tree.elapsed, 2000);
now += 5000; h.tree.navigate(1); h.flush(); assert.equal(h.tree.playing, false);
h.tree.play(); h.flush(); assert.equal(utterances.at(-1).text, 'Second paragraph.');
stale.onend(); h.flush(); assert.equal(h.tree.paragraph, 1);
h.tree.stop(); h.flush(); const count = utterances.length;
stale.onend(); stale.onerror(); h.flush(); assert.equal(utterances.length, count); assert.equal(timers.size, 0);
h.dispose();
// Pause during response delay retains only the remaining time.
const waiting = session({ technique: 'repeat', scope: 'paragraph', interval: 3 });
waiting.tree.play(); waiting.flush(); speakEnd(waiting); timerEnd(waiting); // prompt ends
speakEnd(waiting); timerEnd(waiting); // paragraph ends, response wait starts
assert.equal(waiting.tree.phase, 'wait');
const fullDelay = [...timers.values()][0].ms;
now += 1000; waiting.tree.pause(); waiting.flush(); now += 9000;
waiting.tree.play(); waiting.flush();
assert.equal([...timers.values()][0].ms, fullDelay - 1000);
waiting.dispose(); assert.equal(timers.size, 0);
// Asynchronous voices and no compatible voice.
voices = [];
const missing = session(); missing.tree.play(); missing.flush(); assert.equal(missing.tree.playing, false); assert.match(missing.tree.error, /voz compatível/);
voices = [{ lang: 'en-US' }]; listeners.get('voiceschanged')(); missing.flush(); assert.equal(missing.tree.hasVoice, true);
missing.tree.play(); missing.flush(); const old = utterances.at(-1); missing.dispose();
old.onend(); assert.equal(timers.size, 0);
assert.equal(intervals.size, 0);
assert.ok(canceled > 0);
// Real selection/preparation and accessible practice controls, without a browser dependency.
const ui = new Harness(StoryShadowing, { language: 'en-US', onMenu() {} }); ui.flush();
const practiceButton = find(ui.tree, n => n.type === 'button' && text(n) === 'Praticar');
assert.ok(practiceButton); practiceButton.props.onClick(); ui.flush();
assert.equal(find(ui.tree, n => n.type === 'button' && text(n) === 'Iniciar prática'), null);
const practiceNode = find(ui.tree, n => typeof n.type === 'function' && n.type.name === 'Practice');
assert.ok(practiceNode);
const practice = new Harness(practiceNode.type, practiceNode.props); practice.flush();
for (const key of ['common.previous', 'shadowing.play', 'common.pause', 'common.next', 'shadowing.repeat', 'common.stop', 'shadowing.settings']) assert.ok(named(practice.tree, translate(key)));
named(practice.tree, translate('shadowing.play')).props.onClick(); practice.flush();
const obsolete = utterances.at(-1);
named(practice.tree, 'Próximo').props.onClick(); practice.flush();
const afterNavigation = utterances.length; obsolete.onend(); practice.flush();
assert.equal(utterances.length, afterNavigation);
// Exercise the actual mobile handlers in every scope/control combination.
for (const scope of ['story', 'paragraph']) for (const control of ['manual', 'automatic']) {
  const mobile = new Harness(practiceNode.type, { ...practiceNode.props,
    settings: { ...defaults, scope, control, automatic: control === 'automatic', technique: 'listen', keepAwake: false } });
  const group = () => find(mobile.tree, n => n.props?.className === 'shadowing-mobile-controls');
  mobile.flush();
  assert.equal(React.Children.count(group().props.children), 6);
  for (const button of React.Children.toArray(group().props.children)) {
    assert.ok(button.props['aria-label']);
    assert.equal(text(button), '', 'Mobile controls contain no visible text');
    assert.match(renderToStaticMarkup(button), /<svg[^>]*aria-hidden="true"/);
  }
  assert.equal(named(group(), 'Anterior').props.disabled, true);
  assert.equal(named(group(), 'Próximo').props.disabled, scope === 'paragraph');
  named(group(), 'Continuar').props.onClick(); mobile.flush();
  assert.ok(named(group(), 'Pausar'));
  named(group(), 'Pausar').props.onClick(); mobile.flush();
  assert.ok(named(group(), 'Continuar'));
  named(group(), 'Repetir').props.onClick(); mobile.flush();
  assert.ok(named(group(), 'Pausar'));
  named(group(), 'Parar').props.onClick(); mobile.flush();
  assert.ok(named(group(), 'Continuar'));
  named(group(), 'Configurações').props.onClick(); mobile.flush();
  assert.equal(named(group(), 'Configurações').props['aria-expanded'], true);
  assert.equal(named(group(), 'Continuar').props.disabled, true);
  named(group(), 'Configurações').props.onClick(); mobile.flush();
  if (scope === 'story') {
    named(group(), 'Próximo').props.onClick(); mobile.flush();
    assert.equal(named(group(), 'Anterior').props.disabled, false);
    named(group(), 'Anterior').props.onClick(); mobile.flush();
    assert.equal(named(group(), 'Anterior').props.disabled, true);
  }
  mobile.dispose();
}
practice.dispose(); ui.dispose();

// Sentence practice keeps the original paragraph and allows its full reading after completion.
story.paragraphs[0].en = 'First sentence. Second sentence.';
const phrases = session({ unit: 'sentence', technique: 'listen', scope: 'paragraph' });
phrases.tree.play(); phrases.flush(); drain(phrases);
assert.equal(phrases.tree.complete, true); assert.equal(phrases.tree.completed, 1);
phrases.tree.readParagraph(); phrases.flush(); assert.equal(utterances.at(-1).text, story.paragraphs[0].en);
drain(phrases); assert.equal(phrases.tree.complete, true); phrases.dispose();

// A mid-speech settings change invalidates old callbacks and waits for explicit Play.
const changing = session({ technique: 'shadow' }); changing.tree.play(); changing.flush();
const oldRate = utterances.at(-1);
const nextSettings = { ...changing.props.settings, rate: .8 };
changing.tree.configure(nextSettings); changing.flush({ settings: nextSettings });
assert.equal(changing.tree.playing, false); oldRate.onend(); changing.flush();
changing.tree.play(); changing.flush(); assert.equal(utterances.at(-1).rate, .8);
changing.dispose();
assert.equal(timers.size, 0); assert.equal(intervals.size, 0); assert.equal(listeners.size, 0);
console.log('Story Shadowing: filters, language isolation, techniques, scopes, manual navigation, monotonic clock, pause/resume, cancellation, segmentation and asynchronous voices passed.');

// The selected language drives cards, search, segmentation and spoken content.
const { getStoryTitle, getParagraphText } = load('src/services/localStoryService.ts');
voices = [{ lang: 'en-US' }, { lang: 'es-ES' }, { lang: 'fr-FR' }];
for (const language of ['en-US', 'es-ES', 'fr-FR']) {
  const sample = searchShadowingStories(language, 'A1')[0];
  const title = getStoryTitle(sample, language);
  const query = title.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  assert.ok(searchShadowingStories(language, 'A1', query).includes(sample));
  for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
    const matches = searchShadowingStories(language, level);
    assert.ok(matches.length > 0 && matches.every(s => s.englishLevel === level));
  }
  const markup = renderToStaticMarkup(React.createElement(StoryShadowing, { language, onMenu() {} }));
  assert.ok(markup.includes(title));
  const preview = renderToStaticMarkup(React.createElement('span', null, getParagraphText(sample.paragraphs[0], language))).slice(6, -7);
  assert.ok(markup.includes(preview));
  for (const scope of ['story', 'paragraph']) for (const control of ['manual', 'automatic']) {
    const h = session({ technique: 'listen', scope, control, automatic: control === 'automatic' }, 0, language, sample);
    h.tree.play(); h.flush();
    assert.equal(utterances.at(-1).lang, language);
    assert.equal(utterances.at(-1).text, getParagraphText(sample.paragraphs[0], language));
    assert.equal(h.tree.segments.join(''), getParagraphText(sample.paragraphs[0], language));
    h.tree.readParagraph(); h.flush();
    assert.equal(utterances.at(-1).text, getParagraphText(sample.paragraphs[0], language));
    h.dispose();
  }
  const sentences = session({ technique: 'listen', unit: 'sentence', control: 'manual' }, 1, language, sample);
  sentences.tree.navigate(-1); sentences.flush();
  const parts = sentenceSegments(getParagraphText(sample.paragraphs[0], language), language);
  assert.equal(sentences.tree.sentence, parts.length - 1);
  sentences.tree.play(); sentences.flush();
  assert.equal(utterances.at(-1).text, parts.at(-1));
  assert.equal(utterances.at(-1).lang, language);
  sentences.dispose();
}
const translated = searchShadowingStories('fr-FR', 'A1')[0];
const savedTitle = translated.titleFr;
try {
  translated.titleFr = '';
  assert.ok(!searchShadowingStories('fr-FR', 'A1').includes(translated), 'Incomplete translations are omitted');
} finally { translated.titleFr = savedTitle; }
assert.equal(timers.size, 0);
assert.equal(intervals.size, 0);
console.log('Multilingual Shadowing: translated cards/search, all CEFR levels, four scope/control combinations, full-paragraph audio and backward sentence navigation passed.');

// Dashboard integration uses the real Practice component and its real hook.
// Advance a deterministic clock rather than waiting minutes in real time.
const { StudyClock } = load('src/features/study/studyTrackingService.ts');
const { emptyStore, backupOf, parseStudyBackup, restoreStudyBackup, totalSeconds } = load('src/features/study/studyStorage.ts');
const { studyStats } = load('src/features/study/studyStats.ts');
const baseTime = new Date(2026, 0, 1, 12).getTime();
let studySequence = 0;
function dashboardPractice(language = 'en-US', settings = {}, clock = new StudyClock(() => `shadowing-${++studySequence}`), records = []) {
  const source = searchShadowingStories(language, 'A1')[0];
  const reports = [];
  const onStudyState = (active, mode) => {
    reports.push({ active, mode });
    const finished = clock.set({ language, module: 'shadowing', mode }, active, baseTime + now);
    if (finished?.activeSeconds) records.push(finished);
  };
  const h = new Harness(practiceNode.type, { ...practiceNode.props, story: source, language, onStudyState,
    settings: { ...defaults, technique: 'listen', scope: 'paragraph', interval: 0, keepAwake: false, ...settings } });
  h.flush();
  return { h, clock, records, reports,
    play() { named(h.tree, translate('shadowing.play')).props.onClick(); h.flush(); },
    pause() { named(h.tree, translate('common.pause')).props.onClick(); h.flush(); },
    advance(ms) {
      for (let remaining = ms; remaining > 0;) {
        const step = Math.min(15000, remaining); now += step; remaining -= step;
        for (const tick of intervals.values()) tick();
        h.flush(); clock.snapshot(baseTime + now);
      }
    },
    finish() { h.dispose(); const record = clock.finish(baseTime + now); if (record?.activeSeconds) records.push(record); return records; }
  };
}
const a = dashboardPractice();
a.advance(10000); assert.equal(a.clock.snapshot(baseTime + now), null, 'merely opening Shadowing adds zero time');
a.play(); a.advance(65000);
assert.equal(find(a.h.tree, n => n.type === 'time').props.children, '00:01:05', 'existing visual clock is preserved');
named(a.h.tree, translate('common.stop')).props.onClick(); a.h.flush();
assert.equal(a.reports.at(-1).active, false);
const recordsA = a.finish(); assert.equal(recordsA.length, 1); assert.equal(recordsA[0].activeSeconds, 65);
const b = dashboardPractice(); b.play(); b.advance(30000);
const pauseId = b.clock.snapshot(baseTime + now).id;
b.pause(); b.advance(20000); b.play(); b.advance(30000);
assert.equal(b.clock.snapshot(baseTime + now).id, pauseId);
assert.equal(b.finish()[0].activeSeconds, 60, '30s play + 20s paused + 30s play = 60s');
const c = dashboardPractice(); c.play(); c.advance(60000); const recordsC = c.finish();
now += 20000; assert.equal(c.clock.snapshot(baseTime + now), null); assert.equal(recordsC[0].activeSeconds, 60, 'leaving never continues accumulation');
const d = dashboardPractice(); d.play(); d.advance(30000); d.h.dispose();
const secondStory = dashboardPractice('en-US', {}, d.clock, d.records); secondStory.play(); secondStory.advance(20000);
assert.equal(secondStory.finish()[0].activeSeconds, 50, 'changing stories never re-adds prior elapsed time');
assert.equal(d.records.length, 1);
const en = dashboardPractice(); en.play(); en.advance(30000); en.h.dispose();
const es = dashboardPractice('es-ES', {}, en.clock, en.records); es.play(); es.advance(20000); es.finish();
assert.deepEqual(en.records.map(s => [s.language, s.activeSeconds]), [['en-US', 30], ['es-ES', 20]]);
const guided = dashboardPractice('en-US', { technique: 'repeat', control: 'manual', repetitions: 2 });
guided.play(); speakEnd(guided.h); timerEnd(guided.h); speakEnd(guided.h); timerEnd(guided.h);
assert.equal(guided.reports.at(-1).active, true, 'guided manual response window counts as practice');
timerEnd(guided.h);
assert.equal(guided.reports.at(-1).active, false, 'manual ready state waits for explicit Play');
const beforeReady = guided.clock.snapshot(baseTime + now).activeSeconds;
guided.advance(20000); assert.equal(guided.clock.snapshot(baseTime + now).activeSeconds, beforeReady); guided.finish();
const completedPractice = dashboardPractice(); completedPractice.play(); completedPractice.advance(5000);
for (let i = 0; completedPractice.reports.at(-1).active; i++) {
  assert.ok(i < 100, 'Practice must complete');
  if (timers.size) timerEnd(completedPractice.h); else speakEnd(completedPractice.h);
}
assert.equal(completedPractice.reports.at(-1).active, false, 'completion suspends dashboard tracking'); completedPractice.finish();
const noVoiceSaved = voices; voices = [];
const noVoicePractice = dashboardPractice(); noVoicePractice.play(); noVoicePractice.advance(10000);
assert.equal(noVoicePractice.finish().length, 0, 'missing voice cannot start a study session'); voices = noVoiceSaved;
const persisted = { ...emptyStore(), studyData: { ...emptyStore().studyData, sessions: recordsA } };
const exported = parseStudyBackup(JSON.stringify(backupOf(persisted, new Date(baseTime + now))));
let restored = restoreStudyBackup(emptyStore(), exported, JSON.stringify(emptyStore()));
restored = restoreStudyBackup(restored, exported, JSON.stringify(restored));
assert.equal(totalSeconds(restored.studyData), 65); assert.equal(restored.studyData.sessions[0].id, recordsA[0].id);
const metrics = studyStats(restored.studyData, { language: 'en-US', module: 'shadowing', mode: 'all', period: 'all', from: '', to: '' }, new Date(baseTime + now));
assert.equal(metrics.total, 65); assert.equal(metrics.byModule.shadowing, 65); assert.equal(metrics.byLanguage['en-US'], 65);
assert.equal(restored.studyData.goals['en-US'], 750);
assert.equal(intervals.size, 0); assert.equal(timers.size, 0);
console.log('Shadowing dashboard A–F passed with deterministic time: 65s practice, pause exclusion, navigation, story change, language separation, guided manual practice, completion, missing voice, module/language totals and idempotent backup round trip.');


