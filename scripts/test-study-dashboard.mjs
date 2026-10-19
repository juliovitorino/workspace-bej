import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';

const require = createRequire(import.meta.url), cache = new Map();
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
const storage = load('src/features/study/studyStorage.ts');
const { StudyClock, recoverCheckpoint, localDay, IDLE_MS } = load('src/features/study/studyTrackingService.ts');
const { studyStats } = load('src/features/study/studyStats.ts');
const { emptyStore, backupOf, parseStudyBackup, mergeStudyData, consolidateStudyBackup, writeStudyStore, readStudyStore, totalSeconds, STUDY_KEY, StudyError } = storage;
const code = expected => e => e instanceof StudyError && e.code === expected;
const rawStore = new Map([['bej-favorite-chunks', '[{"id":"keep","language":"en-US"}]'], ['interface-theme', 'dark']]);
let failWrite = false;
const disk = { get length() { return rawStore.size; }, key: i => [...rawStore.keys()][i] ?? null, getItem: key => rawStore.get(key) ?? null, removeItem: key => rawStore.delete(key), setItem(key, value) { if (failWrite) throw new DOMException('Quota', 'QuotaExceededError'); rawStore.set(key, value); } };
assert.equal(totalSeconds(readStudyStore(disk).studyData), 0);
const empty = backupOf(emptyStore());
assert.equal(totalSeconds(parseStudyBackup(JSON.stringify(empty)).studyData), 0);
assert.equal(empty.application, 'Brazilian English Journey');
const start = new Date(2026, 9, 17, 10, 0, 0).getTime();
let sequence = 0;
const clock = new StudyClock(() => `session-${++sequence}`);
const context = { language: 'en-US', module: 'chunk-favorites', mode: 'manual' };
clock.set(context, true, start);
for (let s = 15; s <= 60; s += 15) clock.snapshot(start + s * 1000);
const beforePause = clock.snapshot(start + 60000);
clock.set(context, false, start + 60000);
assert.equal(clock.snapshot(start + 3600000).activeSeconds, 60, 'pause adds zero time');
clock.set(context, true, start + 3600000);
assert.equal(clock.snapshot(start + 3630000).activeSeconds, 90);
assert.equal(clock.snapshot(start + 3630000).id, beforePause.id, 'cards and pause keep session identity');
const manual = clock.set({ ...context, mode: 'walking' }, true, start + 3630000);
assert.equal(manual.activeSeconds, 90);
const walking = clock.set({ ...context, language: 'es-ES' }, true, start + 3640000);
assert.equal(walking.mode, 'walking'); assert.equal(walking.activeSeconds, 10);
const spanish = clock.set({ ...context, module: 'hashmap' }, true, start + 3660000, start + 3660000 + IDLE_MS);
assert.equal(spanish.language, 'es-ES'); assert.equal(spanish.activeSeconds, 20);
for (let seconds = 15; seconds <= 600; seconds += 15) clock.snapshot(start + 3660000 + seconds * 1000);
const idle = clock.finish(start + 4260000);
assert.equal(idle.activeSeconds, 180, 'Hashmap interval is capped at three minutes');
assert.equal(idle.module, 'hashmap');
const frozen = new StudyClock(() => 'frozen'); frozen.set(context, true, start);
assert.equal(frozen.snapshot(start + 8 * 3600000).activeSeconds, 180, 'a suspended process never confirms the entire sleep gap');
const midnight = new Date(2026, 9, 18, 0, 0, 0).getTime();
const cross = new StudyClock(() => 'midnight'); cross.set(context, true, midnight - 30000);
const midnightRecord = cross.finish(midnight + 30000);
assert.deepEqual(Object.values(midnightRecord.dailySeconds), [30, 30], 'local midnight splits actual active intervals');

const first = { ...emptyStore(), studyData: { ...emptyStore().studyData,
  sessions: [manual, walking, spanish, idle, midnightRecord],
  manualAdjustments: [{ id: 'adjustment-1', language: 'en-US', seconds: 432000, date: '2026-10-16', description: '<img src=x onerror=alert(1)> historical study' }] } };
writeStudyStore(first, disk);
const canonical = readStudyStore(disk);
const backup = backupOf(canonical, new Date(start + 24 * 3600000));
const incoming = parseStudyBackup(JSON.stringify(backup));
const merge = mergeStudyData(emptyStore().studyData, incoming.studyData);
assert.equal(merge.newSessions, 5); assert.equal(merge.newAdjustments, 1);
assert.equal(merge.afterSeconds, 432360);
const restored = consolidateStudyBackup(emptyStore(), incoming, JSON.stringify(emptyStore()));
assert.equal(totalSeconds(restored.studyData), totalSeconds(first.studyData), 'round trip preserves the exact second total');
const again = consolidateStudyBackup(restored, incoming, JSON.stringify(restored));
assert.equal(totalSeconds(again.studyData), 432360, 'repeated restore adds no hours');
assert.equal(mergeStudyData(again.studyData, incoming.studyData).duplicates, 5);

// Two devices consolidate individual records, then exchange the same backup safely.
const deviceSession = (id, hours, language, module, date) => ({ id, language, module, mode: 'manual',
  startedAt: `${date}T08:00:00Z`, endedAt: `${date}T${String(8 + hours).padStart(2, '0')}:00:00Z`, activeSeconds: hours * 3600,
  ...(module === 'extra-activities' ? { category: 'reading', note: 'Book' } : {}) });
const desktop = emptyStore(), mobile = emptyStore();
desktop.studyData.sessions = [deviceSession('desktop-2h', 2, 'en-US', 'hashmap', '2026-10-15')];
mobile.studyData.sessions = [deviceSession('mobile-3h', 3, 'es-ES', 'extra-activities', '2026-10-16'), deviceSession('mobile-2h', 2, 'fr-FR', 'shadowing', '2026-10-17')];
desktop.studyData = backupOf(desktop).studyData;
mobile.studyData = backupOf(mobile).studyData;
const mobileBackup = parseStudyBackup(JSON.stringify(backupOf(mobile)));
const consolidation = mergeStudyData(desktop.studyData, mobileBackup.studyData);
assert.equal(consolidation.currentSeconds, 2 * 3600);
assert.equal(consolidation.afterSeconds - consolidation.currentSeconds, 5 * 3600);
assert.equal(consolidation.newSessions, 2);
const combined = consolidateStudyBackup(desktop, mobileBackup, JSON.stringify(desktop));
assert.equal(totalSeconds(combined.studyData), 7 * 3600);
const repeatedDevice = consolidateStudyBackup(combined, mobileBackup, JSON.stringify(combined));
assert.equal(totalSeconds(repeatedDevice.studyData), 7 * 3600);
assert.equal(mergeStudyData(repeatedDevice.studyData, mobileBackup.studyData).duplicates, 2);
const consolidatedBackup = parseStudyBackup(JSON.stringify(backupOf(combined)));
const mobileCombined = consolidateStudyBackup(mobile, consolidatedBackup, JSON.stringify(mobile));
assert.equal(totalSeconds(mobileCombined.studyData), 7 * 3600);
assert.deepEqual(mobileCombined.studyData.sessions.map(s => s.id).sort(), combined.studyData.sessions.map(s => s.id).sort());
console.log('PASS cross-device: 2h + 5h = 7h, repeated import = 7h, reverse transfer = 7h, different dates/languages and external study preserved.');
const repeated = structuredClone(backup); repeated.studyData.sessions.push(structuredClone(backup.studyData.sessions[0])); repeated.studyData.manualAdjustments.push(structuredClone(backup.studyData.manualAdjustments[0]));
assert.equal(totalSeconds(consolidateStudyBackup(restored, parseStudyBackup(JSON.stringify(repeated)), JSON.stringify(restored)).studyData), 432360);
const conflict = structuredClone(incoming); conflict.studyData.sessions[0].mode = 'walking';
assert.equal(mergeStudyData(restored.studyData, conflict.studyData).conflicts.length, 1);
assert.throws(() => consolidateStudyBackup(restored, conflict, JSON.stringify(restored)), code('conflict'));
const adjustmentConflict = structuredClone(incoming); adjustmentConflict.studyData.manualAdjustments[0].seconds++;
assert.throws(() => consolidateStudyBackup(restored, adjustmentConflict, JSON.stringify(restored)), code('conflict'));
const internalConflict = structuredClone(repeated); internalConflict.studyData.sessions.at(-1).mode = 'walking';
assert.throws(() => parseStudyBackup(JSON.stringify(internalConflict)), code('conflict'));
assert.throws(() => consolidateStudyBackup(restored, incoming, JSON.stringify(emptyStore())), code('stale'));
const otherGoals = structuredClone(incoming); otherGoals.studyData.goals['en-US'] = 999; otherGoals.studyData.goals['fr-FR'] = 600;
const keptGoals = mergeStudyData(restored.studyData, otherGoals.studyData);
assert.equal(keptGoals.studyData.goals['en-US'], 750); assert.equal(keptGoals.studyData.goals['fr-FR'], 600);
assert.equal(keptGoals.goalDifferences.length, 1);
assert.equal(mergeStudyData(restored.studyData, otherGoals.studyData, true).studyData.goals['en-US'], 999);
for (const text of ['{', 'null', '[]', '{"schemaVersion":1}']) assert.throws(() => parseStudyBackup(text), code('invalid'));
for (const mutate of [b => b.studyData.sessions[0].activeSeconds = -1, b => b.studyData.sessions[0].activeSeconds = null,
  b => b.studyData.sessions[0].activeSeconds = 1e12, b => b.studyData.sessions[0].endedAt = '2026-02-30T10:00:00Z',
  b => b.studyData.sessions[0].endedAt = '2025-01-01T00:00:00Z', b => b.studyData.manualAdjustments[0].date = '2026-02-30',
  b => b.studyData.goals['en-US'] = 0, b => b.studyData.sessions[0].language = 'xx', b => b.application = 'another application']) {
  const bad = structuredClone(backup); mutate(bad); assert.throws(() => parseStudyBackup(JSON.stringify(bad)), code('invalid'));
}
assert.throws(() => parseStudyBackup(JSON.stringify({ ...backup, schemaVersion: 2 })), code('version'));
assert.throws(() => parseStudyBackup(' '.repeat(storage.MAX_BACKUP_BYTES + 1)), code('tooLarge'));
const beforeFailure = JSON.stringify([...rawStore]); failWrite = true;
assert.throws(() => writeStudyStore({ ...emptyStore(), studyData: { ...emptyStore().studyData, goals: { 'en-US': 900 } } }, disk), code('storage'));
assert.equal(JSON.stringify([...rawStore]), beforeFailure, 'quota failure leaves all previous data intact'); failWrite = false;
assert.equal(rawStore.get('bej-favorite-chunks'), '[{"id":"keep","language":"en-US"}]'); assert.equal(rawStore.get('interface-theme'), 'dark');
rawStore.set(STUDY_KEY + 'session:broken', '{broken'); assert.throws(() => readStudyStore(disk), code('invalid')); assert.equal(rawStore.get(STUDY_KEY + 'session:broken'), '{broken'); rawStore.delete(STUDY_KEY + 'session:broken');
assert.throws(() => readStudyStore({ getItem() { throw Error('denied'); }, setItem() {} }), code('storage'));
const interrupted = { ...emptyStore(), activeSession: manual };
const recovered = recoverCheckpoint(interrupted);
assert.equal(totalSeconds(recovered.studyData), 90); assert.equal(recovered.activeSession, null);
assert.deepEqual(recoverCheckpoint(recovered), recovered, 'recovery is idempotent and adds no unconfirmed time');
assert.throws(() => backupOf(interrupted), code('stale'));

const filter = { language: 'en-US', module: 'all', mode: 'all', period: 'all', from: '2026-10-01', to: '2026-10-31' };
const stats = studyStats(restored.studyData, filter, new Date(2026, 9, 18, 12));
assert.equal(stats.total, 432340, 'Spanish hours never enter English total');
const manualStats = studyStats(restored.studyData, { ...filter, mode: 'manual' }, new Date(2026, 9, 18, 12));
const walkingStats = studyStats(restored.studyData, { ...filter, mode: 'walking' }, new Date(2026, 9, 18, 12));
assert.equal(manualStats.total + walkingStats.total, stats.total - 432000, 'mode is a dimension, not another sum');
assert.equal(studyStats(restored.studyData, { ...filter, period: 'today' }, new Date(2026, 9, 18, 12)).total, 30);
assert.equal(studyStats(restored.studyData, { ...filter, period: 'today' }, new Date(2026, 9, 18, 12)).streak, 0, 'less than a minute does not make a streak');
assert.equal(localDay(new Date(2026, 9, 17, 0, 1)), '2026-10-17');

// Exercise the real queued persistence path, including an export mid-session.
const { studyTracker } = load('src/features/study/studyTrackingService.ts');
const realNow = Date.now, realNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
let fakeNow = start, lastStatus = '';
Date.now = () => fakeNow;
for (const key of [...rawStore.keys()]) if (key.startsWith(STUDY_KEY)) rawStore.delete(key);
globalThis.localStorage = disk;
globalThis.window = { dispatchEvent() {}, addEventListener() {}, removeEventListener() {}, setInterval() { return 1; }, clearInterval() {} };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: { request(_name, options, fn) {
  return Promise.resolve((typeof options === 'function' ? options : fn)({}));
} } } });
const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const unsubscribe = studyTracker.subscribe(status => { lastStatus = status; });
const stop = studyTracker.start(); await settle();
studyTracker.set(context, true); await settle();
fakeNow += 5000; await studyTracker.seal();
const midSessionBackup = backupOf(readStudyStore(disk), new Date(fakeNow));
assert.equal(totalSeconds(midSessionBackup.studyData), 5);
fakeNow += 5000; studyTracker.set(null, false); await studyTracker.seal();
const afterExport = readStudyStore(disk);
assert.equal(afterExport.studyData.sessions.length, 2, 'export seals one ID and continuation gets another');
assert.equal(totalSeconds(afterExport.studyData), 10);
assert.equal(totalSeconds(consolidateStudyBackup(afterExport, midSessionBackup, JSON.stringify(afterExport)).studyData), 10, 'importing the active-session export cannot duplicate the exported segment');
studyTracker.set(context, true); await settle(); fakeNow += 5000; failWrite = true; studyTracker.checkpoint(); await settle();
assert.equal(lastStatus, 'storage');
await assert.rejects(() => studyTracker.seal(), code('storage'));
assert.equal(totalSeconds(readStudyStore(disk).studyData), 10, 'failed checkpoint/export never overwrites confirmed history');
stop(); await settle(); unsubscribe(); failWrite = false;

// Unsupported browsers never use a get/set lease as an atomic lock.
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
const { StudyTracker } = load('src/features/study/studyTrackingService.ts');
const fallbackTracker = new StudyTracker();
const beforeFallback = JSON.stringify([...rawStore]);
const stopFallback = fallbackTracker.start(); fallbackTracker.set(context, true); await settle();
assert.equal(fallbackTracker.hasControl(), false);
await assert.rejects(() => storage.updateStudyStore(s => s), code('unsupported'));
assert.equal(JSON.stringify([...rawStore]), beforeFallback);
stopFallback(); await settle();
Date.now = realNow;
if (realNavigator) Object.defineProperty(globalThis, 'navigator', realNavigator);
const shadowClock = new StudyClock(() => 'shadowing-thirty-minutes');
shadowClock.set({ language: 'en-US', module: 'shadowing', mode: 'manual' }, true, start);
for (let elapsed = 15000; elapsed <= 1800000; elapsed += 15000) shadowClock.commit(start + elapsed);
const shadowStore = emptyStore(); shadowStore.studyData.sessions.push(shadowClock.finish(start + 1800000));
const shadowBackup = parseStudyBackup(JSON.stringify(backupOf(shadowStore, new Date(start + 3600000))));
let shadowRestored = consolidateStudyBackup(emptyStore(), shadowBackup, JSON.stringify(emptyStore()));
shadowRestored = consolidateStudyBackup(shadowRestored, shadowBackup, JSON.stringify(shadowRestored));
const shadowStats = studyStats(shadowRestored.studyData, { ...filter, module: 'shadowing' }, new Date(start + 3600000));
assert.equal(shadowStats.total, 1800); assert.equal(shadowStats.byModule.shadowing, 1800); assert.equal(shadowStats.byLanguage['en-US'], 1800);
assert.equal(shadowRestored.studyData.sessions.length, 1); assert.equal(shadowRestored.studyData.goals['en-US'], 750);
assert.equal(totalSeconds(shadowRestored.studyData) / (750 * 3600) * 100, 1800 / (750 * 3600) * 100);
console.log('PASS: active/pause/idle/module/language/walking/midnight/checkpoint tracking; empty and valid backups; exact round-trip totals; repeated import; duplicate and conflicting IDs; goal choice; invalid dates/durations/version/JSON; file size; atomic quota failure; isolated storage; filters and streak threshold.');
console.log('PASS: queued runtime writes, active-session export seals and rotates IDs, continued study plus restored export keeps exact totals, checkpoint failure blocks successful export.');
console.log('PASS: unsupported browsers fail closed without altering records.');
console.log('PASS: 30 minutes of Shadowing persist once, filter by module/language, contribute to the English goal, and survive repeated backup restore.');
const newModuleStore = emptyStore();
for (const [module, seconds, language] of [['speaking-game', 65, 'en-US'], ['interpretation', 125, 'fr-FR']]) {
  assert.ok(storage.STUDY_MODULES.includes(module));
  newModuleStore.studyData.sessions.push({ id: `new-${module}`, module, mode: 'manual', language,
    startedAt: new Date(start).toISOString(), endedAt: new Date(start + seconds * 1000).toISOString(), activeSeconds: seconds });
}
const newBackup = parseStudyBackup(JSON.stringify(backupOf(newModuleStore, new Date(start + 3600000))));
let mergedModules = consolidateStudyBackup(emptyStore(), newBackup, JSON.stringify(emptyStore()));
mergedModules = consolidateStudyBackup(mergedModules, newBackup, JSON.stringify(mergedModules));
assert.equal(mergedModules.schemaVersion, 1); assert.equal(mergedModules.studyData.sessions.length, 2);
assert.equal(totalSeconds(mergedModules.studyData), 190);
for (const [module, seconds, language] of [['speaking-game', 65, 'en-US'], ['interpretation', 125, 'fr-FR']]) {
  const stats = studyStats(mergedModules.studyData, { ...filter, language: 'all', module }, new Date(start + 3600000));
  assert.equal(stats.total, seconds); assert.equal(stats.byModule[module], seconds); assert.equal(stats.byLanguage[language], seconds);
}
assert.equal(studyStats(mergedModules.studyData, { ...filter, language: 'en-US', module: 'all' }, new Date(start + 3600000)).total, 65);
console.log('PASS: Speaking Game and Interpretation version-1 backup round trip, repeated restore, exact totals and isolated module/language filters.');
