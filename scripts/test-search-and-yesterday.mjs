import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';

const require = createRequire(import.meta.url), modules = new Map();
function load(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} }; modules.set(file, module);
  const source = fs.readFileSync(file, 'utf8').replaceAll('import.meta.env', '({})')
    .replaceAll('import.meta.url', JSON.stringify('file:///search-yesterday-tests/entry.js'));
  const code = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 } }).outputText;
  const localRequire = name => {
    if (name.endsWith('/i18n')) return { t: key => key };
    if (name.endsWith('/cacheService')) return { saveHashmapCache() {} };
    if (!name.startsWith('.')) return require(name);
    const base = path.resolve(path.dirname(file), name);
    return load([base + '.ts', base + '.tsx'].find(fs.existsSync));
  };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(localRequire, module, module.exports);
  return module.exports;
}
const { searchIntentions, globalSearch } = load('src/utils/searchIntentions.ts');
const { fetchHashmap } = load('src/services/hashmapService.ts');
const originalFetch = globalThis.fetch;
globalThis.fetch = async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync('public' + url, 'utf8')) });
let catalog;
try { catalog = await fetchHashmap('en-US', 'pt-BR'); }
finally { globalThis.fetch = originalFetch; }
const sentence = "That was the hardest problem I've ever solved.";
const item = catalog.mentalMap.find(i => i.examples.some(e => e.exampleItem === sentence));
assert.ok(item, 'real catalog example survives the actual normalization/loading service');
const actualExample = item.examples.find(e => e.exampleItem === sentence);
console.log('Search investigation:', { intentionId: item.id, exampleId: actualExample.id,
  apostrophe: 'U+' + sentence.codePointAt(sentence.indexOf("'")).toString(16).padStart(4, '0'),
  straightMatchesBeforeAssertions: globalSearch([item], "I've ever").length,
  curvedMatchesBeforeAssertions: globalSearch([item], 'I’ve ever').length });
for (const [query, text] of [
  ['run every', 'I run every day.'],
  ["I've ever", sentence], ["I've ever", sentence.replace("'", '’')],
  ['I’ve ever', sentence], ["i've EVER", sentence], ['ever solved', sentence],
  ['I‘ve ever', sentence], ["I've ever", sentence.replace("'", '‘')],
  ["l'ete", 'Pendant l’été.']
]) {
  // Isolate example text so matching intention labels cannot hide a regression.
  const fixture = { id: 'fixture', intention: '', english: '', examples: [{ id: 'example', exampleItem: text, en: text, pt: '' }] };
  assert.equal(searchIntentions([fixture], '', query, '', [], '').length, 1, `${query} matches ${text}`);
  assert.equal(globalSearch([fixture], query).length, 1, `global: ${query} matches ${text}`);
}
const isolated = { id: 'isolated', intention: '', english: '', examples: [{ id: 'example', exampleItem: sentence, en: sentence, pt: '' }] };
for (const query of ['ever I’ve', 'Ive ever']) assert.equal(globalSearch([isolated], query).length, 0, 'preserve order and apostrophe boundaries');
assert.ok(searchIntentions(catalog.mentalMap, '', 'I’ve ever', '', [], '').some(i => i.id === item.id));
assert.ok(globalSearch(catalog.mentalMap, 'I’ve ever').some(i => i.id === item.id));
console.log('PASS search: real catalog loader, target/global search, apostrophe variants, case, accents, term order and punctuation boundaries.');

const { studyStats } = load('src/features/study/studyStats.ts');
const filters = { language: 'all', module: 'all', mode: 'all', period: 'yesterday', from: '', to: '' };
const empty = { sessions: [], manualAdjustments: [], goals: {}, monthlyGoals: {} };
for (const [now, expected] of [[new Date(2026, 0, 1, 0, 5), '2025-12-31'], [new Date(2026, 2, 1), '2026-02-28'], [new Date(2024, 2, 1), '2024-02-29'], [new Date(2026, 9, 19, 23, 59), '2026-10-18']]) {
  const yesterday = studyStats(empty, filters, now), today = studyStats(empty, { ...filters, period: 'today' }, now);
  assert.equal(yesterday.from, expected); assert.equal(yesterday.to, expected);
  assert.notEqual(today.from, yesterday.from); assert.equal(yesterday.total, 0);
}
const now = new Date(2026, 0, 1, 0, 5);
const data = { ...empty, manualAdjustments: [
  { id: 'old', language: 'en-US', date: '2025-12-30', seconds: 60 },
  { id: 'yesterday', language: 'en-US', date: '2025-12-31', seconds: 120 },
  { id: 'today', language: 'en-US', date: '2026-01-01', seconds: 180 }
], sessions: [{ id: 'external', language: 'fr-FR', module: 'extra-activities', category: 'reading', mode: 'manual', startedAt: '2025-12-31T12:00:00', activeSeconds: 90, dailySeconds: { '2025-12-31': 90 } }] };
const yesterday = studyStats(data, filters, now);
assert.equal(yesterday.total, 210); assert.equal(yesterday.entries.length, 2);
assert.equal(yesterday.byLanguage['en-US'], 120); assert.equal(yesterday.timeline['2025-12-31'], 210);
assert.equal(studyStats(data, { ...filters, language: 'en-US' }, now).total, 120);
assert.equal(studyStats(data, { ...filters, origin: 'external', extraCategory: 'reading', module: 'extra-activities', mode: 'manual' }, now).total, 90);
assert.equal(studyStats(data, { ...filters, mode: 'walking' }, now).total, 0);
assert.equal(studyStats(data, { ...filters, period: 'today' }, now).total, 180);
assert.equal(studyStats(data, { ...filters, period: '7' }, now).total, 450);
console.log('PASS yesterday: local calendar, month/year/leap transitions, empty data, totals/charts/history and other filters.');
