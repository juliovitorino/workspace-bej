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
let currentHarness = null;
const hooks = { ...React };
for (const name of ['useState', 'useRef', 'useMemo', 'useEffect']) {
  hooks[name] = (...args) => currentHarness ? currentHarness[name](...args) : React[name](...args);
}
function load(file) {
  file = resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const { outputText } = transpileModule(readFileSync(file, 'utf8'), { compilerOptions: {
    module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX, target: ScriptTarget.ES2022
  } });
  const localRequire = id => {
    if (id === 'react') return hooks;
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

let now = 0, timerId = 0;
const timeouts = new Map(), intervals = new Map(), utterances = [];
Object.defineProperty(globalThis, 'performance', { value: { now: () => now }, configurable: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
  userAgent: 'iPhone', platform: 'iPhone', maxTouchPoints: 5
} });
globalThis.localStorage = { getItem: () => null };
globalThis.setTimeout = (fn, ms) => { timeouts.set(++timerId, { fn, ms }); return timerId; };
globalThis.clearTimeout = id => timeouts.delete(id);
globalThis.setInterval = fn => { intervals.set(++timerId, fn); return timerId; };
globalThis.clearInterval = id => intervals.delete(id);
globalThis.SpeechSynthesisUtterance = class { constructor(value) { this.text = value; } };
globalThis.window = { addEventListener() {}, removeEventListener() {},
  setInterval, clearInterval, speechSynthesis: {
    cancel() {}, getVoices: () => [], speak: value => utterances.push(value)
  } };
globalThis.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };

const { CEFR_LEVELS, eligibleChunks, drawChunk } = load('src/utils/chunkEligibility.ts');
const { ChunkFlashcards } = load('src/components/ChunkFlashcards.tsx');
const { WalkingMode } = load('src/components/WalkingMode.tsx');
const { ChunkLevelSelect } = load('src/components/ChunkLevelSelect.tsx');
const makeChunk = (id, englishLevel, extra = {}) => ({ id, english: `Chunk ${id}`, intention: `Intenção ${id}`,
  englishLevel, allowLanguageChunkPractice: true, ...extra });
const fixtures = CEFR_LEVELS.flatMap(level => [makeChunk(`${level}-1`, level), makeChunk(`${level}-2`, level)]);
const invalid = [makeChunk('missing-level'), makeChunk('bad-level', 'A20'),
  makeChunk('disabled', 'A2', { allowLanguageChunkPractice: false }),
  makeChunk('empty', 'A2', { english: '  ' })];
for (const level of CEFR_LEVELS) {
  assert.deepEqual(eligibleChunks([...fixtures, ...invalid], level).map(x => x.id), [`${level}-1`, `${level}-2`]);
}
assert.equal(eligibleChunks([...fixtures, ...invalid], 'all').length, 14);
assert.equal(eligibleChunks([makeChunk('normalized', ' a2 ')], 'A2').length, 1);
assert.equal(drawChunk([], [], null), null);
for (const locale of ['en-US', 'fr-FR', 'es-ES']) {
  const data = JSON.parse(readFileSync(`public/sample-hashmap-${locale}.json`, 'utf8'));
  const items = Array.isArray(data) ? data : data.mentalMap;
  const all = eligibleChunks(items, 'all');
  assert.equal(CEFR_LEVELS.reduce((sum, level) => sum + eligibleChunks(items, level).length, 0), all.length);
  for (const level of CEFR_LEVELS) {
    const pool = eligibleChunks(items, level);
    let ids = [], current = null;
    for (let i = 0; i < pool.length; i++) {
      const result = drawChunk(pool, ids, current);
      assert.ok(!ids.includes(result.id));
      ids = result.drawnIds; current = result.id;
      assert.equal(ids.indexOf(current) + 1, i + 1);
    }
    const next = drawChunk(pool, ids, current);
    assert.equal(next.newRound, true);
    assert.equal(next.drawnIds.length, 1);
    if (pool.length > 1) assert.notEqual(next.id, current);
  }
}

const props = { intentions: fixtures, language: 'fr-FR', onWalkingChange() {},
  onShowDetails() {}, onBasicTraining() {}, onAdvancedTraining() {} };
const parent = new Harness(ChunkFlashcards, props);
parent.flush();
assert.equal(text(named(parent.tree, 'Posição do chunk na rodada')), '0/12');
find(parent.tree, n => n.type === ChunkLevelSelect).props.onChange('A2'); parent.flush();
assert.equal(text(named(parent.tree, 'Posição do chunk na rodada')), '0/2');
find(parent.tree, n => n.props?.className?.includes('walking-entry')).props.onClick(); parent.flush();
assert.equal(parent.tree.type, WalkingMode);
const walking = new Harness(WalkingMode, parent.tree.props);
function flushPair() {
  for (let i = 0; i < 30; i++) {
    parent.flush(); walking.flush(parent.tree.props);
    if (!parent.dirty) return;
  }
  assert.fail('Parent and walking mode must settle');
}
flushPair();
assert.equal(parent.tree.props.position, 1);
const firstId = parent.tree.props.chunk.id;
const click = name => { named(walking.tree, name).props.onClick(); flushPair(); };
click('Próximo chunk'); assert.equal(parent.tree.props.position, 2);
click('Chunk anterior'); assert.equal(parent.tree.props.position, 1);
assert.equal(parent.tree.props.chunk.id, firstId);
click('Próximo chunk'); assert.equal(parent.tree.props.position, 2);
click('Próximo chunk'); assert.equal(parent.tree.props.position, 1);
assert.equal(parent.tree.props.round, 2);

// A live filter change cancels old speech, preserves time/settings, and starts
// a valid new round. Replaying a stale callback must not schedule any work.
const rateSelect = find(walking.tree, n => n.type === 'select' && n.props.value === .9);
rateSelect.props.onChange({ target: { value: '0.8' } }); flushPair();
now = 42000; for (const tick of intervals.values()) tick(); walking.flush();
const stale = utterances.at(-1);
find(walking.tree, n => n.type === ChunkLevelSelect).props.onChange('B1'); flushPair();
const spokenBeforeStale = utterances.length;
stale.onend(); stale.onerror(); flushPair();
assert.equal(utterances.length, spokenBeforeStale);
assert.equal(parent.tree.props.chunk.englishLevel, 'B1');
assert.equal(parent.tree.props.position, 1);
assert.equal(parent.tree.props.round, 1);
assert.equal(utterances.at(-1).rate, .8);
assert.equal(utterances.at(-1).lang, 'fr-FR');
assert.ok(text(walking.tree).includes('00:00:42'));
for (let i = 0; i < 5; i++) {
  utterances.at(-1).onend(); flushPair();
  assert.equal(parent.tree.props.position, 1);
  const [id, timer] = [...timeouts][0]; timeouts.delete(id); timer.fn(); flushPair();
}
assert.equal(parent.tree.props.position, 2);

// Exercise an empty level without remounting the session.
const onlyA1 = fixtures.filter(x => x.englishLevel === 'A1');
parent.flush({ ...props, intentions: onlyA1 }); flushPair();
const beforeEmpty = utterances.length;
assert.equal(parent.tree.props.chunk, null);
assert.equal(parent.tree.props.total, 0);
assert.ok(text(walking.tree).includes('Nenhum chunk disponível para o nível B1.'));
assert.equal(utterances.length, beforeEmpty);
find(walking.tree, n => n.type === ChunkLevelSelect).props.onChange('A1'); flushPair();
assert.equal(parent.tree.props.position, 1);
assert.equal(parent.tree.props.total, 2);
assert.equal(utterances.at(-1).rate, .8);
assert.ok(text(walking.tree).includes('00:00:42'));
click('Pausar');
now = 62000; for (const tick of intervals.values()) tick(); walking.flush();
assert.ok(text(walking.tree).includes('00:00:42'));
find(walking.tree, n => n.type === ChunkLevelSelect).props.onChange('all'); flushPair();
assert.ok(named(walking.tree, 'Continuar'));
click('Continuar');
now = 65000; for (const tick of intervals.values()) tick(); walking.flush();
assert.ok(text(walking.tree).includes('00:00:45'));
const walkingMarkup = renderToStaticMarkup(React.createElement(WalkingMode, parent.tree.props));
const controls = walkingMarkup.match(/<div class="walking-controls">([\s\S]*?)<\/div>/)[1];
assert.equal((controls.match(/<button/g) ?? []).length, 4);
assert.equal((controls.match(/aria-label=/g) ?? []).length, 4);
assert.equal((controls.match(/<svg/g) ?? []).length, 4);
assert.match(walkingMarkup, /<summary[^>]*aria-label="Configurações de reprodução"[^>]*><svg/);
assert.doesNotMatch(controls, />\s*(Pausar|Parar|Próximo chunk|Chunk anterior)\s*</);
find(walking.tree, n => n.type === ChunkLevelSelect).props.onChange('A1'); flushPair();
click('Parar'); walking.dispose();
parent.flush();
assert.equal(find(parent.tree, n => n.type === ChunkLevelSelect).props.value, 'A1');
parent.dispose();
assert.equal(timeouts.size, 0);
assert.equal(intervals.size, 0);
navigator.userAgent = 'Desktop Chrome'; navigator.platform = 'Win32'; navigator.maxTouchPoints = 0;
assert.doesNotMatch(renderToStaticMarkup(React.createElement(ChunkFlashcards, props)), /walking-entry/);
console.log('CEFR, real catalogs, round coverage/counters, backward navigation, live filters, cancellation, time/settings, empty levels and accessible controls passed.');
