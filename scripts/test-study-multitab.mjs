import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';

const require = createRequire(import.meta.url);
function tab() {
  const cache = new Map();
  function load(file) {
    file = resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const output = transpileModule(readFileSync(file, 'utf8').replaceAll('import.meta.url', JSON.stringify('file:///study-lock-tests/entry.js')), { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 } }).outputText;
    vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename: file })(name => name.startsWith('.') ? load(resolve(dirname(file), name) + (existsSync(resolve(dirname(file), name) + '.ts') ? '.ts' : '.tsx')) : require(name), module, module.exports);
    return module.exports;
  }
  return { ...load('src/features/study/studyStorage.ts'), ...load('src/features/study/studyTrackingService.ts'), ...load('src/features/study/extraActivityService.ts'), ...load('src/features/study/studyStats.ts') };
}
const memory = new Map([['bej-study-data', '{old data ignored'], ['bej-study-tracking-lease', 'obsolete'], ['favorites', 'keep'], ['interface-theme', 'dark']]);
let failRemoval = false;
globalThis.localStorage = { get length() { return memory.size; }, key: i => [...memory.keys()][i] ?? null, getItem: k => memory.get(k) ?? null,
  setItem: (k, v) => memory.set(k, v), removeItem(k) { if (failRemoval) throw Error('removal denied'); memory.delete(k); } };
const events = new EventTarget(), timers = new Set(); let sequence = 0;
globalThis.window = { addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events), dispatchEvent: events.dispatchEvent.bind(events),
  setInterval() { timers.add(++sequence); return sequence; }, clearInterval(id) { timers.delete(id); } };
// Model both held native locks and short queued transactions, including ifAvailable.
const locks = new Map();
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: { request(name, options, fn) {
  if (typeof options === 'function') { fn = options; options = {}; }
  if (options.ifAvailable && locks.has(name)) return Promise.resolve(fn(null));
  const previous = locks.get(name) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(() => fn({ name }));
  locks.set(name, next);
  const clear = () => { if (locks.get(name) === next) locks.delete(name); };
  void next.then(clear, clear); return next;
} } } });
const realNow = Date.now; let now = Date.parse('2026-10-17T12:00:00Z'); Date.now = () => now;
const settle = async () => { for (let i = 0; i < 200; i++) await Promise.resolve(); };
const code = value => e => e.code === value;
const context = module => ({ module, language: 'en-US', mode: 'manual' });
const a = tab(), b = tab(), c = tab();
const stops = [a.studyTracker.start(), b.studyTracker.start(), c.studyTracker.start()];
try {
  assert.equal(a.totalSeconds(a.readStudyStore().studyData), 0, 'obsolete data never migrates');
  a.studyTracker.setExtraView(true); await settle();
  await a.startExtraActivity('en-US', 'reading', 'background reading');
  const draft = a.readStudyStore().extraActivity;
  const initialDraft = memory.get(a.STUDY_KEY + 'active:extra-activities');
  b.studyTracker.set(context('hashmap'), true); c.studyTracker.set(context('shadowing'), true); await settle();
  assert.equal(b.studyTracker.hasControl(), true); assert.equal(c.studyTracker.hasControl(), true);
  // No external timer ticks: another tab must neither rewrite nor recover reading.
  now += 3600000; b.studyTracker.checkpoint(); c.studyTracker.checkpoint(); await settle();
  assert.equal(memory.get(a.STUDY_KEY + 'active:extra-activities'), initialDraft);
  assert.equal(a.readStudyStore().extraActivity.recoveryAt, undefined);
  const beforeGoal = memory.get(a.STUDY_KEY + 'active:extra-activities');
  await b.updateStudyStore(s => ({ ...s, studyData: { ...s.studyData, goals: { 'en-US': 800 }, manualAdjustments: [{ id: 'manual', language: 'en-US', seconds: 120, date: '2026-10-17', description: 'previous' }] } }));
  assert.equal(memory.get(a.STUDY_KEY + 'active:extra-activities'), beforeGoal);
  await Promise.all([a.changeExtraActivity(draft.id, 'stop'), b.studyTracker.seal(), c.studyTracker.seal()]);
  await a.changeExtraActivity(draft.id, 'stop');
  let store = a.readStudyStore();
  assert.equal(store.studyData.sessions.length, 3);
  assert.equal(store.studyData.sessions.find(s => s.id === draft.id).activeSeconds, 3600);
  assert.equal(store.studyData.goals['en-US'], 800);
  assert.equal(a.totalSeconds(store.studyData), 4080); // 3600 + two capped 180s + adjustment
  const filters = { language: 'all', module: 'all', mode: 'all', period: 'all', from: '', to: '' };
  assert.equal(a.studyStats(store.studyData, filters, new Date(now)).total, 4080);
  const backup = a.backupOf(store, new Date(now));
  await a.updateStudyStore(s => a.restoreStudyBackup(s, backup, JSON.stringify(s)));
  assert.equal(a.totalSeconds(a.readStudyStore().studyData), 4080);
  console.log('PASS A/B/D/E: reading + Hashmap + Shadowing, one-hour background interval, simultaneous finalization, three unique sessions, independent goals/adjustment, consolidated stats and idempotent backup import.');

  c.studyTracker.set(context('hashmap'), true); await settle();
  assert.equal(c.studyTracker.hasControl(), false, 'same module has exactly one controller');
  const beforeContention = JSON.stringify([...memory]);
  c.studyTracker.checkpoint(); await settle(); assert.equal(JSON.stringify([...memory]), beforeContention);
  let switchedStatus = "";
  const unsubscribeSwitch = c.studyTracker.subscribe(status => { switchedStatus = status; });
  c.studyTracker.set(context('interpretation'), true); await settle();
  assert.equal(c.studyTracker.hasControl(), true);
  assert.equal(switchedStatus, '', 'a Hashmap conflict must not follow the user into another module');
  for (let step = 0; step < 8; step++) {
    now += 15000; c.studyTracker.checkpoint(); await settle();
  }
  c.studyTracker.set(null, false); await c.studyTracker.seal();
  assert.equal(c.readStudyStore().studyData.sessions.find(s => s.module === 'interpretation').activeSeconds, 120);
  unsubscribeSwitch();
  c.studyTracker.set(context('hashmap'), true); await settle();
  assert.equal(c.studyTracker.hasControl(), false);
  console.log('PASS reported regression: new tab conflicts on Hashmap, switches module, records two minutes and consolidates in Dashboard data.');
  await assert.rejects(() => c.startExtraActivity('en-US', 'reading', ''), code('otherTab'));
  b.studyTracker.set(null, false); await b.studyTracker.seal();
  c.studyTracker.set(null, false); await c.studyTracker.seal();
  c.studyTracker.set(context('hashmap'), true); await settle();
  assert.equal(c.studyTracker.hasControl(), true, 'released module can be safely acquired');
  console.log('PASS C: contention cannot write, release permits another controller.');

  // Crash boundary after the completed record was saved but before draft removal.
  await a.startExtraActivity('en-US', 'reading', 'partial finish'); now += 5000;
  const partial = a.readStudyStore().extraActivity; failRemoval = true;
  await assert.rejects(() => a.changeExtraActivity(partial.id, 'stop'), code('storage'));
  failRemoval = false;
  assert.equal(a.readStudyStore().extraActivity, null);
  await a.changeExtraActivity(partial.id, 'stop');
  assert.equal(a.readStudyStore().studyData.sessions.filter(s => s.id === partial.id).length, 1);
  console.log('PASS interrupted multi-key finish: durable session wins over leftover draft, retry never duplicates.');

  // Stale native acquisition and StrictMode's setup/cleanup/setup sequence.
  const d = tab(); const cleanup = d.studyTracker.start(); d.studyTracker.set(context('interpretation'), true); cleanup();
  const cleanupAgain = d.studyTracker.start(); d.studyTracker.set(context('interpretation'), true); await settle();
  assert.equal(d.studyTracker.hasControl(), true); cleanupAgain(); await settle();
  assert.equal(d.studyTracker.hasControl(), false);
  console.log('PASS lifecycle: immediate cleanup/restart releases only old controls.');

  await a.startExtraActivity('en-US', 'reading', 'recovery'); now += 10000;
  a.studyTracker.checkpoint(); await settle();
  stops[0](); await settle(); now += 60000;
  const recovered = tab(), stopRecovered = recovered.studyTracker.start();
  recovered.studyTracker.setExtraView(true); await settle();
  assert.ok(recovered.readStudyStore().extraActivity.recoveryAt);
  const recoveredDraft = recovered.readStudyStore().extraActivity;
  await recovered.changeExtraActivity(recoveredDraft.id, 'confirm', 30);
  stopRecovered(); await settle();
  assert.equal(memory.get('favorites'), 'keep'); assert.equal(memory.get('interface-theme'), 'dark');
  console.log('PASS abandoned extra activity: native control release, explicit recovery confirmation, independent favorites/preferences preserved.');
} finally {
  failRemoval = false; for (const stop of stops) stop(); await settle(); Date.now = realNow;
}
assert.equal(timers.size, 0);
assert.equal(locks.size, 0, 'all test locks released');
