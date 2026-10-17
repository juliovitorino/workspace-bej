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
const translate = (key, values = {}) => {
  const value = key.split('.').reduce((item, part) => item?.[part], translations) ?? key;
  return String(value).replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? ''));
};
let currentHarness = null;
const hooks = { ...React };
for (const name of ['useState', 'useRef', 'useMemo', 'useEffect', 'useLayoutEffect']) {
  hooks[name] = (...args) => currentHarness ? currentHarness[name](...args) : React[name](...args);
}
function load(file) {
  file = resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  if (file.endsWith('.css')) return module.exports;
  const { outputText } = transpileModule(readFileSync(file, 'utf8').replaceAll('import.meta.env', 'globalThis.__trainingEnv'), { compilerOptions: {
    module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX, target: ScriptTarget.ES2022
  } });
  const localRequire = id => {
    if (id === 'react') return hooks;
    if (id === 'react-i18next') return { useTranslation: () => ({ t: translate, i18n: { language: 'pt-BR' } }) };
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
  useLayoutEffect(fn, deps) { return this.useEffect(fn, deps); }
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

const base = new Date(2026, 0, 1, 12).getTime();
let now = base, nextTimer = 0, writes = 0;
const intervals = new Map(), timeouts = new Map(), memory = new Map(), utterances = [], listeners = new Map();
Date.now = () => now;
globalThis.__trainingEnv = { VITE_AI_ENABLED: 'false' };
globalThis.setInterval = (fn, ms) => { intervals.set(++nextTimer, { fn, ms, next: now + ms }); return nextTimer; };
globalThis.clearInterval = id => intervals.delete(id);
globalThis.setTimeout = (fn, ms) => { timeouts.set(++nextTimer, { fn, ms }); return nextTimer; };
globalThis.clearTimeout = id => timeouts.delete(id);
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem(key, value) { writes++; memory.set(key, value); }, removeItem: key => memory.delete(key) };
globalThis.document = { visibilityState: 'visible', addEventListener(name, fn) { listeners.set(name, fn); }, removeEventListener(name) { listeners.delete(name); } };
globalThis.window = { setInterval, clearInterval, setTimeout, clearTimeout, dispatchEvent() {},
  addEventListener(name, fn) { listeners.set(name, fn); }, removeEventListener(name) { listeners.delete(name); },
  speechSynthesis: { cancel() {}, getVoices: () => [{ lang: 'en-US' }, { lang: 'es-ES' }], speak: u => utterances.push(u) } };
globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
  userAgent: 'Desktop Chrome', platform: 'Win32', maxTouchPoints: 0,
  locks: { request(_name, options, fn) { return Promise.resolve((typeof options === 'function' ? options : fn)({})); } }
} });
globalThis.fetch = async url => {
  assert.ok(String(url).startsWith('/english-'), 'tests must never call a remote service');
  return { ok: true, json: async () => JSON.parse(readFileSync('public' + url, 'utf8')) };
};
const settle = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
const { TrainingActivity, useTrainingStudy } = load('src/features/study/useTrainingStudy.ts');
const { studyTracker, IDLE_MS } = load('src/features/study/studyTrackingService.ts');
const { readStudyStore, totalSeconds, backupOf, parseStudyBackup, restoreStudyBackup } = load('src/features/study/studyStorage.ts');
const { effectiveStudyView, useStudyTracking } = load('src/features/study/useStudyTracking.ts');
const { TrainingStudyTime } = load('src/features/study/TrainingStudyTime.tsx');
const { BasicTraining } = load('src/components/BasicTraining.tsx');
const { AdvancedTraining } = load('src/components/AdvancedTraining.tsx');
const tracking = new Harness(({ view, language, signal, blocked }) => useStudyTracking(view, language, signal, blocked),
  { view: 'study-dashboard', language: 'en-US', signal: null, blocked: false });
tracking.flush(); await settle(); tracking.flush();
const intention = { id: 'test-training', intention: 'Express a possibility', english: 'I might go.', targetIntention: 'I might go.',
  examples: [{ id: 'ex-training', exampleItem: 'I might go.', en: 'I might go.', pt: 'Eu posso ir.', intent: 'might', enIntent: 'might' }], tags: [] };
function navigate(view, language = 'en-US', signal = null, blocked = false) { tracking.flush({ view, language, signal, blocked }); }
async function advance(ms, components = []) {
  for (let remaining = ms; remaining > 0;) {
    const step = Math.min(1000, remaining); now += step; remaining -= step;
    for (const timer of [...intervals.values()]) if (timer.next <= now) { timer.next = now + timer.ms; timer.fn(); }
    for (const component of components) component.flush();
    await settle(); tracking.flush();
  }
}
async function openTraining(module, language = 'en-US') {
  const report = (active, mode = 'manual', activeUntil) => navigate(module, language, { view: module, language, active, mode, activeUntil });
  navigate(module, language);
  const component = new Harness(module === 'basic-training' ? BasicTraining : AdvancedTraining, { intention, language, sourceLanguage: 'pt-BR', onBack() {}, onStudyState: report });
  component.flush(); await settle(); component.flush();
  const panel = new Harness(TrainingStudyTime, { module, language }); panel.flush();
  return { component, panel, module, language, report };
}
function input(practice, trusted = true) {
  const value = 'I might go home today.';
  const field = find(practice.component.tree, n => n.type === 'textarea');
  field.props.onChange({ target: { value } });
  practice.component.tree.props.onInput({ isTrusted: trusted }); practice.component.flush();
  assert.equal(find(practice.component.tree, n => n.type === 'textarea').props.value, value, 'typing survives a tracking render');
}
async function finish(practice) {
  practice.component.dispose(); practice.panel.dispose(); navigate('study-dashboard', practice.language);
  await studyTracker.seal(); tracking.flush();
}
for (const origin of ['hashmap', 'memory-flashcards', 'chunk-flashcards', 'favorite-chunks']) {
  assert.equal(effectiveStudyView(origin, 'basic'), 'basic-training');
  assert.equal(effectiveStudyView(origin, 'advanced'), 'advanced-training');
  assert.equal(effectiveStudyView(origin, 'review'), 'review-training');
  assert.equal(effectiveStudyView(origin, null), origin);
}

// A/B: real components signal only after trusted practice interaction.
for (const module of ['basic-training', 'advanced-training']) {
  const p = await openTraining(module);
  await advance(10000, [p.component, p.panel]);
  assert.equal(studyTracker.readSession({ module, language: 'en-US', mode: 'manual' }).state, 'waiting');
  input(p, false); assert.equal(studyTracker.readSession({ module, language: 'en-US', mode: 'manual' }).seconds, 0);
  input(p); const writesBefore = writes;
  await advance(65000, [p.component, p.panel]);
  assert.equal(text(find(p.panel.tree, n => n.type === 'time')), '00:01:05', 'visual time is read from the central clock');
  assert.equal(text(find(p.panel.tree, n => n.props?.role === 'status')), translations.study.tracking.active);
  assert.ok(writes - writesBefore < 10, 'visual seconds never persist per-second events');
  await finish(p);
  const sessions = readStudyStore().studyData.sessions.filter(s => s.module === module);
  assert.equal(sessions.length, 1); assert.equal(sessions[0].activeSeconds, 65);
}

// Explicit pause excludes the entire break and only the resume button restarts it.
for (const module of ['basic-training', 'advanced-training']) {
  const practice = await openTraining(module);
  const syncPanel = () => practice.panel.flush(find(practice.component.tree, n => n.type === TrainingStudyTime).props);
  syncPanel();
  assert.equal(find(practice.panel.tree, n => n.type === 'button').props.disabled, true);
  input(practice); await advance(30000, [practice.panel]); syncPanel();
  const pause = find(practice.panel.tree, n => n.type === 'button');
  assert.equal(pause.props.disabled, false); let stopped = false;
  pause.props.onClick({ stopPropagation() { stopped = true; } }); practice.component.flush(); syncPanel(); await settle();
  assert.equal(stopped, true); assert.equal(find(practice.panel.tree, n => n.type === 'button').props['aria-pressed'], true);
  assert.equal(text(find(practice.panel.tree, n => n.props?.role === 'status')), translations.common.paused);
  const pausedId = readStudyStore().activeSession.id;
  await advance(IDLE_MS + 30000, [practice.panel]);
  input(practice); await advance(10000, [practice.panel]); syncPanel();
  assert.equal(text(find(practice.panel.tree, n => n.type === 'time')), '00:00:30', 'manual pause excludes the whole break and interactions cannot resume it');
  const resume = find(practice.panel.tree, n => n.type === 'button');
  assert.equal(resume.props['aria-label'], translations.flashcards.resumeStudyTime);
  resume.props.onClick({ stopPropagation() {} }); practice.component.flush(); syncPanel();
  await advance(30000, [practice.panel]); syncPanel();
  assert.equal(text(find(practice.panel.tree, n => n.type === 'time')), '00:01:00');
  await finish(practice);
  assert.equal(readStudyStore().studyData.sessions.find(s => s.id === pausedId).activeSeconds, 60, 'resume keeps the same session and never adds break time');
}

// C: the idle window is the existing five-minute reading grace, not all idle time.
const idle = await openTraining('basic-training'); input(idle); await advance(30000, [idle.panel]); input(idle);
await advance(IDLE_MS + 20000, [idle.panel]);
const idleReading = studyTracker.readSession({ module: idle.module, language: 'en-US', mode: 'manual' });
assert.equal(idleReading.state, 'idle'); assert.equal(idleReading.seconds, 330);
assert.equal(text(find(idle.panel.tree, n => n.props?.role === 'status')), translations.study.tracking.idle);
const idleId = readStudyStore().activeSession.id;
input(idle); await advance(30000, [idle.panel]); await finish(idle);
assert.equal(readStudyStore().studyData.sessions.find(s => s.id === idleId).activeSeconds, 360, '20 seconds beyond IDLE_MS add zero');

// D/E: hidden source-module signals cannot become exercise signals.
const originSignal = { view: 'chunk-flashcards', language: 'en-US', mode: 'manual', active: true };
navigate('chunk-flashcards', 'en-US', originSignal); await advance(10000);
navigate(effectiveStudyView('chunk-flashcards', 'basic'), 'en-US', originSignal); await advance(10000);
assert.equal(studyTracker.readSession({ module: 'basic-training', language: 'en-US', mode: 'manual' }).state, 'waiting');
const exclusive = await openTraining('basic-training'); input(exclusive); await advance(60000); await finish(exclusive);
const origin = readStudyStore().studyData.sessions.find(s => s.module === 'chunk-flashcards');
assert.equal(origin.activeSeconds, 10);
const beforeLeaving = totalSeconds(readStudyStore().studyData); await advance(30000);
assert.equal(totalSeconds(readStudyStore().studyData), beforeLeaving);

// F: changing language creates a separate context and waits for interaction.
const english = await openTraining('advanced-training'); input(english); await advance(30000); await finish(english);
const spanish = await openTraining('advanced-training', 'es-ES'); await advance(10000); input(spanish); await advance(30000); await finish(spanish);
const advancedSessions = readStudyStore().studyData.sessions.filter(s => s.module === 'advanced-training');
assert.ok(advancedSessions.some(s => s.language === 'en-US' && s.activeSeconds === 30));
assert.ok(advancedSessions.some(s => s.language === 'es-ES' && s.activeSeconds === 30));

// An open microphone is not perpetual activity; actual speech results renew it.
const recognitions = [];
window.SpeechRecognition = class {
  constructor() { recognitions.push(this); }
  start() { this.onstart?.(); } stop() { this.onend?.(); } abort() { this.onend?.(); }
};
const dictation = await openTraining('basic-training');
const dictateButton = find(dictation.component.tree, n => n.type === 'button' && n.props['aria-label'] === translate('basicTraining.dictateASentenceInTargetlanguage', { targetLanguage: 'en-us' }));
assert.ok(dictateButton); dictateButton.props.onClick(); dictation.component.flush();
await advance(IDLE_MS + 10000);
assert.equal(studyTracker.readSession({ module: dictation.module, language: 'en-US', mode: 'manual' }).state, 'idle');
recognitions.at(-1).onresult({ resultIndex: 0, results: [{ 0: { transcript: 'I might go home.' }, isFinal: true }] }); dictation.component.flush();
assert.equal(studyTracker.readSession({ module: dictation.module, language: 'en-US', mode: 'manual' }).state, 'active');
await finish(dictation); delete window.SpeechRecognition;

// Audio onset and completion come from the component's existing TTS state.
const audio = await openTraining('basic-training'); input(audio);
find(audio.component.tree, n => n.props?.className?.includes('training-example-audio')).props.onClick();
utterances.at(-1).onstart(); audio.component.flush();
await advance(IDLE_MS + 10000, [audio.panel]);
assert.equal(studyTracker.readSession({ module: audio.module, language: 'en-US', mode: 'manual' }).state, 'active');
utterances.at(-1).onend(); audio.component.flush(); await finish(audio);

// Network waits suspend only passive waiting. Interaction can resume reading.
const pending = { identity: 'network', ready: true, pending: false, media: false };
const networkReport = (active, mode, activeUntil) => navigate('advanced-training', 'en-US', { view: 'advanced-training', language: 'en-US', active, mode, activeUntil });
const network = new Harness(p => useTrainingStudy(p.identity, p.ready, p.pending, p.media, networkReport), pending);
network.flush(); network.tree.onInput({ isTrusted: true }); network.flush(); await advance(5000);
network.flush({ ...pending, pending: true }); await advance(20000);
const networkReading = studyTracker.readSession({ module: 'advanced-training', language: 'en-US', mode: 'manual' }); assert.equal(networkReading.seconds, 5);
network.tree.onScrollCapture({ isTrusted: true }); network.flush(); await advance(10000);
assert.equal(studyTracker.readSession({ module: 'advanced-training', language: 'en-US', mode: 'manual' }).seconds, 15);
network.flush(pending); navigate('advanced-training', 'en-US', { view: 'advanced-training', language: 'en-US', active: true, mode: 'manual', activeUntil: now + IDLE_MS }, true);
assert.equal(studyTracker.readSession({ module: 'advanced-training', language: 'en-US', mode: 'manual' }).state, 'unavailable');
network.dispose(); navigate('study-dashboard'); await studyTracker.seal();
const policy = new TrainingActivity(); assert.equal(policy.signal(now, true).active, false);
policy.interact(now); policy.update(true, false, now); assert.equal(policy.signal(now, true).active, false);
policy.update(false, false, now + IDLE_MS + 1); assert.equal(policy.signal(now + IDLE_MS + 1, true).active, false, 'late network completion does not invent fresh activity');

// New module signals traverse the real central hook, visibility gate and storage.
for (const module of ['speaking-game', 'interpretation']) {
  const context = { module, language: 'en-US', mode: 'manual' };
  const signal = { view: module, language: 'en-US', mode: 'manual', active: false, activeUntil: now + IDLE_MS };
  navigate(module, 'en-US', signal); await advance(10000);
  assert.equal(studyTracker.readSession(context).seconds, 0);
  navigate(module, 'en-US', { ...signal, active: true, activeUntil: now + IDLE_MS });
  await advance(65000); assert.equal(studyTracker.readSession(context).seconds, 65);
  document.visibilityState = 'hidden'; listeners.get('visibilitychange')();
  await advance(20000); assert.equal(studyTracker.readSession(context).seconds, 65);
  document.visibilityState = 'visible'; listeners.get('visibilitychange')();
  await advance(5000); assert.equal(studyTracker.readSession(context).seconds, 70);
  navigate('study-dashboard'); await studyTracker.seal();
  const saved = readStudyStore().studyData.sessions.filter(s => s.module === module);
  assert.equal(saved.length, 1); assert.equal(saved[0].activeSeconds, 70);
}
console.log('PASS new module signals: central hook, initial inactivity, 65 seconds, hidden tab exclusion, visibility resume, exit and persisted totals.');

// G: all exercise modules use the unchanged, idempotent backup contract.
const current = readStudyStore(), backup = parseStudyBackup(JSON.stringify(backupOf(current, new Date(now))));
let restored = restoreStudyBackup(current, backup, JSON.stringify(current));
restored = restoreStudyBackup(restored, backup, JSON.stringify(restored));
assert.equal(totalSeconds(restored.studyData), totalSeconds(current.studyData)); assert.deepEqual(restored.studyData.sessions, current.studyData.sessions);
assert.equal(backup.schemaVersion, 1); assert.equal(restored.studyData.goals['en-US'], 750);
tracking.dispose(); await settle();

// Module bars represent a share of all filtered study time, not the largest bar.
const { StudyDashboard } = load('src/features/study/StudyDashboard.tsx');
const { STUDY_KEY, STUDY_CHANGED } = load('src/features/study/studyStorage.ts');
const chartStore = { schemaVersion: 1, activeSession: null, studyData: { ...current.studyData, manualAdjustments: [], sessions:
  [['basic-training', 181], ['advanced-training', 301]].map(([module, activeSeconds]) => ({ id: `chart-${module}`, module, activeSeconds, language: 'en-US', mode: 'manual',
    startedAt: new Date(now - 482000).toISOString(), endedAt: new Date(now).toISOString() })) } };
memory.set(STUDY_KEY, JSON.stringify(chartStore));
const dashboard = new Harness(StudyDashboard, { language: 'en-US' }); dashboard.flush();
const moduleChart = () => find(dashboard.tree, n => n.type === 'section' && React.Children.toArray(n.props.children).some(c => c?.type === 'h3' && text(c) === translations.study.byModule));
const basicRow = () => find(moduleChart(), n => n.type === 'li' && text(n).includes(translations.study.basicTraining));
const barPercent = row => parseFloat(find(row, n => n.type === 'span' && n.props.style?.width).props.style.width);
assert.ok(text(basicRow()).includes('37,55%'), '181 seconds out of 482 seconds must display 37.55%');
assert.ok(Math.abs(barPercent(basicRow()) - 181 / 482 * 100) < 1e-9);
const moduleFilter = find(dashboard.tree, n => n.type === 'select' && find(n, c => c.type === 'option' && c.props.value === 'basic-training'));
for (const [module, key] of [['speaking-game', 'speakingGame'], ['interpretation', 'interpretation']]) {
  assert.equal(text(find(moduleFilter, n => n.type === 'option' && n.props.value === module)), translations.common[key]);
}
moduleFilter.props.onChange({ target: { value: 'basic-training' } }); dashboard.flush();
assert.ok(text(basicRow()).includes('100%')); assert.equal(barPercent(basicRow()), 100, 'percentages follow the filtered total');
chartStore.studyData.sessions = []; memory.set(STUDY_KEY, JSON.stringify(chartStore)); listeners.get(STUDY_CHANGED)(); dashboard.flush();
assert.ok(text(moduleChart()).includes(translations.study.empty)); assert.ok(!text(moduleChart()).includes('NaN'));
// History renders only one fixed page, with totals independent of navigation.
moduleFilter.props.onChange({ target: { value: 'all' } }); dashboard.flush();
chartStore.studyData.sessions = Array.from({ length: 45 }, (_, index) => ({ id: `page-${index}`, module: index < 5 ? 'basic-training' : 'advanced-training',
  language: 'en-US', mode: 'manual', activeSeconds: 60, startedAt: new Date(now - 60000).toISOString(), endedAt: new Date(now).toISOString() }));
const refreshHistory = () => { memory.set(STUDY_KEY, JSON.stringify(chartStore)); listeners.get(STUDY_CHANGED)(); dashboard.flush(); };
refreshHistory();
const historyList = () => find(dashboard.tree, n => n.props?.id === 'study-history-list');
const pagination = () => find(dashboard.tree, n => n.type === 'nav' && n.props.className.includes('study-history-pagination'));
const pageButton = label => find(pagination(), n => n.type === 'button' && text(n) === label);
const rows = () => React.Children.toArray(historyList()?.props.children);
assert.equal(rows().length, 20); assert.equal(pageButton(translations.common.previous).props.disabled, true);
assert.ok(text(pagination()).includes('1 de 3')); const firstPageKeys = rows().map(row => row.key);
pageButton(translations.common.next).props.onClick(); dashboard.flush();
assert.equal(rows().length, 20); assert.ok(rows().every(row => !firstPageKeys.includes(row.key)));
pageButton(translations.common.next).props.onClick(); dashboard.flush();
assert.equal(rows().length, 5); assert.equal(pageButton(translations.common.next).props.disabled, true);
assert.ok(text(pagination()).includes('3 de 3'));
pageButton(translations.common.previous).props.onClick(); dashboard.flush(); assert.equal(rows().length, 20);
pageButton(translations.common.next).props.onClick(); dashboard.flush();
const filterHistory = find(dashboard.tree, n => n.type === 'select' && find(n, c => c.type === 'option' && c.props.value === 'basic-training'));
filterHistory.props.onChange({ target: { value: 'basic-training' } }); dashboard.flush();
assert.equal(rows().length, 5); assert.ok(text(pagination()).includes('1 de 1'), 'changing filters resets to page one');
filterHistory.props.onChange({ target: { value: 'all' } }); dashboard.flush();
pageButton(translations.common.next).props.onClick(); dashboard.flush(); pageButton(translations.common.next).props.onClick(); dashboard.flush();
chartStore.studyData.sessions = chartStore.studyData.sessions.slice(0, 10); refreshHistory();
assert.equal(rows().length, 10); assert.ok(text(pagination()).includes('1 de 1'), 'deletion or restoration cannot leave an out-of-range page');
chartStore.studyData.sessions = []; refreshHistory(); assert.equal(historyList(), null); assert.equal(pagination(), null);
dashboard.dispose();
console.log('PASS history pagination: 20/20/5 rows, disjoint pages, previous/next boundaries, filter reset, page clamping after data changes and empty state.');
console.log('PASS module chart: 3min01s of 8min02s = 37.55%, filtered denominator, accurate bar width and safe empty state.');
console.log('PASS training A–G: actual Basic/Advanced components, trusted interaction only, 65 seconds each, idle cap/resume, no source overlap, navigation, languages, actual TTS state, passive network exclusion, central visual readout, blocked state, limited writes and idempotent backup.');

