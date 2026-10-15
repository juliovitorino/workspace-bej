import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { locales, outputRoot, read, write, digest, hashSet, equalSets, uuidPattern, migrateIntention } from './migration-v4-common.mjs';

const errors = [];
const warnings = [];
const hashes = {};
const catalogs = {};
const fail = (file, message, details = {}) => errors.push({ file, message, ...details });
function load(file) {
  try { return read(file); } catch (error) { fail(file, `JSON indisponivel ou invalido: ${error.code ?? 'sintaxe'}`); return null; }
}
function ids(items, file, context, uuid = false) {
  const result = new Set();
  for (const [index, item] of items.entries()) {
    if (typeof item.id !== 'string' || !item.id || (uuid && !uuidPattern.test(item.id))) fail(file, 'Identificador ausente ou invalido.', { ...context, position: index + 1 });
    else {
      if (result.has(item.id)) fail(file, 'Identificador duplicado.', { ...context, position: index + 1 });
      result.add(item.id);
    }
  }
  return result;
}
const report = load(path.join(outputRoot, 'migration-report.json'));
const stateFile = path.join(outputRoot, 'applied-state.json');
const applied = fs.existsSync(stateFile) ? load(stateFile) : null;
const sourceFile = file => applied?.files[file]?.backup ?? file;
if (report) for (const [file, expected] of Object.entries(report.sources)) {
  const original = sourceFile(file);
  if (!fs.existsSync(original) || digest(fs.readFileSync(original)) !== expected) fail(file, 'Origem ou backup alterado desde a migracao.');
  if (applied?.files[file] && (!fs.existsSync(file) || digest(fs.readFileSync(file)) !== digest(fs.readFileSync(path.join(outputRoot, file))))) fail(file, 'Arquivo aplicado diverge da versao preparada.');
}
for (const locale of locales) {
  const relative = `public/sample-hashmap-${locale}.json`;
  const file = path.join(outputRoot, relative);
  const data = load(file);
  if (!data) continue;
  if (!Array.isArray(data.mentalMap) || !data.metadata) { fail(relative, 'Raiz metadata/mentalMap obrigatoria.'); continue; }
  catalogs[locale] = data;
  const intentionIds = ids(data.mentalMap, relative, {});
  if (data.metadata.schemaVersion !== '4.0.0' || 'targetStudent' in data.metadata) fail(relative, 'Metadata fora do contrato 4.0.');
  if (data.metadata.totalIntentions !== data.mentalMap.length) fail(relative, 'totalIntentions diverge da quantidade real.');
  const source = load(sourceFile(relative));
  const exampleKeys = [];
  const allExampleIds = new Set();
  for (const [index, item] of data.mentalMap.entries()) {
    const context = { intention: item.intention, position: index + 1 };
    for (const field of ['id', 'intention', 'structure', 'level', 'pattern', 'description', 'category', 'searchTerms', 'validationPatterns', 'examples', 'tags', 'related']) {
      if (!(field in item)) fail(relative, `Campo obrigatorio ausente: ${field}`, context);
    }
    if ('english' in item || 'englishLevel' in item) fail(relative, 'Campos antigos nao foram renomeados.', context);
    if (!Array.isArray(item.examples) || !Array.isArray(item.related)) { fail(relative, 'examples/related devem ser listas.', context); continue; }
    ids(item.examples, relative, context, true);
    for (const [exampleIndex, example] of item.examples.entries()) {
      const detail = { ...context, example: exampleIndex + 1 };
      if (allExampleIds.has(example.id)) fail(relative, 'UUID de exemplo reutilizado em outra entrada.', detail);
      allExampleIds.add(example.id);
      exampleKeys.push(`${item.id}\t${example.id}`);
      if (typeof example.exampleItem !== 'string' || !example.exampleItem || typeof example.intent !== 'string' || !example.intent) fail(relative, 'Texto ou destaque obrigatorio ausente.', detail);
      if (['pt', 'en', 'ptIntent', 'enIntent'].some(field => field in example)) fail(relative, 'Exemplo ainda usa campos bilingues antigos.', detail);
    }
    for (const related of item.related) if (!intentionIds.has(related)) fail(relative, 'Referencia related inexistente.', context);
    if (source?.mentalMap[index]) {
      const expected = migrateIntention(source.mentalMap[index], locale, (_, exampleIndex) => item.examples[exampleIndex]?.id);
      if (!isDeepStrictEqual(expected, item)) fail(relative, 'Conteudo original alterado alem da conversao autorizada.', context);
    }
  }
  if (source) {
    const { targetStudent, ...metadata } = source.metadata;
    if (!isDeepStrictEqual(data.metadata, { ...metadata, schemaVersion: '4.0.0' })) fail(relative, 'Metadata original nao preservada.');
    if (source.mentalMap.length !== data.mentalMap.length) fail(relative, 'Quantidade de intencoes alterada.');
    const { mentalMap: oldMap, metadata: oldMeta, ...oldRoot } = source;
    const { mentalMap: newMap, metadata: newMeta, ...newRoot } = data;
    if (!isDeepStrictEqual(oldRoot, newRoot)) fail(relative, 'Campos adicionais da raiz alterados.');
  }
  hashes[locale] = { intentions: hashSet(intentionIds), intentionExamples: hashSet(exampleKeys) };
}
const reference = catalogs['en-US'];
if (reference) for (const locale of locales.filter(value => value !== 'en-US')) {
  const data = catalogs[locale];
  if (!data) continue;
  const target = new Map(data.mentalMap.map(item => [item.id, item]));
  const referenceIds = new Set(reference.mentalMap.map(item => item.id));
  if (!equalSets(referenceIds, new Set(target.keys()))) fail(locale, 'Conjunto de intencoes diverge do ingles.', {
    missing: reference.mentalMap.filter(item => !target.has(item.id)).map(item => item.intention),
    extra: data.mentalMap.filter(item => !referenceIds.has(item.id)).map(item => item.intention),
  });
  for (const item of reference.mentalMap) {
    const other = target.get(item.id);
    if (!other) continue;
    const expected = new Set(item.examples.map(example => example.id));
    const actual = new Set(other.examples.map(example => example.id));
    if (!equalSets(expected, actual)) fail(locale, 'Conjunto de exemplos diverge do ingles.', {
      intention: item.intention,
      missingExamples: item.examples.flatMap((example, index) => actual.has(example.id) ? [] : [index + 1]),
      extraExamples: other.examples.flatMap((example, index) => expected.has(example.id) ? [] : [index + 1]),
    });
  }
}
const storyKeys = Object.fromEntries(locales.map(locale => [locale, new Set()]));
const storyIds = new Set();
for (const filename of fs.readdirSync('src/data/stories').filter(file => /^stories-[abc][12]\.json$/.test(file)).sort()) {
  const relative = `src/data/stories/${filename}`;
  const data = load(path.join(outputRoot, relative));
  const source = load(sourceFile(relative));
  if (!data || !Array.isArray(data.stories)) { fail(relative, 'Lista de historias ausente.'); continue; }
  ids(data.stories, relative, {});
  const stripped = structuredClone(data);
  for (const [storyIndex, story] of data.stories.entries()) {
    if (storyIds.has(story.id)) fail(relative, 'Historia duplicada entre arquivos.', { story: story.titlePt });
    storyIds.add(story.id);
    if (story.englishLevel?.toLowerCase() !== filename.slice(8, 10)) fail(relative, 'Nivel CEFR diverge do arquivo.', { story: story.titlePt });
    ids(story.paragraphs, relative, { story: story.titlePt }, true);
    for (const [index, paragraph] of story.paragraphs.entries()) {
      for (const locale of locales) {
        if (typeof paragraph[locale.slice(0, 2)] !== 'string' || !paragraph[locale.slice(0, 2)]) fail(relative, 'Traducao de paragrafo ausente.', { story: story.titlePt, paragraph: index + 1, locale });
        else storyKeys[locale].add(`${story.id}\t${paragraph.id}`);
      }
      if (!source?.stories[storyIndex]?.paragraphs[index]?.id) delete stripped.stories[storyIndex].paragraphs[index].id;
    }
  }
  if (source && !isDeepStrictEqual(source, stripped)) fail(relative, 'Conteudo original de historias alterado.');
}
for (const locale of locales) {
  hashes[locale] ??= {};
  hashes[locale].storyParagraphs = hashSet(storyKeys[locale]);
  if (!equalSets(storyKeys['en-US'], storyKeys[locale])) fail(locale, 'Conjunto historia/paragrafo diverge.');
}
for (const category of ['verbs', 'adjectives', 'nouns']) {
  const sets = {};
  for (const locale of locales.filter(value => value !== 'pt-BR')) {
    const file = `public/english-${category}-common-${locale}.json`;
    const data = load(file);
    if (!data || !Array.isArray(data[category])) { fail(file, 'Lista de vocabulario ausente.'); continue; }
    sets[locale] = ids(data[category], file, {});
    hashes[locale][category] = hashSet(sets[locale]);
    const total = `total${category[0].toUpperCase()}${category.slice(1)}`;
    if (typeof data.metadata?.[total] === 'number' && data.metadata[total] !== data[category].length) warnings.push({ file, message: `${total} diverge da quantidade real; arquivo preservado.` });
  }
  for (const locale of ['es-ES', 'fr-FR']) if (sets['en-US'] && sets[locale] && !equalSets(sets['en-US'], sets[locale])) warnings.push({ file: locale,
    message: `IDs de ${category} nao equivalentes ao ingles; relacao universal nao confirmada.`,
    missingCount: [...sets['en-US']].filter(id => !sets[locale].has(id)).length,
    extraCount: [...sets[locale]].filter(id => !sets['en-US'].has(id)).length });
}
if (report?.issues?.length) fail('migration-report.json', 'Associacoes de exemplos aguardam revisao.', { count: report.issues.length });
const result = { status: errors.length ? 'review-required' : 'valid', errors, warnings, hashes };
write(path.join(outputRoot, 'validation-report.json'), result);
console.log(`Integridade 4.0: ${errors.length} falhas, ${warnings.length} avisos. Relatorio: migration-output/v4/validation-report.json`);
process.exitCode = errors.length ? 1 : 0;
