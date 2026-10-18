import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MessageChannel } from 'node:worker_threads';
import vm from 'node:vm';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';

const compile = file => transpileModule(readFileSync(file, 'utf8').replaceAll('import.meta.url', '"file:///study-lock-test.js"'), { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 } }).outputText;
const coordinator = vm.createContext({ exports: {} });
vm.runInContext(compile('src/features/study/studyLockWorker.ts'), coordinator);
const tabs = [], ports = [];
function tab() {
  const events = new EventTarget(), exports = {};
  const context = vm.createContext({ exports, URL, navigator: {}, window: { addEventListener: events.addEventListener.bind(events) }, SharedWorker: class {
    constructor() { const { port1, port2 } = new MessageChannel(); this.port = port1; ports.push(port1, port2); coordinator.onconnect({ ports: [port2] }); }
  } });
  vm.runInContext(compile('src/features/study/studyLocks.ts'), context);
  const result = { locks: exports.getStudyLocks(), close: () => events.dispatchEvent(new Event('pagehide')), context };
  tabs.push(result); return result;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const wait = async predicate => { for (let i = 0; i < 1000; i++) { if (predicate()) return; await tick(); } throw Error('Timed out'); };
try {
  const a = tab(), b = tab(); let releaseA, acquired = false;
  const owner = a.locks.request('bej-study-v2:control:hashmap', { ifAvailable: true }, lock => { assert.ok(lock); acquired = true; return new Promise(resolve => { releaseA = resolve; }); });
  await wait(() => acquired);
  assert.equal(await b.locks.request('bej-study-v2:control:hashmap', { ifAvailable: true }, lock => !!lock), false);
  assert.equal(await b.locks.request('bej-study-v2:control:shadowing', { ifAvailable: true }, lock => !!lock), true);
  assert.equal(await b.locks.request('bej-study-v2:write', { controlResource: 'hashmap' }, lock => !!lock), false, 'non-owner cannot commit module writes');
  assert.equal(await a.locks.request('bej-study-v2:write', { controlResource: 'hashmap' }, lock => !!lock), true);

  let releaseWrite, writing = false, second = false;
  const firstWrite = a.locks.request('bej-study-v2:write', () => { writing = true; return new Promise(resolve => { releaseWrite = resolve; }); });
  await wait(() => writing);
  const secondWrite = b.locks.request('bej-study-v2:write', () => { second = true; });
  await tick(); await tick(); assert.equal(second, false);
  releaseWrite(); await firstWrite; await secondWrite; assert.equal(second, true);
  releaseA(); await owner;
  assert.equal(await b.locks.request('bej-study-v2:control:hashmap', { ifAvailable: true }, lock => !!lock), true);
  console.log('PASS HTTP coordinator: module exclusion, independent modules, owner-checked commits, serialized writes and release.');

  let releaseHeld, held = false;
  const heldRequest = a.locks.request('held', lock => { assert.ok(lock); held = true; return new Promise(resolve => { releaseHeld = resolve; }); });
  await wait(() => held);
  let queuedRan = false;
  const cancelled = a.locks.request('held', () => { queuedRan = true; });
  const cancelledCheck = assert.rejects(cancelled, error => error.code === 'otherTab');
  await tick(); a.close(); await cancelledCheck; await tick();
  assert.equal(queuedRan, false);
  assert.equal(await b.locks.request('held', { ifAvailable: true }, lock => !!lock), true);
  releaseHeld(); await heldRequest;
  // A resumed document reconnects instead of reusing its closed port.
  assert.equal(await a.locks.request('resumed', lock => !!lock), true);
  console.log('PASS HTTP lifecycle: pagehide releases controls, cancelled grants cannot write, pageshow can reconnect.');

  const native = { request() {} }; b.context.navigator.locks = native;
  assert.equal(vm.runInContext('exports.getStudyLocks()', b.context), native);
  b.context.navigator.locks = undefined; b.context.SharedWorker = undefined;
  assert.equal(vm.runInContext('exports.getStudyLocks()', b.context), null);
  console.log('PASS native preference and explicit unsupported detection.');
} finally {
  for (const tab of tabs) tab.close();
  for (const port of ports) port.close();
}
