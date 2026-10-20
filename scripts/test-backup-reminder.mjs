import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { transpileModule, ModuleKind } from 'typescript';
function load(file, dependencies = {}) {
 const module = { exports: {} };
 const code = transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;
 vm.runInThisContext(`(function(require,module,exports){${code}\n})`)(name => { if (!(name in dependencies)) throw Error(name); return dependencies[name]; }, module, module.exports);
 return module.exports;
}
const r = load('src/utils/backupReminder.ts');
const memory = new Map([['favorites','original'], ['study','history'], ['stats','original']]);
const disk = { getItem: k => memory.get(k) ?? null, setItem: (k,v) => memory.set(k,v) };
const create = () => r.createBackupReminder(() => disk);
const start = new Date(2026, 9, 1, 12), at = days => new Date(start.getTime() + days * 86400000);
let reminder = create();
assert.equal(reminder.due(start), false);
assert.equal(memory.has(r.LAST_BACKUP_KEY), false);
assert.equal(reminder.due(at(6)), false);
assert.equal(reminder.due(at(7)), false);
assert.equal(reminder.due(new Date(at(7).getTime()+1)), true);
assert.equal(create().due(at(8)), true, 'reload and another tab share the reference');
reminder.dismiss(at(8));
assert.equal(create().due(at(8)), false, 'same day navigation in another tab');
assert.equal(create().due(at(9)), true);
reminder.exported(at(9));
assert.equal(create().due(at(15)), false);
assert.equal(create().due(at(17)), true);
for (const value of ['invalid', at(100).toISOString()]) {
 memory.set(r.LAST_BACKUP_KEY, value);
 assert.equal(create().due(at(17)), true);
}
memory.set(r.MONITORING_STARTED_KEY, 'invalid');
assert.equal(create().due(at(17)), false);
assert.equal(create().due(at(25)), true);
const noStorage = r.createBackupReminder(() => { throw Error('denied'); });
assert.equal(noStorage.due(start), false);
assert.equal(noStorage.due(at(8)), true);
noStorage.dismiss(at(8)); assert.equal(noStorage.due(at(8)), false);
assert.equal(r.localBackupDay(new Date(2026,9,20,23,59)), '2026-10-20');
assert.equal(memory.get('study'), 'history'); assert.equal(memory.get('favorites'),'original'); assert.equal(memory.get('stats'),'original');
let fail = false, recorded = 0, sealed = 0, clicked = 0, payload;
globalThis.window = { matchMedia: () => ({matches:false}), setTimeout: fn => {fn();} };
globalThis.document = { createElement: () => ({click(){if(fail) throw Error('download'); clicked++;},remove(){}}),body:{appendChild(){}} };
const originalURL = globalThis.URL;
globalThis.URL = {createObjectURL: blob => {payload=blob;return 'blob:test';},revokeObjectURL(){}};
const backup = {exportedAt: '2026-10-20T12:00:00.000Z', studyData:{sessions:[]}};
const exporter = load('src/features/study/exportStudyBackup.ts', {
 './studyStorage': {readStudyStore: () => ({}), backupOf: () => backup},
 './studyTrackingService': {studyTracker:{seal: async () => {sealed++;}}},
 '../../utils/backupReminder': {backupReminder:{exported:()=>recorded++}}
});
await exporter.exportStudyBackup();
assert.equal(sealed,1);assert.equal(clicked,1);assert.equal(recorded,1);
assert.deepEqual(JSON.parse(await payload.text()),backup);
fail=true;await assert.rejects(exporter.exportStudyBackup());assert.equal(recorded,1);
globalThis.URL=originalURL;
const app=fs.readFileSync('src/App.tsx','utf8');
assert.ok(app.includes('requestStudyNavigation(navigate)'));
assert.ok(app.includes('requestStudyNavigation(() => {'));
assert.ok(app.includes('["settings", "study-dashboard"].includes(context.currentView)'));
assert.ok(app.includes('context.walkingActive'));
assert.ok(!fs.readFileSync('src/utils/backupReminder.ts','utf8').includes('removeItem'));
console.log('PASS backup reminder: grace period, strict seven-day boundary, dismissal, next day, export reset, reload, shared tabs/languages, invalid/future dates, unavailable storage, local day, data preservation, shared export success/failure and navigation wiring.');
