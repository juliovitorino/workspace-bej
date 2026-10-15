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
  if (file.endsWith('.json')) return module.exports = JSON.parse(readFileSync(file, 'utf8'));
  const source = readFileSync(file, 'utf8').replaceAll('import.meta.env', 'globalThis.__storyTestEnv');
  const { outputText } = transpileModule(source, { compilerOptions: {
    module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX, target: ScriptTarget.ES2022, esModuleInterop: true
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

globalThis.__storyTestEnv = { VITE_AI_ENABLED: 'true', VITE_GEMINI_API_KEY: 'test-key', VITE_GEMINI_MODEL: 'test-model' };
const authorSource = readFileSync('src/utils/authorMode.ts', 'utf8');
const storageKey = authorSource.match(/const STORAGE_AUTHOR_KEY = "([^"]+)"/)[1];
const authorToken = authorSource.match(/const AUTHOR_TOKEN = "([^"]+)"/)[1];
const storage = new Map(), intervals = new Map(), listeners = new Map();
let intervalId = 0;
const addEventListener = (name, fn) => {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name).add(fn);
};
const removeEventListener = (name, fn) => listeners.get(name)?.delete(fn);
globalThis.window = {
  localStorage: { getItem: key => storage.get(key) ?? null },
  addEventListener, removeEventListener,
  setInterval(fn) { intervals.set(++intervalId, fn); return intervalId; },
  clearInterval: id => intervals.delete(id),
  speechSynthesis: { cancel() {} }
};
globalThis.document = { addEventListener, removeEventListener };
function setAuthor(active) {
  if (active) storage.set(storageKey, authorToken); else storage.clear();
  for (const fn of listeners.get('storage') ?? []) fn();
}
const { InterpretationPanel } = load('src/components/InterpretationPanel.tsx');
const { Sidebar } = load('src/components/Sidebar.tsx');
const { generateInterpretationStory } = load('src/services/storyGenerationService.ts');
const { searchLocalStories } = load('src/services/localStoryService.ts');
const intention = { id: 'test-id', intention: 'Siga em frente', english: 'Go ahead!', englishLevel: 'B1' };
const generated = {
  titlePt: 'História gerada de teste', titleEn: 'Generated test story',
  paragraphs: Array.from({ length: 6 }, () => ({ pt: 'Siga em frente.', en: 'Go ahead!',
    intentions: [{ intentionId: 'test-id', ptIntent: 'Siga em frente', enIntent: 'Go ahead!' }] })),
  intentionsUsed: ['test-id']
};
const request = { intentions: [intention], englishLevel: 'B1', theme: 'cotidiano' };
const props = { intentions: [intention], onSelectIntention() {} };
let fetches = [];
let responder = () => Promise.resolve({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(generated) }] } }] }) });
globalThis.fetch = (url, options) => { fetches.push({ url, options }); return responder(); };
const studentMarkup = renderToStaticMarkup(React.createElement(InterpretationPanel, props));
assert.match(studentMarkup, /role="search"/);
assert.match(studentMarkup, /type="search"/);
assert.match(studentMarkup, /type="submit"[^>]*aria-label="Pesquisar histórias"/);
assert.doesNotMatch(studentMarkup, /interpretation-amount|interpretation-theme|Gerar história|sortear as estruturas/);
assert.equal(fetches.length, 0);
await assert.rejects(generateInterpretationStory(request), /Modo Author/);
assert.equal(fetches.length, 0);

const panel = new Harness(InterpretationPanel, props);
const byId = id => find(panel.tree, node => node.props?.id === id);
const generateButton = () => find(panel.tree, node => node.type === 'button' && /Gerar história|Gerando história/.test(text(node)));
const form = () => find(panel.tree, node => node.type === 'form' && node.props.role === 'search');
const submitSearch = () => {
  let prevented = false;
  form().props.onSubmit({ preventDefault() { prevented = true; } }); panel.flush();
  assert.equal(prevented, true);
};
panel.flush();
assert.equal(generateButton(), null);
const localStory = searchLocalStories('B1')[0];
assert.ok(localStory);
byId('story-search-title').props.onChange({ target: { value: localStory.titlePt.toUpperCase() } }); panel.flush();
submitSearch();
assert.ok(text(panel.tree).includes(localStory.titlePt));
const loadButton = () => find(panel.tree, node => node.type === 'button' && text(node) === 'Carregar');
loadButton().props.onClick(); panel.flush();
assert.ok(find(panel.tree, node => node.type === 'article' && text(node).includes(localStory.titlePt)));
assert.equal(fetches.length, 0);
// Existing live filtering, title normalization, empty results and level choices.
byId('story-search-title').props.onChange({ target: { value: 'nonexistent-title-948376' } }); panel.flush(); submitSearch();
assert.ok(text(panel.tree).includes('Nenhuma história encontrada'));
for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
  byId('story-search-level').props.onChange({ target: { value: level } });
  byId('story-search-title').props.onChange({ target: { value: '' } }); panel.flush();
  const expected = searchLocalStories(level);
  assert.equal(searchLocalStories(level, expected[0]?.titlePt.toUpperCase()).length >= 1, expected.length > 0);
}
setAuthor(true); panel.flush();
assert.ok(generateButton());
assert.ok(byId('interpretation-amount'));
assert.ok(byId('interpretation-theme'));
const staleGenerate = generateButton().props.onClick;
setAuthor(false); panel.flush();
assert.equal(generateButton(), null);
await staleGenerate();
assert.equal(fetches.length, 0);
assert.ok(form());

setAuthor(true); panel.flush();
await generateButton().props.onClick(); panel.flush();
assert.equal(fetches.length, 1);
assert.equal(fetches[0].options.method, 'POST');
assert.ok(fetches[0].options.signal instanceof AbortSignal);
assert.ok(JSON.parse(fetches[0].options.body).contents[0].parts[0].text.includes('B1'));
assert.ok(text(panel.tree).includes(generated.titlePt));
assert.ok(find(panel.tree, node => node.props?.title === 'Exportar história gerada pela IA'));

// Deactivation aborts in-flight work; a provider ignoring abort cannot publish it.
let resolveFetch;
responder = () => new Promise(resolve => { resolveFetch = resolve; });
const pending = generateButton().props.onClick(); panel.flush();
const pendingRequest = fetches.at(-1);
setAuthor(false); panel.flush();
assert.equal(pendingRequest.options.signal.aborted, true);
assert.equal(generateButton(), null);
resolveFetch({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(generated) }] } }] }) });
await pending; panel.flush();
assert.ok(!text(panel.tree).includes(generated.titlePt));
assert.ok(form());
const count = fetches.length;
await staleGenerate(); assert.equal(fetches.length, count);

// Loading a library result also cancels a pending generation and wins the race.
setAuthor(true); panel.flush();
const pendingLocal = generateButton().props.onClick(); panel.flush();
byId('story-search-level').props.onChange({ target: { value: 'B1' } });
byId('story-search-title').props.onChange({ target: { value: localStory.titlePt } }); panel.flush(); submitSearch();
loadButton().props.onClick(); panel.flush();
assert.equal(fetches.at(-1).options.signal.aborted, true);
resolveFetch({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(generated) }] } }] }) });
await pendingLocal; panel.flush();
assert.ok(text(panel.tree).includes(localStory.titlePt));
assert.ok(!text(panel.tree).includes(generated.titlePt));

// Provider failures retain their current error and local-fallback behavior.
responder = async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'Provider test error' } }) });
await generateButton().props.onClick(); panel.flush();
assert.ok(text(panel.tree).includes('Provider test error'));
responder = async () => ({ ok: false, status: 429, json: async () => ({ error: { message: 'Quota test' } }) });
assert.equal((await generateInterpretationStory(request)).source, 'local');

// Same-tab localStorage changes are observed even without a storage event.
storage.clear(); for (const tick of intervals.values()) tick(); panel.flush();
assert.equal(generateButton(), null);
globalThis.__storyTestEnv.VITE_AI_ENABLED = 'false';
setAuthor(true); panel.flush();
assert.equal(generateButton(), null);
await assert.rejects(generateInterpretationStory(request), /IA habilitada/);
assert.match(renderToStaticMarkup(React.createElement(Sidebar, { currentView: 'interpretation', onViewChange() {} })), /Interpretação/);
assert.ok(form());
// Unmounting aborts a request, even if the provider does not honor its signal.
globalThis.__storyTestEnv.VITE_AI_ENABLED = 'true';
panel.dirty = true; panel.flush();
responder = () => new Promise(resolve => { resolveFetch = resolve; });
const pendingUnmount = generateButton().props.onClick(); panel.flush();
const unmountSignal = fetches.at(-1).options.signal;
panel.dispose();
assert.equal(unmountSignal.aborted, true);
resolveFetch({ ok: true, json: async () => ({}) });
await pendingUnmount;
assert.equal(intervals.size, 0);
assert.ok([...listeners.values()].every(set => set.size === 0));
console.log('Story access: public search/loading, all levels, Author controls, stale handlers, service guards, cancellation/races and AI-disabled navigation passed. No external requests made.');

