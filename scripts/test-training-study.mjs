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
  const { outputText } = transpileModule(readFileSync(file, 'utf8').replaceAll('import.meta.url', JSON.stringify('file:///study-lock-tests/entry.js')).replaceAll('import.meta.env', 'globalThis.__trainingEnv'), { compilerOptions: {
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
globalThis.localStorage = { get length() { return memory.size; }, key: i => [...memory.keys()][i] ?? null, getItem: key => memory.get(key) ?? null, setItem(key, value) { writes++; memory.set(key, value); }, removeItem: key => memory.delete(key) };
globalThis.document = { getElementById: () => null, visibilityState: 'visible', addEventListener(name, fn) { listeners.set(name, fn); }, removeEventListener(name) { listeners.delete(name); } };
globalThis.window = { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), setInterval, clearInterval, setTimeout, clearTimeout, dispatchEvent() {},
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
  practice.component.tree.props.onInput({ isTrusted: trusted });
  listeners.get("input")?.({ type: "input", isTrusted: trusted, target: null }); practice.component.flush();
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
  const pausedId = readStudyStore(localStorage, module).activeSession.id;
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
assert.equal(idleReading.state, 'idle'); assert.equal(idleReading.seconds, 210);
assert.equal(text(find(idle.panel.tree, n => n.props?.role === 'status')), translations.study.tracking.idle);
const idleId = readStudyStore(localStorage, idle.module).activeSession.id;
input(idle); await advance(30000, [idle.panel]); await finish(idle);
assert.equal(readStudyStore().studyData.sessions.find(s => s.id === idleId).activeSeconds, 240, '20 seconds beyond IDLE_MS add zero');

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
network.flush(); await settle(); network.tree.onInput({ isTrusted: true }); network.flush(); await advance(5000);
network.flush({ ...pending, pending: true }); await advance(20000);
const networkReading = studyTracker.readSession({ module: 'advanced-training', language: 'en-US', mode: 'manual' }); assert.equal(networkReading.seconds, 5);
network.tree.onScrollCapture({ isTrusted: true }); listeners.get("pointerdown")?.({ type: "pointerdown", isTrusted: true, target: null }); network.flush(); await advance(10000);
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
const { STUDY_KEY, STUDY_CHANGED, STUDY_MODULES, writeStudyStore } = load('src/features/study/studyStorage.ts');
function persistChartStore() {
  for (const key of [...memory.keys()]) if (key.startsWith(STUDY_KEY)) memory.delete(key);
  writeStudyStore(chartStore);
}
const chartStore = { schemaVersion: 1, activeSession: null, studyData: { ...current.studyData, manualAdjustments: [], sessions:
  [['basic-training', 181], ['advanced-training', 301]].map(([module, activeSeconds]) => ({ id: `chart-${module}`, module, activeSeconds, language: 'en-US', mode: 'manual',
    startedAt: new Date(now - 482000).toISOString(), endedAt: new Date(now).toISOString() })) } };
persistChartStore();
const dashboard = new Harness(StudyDashboard, { language: 'en-US' }); dashboard.flush();
const viewNode = id => find(dashboard.tree, n => n.props.id === id);
assert.equal(viewNode('study-details').props.hidden, true);
assert.equal(viewNode('study-settings').props.hidden, true);
const beforeUi = JSON.stringify([...memory]);
find(dashboard.tree, n => n.type === 'button' && n.props['aria-controls'] === 'study-details').props.onClick(); dashboard.flush();
assert.equal(viewNode('study-details').props.hidden, false);
find(dashboard.tree, n => n.type === 'button' && n.props['aria-controls'] === 'study-settings').props.onClick(); dashboard.flush();
assert.equal(viewNode('study-settings').props.hidden, false);
find(dashboard.tree, n => n.type === 'button' && n.props['aria-label'] === translations.study.historyTitle).props.onClick(); dashboard.flush();
assert.equal(viewNode('study-results').props.hidden, true);
assert.equal(viewNode('study-filters').props.hidden, false);
find(dashboard.tree, n => n.type === 'button' && text(n) === translations.study.backDashboard).props.onClick(); dashboard.flush();
assert.equal(viewNode('study-results').props.hidden, false);
assert.equal(JSON.stringify([...memory]), beforeUi, 'details, settings and history navigation never write study data');
console.log('PASS dashboard views: collapsed details/settings, expansion, dedicated history, return and no storage writes.');
const moduleChart = () => viewNode('study-time-by-module');
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
chartStore.studyData.sessions = []; persistChartStore(); listeners.get(STUDY_CHANGED)(); dashboard.flush();
assert.equal(React.Children.toArray(find(moduleChart(), n => n.type === 'ul').props.children).length, 1);
assert.ok(text(moduleChart()).includes(translations.study.zeroDuration)); assert.ok(text(moduleChart()).includes('0%'));
assert.equal(barPercent(basicRow()), 0); assert.ok(!text(moduleChart()).includes('NaN'));
// Module comparison lists every applicable module, ordered by raw seconds.
const chartSection = title => find(dashboard.tree, n => n.type === 'section' && React.Children.toArray(n.props.children).some(c => c?.type === 'h3' && (text(c) === title || text(c).startsWith(title + ' \u00b7 '))));
const chartRows = title => React.Children.toArray(find(chartSection(title), n => n.type === 'ul')?.props.children);
const moduleRows = () => chartRows(translations.study.byModule);
const rowLabel = row => text(find(row, n => n.type === 'span' && !n.props.style));
const filterControls = () => React.Children.toArray(find(dashboard.tree, n => n.type === 'fieldset' && n.props.className?.includes('study-filters')).props.children)
  .map(label => find(label, n => n.type === 'select')).filter(Boolean);
const setFilter = (index, value) => { filterControls()[index].props.onChange({ target: { value } }); dashboard.flush(); };
for (const period of ['today', 'yesterday', 'month', '7', '30', '90', 'all', 'custom']) {
  setFilter(3, period);
  for (const title of [translations.study.byLanguage, translations.study.byModule]) {
    assert.equal(text(find(chartSection(title), n => n.type === 'h3')), `${title} \u00b7 ${translations.study.periods[period]}`);
  }
}
setFilter(3, 'all');
console.log('PASS chart headings: language and module charts follow every selected period.');
const labels = Object.fromEntries(STUDY_MODULES.map(module => [module, text(find(moduleFilter, n => n.type === 'option' && n.props.value === module))]));
const updateChart = sessions => {
  chartStore.studyData.sessions = sessions; persistChartStore(); listeners.get(STUDY_CHANGED)(); dashboard.flush();
};
const chartSession = (module, seconds, language = 'en-US', daysAgo = 0, mode = 'manual') => {
  const end = new Date().getTime() - daysAgo * 86400000;
  return { id: `comparison-${module}-${language}-${daysAgo}-${mode}`, module, language, mode, activeSeconds: seconds,
    ...(module === 'extra-activities' ? { category: 'conversation' } : {}),
    startedAt: new Date(end - seconds * 1000).toISOString(), endedAt: new Date(end).toISOString() };
};
setFilter(1, 'all');
for (const [seconds, expected] of [[308, '5min 8s'], [3608, '1h 8s'], [3600, '1h'], [300, '5min'], [8, '8s']]) {
  updateChart([chartSession('basic-training', seconds)]);
  assert.equal(text(find(basicRow(), n => n.type === 'strong')), expected + ' \u00b7 100%');
}
updateChart([]);
console.log('PASS compact durations: omitted zero units, exact hours/minutes/seconds and zero fallback.');
assert.equal(moduleRows().length, STUDY_MODULES.length);
assert.ok(moduleRows().every(row => text(row).includes('0s') && text(row).includes('0%') && barPercent(row) === 0));
assert.deepEqual(moduleRows().map(rowLabel), Object.values(labels).sort((a, b) => a.localeCompare(b, 'pt-BR')));
assert.equal(find(moduleChart(), n => n.type === 'ul').props.className, 'study-chart study-chart-modules');
updateChart([chartSession('basic-training', 5 * 3600), chartSession('shadowing', 2 * 3600), chartSession('speaking-game', 10 * 3600)]);
assert.equal(moduleRows().length, STUDY_MODULES.length);
assert.deepEqual(moduleRows().slice(0, 3).map(rowLabel), ['speaking-game', 'basic-training', 'shadowing'].map(module => labels[module]));
assert.equal(moduleRows().filter(row => barPercent(row) === 0).length, STUDY_MODULES.length - 3);
assert.ok(Math.abs(barPercent(moduleRows()[0]) - 10 / 17 * 100) < 1e-9);
assert.ok(text(moduleRows()[0]).includes('10h'));
updateChart(STUDY_MODULES.map((module, index) => chartSession(module, (index + 1) * 60)));
assert.deepEqual(moduleRows().map(rowLabel), [...STUDY_MODULES].reverse().map(module => labels[module]));
updateChart(STUDY_MODULES.map(module => chartSession(module, 120)));
assert.deepEqual(moduleRows().map(rowLabel), Object.values(labels).sort((a, b) => a.localeCompare(b, 'pt-BR')));
// Refresh and all four filters recalculate order without changing persisted data.
updateChart([chartSession('shadowing', 1000, 'en-US', 40), chartSession('speaking-game', 65), chartSession('interpretation', 125, 'fr-FR'), chartSession('chunk-favorites', 70, 'en-US', 0, 'walking')]);
assert.equal(rowLabel(moduleRows()[0]), labels.shadowing);
setFilter(3, 'today'); assert.equal(rowLabel(moduleRows()[0]), labels['chunk-favorites']);
setFilter(0, 'fr-FR'); assert.equal(rowLabel(moduleRows()[0]), labels.interpretation);
assert.equal(moduleRows().filter(row => barPercent(row) > 0).length, 1);
setFilter(0, 'all'); assert.equal(rowLabel(moduleRows()[0]), labels.interpretation);
setFilter(2, 'walking'); assert.equal(rowLabel(moduleRows()[0]), labels['chunk-favorites']);
assert.equal(barPercent(moduleRows()[0]), 100);
setFilter(1, 'interpretation'); assert.equal(moduleRows().length, 1); assert.equal(barPercent(moduleRows()[0]), 0);
setFilter(2, 'manual'); assert.equal(barPercent(moduleRows()[0]), 100);
setFilter(1, 'all'); setFilter(2, 'all'); setFilter(3, 'all');
const diskBeforeFilters = JSON.stringify([...memory]);
setFilter(0, 'en-US'); setFilter(0, 'all'); assert.equal(JSON.stringify([...memory]), diskBeforeFilters);
for (const title of [translations.study.byLanguage, translations.study.timeline]) {
  assert.equal(find(chartSection(title), n => n.type === 'ul').props.className, 'study-chart');
  const order = chartRows(title).map(rowLabel); assert.deepEqual(order, [...order].sort((a, b) => a.localeCompare(b)));
}
setFilter(0, 'en-US'); setFilter(1, 'all');
console.log('PASS module comparison: complete/empty lists, zero widths, 10h/5h/2h order, localized ties, nine active modules, live refresh, all filters, unchanged storage and other charts.');
// History renders only one fixed page, with totals independent of navigation.
moduleFilter.props.onChange({ target: { value: 'all' } }); dashboard.flush();
chartStore.studyData.sessions = Array.from({ length: 45 }, (_, index) => ({ id: `page-${index}`, module: index < 5 ? 'basic-training' : 'advanced-training',
  language: 'en-US', mode: 'manual', activeSeconds: 60, startedAt: new Date(now - 60000).toISOString(), endedAt: new Date(now).toISOString() }));
const refreshHistory = () => { persistChartStore(); listeners.get("storage")({ key: STUDY_KEY + "session:history-refresh" }); dashboard.flush(); };
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

// External analysis shares metrics/history; the official goal ignores analysis filters.
updateChart([chartSession('basic-training', 30 * 3600),
  ...[['conversation', 8], ['private-class', 6], ['writing', 4]].map(([category, hours]) => ({ ...chartSession('extra-activities', hours * 3600), id: `extra-${category}`, category, note: 'external ' + category }))]);
const metricValue = label => text(find(dashboard.tree, n => n.type === 'div' && n.props.className === 'study-panel' && React.Children.toArray(n.props.children).some(child => child?.type === 'span' && text(child) === label)));
assert.ok(metricValue(translations.extras.internalTime).includes('30h'));
assert.ok(metricValue(translations.extras.externalTime).includes('18h'));
assert.ok(metricValue(translations.extras.consolidated).includes('48h'));
const officialProgress = () => find(dashboard.tree, n => n.type === 'progress').props.value;
assert.equal(officialProgress(), 6.4);
assert.equal(chartRows(translations.extras.byCategory).length, 6);
assert.ok(chartRows(translations.extras.byCategory).some(row => rowLabel(row) === translations.extras.categories.other && barPercent(row) === 0));
setFilter(4, 'external'); assert.ok(metricValue(translations.extras.consolidated).includes('18h')); assert.equal(officialProgress(), 6.4);
setFilter(5, 'conversation'); assert.ok(metricValue(translations.extras.consolidated).includes('8h')); assert.equal(officialProgress(), 6.4);
assert.equal(rows().length, 1); assert.ok(text(historyList()).includes('external conversation'));
setFilter(4, 'internal'); assert.ok(metricValue(translations.extras.consolidated).includes('30h')); assert.equal(filterControls().length, 5);
setFilter(4, 'all'); setFilter(5, 'all'); assert.ok(metricValue(translations.extras.consolidated).includes('48h'));
updateChart(Array.from({ length: 45 }, (_, index) => ({ ...chartSession('extra-activities', 60), id: `extra-page-${index}`, note: `external ${index}` })));
assert.equal(rows().length, 20); pageButton(translations.common.next).props.onClick(); dashboard.flush();
assert.equal(rows().length, 20); pageButton(translations.common.next).props.onClick(); dashboard.flush(); assert.equal(rows().length, 5);
console.log('PASS external dashboard: 30h + 18h = 48h, six categories including zero, origin/category filters, official 6.4% unchanged, notes and 20/20/5 external history.');
// A dashboard tab must show confirmed time while the flashcards tab stays open.
updateChart([]);
const liveCheckpoint = { ...chartSession('chunk-flashcards', 120), id: 'live-flashcards' };
const checkpointKey = STUDY_KEY + 'active:chunk-flashcards';
memory.set(checkpointKey, JSON.stringify(liveCheckpoint));
listeners.get('storage')({ key: checkpointKey }); dashboard.flush();
assert.ok(metricValue(translations.extras.consolidated).includes('2min'));
assert.equal(officialProgress(), 120 / (750 * 3600) * 100);
assert.equal(readStudyStore().studyData.sessions.length, 0, 'visible checkpoint is not completed history');
assert.equal(backupOf(readStudyStore()).studyData.sessions.length, 0, 'backups do not seal another tab');
const pausedCheckpoint = { ...liveCheckpoint, activeSeconds: 120 };
memory.set(checkpointKey, JSON.stringify(pausedCheckpoint));
listeners.get('focus')(); dashboard.flush();
assert.ok(metricValue(translations.extras.consolidated).includes('2min'));
const finalCheckpoint = { ...liveCheckpoint, activeSeconds: 125, endedAt: new Date(Date.parse(liveCheckpoint.endedAt) + 5000).toISOString() };
memory.set(STUDY_KEY + 'session:' + finalCheckpoint.id, JSON.stringify(finalCheckpoint));
listeners.get('storage')({ key: STUDY_KEY + 'session:' + finalCheckpoint.id }); dashboard.flush();
assert.ok(metricValue(translations.extras.consolidated).includes('2min 5s'), 'finalized history wins even before draft removal');
assert.equal(officialProgress(), 125 / (750 * 3600) * 100);
memory.delete(checkpointKey); listeners.get('storage')({ key: checkpointKey }); dashboard.flush();
assert.ok(metricValue(translations.extras.consolidated).includes('2min 5s'));
assert.equal(readStudyStore().studyData.sessions.length, 1);
console.log('PASS live Dashboard: cross-tab checkpoint contributes to metrics/goals before completion, focus refresh, pause stays fixed, history wins without duplication and backup remains completed-only.');

// The calendar uses the actual Dashboard filter state, with no persistence.
const calendarWrites = writes;
const calendarButton = () => named(dashboard.tree, translations.study.calendar);
const periodSelect = () => find(dashboard.tree, n => n.type === 'select' && find(n, c => c.type === 'option' && c.props.value === 'custom'));
const periodMenu = () => find(dashboard.tree, n => n.type?.name === 'StudyPeriodMenu');
const calendarAnchor = {};
const originalElementById = document.getElementById, originalMatchMedia = window.matchMedia;
const calendarScrolls = []; let reducedMotion = false;
document.getElementById = id => id === 'study-time-by-module' ? {
  scrollIntoView(options) {
    assert.equal(periodMenu(), null, 'menu collapses before scrolling');
    assert.ok(find(dashboard.tree, node => node.props?.id === id), 'updated module chart is mounted');
    calendarScrolls.push({ ...options, period: periodSelect().props.value });
  }, focus(options) { assert.equal(options.preventScroll, true); }
} : originalElementById(id);
window.matchMedia = query => query === '(prefers-reduced-motion: reduce)' ? { matches: reducedMotion } : originalMatchMedia(query);
for (const period of ['today', '7', '30', 'month', '90', 'all']) {
  const beforeScroll = calendarScrolls.length;
  calendarButton().props.onClick({ currentTarget: calendarAnchor }); dashboard.flush();
  assert.equal(calendarScrolls.length, beforeScroll, 'opening never scrolls');
  assert.equal(periodMenu().props.period, periodSelect().props.value);
  periodMenu().props.onSelect(period); dashboard.flush();
  assert.equal(periodSelect().props.value, period); assert.equal(periodMenu(), null);
  assert.equal(calendarScrolls.length, beforeScroll + 1);
  assert.deepEqual(calendarScrolls.at(-1), { behavior: 'smooth', block: 'start', period });
  reducedMotion = true;
  calendarButton().props.onClick({ currentTarget: calendarAnchor }); dashboard.flush();
  periodMenu().props.onSelect(period); dashboard.flush();
  assert.equal(periodMenu(), null); assert.equal(calendarScrolls.length, beforeScroll + 2, 'same period scrolls exactly once');
  assert.deepEqual(calendarScrolls.at(-1), { behavior: 'instant', block: 'start', period });
  reducedMotion = false;
}
const selectionScrolls = calendarScrolls.length;
periodSelect().props.onChange({ target: { value: 'custom' } }); dashboard.flush();
calendarButton().props.onClick({ currentTarget: calendarAnchor }); dashboard.flush();
assert.equal(periodMenu().props.period, 'custom');
periodMenu().props.onClose(); dashboard.flush(); assert.equal(periodSelect().props.value, 'custom');
calendarButton().props.onClick({ currentTarget: calendarAnchor }); dashboard.flush();
calendarButton().props.onClick({ currentTarget: calendarAnchor }); dashboard.flush(); assert.equal(periodMenu(), null);
assert.equal(calendarScrolls.length, selectionScrolls, 'traditional filters, opening and closing never scroll to the module chart');
document.getElementById = originalElementById; window.matchMedia = originalMatchMedia;
assert.equal(writes, calendarWrites);
console.log('PASS calendar Dashboard: all six periods share the existing filter, bidirectional selection, custom period, toggle/close and zero storage writes.');
console.log('PASS calendar selection scroll: all six periods collapse before one scroll to the updated module chart, repeated active periods, reduced motion and no scroll without selection.');
dashboard.dispose();
console.log('PASS history pagination: 20/20/5 rows, disjoint pages, previous/next boundaries, filter reset, page clamping after data changes and empty state.');
console.log('PASS module chart: 3min01s of 8min02s = 37.55%, filtered denominator, accurate bar width and safe empty state.');
console.log('PASS training A–G: actual Basic/Advanced components, trusted interaction only, 65 seconds each, idle cap/resume, no source overlap, navigation, languages, actual TTS state, passive network exclusion, central visual readout, blocked state, limited writes and idempotent backup.');

