import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
const require = createRequire(import.meta.url), cache = new Map();
let currentHarness;
const hooks = { useState: (...a) => currentHarness.useState(...a), useRef: (...a) => currentHarness.useRef(...a), useEffect: (...a) => currentHarness.useEffect(...a) };
function load(file) {
  file = path.resolve(file); if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const source = fs.readFileSync(file, 'utf8').replaceAll('import.meta.url', '"file:///study-events-test.js"');
  const output = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 } }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename: file })(name => name === 'react' ? hooks : name.startsWith('.') ? load(path.resolve(path.dirname(file), name) + '.ts') : require(name), module, module.exports);
  return module.exports;
}
class Harness {
  slots = []; dirty = true;
  constructor(fn, props) { this.fn = fn; this.props = props; }
  useState(initial) { const n = this.cursor++; this.slots[n] ??= { value: typeof initial === 'function' ? initial() : initial }; return [this.slots[n].value, value => { const next = typeof value === 'function' ? value(this.slots[n].value) : value; if (!Object.is(next, this.slots[n].value)) { this.slots[n].value = next; this.dirty = true; } }]; }
  useRef(value) { return this.slots[this.cursor++] ??= { current: value }; }
  useEffect(fn, deps) { const n = this.cursor++, previous = this.slots[n]; if (!previous || deps.some((d, i) => !Object.is(d, previous.deps[i]))) this.effects.push(() => { previous?.cleanup?.(); this.slots[n] = { deps, cleanup: fn() }; }); }
  flush(props = this.props) { if (props !== this.props) { this.props = props; this.dirty = true; } for (let n = 0; this.dirty; n++) { assert.ok(n < 30); this.dirty = false; this.cursor = 0; this.effects = []; currentHarness = this; this.value = this.fn(this.props); currentHarness = null; for (const effect of this.effects) effect(); } }
  close() { for (const slot of this.slots) slot.cleanup?.(); }
}
const listeners = new Map(), documentListeners = new Map(), timers = new Map(); let timerId = 0, writes = 0;
const add = (map, kind, fn) => { const group = map.get(kind) ?? new Set(); group.add(fn); map.set(kind, group); };
const remove = (map, kind, fn) => map.get(kind)?.delete(fn);
const dispatch = (map, event) => { for (const fn of [...map.get(event.type) ?? []]) fn(event); };
class Element { constructor(sidebar = false) { this.sidebar = sidebar; } closest(selector) { return this.sidebar && selector.includes('.sidebar') ? this : null; } }
globalThis.Element = Element;
const memory = new Map([['bej-favorite-chunks','keep'],['interface-theme','dark']]);
const disk = { get length() { return memory.size; }, key: n => [...memory.keys()][n] ?? null, getItem: k => memory.get(k) ?? null, setItem(k,v) { writes++; memory.set(k,v); }, removeItem: k => memory.delete(k) };
globalThis.localStorage = disk;
const tabMemory = new Map(); globalThis.sessionStorage = { getItem: k => tabMemory.get(k) ?? null, setItem: (k,v) => tabMemory.set(k,v) };
globalThis.document = { visibilityState: 'visible', addEventListener: (kind, fn) => add(documentListeners, kind, fn), removeEventListener: (kind, fn) => remove(documentListeners, kind, fn) };
const utterances = [];
globalThis.window = { addEventListener: (kind,fn) => add(listeners,kind,fn), removeEventListener: (kind,fn) => remove(listeners,kind,fn), dispatchEvent: event => { dispatch(listeners,event); return true; }, setInterval: fn => { timers.set(++timerId,fn); return timerId; }, clearInterval: id => timers.delete(id), speechSynthesis: { speak: u => utterances.push(u), cancel() {} } };
const locks = new Map();
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: { request(name, options, fn) { if (typeof options === 'function') { fn = options; options = {}; } if (options.ifAvailable && locks.has(name)) return Promise.resolve(fn(null)); const previous = locks.get(name) ?? Promise.resolve(); const next = previous.catch(()=>{}).then(()=>fn({name})); locks.set(name,next); const clear = () => { if (locks.get(name) === next) locks.delete(name); }; void next.then(clear,clear); return next; } } } });
const realNow = Date.now; let now = new Date(2026,9,18,10).getTime(); Date.now = () => now;
const { StudyClock, studyTracker } = load('src/features/study/studyTrackingService.ts');
const { useStudyTracking } = load('src/features/study/useStudyTracking.ts');
const { useStudyReading } = load('src/features/study/useStudyReading.ts');
const storage = load('src/features/study/studyStorage.ts');
const { speakStudyAudio, cancelStudyAudio } = load('src/features/study/studyAudio.ts');
const extra = load('src/features/study/extraActivityService.ts'), extraTime = load('src/features/study/extraActivityTime.ts');
const settle = async () => { for (let i = 0; i < 200; i++) await Promise.resolve(); };
const context = { module:'hashmap', language:'en-US', mode:'manual' };
for (const interval of [10,60,120,180,181,900,3600]) {
  const c = new StudyClock(() => 'interval'); c.set(context,true,now);
  assert.equal(c.snapshot(now,false).activeSeconds,0);
  c.snapshot(now+interval*1000); // A visual read is not a checkpoint.
  assert.equal(c.snapshot(now,false).activeSeconds,0);
  assert.equal(c.commit(now+interval*1000).activeSeconds,Math.min(interval,180));
  assert.equal(c.commit(now+interval*1000).id,'interval');
}
console.log('PASS cap table: 10/60/120/180/181/900/3600 seconds; visual reads cannot confirm time.');
const tracking = new Harness(p => useStudyTracking(p.view,p.language,p.signal,p.blocked), {view:'hashmap',language:'en-US',signal:null,blocked:false});
const reading = new Harness(() => useStudyReading('hashmap','en-US'), {});
const checkpoint = () => storage.readStudyStore(disk,'hashmap').activeSession;
const interact = async (kind, trusted=true, target=new Element()) => { dispatch(listeners,{type:kind,isTrusted:trusted,target}); await settle(); tracking.flush(); reading.flush(); };
try {
  tracking.flush(); reading.flush(); await settle();
  const id = checkpoint().id; assert.equal(checkpoint().activeSeconds,0);
  now += 60000; await interact('input'); assert.equal(checkpoint().activeSeconds,60);
  now += 120000; await interact('pointerdown'); await interact('click'); assert.equal(checkpoint().activeSeconds,180);
  now += 17*60000; await interact('change'); assert.equal(checkpoint().activeSeconds,360);
  now += 120000; await interact('keydown'); assert.equal(checkpoint().activeSeconds,480);
  assert.equal(checkpoint().id,id,'detail/portal interactions never create a new module or ID');
  const beforeVisual = writes;
  now += 3600000;
  for (let i=0;i<10;i++) { for (const timer of [...timers.values()]) timer(); await settle(); }
  assert.equal(writes,beforeVisual,'control retries and visual ticks cannot write periodic checkpoints');
  assert.equal(checkpoint().activeSeconds,480);
  reading.flush(); assert.equal(reading.value,660,'visual preview is capped after inactivity');
  await interact('input',false); await interact('scroll'); await interact('pointerdown',true,new Element(true));
  assert.equal(checkpoint().activeSeconds,480,'synthetic events, programmatic scroll and sidebar are excluded');
  await interact('wheel'); await interact('scroll'); await interact('click');
  assert.equal(checkpoint().activeSeconds,660); assert.equal(checkpoint().id,id);
  console.log('PASS actual central hook: 8-minute example, filters, detail/portal click/copy/favorite/change, manual scroll, overlap dedup, synthetic exclusion and no periodic writes.');

  const spoken = {}; let starts=0, ends=0; spoken.onstart=()=>starts++; spoken.onend=()=>ends++;
  speakStudyAudio(spoken); assert.equal(checkpoint().activeSeconds,660,'queueing speech does not prove playback');
  spoken.onstart({isTrusted:false}); await settle(); assert.equal(checkpoint().activeSeconds,660,'synthetic speech events cannot confirm playback');
  spoken.onstart();
  now += 120000; await interact('input');
  now += 180000; spoken.onend(); await settle();
  assert.equal(checkpoint().activeSeconds,960,'five minutes of speech plus overlapping interaction counts five minutes once');
  assert.equal(starts,2); assert.equal(ends,1);
  const paused = {}; speakStudyAudio(paused); paused.onstart(); now += 30000; paused.onpause(); await settle();
  now += 600000; paused.onresume(); now += 30000; paused.onend(); await settle();
  assert.equal(checkpoint().activeSeconds,1020,'paused speech does not add the ten-minute gap');
  const cancelled = {}; speakStudyAudio(cancelled); cancelled.onstart(); now += 10000; cancelStudyAudio(); await settle();
  now += 100000; cancelled.onend(); await settle(); assert.equal(checkpoint().activeSeconds,1030,'late end after cancellation cannot add time');
  console.log('PASS real speech handlers: long playback, overlap, pause/resume, cancellation, late events and existing callbacks preserved.');

  for (const [view,module] of [['chunk-flashcards','chunk-flashcards'],['favorite-chunks','chunk-favorites']]) {
    const signal = active => ({view,language:'en-US',mode:'walking',active});
    const walkingProps = {view,language:'en-US',blocked:false,signal:signal(true)};
    tracking.flush(walkingProps); await settle();
    const {StudyTracker} = load('src/features/study/studyTrackingService.ts');
    const {roundKey,presentItem,readRound} = load('src/utils/learningRound.ts');
    const contender = new StudyTracker(), releaseContender = contender.start();
    contender.set({module,language:'en-US',mode:'walking'},true); await settle();
    const roundStorageKey=roundKey('en-US',view);
    studyTracker.requireControl(); presentItem(roundStorageKey,['one','two'],'one');
    assert.throws(()=>{contender.requireControl(); presentItem(roundStorageKey,['one','two'],'two');});
    assert.deepEqual(readRound(roundStorageKey).presentedItemIds,['one']);
    releaseContender(); await settle();
    now += 20*60000; // no ticks or speech callbacks
    dispatch(listeners,{type:'blur'});
    document.visibilityState='hidden'; dispatch(documentListeners,{type:'visibilitychange'}); await settle();
    tracking.flush({...walkingProps,signal:signal(false)}); await settle();
    assert.equal(storage.readStudyStore(disk,module).activeSession.activeSeconds,1200);
    now += 5*60000;
    tracking.flush(walkingProps); await settle();
    now += 27*60000;
    tracking.flush({...walkingProps,signal:signal(false)}); await settle();
    assert.equal(storage.readStudyStore(disk,module).activeSession.activeSeconds,2820);
    const sessionId=storage.readStudyStore(disk,module).activeSession.id;
    tracking.flush({view:'study-dashboard',language:'en-US',blocked:false,signal:null}); await settle();
    const completed=storage.readStudyStore(disk,module).studyData.sessions.find(item=>item.id===sessionId);
    assert.equal(completed.activeSeconds,2820);
    assert.equal(storage.studyDataWithCheckpoints(storage.readStudyStore().studyData,storage.readStudyCheckpoints()).sessions.filter(item=>item.id===sessionId).length,1);
    tracking.flush(walkingProps); await settle();
    now += 10*60000;
    const directId=storage.readStudyStore(disk,module).activeSession.id;
    tracking.flush({view:'study-dashboard',language:'en-US',blocked:false,signal:null}); await settle();
    assert.equal(storage.readStudyStore(disk,module).studyData.sessions.find(item=>item.id===directId).activeSeconds,600);
    document.visibilityState='visible';
  }
  console.log('PASS walking in both modules: 20 active + 5 paused + 27 active = 47 minutes, blur/background without callbacks, pause-stop idempotency, direct-stop final 10 minutes, persisted Dashboard and unchanged manual cap.');

  tracking.flush({...tracking.props,view:'extra-activities'}); await settle();
  await extra.startExtraActivity('en-US','private-class','90-minute lesson');
  const draft = storage.readStudyStore().extraActivity;
  now += 90*60000;
  const beforeExtraTicks = writes; for (const timer of [...timers.values()]) timer(); await settle(); assert.equal(writes,beforeExtraTicks);
  assert.equal(extraTime.extraEstimate(storage.readStudyStore().extraActivity,now).accumulatedMs,90*60000);
  await interact('pointerdown'); assert.equal(storage.readStudyStore().extraActivity.accumulatedMs,90*60000);
  assert.equal(storage.readStudyCheckpoints().find(s=>s.id===draft.id).activeSeconds,5400);
  await extra.changeExtraActivity(draft.id,'stop'); await extra.changeExtraActivity(draft.id,'stop');
  assert.equal(storage.readStudyStore().studyData.sessions.filter(s=>s.id===draft.id).length,1);
  assert.equal(storage.readStudyStore().studyData.sessions.find(s=>s.id===draft.id).activeSeconds,5400);
  console.log('PASS extras: 90 minutes with zero intermediate interactions, frozen visual correction by timestamp/event, no mandatory writes and one completed session.');

  await extra.startExtraActivity('en-US','reading','reload'); now += 60000; studyTracker.interact(); await settle();
  const owner = studyTracker.extraOwner; const stop = studyTracker.start(); stop(); await settle();
  const { StudyTracker } = load('src/features/study/studyTrackingService.ts'); const recovered = new StudyTracker();
  assert.equal(recovered.extraOwner,owner,'same document sessionStorage survives reload');
  const releaseRecovered = recovered.start(); await recovered.acquireExtraControl();
  assert.equal(storage.readStudyStore().extraActivity.recoveryAt,undefined,'known owner resumes without invented recovery estimates');
  now += 60000; assert.equal(extraTime.extraEstimate(storage.readStudyStore().extraActivity,now).accumulatedMs,120000);
  releaseRecovered(); await settle();
  assert.equal(memory.get('bej-favorite-chunks'),'keep'); assert.equal(memory.get('interface-theme'),'dark');
  console.log('PASS same-tab reload ownership, timestamp continuation, favorites and theme preserved.');
} finally { cancelStudyAudio(); tracking.close(); reading.close(); await settle(); Date.now=realNow; }
assert.equal(timers.size,0); assert.equal(locks.size,0);
