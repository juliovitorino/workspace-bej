import fs from 'node:fs';
import path from 'node:path';
import { locales, outputRoot, read, write, digest, anchor, assigned, migrateIntention } from './migration-v4-common.mjs';

// Outputs are intentionally isolated from the files consumed by the current app.
if (fs.existsSync(path.join(outputRoot, 'applied-state.json'))) {
  console.log('Migracao ja aplicada. UUIDs preservados; use validate-v4.mjs para verificar os arquivos e backups.');
  process.exit(0);
}
const manifestFile = path.join(outputRoot, 'identifier-map.json');
const manifest = fs.existsSync(manifestFile) ? read(manifestFile) : { version: 1, examples: {}, paragraphs: {} };
const catalogs = Object.fromEntries(locales.map(locale => [locale, read(`public/sample-hashmap-${locale}.json`)]));
const lookup = Object.fromEntries(locales.map(locale => [locale, new Map(catalogs[locale].mentalMap.map(item => [item.id, item]))]));
const issues = [];
const sources = {};
const outputs = [];
const inventory = {};
const fields = items => [...new Set(items.flatMap(item => Object.keys(item)))].sort();
for (const locale of locales) {
  const source = `public/sample-hashmap-${locale}.json`;
  sources[source] = digest(fs.readFileSync(source));
  const data = catalogs[locale];
  inventory[source] = { intentions: data.mentalMap.length,
    examples: data.mentalMap.reduce((sum, item) => sum + item.examples.length, 0),
    rootFields: Object.keys(data), metadataFields: Object.keys(data.metadata),
    intentionFields: fields(data.mentalMap), exampleFields: fields(data.mentalMap.flatMap(item => item.examples)) };
  const { targetStudent, ...metadata } = data.metadata;
  const mentalMap = data.mentalMap.map(item => {
    const occurrences = new Map();
    return migrateIntention(item, locale, (example, index) => {
      const reference = anchor(example);
      const matches = locales.map(other => lookup[other].get(item.id)?.examples.filter(value => anchor(value) === reference) ?? []);
      const unique = typeof example.pt === 'string' && typeof example.ptIntent === 'string' && matches.every(values => values.length <= 1);
      const occurrence = occurrences.get(reference) ?? 0;
      occurrences.set(reference, occurrence + 1);
      // No matching by array index: ambiguous anchors get locale-local identities.
      const fingerprint = unique ? [item.id, reference] : [locale, item.id, reference, example.en, example.enIntent, occurrence];
      if (!unique || matches.some(values => values.length === 0)) issues.push({ locale, intention: item.intention,
        example: index + 1, portuguese: example.pt,
        reason: unique ? 'Referencia portuguesa ausente em outro idioma; revisar equivalencia/traducao.' : 'Referencia portuguesa repetida; associacao semantica manual necessaria.' });
      return assigned(manifest.examples, digest(JSON.stringify(fingerprint)), example.id);
    });
  });
  outputs.push([path.join(outputRoot, source), { ...data, metadata: { ...metadata, schemaVersion: '4.0.0' }, mentalMap }]);
}
for (const filename of fs.readdirSync('src/data/stories').filter(file => /^stories-[abc][12]\.json$/.test(file)).sort()) {
  const source = `src/data/stories/${filename}`;
  sources[source] = digest(fs.readFileSync(source));
  const data = read(source);
  inventory[source] = { stories: data.stories.length,
    paragraphs: data.stories.reduce((sum, story) => sum + story.paragraphs.length, 0),
    rootFields: Object.keys(data), storyFields: fields(data.stories),
    paragraphFields: fields(data.stories.flatMap(story => story.paragraphs)) };
  const seen = new Map();
  const stories = data.stories.map(story => ({ ...story, paragraphs: story.paragraphs.map(paragraph => {
    const fingerprint = digest(JSON.stringify([story.id, paragraph.pt, paragraph.en]));
    const occurrence = seen.get(fingerprint) ?? 0;
    seen.set(fingerprint, occurrence + 1);
    return { ...paragraph, id: assigned(manifest.paragraphs, `${fingerprint}:${occurrence}`, paragraph.id) };
  }) }));
  outputs.push([path.join(outputRoot, source), { ...data, stories }]);
}
for (const category of ['verbs', 'adjectives', 'nouns']) {
  for (const locale of locales.filter(value => value !== 'pt-BR')) {
    const source = `public/english-${category}-common-${locale}.json`;
    const data = read(source);
    sources[source] = digest(fs.readFileSync(source));
    inventory[source] = { entries: data[category].length, rootFields: Object.keys(data),
      metadataFields: Object.keys(data.metadata ?? {}), entryFields: fields(data[category]) };
  }
}
// Persist assignments before outputs so reruns recover the same identifiers.
write(manifestFile, manifest);
for (const [file, data] of outputs) write(file, data);
write(path.join(outputRoot, 'migration-report.json'), {
  schemaVersion: '4.0.0', status: issues.length ? 'review-required' : 'prepared', sources,
  inventory,
  matchingRule: 'Exact Portuguese text and highlighted span, unique within each intention; never positional.',
  caveats: ['Portuguese structural grammar remains unchanged from its source catalog.', 'Vocabulary preserved in public; no cross-language equivalence assumed.'],
  issues,
});
console.log(`Migracao preparada: ${outputs.length} arquivos; ${issues.length} ocorrencias para revisao. Originais preservados.`);
