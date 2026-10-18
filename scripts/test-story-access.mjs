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
const translate = (key, values = {}) => String(key.split('.').reduce((value, part) => value?.[part], translations) ?? key)
  .replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? ''));
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
  if (file.endsWith('.json')) return module.exports = JSON.parse(readFileSync(file, 'utf8').replaceAll('import.meta.url', JSON.stringify('file:///study-lock-tests/entry.js')));
  const source = readFileSync(file, 'utf8').replaceAll('import.meta.url', JSON.stringify('file:///study-lock-tests/entry.js')).replaceAll('import.meta.env', 'globalThis.__storyTestEnv');
  const { outputText } = transpileModule(source, { compilerOptions: {
    module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX, target: ScriptTarget.ES2022, esModuleInterop: true
  } });
  const localRequire = id => {
    if (id === 'react') return hooks;
    if (id === 'react-i18next') return { useTranslation: () => ({ t: translate }) };
    if (id.endsWith('/i18n')) return { t: translate, languageName: value => ({ 'pt-BR': 'português', 'en-US': 'inglês', 'es-ES': 'espanhol', 'fr-FR': 'francês' }[value] ?? value) };
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
const props = { intentions: [intention], language: 'en-US', onSelectIntention() {} };
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

// Multilingual local interpretation uses the same real component and hook harness.
const { getStoryTitle, getParagraphText, getIntentionText, isStoryAvailable, searchShadowingStories } = load('src/services/localStoryService.ts');
const sample = searchLocalStories('A1', 'Um Sábado Diferente')[0];
assert.ok(sample);
const languages = [
  ['en-US', 'inglês', 'titleEn', 'en', 'enIntent', 'SATURDAY'],
  ['fr-FR', 'francês', 'titleFr', 'fr', 'frIntent', 'SAMEDI'],
  ['es-ES', 'espanhol', 'titleEs', 'es', 'esIntent', 'SABADO'],
];
for (const [language, , titleKey, textKey, intentionKey, query] of languages) {
  assert.equal(getStoryTitle(sample, language), sample[titleKey]);
  assert.equal(getParagraphText(sample.paragraphs[0], language), sample.paragraphs[0][textKey]);
  assert.equal(getIntentionText(sample.paragraphs[0].intentions[0], language), sample.paragraphs[0].intentions[0][intentionKey]);
  assert.ok(searchLocalStories('A1', query, language).includes(sample));
  assert.ok(searchLocalStories('a1', 'SABADO DIFERENTE', language).includes(sample));
  assert.equal(searchLocalStories('A1', sample.paragraphs[0][textKey], language).length, 0, 'Search remains title-only');
  assert.ok(searchLocalStories('A1', '', language).every(s => s.englishLevel === 'A1'));
  for (const field of [titleKey, textKey, intentionKey]) {
    const incomplete = structuredClone(sample);
    if (field === titleKey) delete incomplete[field];
    else if (field === textKey) delete incomplete.paragraphs[0][field];
    else delete incomplete.paragraphs[0].intentions[0][field];
    assert.equal(isStoryAvailable(incomplete, language), false);
  }
}
for (const language of ['es-ES', 'fr-FR']) {
  assert.equal(searchLocalStories('A1', '', language).length, 11);
  assert.equal(searchLocalStories('A1', 'Saturday', language).length, 0);
  for (const level of ['A2', 'B1', 'B2', 'C1', 'C2']) assert.equal(searchLocalStories(level, '', language).length, searchLocalStories(level).length);
  assert.equal(searchShadowingStories(language).length, 42, 'Shadowing supports translated catalogs');
}
assert.equal(searchShadowingStories('en-US').length, 42);

setAuthor(false);
const utterances = [];
const voices = languages.map(([lang]) => ({ lang }));
globalThis.SpeechSynthesisUtterance = class { constructor(value) { this.text = value; } };
window.speechSynthesis.getVoices = () => voices;
window.speechSynthesis.speak = utterance => utterances.push(utterance);
let clipboard = '', printed = '';
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { async writeText(value) { clipboard = value; } } } });
window.open = () => ({ document: { write(value) { printed = value; }, close() {} } });
const nodeById = (h, id) => find(h.tree, node => node.props?.id === id);
const buttonText = (h, label) => find(h.tree, node => node.type === 'button' && text(node) === label);
function loadStory(h, level, title) {
  nodeById(h, 'story-search-level').props.onChange({ target: { value: level } });
  nodeById(h, 'story-search-title').props.onChange({ target: { value: title } }); h.flush();
  find(h.tree, n => n.type === 'form' && n.props.role === 'search').props.onSubmit({ preventDefault() {} }); h.flush();
  buttonText(h, 'Carregar').props.onClick(); h.flush();
}
const targetParagraph = h => find(h.tree, n => n.props?.className === 'english interpretation-en');
const networkCount = fetches.length;
for (const [language, name, titleKey, textKey, intentionKey] of languages) {
  let selectedIntention;
  const relatedIntentions = sample.paragraphs.flatMap(p => p.intentions).map(i => ({ id: i.intentionId, intention: i.ptIntent }));
  const h = new Harness(InterpretationPanel, { ...props, language, intentions: relatedIntentions,
    onSelectIntention(value) { selectedIntention = value; } }); h.flush();
  loadStory(h, 'A1', sample.titlePt);
  assert.ok(text(h.tree).includes(sample[titleKey]));
  assert.equal(targetParagraph(h), null, 'Target paragraphs remain hidden until revealed');
  buttonText(h, `Mostrar versão em ${name}`).props.onClick(); h.flush();
  const paragraph = targetParagraph(h);
  assert.equal(paragraph.props.lang, language);
  assert.equal(text(paragraph), sample.paragraphs[0][textKey]);
  const highlight = find(paragraph, n => n.props?.className === 'intention-highlight');
  assert.equal(text(highlight), sample.paragraphs[0].intentions[0][intentionKey]);
  find(h.tree, n => n.props?.className === 'pill interpretation-used-button').props.onClick();
  assert.equal(selectedIntention.id, sample.intentionsUsed[0]);
  assert.equal(selectedIntention.intention, sample.paragraphs[0].intentions[0].ptIntent);
  const portuguese = find(h.tree, n => n.props?.className === 'interpretation-pt');
  assert.equal(text(portuguese), sample.paragraphs[0].pt);
  const studio = find(h.tree, n => typeof n.type === 'function' && n.type.name === 'ConnectedSpeechButton');
  assert.equal(studio.props.blocks[0].original, sample.paragraphs[0][textKey]);
  assert.equal(studio.props.blocks[0].portuguese, sample.paragraphs[0].pt);
  assert.ok(studio.key.endsWith(language));
  named(h.tree, `Ouvir parágrafo 1 em ${name}`).props.onClick(); h.flush();
  assert.equal(utterances.at(-1).lang, language);
  assert.equal(utterances.at(-1).voice.lang, language);
  assert.equal(utterances.at(-1).text, sample.paragraphs[0][textKey]);
  named(h.tree, `Copiar parágrafo 1 em ${name}`).props.onClick();
  await Promise.resolve(); h.flush();
  assert.equal(clipboard, sample.paragraphs[0][textKey]);
  const fullAudio = find(h.tree, n => n.props?.title === `Ouvir a história completa em ${name}`);
  fullAudio.props.onClick(); h.flush();
  assert.equal(utterances.at(-1).text, [sample[titleKey], ...sample.paragraphs.map(p => p[textKey])].join('. '));
  const staleAudio = utterances.at(-1);
  await named(h.tree, 'Copiar história completa em texto puro').props.onClick(); h.flush();
  assert.ok(clipboard.includes(`PT-BR + ${language}`));
  assert.ok(clipboard.includes(sample.paragraphs[0][textKey]));
  if (language !== 'en-US') assert.ok(!clipboard.includes(sample.paragraphs[0].en));
  named(h.tree, 'Imprimir exercício e solução').props.onClick();
  assert.ok(printed.includes(sample[titleKey]));
  assert.ok(printed.includes(`PT-BR + ${language}`));
  assert.ok(printed.includes(`interpretação em ${name}`));
  const nextLanguage = language === 'fr-FR' ? 'es-ES' : 'fr-FR';
  h.flush({ ...props, language: nextLanguage });
  assert.equal(targetParagraph(h).props.lang, nextLanguage);
  assert.equal(text(targetParagraph(h)), getParagraphText(sample.paragraphs[0], nextLanguage));
  staleAudio.onerror(); h.flush();
  assert.ok(!text(h.tree).includes('Não foi possível reproduzir a história'));
  assert.equal(nodeById(h, 'story-search-title').props.value, sample.titlePt);
  h.dispose();
}
// A story missing the new language is cleared with a student-visible notice.
const switching = new Harness(InterpretationPanel, props); switching.flush();
const savedFrenchTitle = localStory.titleFr;
delete localStory.titleFr;
loadStory(switching, 'B1', localStory.titlePt);
switching.flush({ ...props, language: 'fr-FR' });
assert.equal(find(switching.tree, n => n.type === 'article'), null);
assert.ok(text(switching.tree).includes('Esta história ainda não está disponível em francês'));
switching.dispose();
localStory.titleFr = savedFrenchTitle;

// Invalid excerpts are reported and never highlighted; source data stays untouched.
const annotation = sample.paragraphs[0].intentions[0];
const savedExcerpt = annotation.frIntent;
const savedWarn = console.warn;
const warnings = [];
try {
  annotation.frIntent = 'EXCERPT NOT IN PARAGRAPH';
  console.warn = message => warnings.push(message);
  const invalid = new Harness(InterpretationPanel, { ...props, language: 'fr-FR' }); invalid.flush();
  loadStory(invalid, 'A1', sample.titlePt);
  buttonText(invalid, 'Mostrar versão em francês').props.onClick(); invalid.flush();
  assert.ok(!text(targetParagraph(invalid)).includes(annotation.frIntent));
  assert.ok(warnings.some(message => message.includes('parágrafo 1, fr-FR')));
  invalid.dispose();
} finally {
  annotation.frIntent = savedExcerpt;
  console.warn = savedWarn;
}
assert.equal(fetches.length, networkCount, 'Local interpretation makes no AI requests');
// Language changes abort existing English author generation and reject stale results.
setAuthor(true);
responder = () => new Promise(resolve => { resolveFetch = resolve; });
const authorSwitch = new Harness(InterpretationPanel, props); authorSwitch.flush();
const pendingLanguage = buttonText(authorSwitch, 'Gerar história').props.onClick(); authorSwitch.flush();
const languageSignal = fetches.at(-1).options.signal;
authorSwitch.flush({ ...props, language: 'fr-FR' });
assert.equal(languageSignal.aborted, true);
assert.equal(buttonText(authorSwitch, 'Gerar história'), null);
resolveFetch({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(generated) }] } }] }) });
await pendingLanguage; authorSwitch.flush();
assert.ok(!text(authorSwitch.tree).includes(generated.titlePt));
authorSwitch.dispose();
assert.equal(intervals.size, 0);
console.log('Multilingual interpretation: title search, CEFR, missing fields, exact highlights, Portuguese reference, audio, clipboard, print, Connected Speech, language switching and Shadowing regression passed.');

// Actual content events share the central clock, with no library/selection time.
setAuthor(false);
const { StudyClock, IDLE_MS } = load('src/features/study/studyTrackingService.ts');
const realNow = Date.now;
let studyNow = new Date(2026, 9, 17, 10).getTime(), studySignal;
Date.now = () => studyNow;
const interpretationClock = new StudyClock(() => 'interpretation-study');
const reportStudy = (active, mode, until) => {
  const previousSignal = studySignal;
  studySignal = { active, until };
  interpretationClock.set({ module: 'interpretation', language: 'en-US', mode }, active, studyNow, until);
  if (active && previousSignal?.active && until > previousSignal.until) interpretationClock.commit(studyNow);
};
const studying = new Harness(InterpretationPanel, { ...props, onStudyState: reportStudy }); studying.flush();
assert.equal(studySignal.active, false); assert.equal(interpretationClock.snapshot(studyNow), null);
loadStory(studying, 'A1', sample.titlePt);
assert.equal(studySignal.active, false, 'selection alone never starts a session');
const content = () => find(studying.tree, n => n.type === 'article');
content().props.onPointerDown({ isTrusted: false }); studying.flush();
assert.equal(studySignal.active, false);
const savedNode = globalThis.Node;
globalThis.Node = class { contains() { return true; } };
window.innerHeight = 800;
let contentTop = 1000;
content().props.ref.current = { getBoundingClientRect: () => ({ top: contentTop, bottom: contentTop + 600 }) };
const pageScroll = { isTrusted: true, target: new Node() };
for (const listener of listeners.get('scroll') ?? []) listener(pageScroll);
studying.flush(); assert.equal(studySignal.active, false, 'scrolling the library above the content does not count');
contentTop = 100;
for (const listener of listeners.get('scroll') ?? []) listener(pageScroll);
studying.flush(); assert.equal(studySignal.active, true, 'page scroll over visible story counts');
globalThis.Node = savedNode;
content().props.onPointerDown({ isTrusted: true }); studying.flush();
assert.equal(studySignal.active, true);
const advanceStudy = seconds => { for (let i = 0; i < seconds; i++) { studyNow += 1000; interpretationClock.snapshot(studyNow); } };
advanceStudy(65); assert.equal(interpretationClock.snapshot(studyNow).activeSeconds, 65);
const firstDeadline = studySignal.until;
content().props.onInput({ isTrusted: true }); studying.flush();
assert.ok(studySignal.until > firstDeadline, 'typing renews the reading window');
advanceStudy(IDLE_MS / 1000 + 60);
assert.equal(interpretationClock.snapshot(studyNow).activeSeconds, 245);
content().props.onScrollCapture({ isTrusted: true }); studying.flush();
advanceStudy(10); assert.equal(interpretationClock.snapshot(studyNow).activeSeconds, 255);
studying.flush({ ...props, language: 'fr-FR', onStudyState: reportStudy });
assert.equal(studySignal.active, false, 'new language requires a new interaction');
advanceStudy(60); assert.equal(interpretationClock.snapshot(studyNow).activeSeconds, 255);
content().props.onKeyDown({ isTrusted: true }); studying.flush();
advanceStudy(5); studying.dispose();
assert.equal(studySignal.active, false); advanceStudy(60);
assert.equal(interpretationClock.snapshot(studyNow).activeSeconds, 260);
assert.equal(listeners.get('scroll')?.size ?? 0, 0, 'scroll listeners are removed');

// Passive AI generation suspends an already active reading session.
setAuthor(true);
const pendingStudy = new Harness(InterpretationPanel, { ...props, onStudyState: reportStudy }); pendingStudy.flush();
loadStory(pendingStudy, 'B1', localStory.titlePt);
find(pendingStudy.tree, n => n.type === 'article').props.onInput({ isTrusted: true }); pendingStudy.flush();
assert.equal(studySignal.active, true);
responder = () => new Promise(resolve => { resolveFetch = resolve; });
const generatingStudy = buttonText(pendingStudy, 'Gerar história').props.onClick(); pendingStudy.flush();
assert.equal(studySignal.active, false, 'waiting on AI is not study');
const beforeWait = interpretationClock.snapshot(studyNow).activeSeconds;
advanceStudy(600); assert.equal(interpretationClock.snapshot(studyNow).activeSeconds, beforeWait);
resolveFetch({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(generated) }] } }] }) });
await generatingStudy; pendingStudy.flush(); assert.equal(studySignal.active, false);
pendingStudy.dispose(); Date.now = realNow;
console.log('PASS Interpretation study: library/selection exclusion, trusted events, 65 seconds, typing/scroll renewal, idle, language, exit, AI wait and listener cleanup.');

