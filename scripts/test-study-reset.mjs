import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
const require = createRequire(import.meta.url), cache = new Map();
function load(file) {
  file = path.resolve(file); if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const source = fs.readFileSync(file,'utf8').replaceAll('import.meta.url','"file:///reset-test.js"');
  const js = transpileModule(source,{compilerOptions:{module:ModuleKind.CommonJS,target:ScriptTarget.ES2022}}).outputText;
  vm.runInThisContext(`(function(require,module,exports){${js}\n})`,{filename:file})(name=>name.startsWith('.')?load(path.resolve(path.dirname(file),name)+'.ts'):require(name),module,module.exports);
  return module.exports;
}
const values = new Map(), held = new Map(); let failAt = -1, removals = 0, changes = 0;
globalThis.localStorage = {
  get length(){return values.size}, key:i=>[...values.keys()][i]??null, getItem:k=>values.get(k)??null,
  setItem:(k,v)=>values.set(k,v), removeItem(k){if(++removals===failAt)throw Error('disk failure');values.delete(k)}
};
globalThis.window = {dispatchEvent(){changes++;return true}};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request(name,options,fn){
  if(typeof options==='function'){fn=options;options={}};
  if(held.has(name)&&options.ifAvailable)return Promise.resolve().then(()=>fn(null));
  const prior=held.get(name)??Promise.resolve();
  const result=prior.catch(()=>{}).then(()=>fn({name}));held.set(name,result);
  const release=()=>{if(held.get(name)===result)held.delete(name)};void result.then(release,release);return result;
}}}});
const s=load('src/features/study/studyStorage.ts'), stats=load('src/features/study/studyStats.ts');
const K=s.STUDY_KEY, en={scope:'language',language:'en-US'}, all={scope:'all'};
const code=expected=>error=>error instanceof s.StudyError&&error.code===expected;
const session=(id,language='en-US',module='hashmap')=>({id,language,module,mode:'manual',startedAt:'2026-10-18T10:00:00.000Z',endedAt:'2026-10-18T11:00:00.000Z',activeSeconds:3600,...(module==='extra-activities'?{category:'reading'}:{})});
const put=(key,value)=>values.set(K+key,JSON.stringify(value));
function seed(){
  values.clear();failAt=-1;removals=0;
  put('session:english',session('english'));put('session:spanish',session('spanish','es-ES'));
  put('session:extra',session('extra','en-US','extra-activities'));
  put('adjustment:adjust-en',{id:'adjust-en',language:'en-US',seconds:600,date:'2026-10-18',description:'previous'});
  put('adjustment:adjust-es',{id:'adjust-es',language:'es-ES',seconds:120,date:'2026-10-18',description:'previous'});
  put('goal:en-US',{total:750,monthly:20});put('goal:es-ES',{total:600,monthly:15});
  put('active:hashmap',session('obsolete'));
  put('active:unrelated-feature',{language:'en-US',progress:42});
  put('preferences:learning',{language:'en-US',enabled:true});
  values.set('bej-favorite-chunks','favorites');values.set('interface-theme','dark');values.set('mental-hashmap-student-language','en-US');values.set('pedagogical-content','keep');
}
const preserved=()=>[...values].filter(([key])=>key.includes('goal:')||!key.startsWith(K)||key===K+'active:unrelated-feature'||key===K+'preferences:learning');
seed(); const before=preserved(), stale=s.readStudyStore(localStorage,'hashmap');
await s.checkStudyReset(en);await s.resetStudyData(en);
assert.deepEqual(s.readStudyStore().studyData.sessions.map(x=>x.id),['spanish']);
assert.equal(s.totalSeconds(s.readStudyStore().studyData),3720);assert.equal(s.readStudyCheckpoints().length,0);
assert.deepEqual(preserved(),before);assert.throws(()=>s.writeStudyStore(stale),code('stale'));
await assert.rejects(s.updateStudyStore(()=>stale,'hashmap'),code('stale'));
assert.equal(s.backupOf(s.readStudyStore(),new Date('2026-10-19')).studyData.sessions.length,1);
assert.equal(stats.studyStats(s.readStudyStore().studyData,{language:'en-US',module:'all',mode:'all',period:'all'},new Date()).total,0);
console.log('PASS language reset: history, internal/external records, adjustments and orphan checkpoint removed; other language, goals/monthly goals, favorites, preferences and content preserved; stale snapshot rejected; backup and Dashboard reflect remaining records.');
await s.resetStudyData(all);assert.equal(s.totalSeconds(s.readStudyStore().studyData),0);assert.deepEqual(preserved(),before);
await s.resetStudyData(all);assert.equal(s.readStudyStore().studyData.sessions.length,0);
const backup={schemaVersion:1,application:s.APPLICATION,exportedAt:'2026-10-19T00:00:00.000Z',studyData:{goals:{'en-US':750},monthlyGoals:{},sessions:[session('restored')],manualAdjustments:[]}};
const baseline=JSON.stringify(s.readStudyStore());
await s.updateStudyStore(store=>s.restoreStudyBackup(store,backup,baseline));
assert.equal(s.readStudyStore().studyData.sessions[0].id,'restored','explicit restore remains supported after reset');
await s.resetStudyData(all);
await assert.rejects(s.updateStudyStore(store=>s.restoreStudyBackup(store,backup,baseline)),code('stale'));
await assert.rejects(s.resetStudyData({scope:'language',language:'de-DE'}),code('invalid'));
await assert.rejects(s.resetStudyData({scope:'wrong'}),code('invalid'));
console.log('PASS global reset: zero totals, empty history, stable goals, idempotency, scope/language validation, explicit restore and stale restore rejection.');
seed();
for(const state of ['running','paused']){
  put('active:extra-activities',{id:'draft',owner:'other-tab',language:'en-US',category:'private-class',startedAt:'2026-10-18T10:00:00.000Z',updatedAt:'2026-10-18T10:00:00.000Z',state,accumulatedMs:0,dailyMs:{},runningSince:state==='running'?'2026-10-18T10:00:00.000Z':null});
  const original=[...values];await assert.rejects(s.checkStudyReset(en),code('resetActive'));await assert.rejects(s.resetStudyData(en),code('resetActive'));assert.deepEqual([...values],original);
}
values.delete(K+'active:extra-activities');
// The second check detects a session that started after opening confirmation.
await s.checkStudyReset(en);let release;
const control=navigator.locks.request(K+'control:hashmap',()=>new Promise(resolve=>{release=resolve}));
await Promise.resolve();await assert.rejects(s.resetStudyData(en),code('resetActive'));
put('active:hashmap',session('spanish-active','es-ES'));
await s.resetStudyData(en);assert.equal(s.readStudyCheckpoints()[0].language,'es-ES');
await assert.rejects(s.resetStudyData(all),code('resetActive'));release();await control;
console.log('PASS concurrency: running and paused Extras block, background module ownership blocks, confirmation is rechecked, unrelated language control remains intact.');
seed();let unlock;
const barrier=navigator.locks.request(K+'write',()=>new Promise(resolve=>{unlock=resolve}));for(let i=0;i<20;i++)await Promise.resolve();
const reset=s.resetStudyData(en);
const queued=s.updateStudyStore(store=>({...store,activeSession:session('queued')}),'hashmap');
unlock();await barrier;await reset;await assert.rejects(queued,code('stale'));assert.equal(s.readStudyCheckpoints().length,0);
console.log('PASS queued stale checkpoint cannot resurrect a deleted session after reset.');
seed();const saved=preserved();failAt=2;
await assert.rejects(s.resetStudyData(en),code('storage'));
assert.equal(s.totalSeconds(s.readStudyStore().studyData),3720,'pending deletions are hidden from Dashboard');
assert.deepEqual(preserved(),saved);assert.ok([...values.keys()].some(k=>k.includes('session:extra')),'failure leaves a recoverable journal');
failAt=-1;await s.updateStudyStore(store=>store);assert.equal(values.has(K+'session:extra'),false);
await s.resetStudyData(en);assert.equal(s.totalSeconds(s.readStudyStore().studyData),3720);assert.deepEqual(preserved(),saved);
assert.ok(changes>0);assert.equal(held.size,0);
console.log('PASS interrupted deletion: no success, durable journal, truthful read model, automatic coordinated cleanup, safe retry, no other-scope deletion, notifications and released locks.');
seed();put('session:french',session('french','fr-FR'));
const previewBytes=[...values];await s.checkStudyReset(all);const impact=s.readStudyResetImpact(all);
assert.deepEqual([...values],previewBytes,'opening/checking preview cannot modify storage');
assert.deepEqual(impact.rows.find(row=>row.language==='en-US'),{language:'en-US',seconds:11400,sessions:3,adjustments:1});
assert.equal(impact.rows.find(row=>row.language==='es-ES').seconds,3720);
assert.equal(impact.rows.find(row=>row.language==='fr-FR').seconds,3600);
put('adjustment:adjust-en',{id:'adjust-en',language:'en-US',seconds:600,date:'2026-10-18',description:'changed elsewhere'});
const changedBytes=[...values];await assert.rejects(s.resetStudyData(all,impact.fingerprint),code('stale'));
assert.deepEqual([...values],changedBytes,'stale impact rejects deletion even when totals are unchanged');
const english=s.readStudyResetImpact(en);await s.resetStudyData(en,english.fingerprint);
assert.deepEqual(s.readStudyStore().studyData.sessions.map(row=>row.language).sort(),['es-ES','fr-FR']);
const updated=s.readStudyResetImpact(all);await s.resetStudyData(all,updated.fingerprint);
assert.equal(s.totalSeconds(s.readStudyStore().studyData),0);
console.log('PASS impact preview: exact per-language totals/session/adjustment counts, read-only opening, stale identity/content rejection under lock, EN-only preservation of ES/FR and explicit global deletion.');
