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
const translations = JSON.parse(readFileSync('src/i18n/locales/pt-BR.json', 'utf8'));
const translate = (key, values = {}) => {
  const value = key.split('.').reduce((item, part) => item?.[part], translations) ?? key;
  return String(value).replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? ''));
};
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
  if (file.endsWith('.css')) return module.exports;
  const { outputText } = transpileModule(readFileSync(file, 'utf8'), { compilerOptions: {
    module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX, target: ScriptTarget.ES2022
  } });
  const localRequire = id => {
    if (id === 'react') return hooks;
    if (id === 'react-i18next') return { useTranslation: () => ({ t: translate, i18n: { language: 'pt-BR' } }) };
    if (id.endsWith('/i18n')) return { t: translate, languageName: value => value };
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
const { FavoriteChunkButton } = load('src/components/FavoriteChunkButton.tsx');
const { WalkingSessionSummary } = load('src/components/WalkingSessionSummary.tsx');
const { useFavoriteChunks } = load('src/hooks/useFavoriteChunks.ts');
const { Sidebar } = load('src/components/Sidebar.tsx');
const { IntentionCard } = load('src/components/IntentionCard.tsx');
const { IntentionList } = load('src/components/IntentionList.tsx');
const { MemoryFlashcards } = load('src/components/MemoryFlashcards.tsx');
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
  const items = (Array.isArray(data) ? data : data.mentalMap).map(item => ({ ...item,
    english: item.english ?? item.structure, englishLevel: item.englishLevel ?? item.level
  }));
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

const props = { intentions: fixtures, language: 'fr-FR', sourceLanguage: 'pt-BR', onWalkingChange() {},
  onShowDetails() {}, onBasicTraining() {}, onAdvancedTraining() {} };
for (const language of ['en-US', 'fr-FR', 'es-ES']) {
  const h = new Harness(ChunkFlashcards, { ...props, language }); h.flush();
  find(h.tree, n => n.type === 'button' && text(n) === 'Começar').props.onClick(); h.flush();
  const speaker = find(h.tree, n => n.props?.className === 'chunk-flashcards-speaker');
  const regional = { lang: `${language.slice(0, 2)}-CA` };
  const exact = { lang: language };
  for (const available of [[{ lang: 'en-US' }, regional, exact], [regional], []]) {
    window.speechSynthesis.getVoices = () => available;
    speaker.props.onClick();
    assert.equal(utterances.at(-1).lang, language);
    assert.equal(utterances.at(-1).voice?.lang ?? null, available.length === 3 ? language : available[0]?.lang ?? null);
  }
  h.dispose();
}
window.speechSynthesis.getVoices = () => [];
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

// Favorites reuse the real card and round state, with a pool isolated by language.
const favoriteProps = { ...props, language: 'en-US', mode: 'favorites',
  favorites: [{ id: 'A1-1', language: 'en-US' }, { id: 'A1-2', language: 'es-ES' }],
  onToggleFavorite() {}, onBackToAll() {} };
const favorites = new Harness(ChunkFlashcards, favoriteProps); favorites.flush();
find(favorites.tree, n => n.type === 'button' && text(n) === 'Começar').props.onClick(); favorites.flush();
assert.equal(find(favorites.tree, n => n.type === FavoriteChunkButton).props.active, true);
assert.ok(text(favorites.tree).includes('Chunk A1-1'));
assert.doesNotMatch(renderToStaticMarkup(React.createElement(ChunkFlashcards, favoriteProps)), /walking-entry/);
favorites.flush({ ...favoriteProps, language: 'es-ES' });
find(favorites.tree, n => n.type === 'button' && text(n) === 'Começar').props.onClick(); favorites.flush();
assert.ok(text(favorites.tree).includes('Chunk A1-2'));
favorites.flush({ ...favoriteProps, favorites: [] });
assert.ok(text(favorites.tree).includes(translations.favorites.empty));
assert.equal(find(favorites.tree, n => n.type === FavoriteChunkButton), null);
favorites.dispose();

// Count on successful speech end, not draw/navigation or the end of the delay.
navigator.userAgent = 'iPhone'; navigator.platform = 'iPhone'; navigator.maxTouchPoints = 5;
now = 0;
let stopped = null, toggled = 0;
const statsProps = { ...props, chunk: fixtures[0], total: 2, position: 1, round: 1, level: 'all',
  canPrevious: false, onPrevious() {}, onNext() { return false; }, onLevelChange() {},
  onStop(summary) { stopped = summary; }, favorite: false, onToggleFavorite() { toggled++; } };
const stats = new Harness(WalkingMode, statsProps); stats.flush();
for (let i = 0; i < 2; i++) {
  const utterance = utterances.at(-1); utterance.onend(); utterance.onend(); stats.flush();
  const [id, timer] = [...timeouts][0]; timeouts.delete(id); timer.fn(); stats.flush();
}
const incomplete = utterances.at(-1);
now = 10000; named(stats.tree, 'Pausar').props.onClick(); stats.flush();
let summary = find(stats.tree, n => n.type === WalkingSessionSummary).props.summary;
assert.deepEqual({ ...summary }, { completed: 0, total: 2, phrases: 2, seconds: 10 });
incomplete.onend(); incomplete.onerror(); stats.flush();
assert.equal(find(stats.tree, n => n.type === WalkingSessionSummary).props.summary.phrases, 2);
now = 60000; for (const tick of intervals.values()) tick(); stats.flush();
assert.equal(find(stats.tree, n => n.type === WalkingSessionSummary).props.summary.seconds, 10);
named(stats.tree, 'Continuar').props.onClick(); stats.flush();
const speechBeforeFavorite = utterances.length;
find(stats.tree, n => n.type === FavoriteChunkButton).props.onToggle();
stats.flush({ ...statsProps, favorite: true });
assert.equal(toggled, 1); assert.equal(utterances.length, speechBeforeFavorite);
for (let i = 0; i < 3; i++) {
  utterances.at(-1).onend(); stats.flush();
  if (i < 2) { const [id, timer] = [...timeouts][0]; timeouts.delete(id); timer.fn(); stats.flush(); }
}
now = 65000;
named(stats.tree, 'Parar').props.onClick(); stats.flush();
assert.deepEqual({ ...stopped }, { completed: 1, total: 2, phrases: 5, seconds: 15 });
stats.dispose();
const newSession = new Harness(WalkingMode, statsProps); newSession.flush();
named(newSession.tree, 'Pausar').props.onClick(); newSession.flush();
assert.equal(find(newSession.tree, n => n.type === WalkingSessionSummary).props.summary.phrases, 0);
newSession.dispose();
assert.equal(timeouts.size, 0); assert.equal(intervals.size, 0);

// Favorites walking uses the same playback and draw policy on phones only.
const extraFavoriteChunk = makeChunk('A1-3', 'A1');
let favoriteWalkProps = { ...props, language: 'en-US', mode: 'favorites', intentions: [...fixtures, extraFavoriteChunk],
  favorites: [{ id: 'A1-1', language: 'en-US' }, { id: 'A1-2', language: 'en-US' },
    { id: 'A2-1', language: 'es-ES' }, { id: 'A2-2', language: 'en-US' }],
  onToggleFavorite(id) { favoriteWalkProps = { ...favoriteWalkProps,
    favorites: favoriteWalkProps.favorites.filter(f => f.id !== id || f.language !== 'en-US') }; } };
const favoriteWalkParent = new Harness(ChunkFlashcards, favoriteWalkProps); favoriteWalkParent.flush();
find(favoriteWalkParent.tree, n => n.type === ChunkLevelSelect).props.onChange('A1'); favoriteWalkParent.flush();
assert.ok(find(favoriteWalkParent.tree, n => n.props?.className?.includes('walking-entry')));
find(favoriteWalkParent.tree, n => n.props?.className?.includes('walking-entry')).props.onClick(); favoriteWalkParent.flush();
const favoriteWalk = new Harness(WalkingMode, favoriteWalkParent.tree.props);
function flushFavoriteWalk() {
  for (let i = 0; i < 30; i++) {
    favoriteWalkParent.flush(favoriteWalkProps);
    if (favoriteWalkParent.tree.type !== WalkingMode) return;
    favoriteWalk.flush(favoriteWalkParent.tree.props);
    if (!favoriteWalkParent.dirty) return;
  }
  assert.fail('Favorite walking must settle');
}
flushFavoriteWalk();
assert.equal(favoriteWalkParent.tree.props.total, 2);
find(favoriteWalk.tree, n => n.type === 'input' && n.props.type === 'checkbox').props.onChange({ target: { checked: false } });
flushFavoriteWalk(); // removing the current favorite advances even with auto-advance disabled
const removedCurrent = favoriteWalkParent.tree.props.chunk.id;
utterances.at(-1).onend(); flushFavoriteWalk();
{ const [id, timer] = [...timeouts][0]; timeouts.delete(id); timer.fn(); flushFavoriteWalk(); }
const playingBeforeRemoval = utterances.at(-1), speechCountBeforeRemoval = utterances.length;
find(favoriteWalk.tree, n => n.type === FavoriteChunkButton).props.onToggle(); flushFavoriteWalk();
assert.equal(favoriteWalkParent.tree.props.chunk.id, removedCurrent);
assert.equal(favoriteWalkParent.tree.props.total, 1);
assert.equal(utterances.length, speechCountBeforeRemoval); // current utterance was not restarted/canceled
favoriteWalkProps = { ...favoriteWalkProps, favorites: [...favoriteWalkProps.favorites, { id: 'A1-3', language: 'en-US' }] };
flushFavoriteWalk(); assert.equal(favoriteWalkParent.tree.props.total, 2);
assert.equal(utterances.at(-1), playingBeforeRemoval);
utterances.at(-1).onend(); flushFavoriteWalk();
assert.notEqual(favoriteWalkParent.tree.props.chunk.id, removedCurrent);
assert.equal(favoriteWalkParent.tree.props.chunk.englishLevel, 'A1');
assert.equal(utterances.at(-1).lang, 'en-US');
named(favoriteWalk.tree, 'Pausar').props.onClick(); flushFavoriteWalk();
const beforeEmptySummary = find(favoriteWalk.tree, n => n.type === WalkingSessionSummary).props.summary;
assert.equal(beforeEmptySummary.phrases, 2); assert.equal(beforeEmptySummary.completed, 0);
favoriteWalkProps = { ...favoriteWalkProps, favorites: [] }; flushFavoriteWalk();
assert.notEqual(favoriteWalkParent.tree.type, WalkingMode);
const emptySummary = find(favoriteWalkParent.tree, n => n.type === WalkingSessionSummary).props.summary;
assert.equal(emptySummary.total, 0); assert.equal(emptySummary.phrases, 2); assert.equal(emptySummary.completed, 0);
assert.equal(emptySummary.seconds, beforeEmptySummary.seconds);
favoriteWalk.dispose(); favoriteWalkParent.dispose();
// Removing the sole favorite during speech lets that speech end before stopping.
let soleStop = null;
const soleProps = { ...statsProps, stopWhenEmpty: true, onStop(summary) { soleStop = summary; } };
const soleWalk = new Harness(WalkingMode, soleProps); soleWalk.flush();
const lastUtterance = utterances.at(-1);
soleWalk.flush({ ...soleProps, total: 0 }); assert.equal(soleStop, null);
lastUtterance.onend(); soleWalk.flush();
assert.equal(soleStop.total, 0); assert.equal(soleStop.phrases, 1);
soleWalk.dispose();
assert.equal(timeouts.size, 0); assert.equal(intervals.size, 0);
assert.ok(text(WalkingSessionSummary({ summary: { completed: 3, total: 1, phrases: 15, seconds: 10 } })).includes('100%'));
assert.ok(text(WalkingSessionSummary({ summary: { completed: 3, total: 0, phrases: 15, seconds: 10 } })).includes('0%'));
console.log('Favorites walking: mobile entry, level/language pool, live add/remove, uninterrupted speech, historical stats and safe empty-session stop passed.');
// The shared hook persists synchronously and leaves other languages intact.
let savedFavorites = null;
globalThis.localStorage = {
  getItem: () => savedFavorites,
  setItem(key, value) { assert.equal(key, 'bej-favorite-chunks'); savedFavorites = value; }
};
const store = new Harness(useFavoriteChunks, {}); store.flush();
store.tree.toggleFavorite('A1-1', 'en-US');
store.tree.toggleFavorite('A1-1', 'es-ES');
store.flush();
assert.equal(JSON.parse(savedFavorites).length, 2);
store.tree.toggleFavorite('A1-1', 'es-ES'); store.flush();
assert.deepEqual(JSON.parse(savedFavorites), [{ id: 'A1-1', language: 'en-US' }]);
const reloaded = new Harness(useFavoriteChunks, {}); reloaded.flush();
assert.equal(reloaded.tree.favorites[0].language, 'en-US');
globalThis.localStorage.setItem = () => { throw Error('quota'); };
store.tree.toggleFavorite('A1-2', 'en-US'); store.flush();
assert.equal(store.tree.storageError, true); assert.equal(store.tree.favorites.length, 1);
store.dispose(); reloaded.dispose();
const sidebarProps = { theme: 'light', currentView: 'chunk-flashcards', personalCount: 0,
  onThemeChange() {}, onOpenLanguages() {}, onOpenAbout() {}, onViewChange() {} };
assert.ok(renderToStaticMarkup(React.createElement(Sidebar, { ...sidebarProps, favoriteChunkCount: 1 })).includes(translations.favorites.title));
assert.ok(!renderToStaticMarkup(React.createElement(Sidebar, { ...sidebarProps, favoriteChunkCount: 0 })).includes(translations.favorites.title));

// Hashmap is another entry point into the same shared favorite store.
let hashmapSaved = null, selectedIntention = null;
globalThis.localStorage = {
  getItem: () => hashmapSaved,
  setItem(key, value) { assert.equal(key, 'bej-favorite-chunks'); hashmapSaved = value; }
};
function FavoriteListHarness(input) {
  const store = useFavoriteChunks();
  return IntentionList({ ...input, favorites: store.favorites,
    onToggleFavorite: id => store.toggleFavorite(id, input.language) });
}
const listProps = { items: [fixtures[0]], sourceLanguage: 'pt-BR', language: 'en-US',
  onSelect(item) { selectedIntention = item; } };
const list = new Harness(FavoriteListHarness, listProps); list.flush();
const card = new Harness(IntentionCard, find(list.tree, n => n.type === IntentionCard).props); card.flush();
const clickFavorite = () => {
  const favorite = find(card.tree, n => n.type === FavoriteChunkButton);
  const button = new Harness(FavoriteChunkButton, favorite.props); button.flush();
  let stopped = false;
  button.tree.props.onClick({ stopPropagation() { stopped = true; } });
  if (!stopped) find(card.tree, n => n.props?.role === 'button').props.onClick();
  assert.equal(stopped, true); assert.equal(selectedIntention, null);
  button.dispose(); list.flush(); card.flush(find(list.tree, n => n.type === IntentionCard).props);
};
assert.equal(find(card.tree, n => n.type === FavoriteChunkButton).props.active, false);
clickFavorite();
assert.equal(find(card.tree, n => n.type === FavoriteChunkButton).props.active, true);
assert.deepEqual(JSON.parse(hashmapSaved), [{ id: fixtures[0].id, language: 'en-US' }]);
list.flush({ ...listProps, language: 'es-ES' }); card.flush(find(list.tree, n => n.type === IntentionCard).props);
assert.equal(find(card.tree, n => n.type === FavoriteChunkButton).props.active, false);
clickFavorite(); assert.equal(JSON.parse(hashmapSaved).length, 2);
clickFavorite(); assert.deepEqual(JSON.parse(hashmapSaved), [{ id: fixtures[0].id, language: 'en-US' }]);
// Existing card navigation still works, while ineligible cards have no star.
find(card.tree, n => n.props?.role === 'button').props.onClick();
assert.equal(selectedIntention.id, fixtures[0].id);
card.flush({ ...card.props, item: { ...fixtures[0], allowLanguageChunkPractice: false } });
assert.equal(find(card.tree, n => n.type === FavoriteChunkButton), null);
// Author and ordinary profiles see the same public favorite action.
for (const author of [false, true]) {
  window.localStorage = { getItem: () => author ? '8f4c2e91-6a73-4d0b-9e52-c17a08f6b394' : null };
  card.flush({ ...card.props, item: fixtures[0] });
  assert.ok(find(card.tree, n => n.type === FavoriteChunkButton));
}
card.dispose(); list.dispose();
// Memory cards share the App store on both faces without resetting the deck.
let memorySaved = null, memoryCancellations = 0;
globalThis.localStorage = { getItem: () => memorySaved,
  setItem(key, value) { assert.equal(key, 'bej-favorite-chunks'); memorySaved = value; } };
window.speechSynthesis.cancel = () => memoryCancellations++;
window.localStorage = { getItem: () => null }; // ordinary user
const memoryItems = [makeChunk('memory-1', 'A1', { targetIntention: 'First expression', examples: [{ id: 'e1' }] }),
  makeChunk('memory-2', 'A1', { targetIntention: 'Second expression', examples: [{ id: 'e2' }] }),
  makeChunk('not-a-chunk', 'A1', { targetIntention: 'Not eligible', examples: [{ id: 'e3' }], allowLanguageChunkPractice: false })];
function MemoryStore(input) {
  const store = useFavoriteChunks();
  return MemoryFlashcards({ ...input, favorites: store.favorites,
    onToggleFavorite: id => store.toggleFavorite(id, input.language) });
}
const memoryProps = { ...props, intentions: memoryItems, language: 'en-US' };
const memoryStore = new Harness(MemoryStore, memoryProps); memoryStore.flush();
const roundElement = () => find(memoryStore.tree, n => n.type?.name === 'MemoryRound');
assert.equal(roundElement().props.eligible.length, 2);
const memoryRound = new Harness(roundElement().type, roundElement().props); memoryRound.flush();
const memoryFace = () => find(memoryRound.tree, n => n.props?.className === 'memory-card');
const memoryStats = () => text(find(memoryRound.tree, n => n.props?.className === 'memory-stats'));
const memoryToggle = buttonProps => {
  const button = new Harness(FavoriteChunkButton, buttonProps); button.flush();
  let stopped = false; button.tree.props.onClick({ stopPropagation() { stopped = true; } }); assert(stopped);
  button.dispose(); memoryStore.flush(); memoryRound.flush(roundElement().props);
};
const frontStats = memoryStats(), frontCancelCount = memoryCancellations;
memoryToggle(find(memoryRound.tree, n => n.type === FavoriteChunkButton).props);
assert.equal(memoryFace().props['data-side'], 'front'); assert.equal(memoryStats(), frontStats);
assert.equal(memoryCancellations, frontCancelCount);
assert.equal(find(memoryRound.tree, n => n.type === FavoriteChunkButton).props.active, true);
const memoryId = JSON.parse(memorySaved)[0].id;
assert.deepEqual(JSON.parse(memorySaved), [{ id: memoryId, language: 'en-US' }]);
// Reveal using the existing button, then toggle through the reused back face.
find(memoryRound.tree, n => n.type === 'button' && n.props.className === 'primary-button').props.onClick(); memoryRound.flush();
const back = () => find(memoryRound.tree, n => n.type === ChunkFlashcards);
const memoryBack = new Harness(ChunkFlashcards, back().props); memoryBack.flush();
assert.equal(find(memoryBack.tree, n => n.type === FavoriteChunkButton).props.active, true);
find(memoryBack.tree, n => n.props?.className === 'chunk-flashcards-speaker').props.onClick();
const backStats = memoryStats(), backCancelCount = memoryCancellations, backAudioCount = utterances.length;
memoryToggle(find(memoryBack.tree, n => n.type === FavoriteChunkButton).props);
memoryBack.flush(back().props);
assert.equal(memoryFace().props['data-side'], 'back'); assert.equal(memoryStats(), backStats);
assert.equal(memoryCancellations, backCancelCount); assert.equal(utterances.length, backAudioCount);
assert.equal(back().props.studyChunk.id, memoryId); assert.deepEqual(JSON.parse(memorySaved), []);
// Save again; switching the target language must not inherit the English star.
memoryToggle(find(memoryBack.tree, n => n.type === FavoriteChunkButton).props); memoryBack.flush(back().props);
assert.equal(JSON.parse(memorySaved)[0].language, 'en-US');
find(memoryRound.tree, n => n.type === 'button' && n.props.className === 'secondary-button').props.onClick(); memoryRound.flush();
assert.equal(memoryFace().props['data-side'], 'front');
assert.equal(find(memoryRound.tree, n => n.type === FavoriteChunkButton).props.active, false);
assert.equal(memoryStats(), backStats); // advancing does not erase the recorded card
memoryBack.dispose(); memoryRound.dispose(); memoryStore.dispose();
const spanishMemoryStore = new Harness(MemoryStore, { ...memoryProps, language: 'es-ES' }); spanishMemoryStore.flush();
const spanishRoundElement = find(spanishMemoryStore.tree, n => n.type?.name === 'MemoryRound');
const spanishMemoryRound = new Harness(spanishRoundElement.type, spanishRoundElement.props); spanishMemoryRound.flush();
assert.equal(find(spanishMemoryRound.tree, n => n.type === FavoriteChunkButton).props.active, false);
spanishMemoryRound.dispose(); spanishMemoryStore.dispose();
const ineligibleMemory = new Harness(MemoryFlashcards, { ...memoryProps, intentions: [memoryItems[2]] }); ineligibleMemory.flush();
const emptyRoundElement = find(ineligibleMemory.tree, n => n.type?.name === 'MemoryRound');
const emptyMemoryRound = new Harness(emptyRoundElement.type, emptyRoundElement.props); emptyMemoryRound.flush();
assert.equal(find(emptyMemoryRound.tree, n => n.type === FavoriteChunkButton), null);
emptyMemoryRound.dispose(); ineligibleMemory.dispose();
assert.equal(intervals.size, 0); assert.equal(timeouts.size, 0);
console.log('Memory favorites: shared persisted state on both faces, eligibility, ordinary user, language isolation, unchanged reveal/progress/deck/audio passed.');

// Regression: remove five favorites down to zero without returning to Start.
const realDateNow = Date.now;
let manualClock = 100000;
Date.now = () => manualClock;
navigator.userAgent = 'Desktop Chrome'; navigator.platform = 'Win32'; navigator.maxTouchPoints = 0;
const removalItems = Array.from({ length: 5 }, (_, i) => makeChunk(`remove-${i}`, 'A1'));
let removalStorage = null;
globalThis.localStorage = { getItem: () => removalStorage,
  setItem(key, value) { assert.equal(key, 'bej-favorite-chunks'); removalStorage = value; } };
function RemovalPractice(input) {
  const store = useFavoriteChunks();
  return ChunkFlashcards({ ...input, mode: 'favorites', favorites: store.favorites,
    onToggleFavorite: id => store.toggleFavorite(id, input.language) });
}
for (const language of ['en-US', 'es-ES', 'fr-FR']) {
  const otherLanguage = language === 'en-US' ? 'es-ES' : 'en-US';
  const untouchedFavorite = { id: removalItems[0].id, language: otherLanguage };
  removalStorage = JSON.stringify([...removalItems.map(item => ({ id: item.id, language })), untouchedFavorite]);
  const practice = new Harness(RemovalPractice, { ...props, intentions: removalItems, language, onBackToAll() {} }); practice.flush();
  find(practice.tree, n => n.type === 'button' && text(n) === 'Começar').props.onClick(); practice.flush();
  named(practice.tree, translate('flashcards.showStudyTime')).props.onClick(); practice.flush();
  manualClock += 12000; for (const tick of intervals.values()) tick(); practice.flush();
  const removed = new Set();
  for (let remaining = 4; remaining >= 0; remaining--) {
    const currentText = text(find(practice.tree, n => n.type === 'h3'));
    assert(!removed.has(currentText)); removed.add(currentText);
    find(practice.tree, n => n.type === FavoriteChunkButton).props.onToggle(); practice.flush();
    assert.equal(JSON.parse(removalStorage).filter(f => f.language === language).length, remaining);
    assert(JSON.parse(removalStorage).some(f => f.id === untouchedFavorite.id && f.language === otherLanguage));
    assert.ok(text(practice.tree).includes('00:00:12'));
    assert.equal(find(practice.tree, n => n.props?.className === 'chunk-flashcards-start'), null);
    if (remaining > 0) {
      assert(find(practice.tree, n => n.type === FavoriteChunkButton));
      assert(!removed.has(text(find(practice.tree, n => n.type === 'h3'))));
      assert.ok(text(practice.tree).includes(translate('flashcards.roundNumber', { round: 1 })));
    } else {
      assert.equal(find(practice.tree, n => n.type === FavoriteChunkButton), null);
      assert(find(practice.tree, n => n.props?.className === 'chunk-flashcards-empty'));
      manualClock += 5000; for (const tick of intervals.values()) tick(); practice.flush();
      assert.ok(text(practice.tree).includes('00:00:12')); // the final session time is frozen
    }
  }
  practice.dispose();
}
Date.now = realDateNow;

// Keep the current card for an unrelated removal; prefer unseen items, then a new round.
let historyProps = { ...props, language: 'en-US', mode: 'favorites', intentions: removalItems.slice(0, 4),
  favorites: removalItems.slice(0, 4).map(item => ({ id: item.id, language: 'en-US' })),
  onToggleFavorite(id) { historyProps = { ...historyProps, favorites: historyProps.favorites.filter(f => f.id !== id) }; } };
const historyPractice = new Harness(ChunkFlashcards, historyProps); historyPractice.flush();
const nextManual = () => { find(historyPractice.tree, n => n.type === 'button' && n.props.className === 'primary-button').props.onClick(); historyPractice.flush(historyProps); };
const currentManualText = () => text(find(historyPractice.tree, n => n.type === 'h3'));
nextManual(); const firstManualText = currentManualText();
const removeOther = removalItems.slice(0, 4).find(item => item.english !== firstManualText);
historyProps = { ...historyProps, favorites: historyProps.favorites.filter(f => f.id !== removeOther.id) }; historyPractice.flush(historyProps);
assert.equal(currentManualText(), firstManualText);
nextManual(); assert.notEqual(currentManualText(), firstManualText);
find(historyPractice.tree, n => n.type === FavoriteChunkButton).props.onToggle(); historyPractice.flush(historyProps);
assert.notEqual(currentManualText(), firstManualText); // the third, unseen favorite
find(historyPractice.tree, n => n.type === FavoriteChunkButton).props.onToggle(); historyPractice.flush(historyProps);
assert.equal(currentManualText(), firstManualText);
assert.ok(text(historyPractice.tree).includes(translate('flashcards.roundNumber', { round: 2 })));
historyPractice.dispose();
assert.equal(intervals.size, 0); assert.equal(timeouts.size, 0);
console.log('Favorite removal: five-to-zero in EN/ES/FR, exact persistence, other-language preservation, active clock, unrelated removal, unseen-first draw and automatic next round passed.');
console.log('Hashmap favorites: shared persistence, public profiles, eligibility, language isolation and click/navigation separation passed.');
console.log('CEFR, real catalogs, round coverage/counters, backward navigation, live filters, cancellation, time/settings, empty levels and accessible controls passed.');
console.log('Favorites filtering/removal/language changes, pause/resume summaries, incomplete/duplicate speech, active time, stop/new sessions and favorite toggling during playback passed.');

// Favorite example resolution and manual session share the production component.
const { favoriteStudyItems } = load('src/utils/favoriteStudyItems.ts');
const exampleOrigin = { id: 'origin', intention: 'origem', english: 'origin', targetIntention: 'origin', englishLevel: 'B1',
  allowLanguageChunkPractice: false, examples: [
    { id: 'sentence-one', exampleItem: 'First sentence.', en: 'First sentence.', pt: 'Primeira frase.', intent: 'First' },
    { id: 'sentence-two', exampleItem: 'Second sentence.', en: 'Second sentence.', pt: 'Segunda frase.', intent: 'Second' }
  ] };
const exampleFavorites = [
  { id: 'sentence-one', language: 'en-US', type: 'example' },
  { id: 'sentence-two', language: 'en-US', type: 'example' },
  { id: 'unavailable', language: 'en-US', type: 'example' },
  { id: 'sentence-one', language: 'es-ES', type: 'example' }
];
const resolved = favoriteStudyItems([exampleOrigin], exampleFavorites, 'en-US', 'all');
assert.equal(resolved.length, 2);
assert.notEqual(resolved[0].id, resolved[1].id);
assert.equal(resolved[0].targetIntention, 'First sentence.');
assert.equal(resolved[0].intention, 'Primeira frase.');
assert.equal(resolved[0].examples.length, 1);
assert.equal(favoriteStudyItems([exampleOrigin], exampleFavorites, 'en-US', 'A1').length, 0);
assert.equal(favoriteStudyItems([exampleOrigin], exampleFavorites, 'en-US', 'B1').length, 2);
const completeOrigin = { ...exampleOrigin, allowLanguageChunkPractice: true };
assert.equal(favoriteStudyItems([completeOrigin], [...exampleFavorites, { id: 'origin', language: 'en-US' }], 'en-US', 'all').length, 3);
let exampleProps = { ...props, language: 'en-US', mode: 'favorites', intentions: [exampleOrigin], favorites: exampleFavorites,
  onToggleFavorite(id, type) { exampleProps = { ...exampleProps, favorites: exampleProps.favorites.filter(f => f.id !== id || f.type !== type || f.language !== 'en-US') }; } };
const examplePractice = new Harness(ChunkFlashcards, exampleProps); examplePractice.flush();
find(examplePractice.tree, n => n.type === 'button' && n.props.className === 'primary-button').props.onClick(); examplePractice.flush();
let star = find(examplePractice.tree, n => n.type === FavoriteChunkButton);
assert.equal(star.props.active, true);
star.props.onToggle(); examplePractice.flush(exampleProps);
assert.ok(find(examplePractice.tree, n => n.type === 'h3' && ['First sentence.', 'Second sentence.'].includes(n.props.children)));
star = find(examplePractice.tree, n => n.type === FavoriteChunkButton); star.props.onToggle(); examplePractice.flush(exampleProps);
assert.ok(!find(examplePractice.tree, n => n.type === FavoriteChunkButton));
assert.equal(exampleProps.favorites.length, 2); // unavailable and other-language references survive
console.log('Example favorites: UUID resolution, level inheritance, independent identities, mixed pool and removal to empty passed.');

// Dashboard integration follows the existing clock, without signaling on each card.
const studySignals = [];
const tracked = new Harness(ChunkFlashcards, { ...props, onStudyState: (active, mode) => studySignals.push({ active, mode }) });
tracked.flush(); assert.equal(studySignals.at(-1).active, false);
find(tracked.tree, n => n.type === 'button' && n.props.className === 'primary-button').props.onClick(); tracked.flush();
assert.deepEqual(studySignals.at(-1), { active: true, mode: 'manual' });
const countBeforeNext = studySignals.length;
find(tracked.tree, n => n.type === 'button' && n.props.className === 'primary-button').props.onClick(); tracked.flush();
assert.equal(studySignals.length, countBeforeNext, 'next card does not restart tracking');
const pauseTracking = () => find(tracked.tree, n => n.type === 'button' && n.props['aria-label'] === translations.flashcards.pauseStudyTime);
pauseTracking().props.onClick(); tracked.flush(); assert.equal(studySignals.at(-1).active, false);
find(tracked.tree, n => n.type === 'button' && n.props['aria-label'] === translations.flashcards.resumeStudyTime).props.onClick(); tracked.flush();
assert.equal(studySignals.at(-1).active, true);
tracked.dispose(); assert.equal(studySignals.at(-1).active, false);
const walkSignals = [];
navigator.userAgent = 'iPhone'; navigator.platform = 'iPhone'; navigator.maxTouchPoints = 5;
const trackedWalk = new Harness(WalkingMode, { chunk: fixtures[0], language: 'en-US', sourceLanguage: 'pt-BR',
  level: 'all', position: 1, total: 2, round: 1, canPrevious: false, onNext() {}, onPrevious() {}, onStop() {}, onLevelChange() {},
  onStudyState: (active, mode) => walkSignals.push({ active, mode }) });
trackedWalk.flush();
assert.equal(walkSignals.length, 0, 'walking does not count queued speech');
utterances.at(-1).onstart(); assert.deepEqual(walkSignals.at(-1), { active: true, mode: 'walking' });
utterances.at(-1).onend(); assert.deepEqual(walkSignals.at(-1), { active: false, mode: 'walking' });
trackedWalk.dispose();
console.log('Dashboard integration: manual start/pause/resume/unmount, no per-card restart, walking starts on actual speech and excludes repetition delays passed.');
