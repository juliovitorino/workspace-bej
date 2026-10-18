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
  if (file.endsWith('hashmapService.ts')) return { loadHashmap: language => hashmapLoader(language) };
  const module = { exports: {} };
  cache.set(file, module);
  const { outputText } = transpileModule(readFileSync(file, 'utf8').replaceAll('import.meta.url', JSON.stringify('file:///study-lock-tests/entry.js')).replaceAll('import.meta.env', 'globalThis.__speakingEnv'), { compilerOptions: {
    module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX, target: ScriptTarget.ES2022
  } });
  const localRequire = id => {
    if (id === 'react') return hooks;
    if (id === 'react-i18next') return { useTranslation: () => ({ t: translate }) };
    if (id.endsWith('/i18n')) return { t: translate };
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

globalThis.__speakingEnv = {};
let now = 0, nextTimer = 0;
const timers = new Map();
const oldDateNow = Date.now;
Date.now = () => now;
globalThis.window = {
  setTimeout(fn, delay) { timers.set(++nextTimer, { fn, delay }); return nextTimer; },
  clearTimeout(id) { timers.delete(id); },
  requestAnimationFrame(fn) { fn(); },
  open(url) { openedUrl = url; },
};
globalThis.document = { getElementById() { return null; } };
let openedUrl = '';
// The component consumes runtime fields supplied by the V4 catalog adapter.
const runtimeCatalog = language => {
  const data = JSON.parse(readFileSync(`public/sample-hashmap-${language}.json`, 'utf8'));
  return { ...data, mentalMap: data.mentalMap.map(item => ({ ...item, english: item.structure || item.pattern || item.intention })) };
};
let hashmapLoader = async language => ({ data: runtimeCatalog(language) });
const requests = [];
let fetchImpl = async url => {
  requests.push(url);
  return { ok: true, json: async () => JSON.parse(readFileSync(`public${url}`, 'utf8')) };
};
globalThis.fetch = url => fetchImpl(url);
const { SpeakingGame } = load('src/components/SpeakingGame.tsx');
const { SpeakingGamePlayStep } = load('src/components/SpeakingGamePlayStep.tsx');
const { SpeakingGameReadyStep } = load('src/components/SpeakingGameReadyStep.tsx');
const { SpeakingGameSetupStep } = load('src/components/SpeakingGameSetupStep.tsx');
const service = load('src/services/englishVerbService.ts');
const { SPEAKING_GAME_FORMS, getSpeakingGameForms, supportsSpeakingForm, getSpeakingChallenge } = load('src/config/speakingGameForms.ts');
const { getNextSequentialFormIndex, getRandomFormIndex, clampSpeakingGameSeconds } = load('src/utils/speakingGameEngine.ts');
const languages = ['en-US', 'es-ES', 'fr-FR'];
const categories = ['verbs', 'adjectives', 'nouns'];
const vocabulary = {};
const counts = {};
for (const category of categories) {
  assert.ok(readFileSync(`public/english-${category}-common.json`).equals(readFileSync(`public/english-${category}-common-en-US.json`)), 'English catalog must be byte-identical');
}
for (const language of languages) {
  const before = requests.length;
  const [first, second] = await Promise.all([service.getSpeakingVocabulary(language), service.getSpeakingVocabulary(language)]);
  assert.equal(requests.length - before, 3, 'Concurrent consumers share the three requests');
  assert.equal(first.verbs, second.verbs);
  vocabulary[language] = first;
  counts[language] = categories.map(category => first[category].length);
  const definitions = getSpeakingGameForms(language);
  assert.equal(definitions.length, 17);
  for (const category of categories) {
    const list = first[category];
    assert.equal(new Set(list.map(item => item.id)).size, list.length);
    assert.ok(list.length >= 110);
    for (const item of list) assert.ok(item.meanings.length && item.meanings.every(s => s.trim()));
  }
  for (const form of definitions) assert.ok(first.verbs.some(v => supportsSpeakingForm(v, form)));
  for (const verb of first.verbs) {
    assert.ok(definitions.some(form => supportsSpeakingForm(verb, form)));
    for (const form of definitions.filter(form => supportsSpeakingForm(verb, form))) assert.ok(getSpeakingChallenge(verb, form).trim());
  }
  if (language !== 'en-US') {
    for (const a of first.adjectives) assert.ok(['masculine','feminine','masculinePlural','femininePlural'].every(k => a.forms[k]));
    for (const n of first.nouns) assert.ok(n.gender && n.article && (n.plural || n.countability === 'uncountable'));
    const stative = first.verbs.find(v => v.stative);
    assert.equal(supportsSpeakingForm(stative, definitions[1]), false);
    const impersonal = first.verbs.find(v => v.impersonal);
    assert.equal(supportsSpeakingForm(impersonal, definitions[13]), false);
  }
}
assert.equal(SPEAKING_GAME_FORMS.length, 17);
assert.equal(SPEAKING_GAME_FORMS[0], 'I +verb');
assert.equal(SPEAKING_GAME_FORMS[16], 'I should +verb');
assert.equal(vocabulary['es-ES'].verbs.find(v => v.base === 'ir').forms.present, 'voy');
assert.equal(vocabulary['es-ES'].verbs.find(v => v.base === 'sentarse').forms.perfect, 'me he sentado');
assert.equal(vocabulary['fr-FR'].verbs.find(v => v.base === 'aller').forms.past, 'je suis allé');
assert.equal(vocabulary['fr-FR'].verbs.find(v => v.base === 'aller').forms.pastFeminine, 'je suis allée');
assert.equal(vocabulary['fr-FR'].verbs.find(v => v.base === 'savoir').forms.present, 'je sais');
assert.equal(clampSpeakingGameSeconds(0), 2);
assert.equal(clampSpeakingGameSeconds(500), 120);
for (const total of [0,1,5,17,19]) {
  assert.equal(getNextSequentialFormIndex(Math.max(0,total-1), total), 0);
  for (let i=0;i<100;i++) {
    const index=getRandomFormIndex(0,total);
    assert.ok(index>=0 && index<Math.max(1,total));
    if(total>1) assert.notEqual(index,0);
  }
}

const component = (h, type) => find(h.tree, n => n.type === type);
async function settle(h) { for(let i=0;i<20;i++) { await Promise.resolve(); h.flush(); } }
async function start(h, settings = {}) {
  h.flush();
  const setup=component(h,SpeakingGameSetupStep);
  setup.props.onSettingsChange({ ...setup.props.settings, ...settings }); h.flush();
  component(h,SpeakingGameSetupStep).props.onNext(); h.flush();
  component(h,SpeakingGameReadyStep).props.onStart(); await settle(h);
  assert.ok(component(h,SpeakingGamePlayStep));
}
for (const language of languages) for(const timeMode of ['manual','automatic']) for(const order of ['sequential','random']) {
  const h=new Harness(SpeakingGame,{sourceLanguage:'pt-BR',language});
  await start(h,{timeMode,order,seconds:2});
  let play=component(h,SpeakingGamePlayStep);
  assert.ok(vocabulary[language].verbs.includes(play.props.verb));
  const beforeForm=play.props.formLabel;
  if(timeMode==='manual') {
    const beforeVerb=play.props.verb.id;
    play.props.onNewVerb();await settle(h);play=component(h,SpeakingGamePlayStep);
    assert.equal(play.props.formLabel,beforeForm);
    assert.notEqual(play.props.verb.id,beforeVerb);
    play.props.onNext();await settle(h);
    assert.notEqual(component(h,SpeakingGamePlayStep).props.formLabel,beforeForm);
  } else {
    assert.equal(timers.size,1);
    now+=1000;play.props.onPause();h.flush();
    assert.equal(timers.size,0);
    component(h,SpeakingGamePlayStep).props.onResume();h.flush();
    for(let tick=0;tick<2;tick++) {
      const [id,timer]=timers.entries().next().value;timers.delete(id);now+=1000;timer.fn();await settle(h);
    }
    assert.notEqual(component(h,SpeakingGamePlayStep).props.formLabel,beforeForm);
  }
  const child=new Harness(SpeakingGamePlayStep,component(h,SpeakingGamePlayStep).props);child.flush();await settle(child);
  const chunk=named(child.tree,'Chunk aleatório do Mental Hashmap');
  assert.ok(chunk);
  const localHashmap=runtimeCatalog(language).mentalMap;
  assert.ok(localHashmap.some(item=>item.allowLanguageChunkPractice===true && text(chunk).includes(item.english)));
  const translation=find(child.tree,n=>n.type==='button' && n.props.title?.startsWith('Abrir Google Tradutor'));
  if(translation) { translation.props.onClick();assert.ok(openedUrl.includes(`sl=${language.slice(0,2)}`)); }
  const markup=renderToStaticMarkup(React.createElement(SpeakingGamePlayStep,component(h,SpeakingGamePlayStep).props));
  assert.ok(markup.includes('Vocabulário sorteado'));
  if(language!=='en-US') assert.ok(!markup.includes('>TO</span>')&&!markup.includes('I +verb'));
  child.dispose();
  now+=1000;component(h,SpeakingGamePlayStep).props.onStop();h.flush();
  assert.equal(timers.size,0);
  assert.ok(component(h,SpeakingGameReadyStep).props.lastStudySeconds>=1);
  h.dispose();
}

// Pending data from an old language/session cannot publish a new round.
const pendingChunks = [];
const realHashmapLoader=hashmapLoader;
hashmapLoader=language=>new Promise(resolve=>pendingChunks.push({language,resolve}));
const playProps=language=>({sourceLanguage:"pt-BR",language,verb:vocabulary[language].verbs[0],vocabulary:vocabulary[language],form:'Teste',formLabel:'Teste',settings:{timeMode:'manual',seconds:60,order:'sequential'},status:'running',remainingSeconds:60,onPause(){},onResume(){},onStop(){},onNext(){}});
const chunkSession=new Harness(SpeakingGamePlayStep,playProps('en-US'));chunkSession.flush();
chunkSession.flush(playProps('es-ES'));
pendingChunks[1].resolve({data:{mentalMap:[{id:'spanish-test',english:'Hasta pronto',intention:'Até logo',allowLanguageChunkPractice:true}]}});
await settle(chunkSession);
assert.ok(text(named(chunkSession.tree,'Chunk aleatório do Mental Hashmap')).includes('Hasta pronto'));
pendingChunks[0].resolve({data:{mentalMap:[{id:'english-test',english:'See you soon',intention:'Até logo',allowLanguageChunkPractice:true}]}});
await settle(chunkSession);
assert.ok(!text(chunkSession.tree).includes('See you soon'));
chunkSession.dispose();hashmapLoader=realHashmapLoader;

service.clearEnglishVerbsCache();
const deferred=[];
const normalFetch=fetchImpl;
fetchImpl=url=>new Promise(resolve=>{requests.push(url);deferred.push({url,resolve});});
const h=new Harness(SpeakingGame,{sourceLanguage:'pt-BR',language:'en-US'});h.flush();
component(h,SpeakingGameSetupStep).props.onNext();h.flush();
component(h,SpeakingGameReadyStep).props.onStart();h.flush();
component(h,SpeakingGameReadyStep).props.onStart();h.flush();
assert.equal(deferred.length,3,'Repeated start cannot create duplicate requests');
h.flush({sourceLanguage:"pt-BR",language:'es-ES'});
for(const {url,resolve}of deferred.splice(0)) resolve({ok:true,json:async()=>JSON.parse(readFileSync(`public${url}`,'utf8'))});
await settle(h);assert.equal(component(h,SpeakingGamePlayStep),null);
assert.ok(component(h,SpeakingGameSetupStep));
fetchImpl=normalFetch;
for(const language of ['es-ES','fr-FR','en-US']) { h.flush({sourceLanguage:'pt-BR',language});await start(h);assert.equal(component(h,SpeakingGamePlayStep).props.language,language); }
h.dispose();assert.equal(timers.size,0);

// Stopping while a new round is pending cannot resurrect the session.
const stopping=new Harness(SpeakingGame,{sourceLanguage:'pt-BR',language:'en-US'});await start(stopping);
const oldPlay=component(stopping,SpeakingGamePlayStep);
oldPlay.props.onNext();stopping.flush();oldPlay.props.onStop();await settle(stopping);
assert.equal(component(stopping,SpeakingGamePlayStep),null);
assert.ok(component(stopping,SpeakingGameReadyStep));stopping.dispose();

// Failures remain local to the selected language and can be retried.
service.clearEnglishVerbsCache();
fetchImpl=async url=>({ok:false,status:503});
const failed=new Harness(SpeakingGame,{sourceLanguage:'pt-BR',language:'fr-FR'});failed.flush();component(failed,SpeakingGameSetupStep).props.onNext();failed.flush();component(failed,SpeakingGameReadyStep).props.onStart();await settle(failed);
assert.ok(named(failed.tree,'alert') || find(failed.tree,n=>n.props?.role==='alert'));
assert.equal(component(failed,SpeakingGamePlayStep),null);
fetchImpl=normalFetch;component(failed,SpeakingGameReadyStep).props.onStart();await settle(failed);assert.equal(component(failed,SpeakingGamePlayStep).props.language,'fr-FR');failed.dispose();

// Wrong-language payloads must be rejected instead of becoming a fallback.
service.clearEnglishVerbsCache();fetchImpl=async url=>({ok:true,json:async()=>JSON.parse(readFileSync(`public/english-${url.includes('verbs')?'verbs':url.includes('adjectives')?'adjectives':'nouns'}-common-en-US.json`,'utf8'))});
await assert.rejects(service.getSpeakingVocabulary('es-ES'),/idioma/);
fetchImpl=normalFetch;
// Real game handlers feed the existing clock; no wall time from setup or pauses.
const { StudyClock, IDLE_MS } = load('src/features/study/studyTrackingService.ts');
now = new Date(2026, 9, 17, 10).getTime();
const studyClock = new StudyClock(() => 'game-study');
let studyLanguage = 'en-US', lastSignal;
const reportStudy = (active, mode, until) => {
  lastSignal = { active, until };
  studyClock.set({ module: 'speaking-game', language: studyLanguage, mode }, active, now, until);
};
const tracked = new Harness(SpeakingGame, { language: studyLanguage, sourceLanguage: 'pt-BR', onStudyState: reportStudy });
tracked.flush(); assert.equal(lastSignal.active, false); assert.equal(studyClock.snapshot(now), null);
await start(tracked, { timeMode: 'manual' }); assert.equal(lastSignal.active, true);
const advanceStudy = seconds => { for (let i = 0; i < seconds; i++) { now += 1000; studyClock.snapshot(now); } };
advanceStudy(65); assert.equal(studyClock.snapshot(now).activeSeconds, 65);
component(tracked, SpeakingGamePlayStep).props.onPause(); tracked.flush();
advanceStudy(120); assert.equal(studyClock.snapshot(now).activeSeconds, 65);
tracked.tree.props.onPointerDown({ isTrusted: true }); tracked.flush();
assert.equal(lastSignal.active, false, 'paused interactions never resume study');
component(tracked, SpeakingGamePlayStep).props.onResume(); tracked.flush();
advanceStudy(10); assert.equal(studyClock.snapshot(now).activeSeconds, 75);
tracked.tree.props.onInput({ isTrusted: false }); tracked.flush();
const previousDeadline = lastSignal.until;
advanceStudy(10); tracked.tree.props.onKeyDown({ isTrusted: true }); tracked.flush();
assert.ok(lastSignal.until > previousDeadline);
advanceStudy(IDLE_MS / 1000 + 60);
assert.equal(studyClock.snapshot(now).activeSeconds, 385, 'idle adds only five minutes since last interaction');
component(tracked, SpeakingGamePlayStep).props.onStop(); tracked.flush();
advanceStudy(60); assert.equal(lastSignal.active, false); assert.equal(studyClock.snapshot(now).activeSeconds, 385);
component(tracked, SpeakingGameReadyStep).props.onStart(); await settle(tracked); advanceStudy(5);
tracked.flush({ language: 'fr-FR', sourceLanguage: 'pt-BR', onStudyState: reportStudy });
assert.equal(lastSignal.active, false, 'language change stops the old practice');
tracked.dispose(); assert.equal(lastSignal.active, false, 'unmount stops reporting');
assert.equal(timers.size, 0);
console.log('PASS Speaking study: setup exclusion, 65 seconds, explicit pause/resume, trusted activity, five-minute idle, stop, language and unmount.');
Date.now=oldDateNow;
assert.equal(timers.size,0);
console.log('Speaking Game: nine catalogs, English preservation, localized morphology, compatible forms, cache isolation, manual/automatic and sequential/random modes, timers, pause/resume/stop, language changes, stale requests, errors/retry and Translate passed.');
console.log(JSON.stringify({catalogCounts:counts,trainingForms:17,originalEnglishMetadataWarning:'130 verbs; totalVerbs remains 99 to preserve original metadata'}));

