import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';

const require = createRequire(import.meta.url);
function runtime() {
  const cache = new Map();
  function load(file) {
    file = resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const output = transpileModule(readFileSync(file, 'utf8').replaceAll('import.meta.url', JSON.stringify('file:///study-lock-tests/entry.js')), { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 } }).outputText;
    const localRequire = id => {
      if (!id.startsWith('.')) return require(id);
      const base = resolve(dirname(file), id);
      return load([base + '.ts', base + '.tsx', base].find(p => existsSync(p) && statSync(p).isFile()));
    };
    vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename: file })(localRequire, module, module.exports);
    return module.exports;
  }
  return { storage: load('src/features/study/studyStorage.ts'), tracker: load('src/features/study/studyTrackingService.ts').studyTracker,
    service: load('src/features/study/extraActivityService.ts'), time: load('src/features/study/extraActivityTime.ts'),
    stats: load('src/features/study/studyStats.ts').studyStats };
}
const realNow = Date.now;
let now = new Date(2026, 9, 17, 12).getTime(), failWrite = false;
Date.now = () => now;
const data = new Map([['bej-favorite-chunks', 'preserve'], ['interface-theme', 'dark']]);
globalThis.localStorage = { get length() { return data.size; }, key: i => [...data.keys()][i] ?? null, getItem: k => data.get(k) ?? null, setItem(k, v) { if (failWrite) throw new Error('quota'); data.set(k, v); }, removeItem: k => data.delete(k) };
const events = new EventTarget(), timers = new Map(); let timerId = 0;
globalThis.window = { addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events), dispatchEvent: events.dispatchEvent.bind(events),
  setInterval(fn) { timers.set(++timerId, fn); return timerId; }, clearInterval(id) { timers.delete(id); }, setTimeout };
// Model native lock serialization, including a held tracking lock across tabs.
const locks = new Map();
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: { request(name, options, callback) {
  if (typeof options === 'function') { callback = options; options = {}; }
  if (options.ifAvailable && locks.has(name)) return Promise.resolve(callback(null));
  const previous = locks.get(name) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(() => { if (options.signal?.aborted) throw new Error('aborted'); return callback({ name }); });
  locks.set(name, next); void next.then(() => { if (locks.get(name) === next) locks.delete(name); }, () => { if (locks.get(name) === next) locks.delete(name); }); return next;
} } } });
const settle = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };
const code = expected => error => error.code === expected;
let app = runtime(), stop = app.tracker.start(); await settle();
const context = { module: 'basic-training', language: 'en-US', mode: 'manual' };
app.tracker.set(context, true); await settle(); now += 10000;
await app.service.startExtraActivity('en-US', 'conversation', 'HelloTalk'); await settle();
let store = app.storage.readStudyStore(), draft = store.extraActivity;
assert.equal(app.storage.totalSeconds(store.studyData), 10);
assert.ok(draft); assert.equal(store.activeSession, null);
await assert.rejects(() => app.service.startExtraActivity('fr-FR', 'writing', ''), code('extraActive'));
await assert.rejects(() => app.service.changeExtraActivity(draft.id, 'stop'), code('zero'));
now += 45 * 60000; // no interval ticks: hidden tab, locked screen or app switch
app.tracker.set(context, true); app.tracker.checkpoint(); await settle();
assert.equal(app.tracker.readSession(context).seconds, 0);
assert.equal(app.storage.totalSeconds(app.storage.readStudyStore().studyData), 10, 'unconfirmed time never enters totals');
await app.service.changeExtraActivity(draft.id, 'stop'); await settle();
store = app.storage.readStudyStore();
assert.equal(store.studyData.sessions.find(s => s.id === draft.id).activeSeconds, 2700);
assert.equal(store.studyData.sessions.find(s => s.id === draft.id).note, 'HelloTalk');
assert.equal(store.extraActivity, null);
await app.service.changeExtraActivity(draft.id, 'stop');
assert.equal(app.storage.readStudyStore().studyData.sessions.filter(s => s.id === draft.id).length, 1);
app.tracker.set(null, false); await app.tracker.seal();
console.log('PASS 45-minute HelloTalk: timestamp-only background time, pending exclusion, internal suppression, double-start/zero rejection and idempotent stop.');

await app.service.startExtraActivity('en-US', 'private-class', 'lesson');
draft = app.storage.readStudyStore().extraActivity;
now += 30 * 60000; await app.service.changeExtraActivity(draft.id, 'pause');
const paused = app.storage.readStudyStore().extraActivity;
now += 15 * 60000; assert.equal(app.time.extraEstimate(paused, now).accumulatedMs, 30 * 60000);
await app.service.changeExtraActivity(draft.id, 'resume'); now += 15 * 60000;
await app.service.changeExtraActivity(draft.id, 'stop');
assert.equal(app.storage.readStudyStore().studyData.sessions.find(s => s.id === draft.id).activeSeconds, 2700);
console.log('PASS 60-minute lesson with 15-minute break records exactly 45 minutes.');

async function reload() {
  stop(); await settle(); app = runtime(); stop = app.tracker.start(); app.tracker.setExtraView(true); await settle();
  assert.equal(app.tracker.hasExtraControl(), true);
}
await app.service.startExtraActivity('fr-FR', 'writing', 'paper');
now += 60000; app.tracker.checkpoint(); await settle();
draft = app.storage.readStudyStore().extraActivity; assert.equal(draft.accumulatedMs, 60000);
stop(); await settle(); now += 2 * 3600000;
app = runtime(); stop = app.tracker.start(); app.tracker.setExtraView(true); await settle();
draft = app.storage.readStudyStore().extraActivity;
assert.ok(draft.recoveryAt); assert.equal(draft.accumulatedMs, 60000);
const frozen = draft.recoveryAt, estimate = app.time.extraEstimate(draft, now).accumulatedMs;
assert.equal(estimate, 7260000); now += 3600000;
await reload(); assert.equal(app.storage.readStudyStore().extraActivity.recoveryAt, frozen, 'reloading again does not inflate the estimate');
await assert.rejects(() => app.service.changeExtraActivity(draft.id, 'resume'), code('stale'));
await assert.rejects(() => app.service.changeExtraActivity(draft.id, 'confirm', 7261), code('invalid'));
assert.throws(() => app.storage.restoreStudyBackup(app.storage.readStudyStore(), app.storage.backupOf(app.storage.emptyStore(), new Date(now)), JSON.stringify(app.storage.readStudyStore())), code('extraActive'));
const beforeFailure = JSON.stringify([...data]); failWrite = true;
await assert.rejects(() => app.service.changeExtraActivity(draft.id, 'confirm', 1800), code('storage'));
assert.equal(JSON.stringify([...data]), beforeFailure, 'failed save leaves recovery intact'); failWrite = false;
await app.service.changeExtraActivity(draft.id, 'confirm', 1800); await app.service.changeExtraActivity(draft.id, 'confirm', 1800);
store = app.storage.readStudyStore();
assert.equal(store.studyData.sessions.filter(s => s.id === draft.id).length, 1);
assert.equal(store.studyData.sessions.find(s => s.id === draft.id).activeSeconds, 1800);
assert.equal(store.extraActivity, null);
console.log('PASS interrupted running recovery: estimated/confirmed separation, frozen limit across reloads, adjustment, atomic quota failure, idempotency and no automatic resume.');

await app.service.startExtraActivity('es-ES', 'other', 'paused'); now += 60000;
draft = app.storage.readStudyStore().extraActivity;
await app.service.changeExtraActivity(draft.id, 'pause'); now += 86400000; await reload();
draft = app.storage.readStudyStore().extraActivity;
assert.equal(app.time.extraEstimate(draft, now).accumulatedMs, 60000);
await app.service.changeExtraActivity(draft.id, 'confirm', 60);
await app.service.startExtraActivity('en-US', 'other', 'discard'); now += 60000; await reload();
draft = app.storage.readStudyStore().extraActivity;
const beforeDiscard = app.storage.totalSeconds(app.storage.readStudyStore().studyData);
await app.service.changeExtraActivity(draft.id, 'discard');
assert.equal(app.storage.totalSeconds(app.storage.readStudyStore().studyData), beforeDiscard);
console.log('PASS paused recovery excludes all time after closing; recovered discard adds no study time.');

// Daily distribution survives pauses and a reduced recovery confirmation.
now = new Date(2026, 9, 20, 23, 59, 30).getTime();
await app.service.startExtraActivity('en-US', 'conversation', 'midnight');
draft = app.storage.readStudyStore().extraActivity; now += 60000;
await reload(); draft = app.storage.readStudyStore().extraActivity;
await app.service.changeExtraActivity(draft.id, 'confirm', 45);
const midnight = app.storage.readStudyStore().studyData.sessions.find(s => s.id === draft.id);
assert.deepEqual(midnight.dailySeconds, { '2026-10-20': 30, '2026-10-21': 15 });
console.log('PASS midnight recovery: reduced confirmation retains 30 + 15 eligible seconds, with exact daily sum.');

// Another tab cannot mutate or start while the existing tracking lock is held.
const tabTwo = runtime(); const stopTwo = tabTwo.tracker.start(); await settle();
assert.equal(tabTwo.tracker.hasControl(), false);
await assert.rejects(() => tabTwo.service.startExtraActivity('en-US', 'other', ''), code('otherTab'));
await app.service.startExtraActivity('en-US', 'other', 'one owner');
draft = app.storage.readStudyStore().extraActivity;
await assert.rejects(() => tabTwo.service.changeExtraActivity(draft.id, 'discard'), code('otherTab'));
await app.service.changeExtraActivity(draft.id, 'discard'); stopTwo(); await settle();
const simultaneous = await Promise.allSettled([app.service.startExtraActivity('en-US', 'conversation', ''), app.service.startExtraActivity('fr-FR', 'writing', '')]);
assert.equal(simultaneous.filter(result => result.status === 'fulfilled').length, 1);
assert.equal(simultaneous.filter(result => result.status === 'rejected' && result.reason.code === 'extraActive').length, 1);
await app.service.changeExtraActivity(app.storage.readStudyStore().extraActivity.id, 'discard');

const filter = { language: 'en-US', module: 'all', mode: 'all', period: 'all', from: '', to: '', origin: 'all', extraCategory: 'all' };
const fixture = app.storage.emptyStore();
fixture.studyData.sessions = [['basic-training', 30, undefined], ['extra-activities', 8, 'conversation'], ['extra-activities', 6, 'private-class'], ['extra-activities', 4, 'writing']].map(([module, hours, category], index) => ({
  id: `48-hours-${index}`, module, language: 'en-US', mode: 'manual', ...(category ? { category, note: 'external ' + category } : {}),
  startedAt: new Date(now - hours * 3600000).toISOString(), endedAt: new Date(now).toISOString(), activeSeconds: hours * 3600
}));
let stats = app.stats(fixture.studyData, filter, new Date(now));
assert.equal(stats.internal, 30 * 3600); assert.equal(stats.external, 18 * 3600); assert.equal(stats.total, 48 * 3600);
assert.equal(stats.total / (750 * 3600) * 100, 6.4);
assert.equal(stats.byExtraCategory.other, 0); assert.equal(Object.keys(stats.byExtraCategory).length, 6);
assert.equal(stats.byExtraCategory.reading, 0); assert.equal(stats.byExtraCategory['active-listening'], 0);
assert.equal(app.stats(fixture.studyData, { ...filter, origin: 'external' }, new Date(now)).total, 18 * 3600);
assert.equal(app.stats(fixture.studyData, { ...filter, extraCategory: 'conversation' }, new Date(now)).total, 8 * 3600);
assert.equal(app.stats(fixture.studyData, { ...filter, origin: 'internal', extraCategory: 'conversation' }, new Date(now)).total, 30 * 3600);
assert.equal(app.stats(fixture.studyData, { ...filter, language: 'fr-FR' }, new Date(now)).total, 0);
fixture.studyData.manualAdjustments.push({ id: 'manual', language: 'en-US', seconds: 3600, date: '2026-10-20', description: 'previous' });
assert.equal(app.stats(fixture.studyData, filter, new Date(now)).total, 49 * 3600);
assert.equal(app.stats(fixture.studyData, { ...filter, origin: 'internal' }, new Date(now)).total, 30 * 3600);
const backup = app.storage.parseStudyBackup(JSON.stringify(app.storage.backupOf(fixture, new Date(now))));
let restored = app.storage.restoreStudyBackup(app.storage.emptyStore(), backup, JSON.stringify(app.storage.emptyStore()));
restored = app.storage.restoreStudyBackup(restored, backup, JSON.stringify(restored));
assert.equal(app.storage.totalSeconds(restored.studyData), 49 * 3600);
assert.deepEqual(restored.studyData.sessions, fixture.studyData.sessions);
const conflict = structuredClone(backup); conflict.studyData.sessions[1].note = 'different';
assert.throws(() => app.storage.restoreStudyBackup(restored, conflict, JSON.stringify(restored)), code('conflict'));
const invalid = structuredClone(backup); delete invalid.studyData.sessions[1].category;
assert.throws(() => app.storage.parseStudyBackup(JSON.stringify(invalid)), code('invalid'));
invalid.studyData.sessions[1].category = 'conversation'; invalid.studyData.sessions[1].note = 'x'.repeat(1001);
assert.throws(() => app.storage.parseStudyBackup(JSON.stringify(invalid)), code('invalid'));
assert.equal(app.storage.parseStudyBackup(JSON.stringify(app.storage.backupOf(app.storage.emptyStore(), new Date(now)))).schemaVersion, 1);
assert.equal(data.get('bej-favorite-chunks'), 'preserve'); assert.equal(data.get('interface-theme'), 'dark');
console.log('PASS consolidation: 30h + 18h = 48h, 6.4% goal, source/category/language filters, four categories, manual adjustments, legacy schema, backup merge/dedup/conflicts and note validation.');
console.log('PASS concurrency: existing tracking lock protects internal/external writes and another tab cannot start or change a session.');
// Exercise both additions through the real service and persisted recovery path.
const oldSessions = structuredClone(app.storage.readStudyStore().studyData.sessions);
for (const category of ['reading', 'active-listening']) {
  await app.service.startExtraActivity('en-US', category, 'note ' + category);
  draft = app.storage.readStudyStore().extraActivity;
  assert.equal(draft.category, category);
  now += 90000; await app.service.changeExtraActivity(draft.id, 'pause');
  now += 30000;
  assert.equal(app.time.extraEstimate(app.storage.readStudyStore().extraActivity, now).accumulatedMs, 90000);
  await app.service.changeExtraActivity(draft.id, 'resume'); now += 30000;
  await app.service.changeExtraActivity(draft.id, 'stop');
  await app.service.changeExtraActivity(draft.id, 'stop');
  let saved = app.storage.readStudyStore().studyData.sessions.filter(s => s.id === draft.id);
  assert.equal(saved.length, 1); assert.equal(saved[0].activeSeconds, 120);
  assert.equal(saved[0].category, category); assert.equal(saved[0].note, 'note ' + category);

  await app.service.startExtraActivity('en-US', category, 'recovered ' + category);
  now += 60000; await reload(); draft = app.storage.readStudyStore().extraActivity;
  assert.equal(draft.category, category); assert.ok(draft.recoveryAt);
  await app.service.changeExtraActivity(draft.id, 'confirm', 45);
  saved = app.storage.readStudyStore().studyData.sessions.filter(s => s.id === draft.id);
  assert.equal(saved.length, 1); assert.equal(saved[0].activeSeconds, 45);
}
const expandedStore = app.storage.readStudyStore();
assert.deepEqual(expandedStore.studyData.sessions.filter(s => oldSessions.some(old => old.id === s.id)), oldSessions);
for (const category of ['reading', 'active-listening']) {
  const filtered = app.stats(expandedStore.studyData, { ...filter, extraCategory: category }, new Date(now));
  assert.equal(filtered.total, 165); assert.equal(filtered.external, 165);
  assert.equal(filtered.byLanguage['en-US'], 165);
  assert.equal(filtered.byExtraCategory[category], 165);
  assert.ok(filtered.entries.every(e => e.category === category));
}
const expandedStats = app.stats(expandedStore.studyData, filter, new Date(now));
assert.equal(expandedStats.total, app.stats({ ...expandedStore.studyData, sessions: oldSessions }, filter, new Date(now)).total + 330);
assert.equal(Object.values(expandedStats.byExtraCategory).reduce((a, b) => a + b, 0), expandedStats.external);
const expandedBackup = app.storage.parseStudyBackup(JSON.stringify(app.storage.backupOf(expandedStore, new Date(now))));
let expandedRestored = app.storage.restoreStudyBackup(app.storage.emptyStore(), expandedBackup, JSON.stringify(app.storage.emptyStore()));
expandedRestored = app.storage.restoreStudyBackup(expandedRestored, expandedBackup, JSON.stringify(expandedRestored));
assert.deepEqual(expandedRestored.studyData, expandedStore.studyData);
for (const locale of ['pt-BR', 'en-US', 'es-ES', 'fr-FR']) {
  const labels = JSON.parse(readFileSync('src/i18n/locales/' + locale + '.json', 'utf8')).extras.categories;
  assert.ok(labels.reading); assert.ok(labels['active-listening']);
}
console.log('PASS reading/listening: start, pause, resume, stop, recovery, persisted notes, category filters, totals without duplication, legacy preservation, new backup restore and four locales.');
stop(); await settle(); Date.now = realNow;
assert.equal(timers.size, 0);

// No atomic browser primitive: fail closed without mutating storage.
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
app = runtime(); stop = app.tracker.start();
const beforeUnsupported = JSON.stringify([...data]);
await assert.rejects(() => app.service.startExtraActivity('en-US', 'reading', ''), code('unsupported'));
assert.equal(JSON.stringify([...data]), beforeUnsupported);
stop(); await settle();
console.log('PASS unsupported browsers: conservative read-only fallback preserves all records.');
