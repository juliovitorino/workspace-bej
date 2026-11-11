import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';

const require = createRequire(import.meta.url);
const cache = new Map();
function load(file) {
  file = resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const source = readFileSync(file, 'utf8')
    .replaceAll('import.meta.url', JSON.stringify('file:///study-drive-sync-test.js'))
    .replaceAll('import.meta.env.VITE_GOOGLE_CLIENT_ID', 'undefined');
  const output = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 } }).outputText;
  vm.runInThisContext('(function(require,module,exports){' + output + '\n})', { filename: file })(
    name => {
      if (!name.startsWith('.')) return require(name);
      const base = resolve(dirname(file), name);
      const target = [base + '.ts', base + '.tsx', base].find(existsSync);
      if (!target) throw new Error('Missing dependency: ' + name + ' from ' + file);
      return load(target);
    }, module, module.exports);
  return module.exports;
}

const storage = load('src/features/study/studyStorage.ts');
const sync = load('src/features/study/studyDriveSync.ts');
const wyr = load('src/features/would-you-rather/wouldYouRatherStorage.ts');
const favorite = load('src/utils/favoriteChunks.ts');
const disk = new Map();
globalThis.localStorage = {
  get length() { return disk.size; },
  key: i => [...disk.keys()][i] ?? null,
  getItem: k => disk.get(k) ?? null,
  setItem: (k, v) => disk.set(k, v),
  removeItem: k => disk.delete(k)
};
globalThis.window = { dispatchEvent: () => true, addEventListener() {}, removeEventListener() {} };
globalThis.StorageEvent ??= class StorageEvent extends Event { constructor(name, init) { super(name); this.key = init?.key; } };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: {
  request(_name, options, callback) { return Promise.resolve((typeof options === 'function' ? options : callback)({ name: _name })); }
} } });

const clone = value => structuredClone(value);
const seconds = data => data.sessions.reduce((total, item) => total + item.activeSeconds, 0) +
  data.manualAdjustments.reduce((total, item) => total + item.seconds, 0);
const ids = sessions => sessions.map(s => s.id).sort();
const favoriteIds = favorites => favorites.map(f => f.language + ':' + (f.type ?? 'chunk') + ':' + f.id).sort();
function normalize(raw) {
  assert.equal(raw.kind, 'bej-study-sync');
  return { ...raw, study: storage.parseStudyBackup(JSON.stringify(raw.study)),
    favorites: favorite.parseFavoriteChunks(JSON.stringify(raw.favorites)),
    wyrAnswers: wyr.validateWyrAnswers(raw.wyrAnswers) };
}
function example(id, seconds) {
  return { id, language: 'en-US', module: 'hashmap', mode: 'manual',
    startedAt: '2026-11-09T10:00:00.000Z', endedAt: '2026-11-09T10:10:00.000Z',
    activeSeconds: seconds, dailySeconds: { '2026-11-09': seconds } };
}
function sample(deviceId, sessions, favorites, updatedAt, answer) {
  const base = storage.emptyStore();
  base.studyData.sessions = sessions;
  const key = 'en-US:7b04d826-1913-58d8-a077-af586024baf9:A';
  return normalize({ schemaVersion: 1, kind: 'bej-study-sync', deviceId,
    exportedAt: '2026-11-11T14:20:00.000Z',
    study: storage.backupOf(base, new Date('2026-11-11T14:20:00.000Z')),
    favorites, wyrAnswers: { [key]: { text: answer, updatedAt } } });
}
const [a, b] = process.argv.length >= 4
  ? [normalize(JSON.parse(readFileSync(process.argv[2], 'utf8'))), normalize(JSON.parse(readFileSync(process.argv[3], 'utf8')))]
  : [
    sample('device-a', [example('shared', 100), example('only-a', 200)], [{ id: 'one', language: 'en-US' }, { id: 'two', language: 'en-US', type: 'example' }], '2026-11-03T15:40:57.115Z', 'Old answer'),
    sample('device-b', [example('shared', 100), example('only-b', 300)], [{ id: 'one', language: 'en-US' }, { id: 'three', language: 'en-US' }], '2026-11-10T16:39:47.580Z', 'New answer')
  ];
assert.notEqual(a.deviceId, b.deviceId);
const expectedIds = ids([...new Map([...a.study.studyData.sessions, ...b.study.studyData.sessions].map(s => [s.id, s])).values()]);
const expectedFavorites = [...new Set([...favoriteIds(a.favorites), ...favoriteIds(b.favorites)])].sort();
const expectedSeconds = seconds(storage.mergeStudyData(a.study.studyData, b.study.studyData).studyData);
const expectedWyr = wyr.mergeWyrAnswers(a.wyrAnswers, b.wyrAnswers);

const mergedA = sync.combineSyncFiles(a, [b]);
const mergedB = sync.combineSyncFiles(b, [a]);
for (const merged of [mergedA, mergedB]) {
  assert.deepEqual(merged.conflicts, [], 'shared sessions must not conflict');
  assert.deepEqual(ids(merged.study.sessions), expectedIds);
  assert.equal(seconds(merged.study), expectedSeconds, 'no duplicated study seconds');
  assert.deepEqual(favoriteIds(merged.favorites), expectedFavorites);
  assert.deepEqual(merged.wyrAnswers, expectedWyr, 'most recent WRG answer wins');
}
assert.equal(mergedA.newSessions, expectedIds.length - a.study.studyData.sessions.length);
assert.equal(mergedB.newSessions, expectedIds.length - b.study.studyData.sessions.length);
assert.equal(sync.combineSyncFiles(a, [a, b, b]).study.sessions.length, expectedIds.length);
assert.equal(sync.combineSyncFiles(b, [a, b, a]).study.sessions.length, expectedIds.length);
if (process.argv.length >= 4) {
  assert.equal(expectedIds.length, 558);
  assert.equal(expectedSeconds, 169021);
  assert.equal(expectedFavorites.length, 163);
  assert.equal(Object.keys(expectedWyr).length, 7);
}
console.log('PASS union A/B: unique sessions, exact seconds, favorites, latest WRG, duplicate remote snapshots.');

function seed(snapshot) {
  disk.clear();
  storage.writeStudyStore({ ...storage.emptyStore(), studyData: clone(snapshot.study.studyData) });
  localStorage.setItem(favorite.FAVORITE_CHUNKS_KEY, JSON.stringify(snapshot.favorites));
  localStorage.setItem(wyr.WYR_CUSTOM_ANSWERS_KEY, JSON.stringify(snapshot.wyrAnswers));
}
seed(a);
const baseline = sync.syncBaseline();
await sync.applySync(mergedA, baseline);
assert.deepEqual(ids(storage.readStudyStore().studyData.sessions), expectedIds);
assert.equal(seconds(storage.readStudyStore().studyData), expectedSeconds);
assert.deepEqual(favoriteIds(favorite.readFavoriteChunks()), expectedFavorites);
assert.deepEqual(wyr.readWyrAnswers(), expectedWyr);
const snapshotA = { ...a, study: storage.backupOf(storage.readStudyStore(), new Date('2026-11-11T14:21:00.000Z')),
  favorites: favorite.readFavoriteChunks(), wyrAnswers: wyr.readWyrAnswers() };
const convergedB = sync.combineSyncFiles(b, [snapshotA]);
assert.deepEqual(ids(convergedB.study.sessions), expectedIds);
assert.equal(seconds(convergedB.study), expectedSeconds);
assert.deepEqual(favoriteIds(convergedB.favorites), expectedFavorites);
assert.deepEqual(convergedB.wyrAnswers, expectedWyr);
assert.equal(sync.combineSyncFiles(snapshotA, [a, b, snapshotA]).newSessions, 0);
console.log('PASS real local apply and second-device convergence; repeated sync is idempotent.');

seed(a);
const oldBaseline = sync.syncBaseline();
localStorage.setItem(favorite.FAVORITE_CHUNKS_KEY, JSON.stringify([...a.favorites, { id: 'new-during-preview', language: 'en-US' }]));
await assert.rejects(() => sync.applySync(mergedA, oldBaseline), /changed|Retry|stale/i,
  'a favorite added after preview must not be silently overwritten');
assert.ok(favorite.readFavoriteChunks().some(f => f.id === 'new-during-preview'));
seed(a);
const oldWyrBaseline = sync.syncBaseline();
const changed = { ...a.wyrAnswers, ['en-US:7b04d826-1913-58d8-a077-af586024baf9:A']: {
  text: 'Changed during preview', updatedAt: '2026-11-11T14:21:00.000Z' } };
localStorage.setItem(wyr.WYR_CUSTOM_ANSWERS_KEY, JSON.stringify(changed));
await assert.rejects(() => sync.applySync(mergedA, oldWyrBaseline), /changed|Retry|stale/i,
  'a WRG edit after preview must not be silently overwritten');
assert.deepEqual(wyr.readWyrAnswers(), changed);
console.log('PASS stale preview protection for favorite and WRG edits.');

const conflict = clone(b);
conflict.study.studyData.sessions[0] = { ...a.study.studyData.sessions[0], activeSeconds: a.study.studyData.sessions[0].activeSeconds + 1,
  dailySeconds: { '2026-11-09': a.study.studyData.sessions[0].activeSeconds + 1 } };
const conflicting = sync.combineSyncFiles(a, [conflict]);
assert.ok(conflicting.conflicts.length > 0);
seed(a);
await assert.rejects(() => sync.applySync(conflicting, sync.syncBaseline()), /Conflicting/);
console.log('PASS conflicting session IDs block the write without losing local data.');
