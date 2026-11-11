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
seed(b);
await sync.applySync(convergedB, sync.syncBaseline());
assert.deepEqual(ids(storage.readStudyStore().studyData.sessions), expectedIds);
assert.equal(seconds(storage.readStudyStore().studyData), expectedSeconds);
assert.deepEqual(favoriteIds(favorite.readFavoriteChunks()), expectedFavorites);
assert.deepEqual(wyr.readWyrAnswers(), expectedWyr);
console.log('PASS persisted A and B both converge to identical study/favorite/WRG results; repeated sync is idempotent.');

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

seed(a);
localStorage.setItem(storage.STUDY_KEY + 'active:hashmap', JSON.stringify(example('checkpoint-1', 590)));
localStorage.setItem(storage.STUDY_KEY + 'active:shadowing', JSON.stringify({ ...example('checkpoint-2', 190), module: 'shadowing' }));
const diagnostics = sync.studySyncDiagnostics();
const english = diagnostics.rows.find(row => row.language === 'en-US');
assert.equal(english.completedSeconds, seconds(a.study.studyData));
assert.equal(english.checkpointSeconds, 780);
assert.equal(english.checkpoints.length, 2);
assert.equal(english.completedSeconds + english.checkpointSeconds, seconds(a.study.studyData) + 780);
assert.equal(storage.backupOf(storage.readStudyStore()).studyData.sessions.length, a.study.studyData.sessions.length,
  'unfinished checkpoints must not be silently exported or removed');
localStorage.removeItem(storage.STUDY_KEY + 'active:hashmap');
localStorage.removeItem(storage.STUDY_KEY + 'active:shadowing');
console.log('PASS dashboard diagnostics separate completed backup sessions from 13-minute active checkpoints.');


function checkpoint(id, module, seconds) {
  return { ...example(id, seconds), module };
}
const mobileCheckpoints = [
  checkpoint('mobile-hashmap', 'hashmap', 65),
  checkpoint('mobile-memory', 'memory-flashcards', 596),
  checkpoint('mobile-basic', 'basic-training', 1),
  checkpoint('mobile-review', 'review-training', 99),
  checkpoint('mobile-speaking', 'speaking-game', 240),
  checkpoint('mobile-wrg', 'would-you-rather', 23)
];
const desktopCheckpoint = checkpoint('desktop-basic', 'basic-training', 122);
seed(a);
for (const item of mobileCheckpoints) {
  localStorage.setItem(storage.STUDY_KEY + 'active:' + item.module, JSON.stringify(item));
}
assert.equal(sync.studySyncDiagnostics().rows.find(row => row.language === 'en-US').checkpointSeconds, 1024);
const recoveredMobile = await storage.reconcileOrphanedCheckpoints();
assert.equal(recoveredMobile.sessions, 6);
assert.equal(recoveredMobile.seconds, 1024);
assert.deepEqual(recoveredMobile.skipped, []);
assert.equal(storage.readStudyCheckpoints().length, 0);
assert.equal(storage.readStudyStore().studyData.sessions.length, a.study.studyData.sessions.length + 6);
const mobileSnapshot = await sync.createSnapshot();
assert.equal(seconds(mobileSnapshot.study.studyData), seconds(a.study.studyData) + 1024);
assert.equal((await storage.reconcileOrphanedCheckpoints()).sessions, 0, 'recovery is idempotent');
assert.equal(storage.readStudyStore().studyData.sessions.length, a.study.studyData.sessions.length + 6);
seed(b);
localStorage.setItem(storage.STUDY_KEY + 'active:basic-training', JSON.stringify(desktopCheckpoint));
const recoveredDesktop = await storage.reconcileOrphanedCheckpoints();
assert.equal(recoveredDesktop.sessions, 1);
assert.equal(recoveredDesktop.seconds, 122);
const desktopSnapshot = await sync.createSnapshot();
const consolidated = sync.combineSyncFiles(mobileSnapshot, [desktopSnapshot]);
assert.deepEqual(consolidated.conflicts, []);
assert.equal(seconds(consolidated.study), expectedSeconds + 1024 + 122);
assert.equal(consolidated.study.sessions.length, expectedIds.length + 7);
seed(a);
await sync.applySync(consolidated, sync.syncBaseline());
assert.equal(seconds(storage.readStudyStore().studyData), expectedSeconds + 1146);
assert.equal(storage.readStudyCheckpoints().length, 0);
assert.equal(sync.combineSyncFiles(await sync.createSnapshot(), [mobileSnapshot, desktopSnapshot]).newSessions, 0);
console.log('PASS mobile 17m04s and desktop 2m02s checkpoints converge once, with no lost or duplicated seconds.');

seed(a);
const live = checkpoint('live-checkpoint', 'hashmap', 65);
localStorage.setItem(storage.STUDY_KEY + 'active:hashmap', JSON.stringify(live));
const realRequest = navigator.locks.request;
navigator.locks.request = (name, options, callback) => {
  if (name === storage.STUDY_KEY + 'control:hashmap') {
    return Promise.resolve((typeof options === 'function' ? options : callback)(null));
  }
  return realRequest(name, options, callback);
};
try {
  const result = await storage.reconcileOrphanedCheckpoints();
  assert.deepEqual(result.skipped, ['hashmap']);
  assert.equal(result.sessions, 0);
  assert.deepEqual(storage.readStudyCheckpoints(), [live]);
  await assert.rejects(() => sync.createSnapshot(), error => error.code === 'otherTab',
    'a live tab must block a snapshot that would silently omit its checkpoint');
  assert.equal(storage.readStudyStore().studyData.sessions.length, a.study.studyData.sessions.length);
} finally {
  navigator.locks.request = realRequest;
}
const staleBaseline = sync.syncBaseline();
localStorage.setItem(storage.STUDY_KEY + 'active:hashmap', JSON.stringify({ ...live, activeSeconds: 66, dailySeconds: { '2026-11-09': 66 } }));
await assert.rejects(() => sync.applySync(mergedA, staleBaseline), /changed|Retry/,
  'checkpoint changes between preview and confirmation must invalidate the preview');
assert.equal(storage.readStudyCheckpoints()[0].activeSeconds, 66);
console.log('PASS active locks protect live checkpoints and changed checkpoints invalidate stale sync previews.');

seed(a);
const duplicate = clone(a.study.studyData.sessions[0]);
localStorage.setItem(storage.STUDY_KEY + 'active:hashmap', JSON.stringify(duplicate));
const duplicateResult = await storage.reconcileOrphanedCheckpoints();
assert.equal(duplicateResult.sessions, 0);
assert.equal(storage.readStudyCheckpoints().length, 0);
assert.equal(storage.readStudyStore().studyData.sessions.length, a.study.studyData.sessions.length);
localStorage.setItem(storage.STUDY_KEY + 'active:hashmap', JSON.stringify({
  ...duplicate, activeSeconds: duplicate.activeSeconds + 1,
  dailySeconds: { '2026-11-09': duplicate.activeSeconds + 1 }
}));
await assert.rejects(() => storage.reconcileOrphanedCheckpoints(), error => error.code === 'conflict',
  'same ID with different data must fail closed');
assert.equal(storage.readStudyCheckpoints().length, 1, 'conflicting checkpoint must not be deleted');
console.log('PASS duplicate IDs are idempotent; conflicting records are preserved and block reconciliation.');
seed(a);

const folder = 'drive-folder-for-tests';
sync.markPendingDrivePublication(folder);
assert.equal(sync.pendingDrivePublication().folder, folder, 'pending publication survives component reload');
const previousFetch = globalThis.fetch;
let uploadAttempts = 0;
let failUpload = true;
globalThis.fetch = async (_url, init = {}) => {
  const method = init.method ?? 'GET';
  if (method === 'GET') return new Response(JSON.stringify({
    files: [{ id: 'existing-file', name: 'bej-study-' + sync.deviceId() + '.json' }]
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  if (method === 'PATCH') {
    assert.match(String(_url), /uploadType=media/, 'existing file should use simple media upload');
    assert.equal(init.headers['Content-Type'], 'application/json');
    uploadAttempts++;
    if (failUpload) throw new TypeError('Load failed');
    return new Response('{}', { status: 200 });
  }
  throw new Error('Unexpected HTTP method: ' + method);
};
try {
  const localBefore = JSON.stringify(storage.readStudyStore().studyData);
  const uploadFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new TypeError('Load failed'); };
  await assert.rejects(() => sync.publishCurrentSnapshot('token', folder), /Google Drive GET network failure: Load failed/,
    'failed Drive file listing must identify GET without changing local data');
  assert.equal(sync.pendingDrivePublication().folder, folder);
  globalThis.fetch = uploadFetch;
  await assert.rejects(() => sync.publishCurrentSnapshot('token', folder), /Google Drive PATCH network failure: Load failed/,
    'network error must identify the failed HTTP step');
  assert.equal(sync.pendingDrivePublication().folder, folder);
  assert.equal(JSON.stringify(storage.readStudyStore().studyData), localBefore,
    'a failed Drive publication must not roll back or re-merge local data');
  failUpload = false;
  await sync.publishCurrentSnapshot('fresh-token', folder);
  sync.clearPendingDrivePublication(folder);
  assert.equal(sync.pendingDrivePublication(), null);
  assert.equal(uploadAttempts, 2);
  assert.equal(JSON.stringify(storage.readStudyStore().studyData), localBefore,
    'retry publishes the local snapshot without altering sessions');
  let created = 0;
  globalThis.fetch = async (_url, init = {}) => {
    if ((init.method ?? 'GET') === 'GET') return new Response(JSON.stringify({ files: [] }), { status: 200 });
    assert.equal(init.method, 'POST');
    assert.match(String(_url), /uploadType=multipart/);
    assert.match(init.headers['Content-Type'], /multipart\/related/);
    created++;
    return new Response('{}', { status: 200 });
  };
  await sync.publishCurrentSnapshot('token', folder);
  assert.equal(created, 1, 'first upload creates a file in the selected folder');
} finally {
  globalThis.fetch = previousFetch;
}
console.log('PASS failed PATCH keeps local sessions and pending marker; retry publishes without repeating merge.');
