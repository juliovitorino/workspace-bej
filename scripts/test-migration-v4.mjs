import test from 'node:test';
import assert from 'node:assert/strict';
import { assigned, anchor, equalSets, hashSet, migrateIntention } from './migration-v4-common.mjs';

const item = {
  id: 'existing-intention', intention: 'Example', english: 'Structure', englishLevel: 'A1',
  pattern: 'original', validationPatterns: ['original'], allowLanguageChunkPractice: true,
  custom: { preserve: true }, youtubeVideo: 'local-video',
  examples: [{ pt: 'Uma frase.', en: 'A sentence.', ptIntent: 'frase', enIntent: 'sentence', hqImage: 'local-image', custom: 3 }],
};
test('conversion preserves unknown fields, original identifiers, regex and local media', () => {
  const before = structuredClone(item);
  const output = migrateIntention(item, 'en-US', () => 'example-id');
  assert.equal(output.id, item.id);
  assert.equal(output.structure, item.english);
  assert.equal(output.level, item.englishLevel);
  assert.equal(output.youtubeVideo, item.youtubeVideo);
  assert.deepEqual(output.validationPatterns, item.validationPatterns);
  assert.deepEqual(output.custom, item.custom);
  assert.deepEqual(output.examples[0], { id: 'example-id', exampleItem: 'A sentence.', intent: 'sentence', hqImage: 'local-image', custom: 3 });
  assert.ok(!('english' in output));
  assert.ok(!('englishLevel' in output));
  assert.deepEqual(item, before);
});
test('Portuguese uses source text and span, while destination locales use their own text', () => {
  for (const locale of ['pt-BR', 'en-US', 'es-ES', 'fr-FR']) {
    const example = migrateIntention(item, locale, () => 'example-id').examples[0];
    assert.equal(example.exampleItem, locale === 'pt-BR' ? item.examples[0].pt : item.examples[0].en);
    assert.equal(example.intent, locale === 'pt-BR' ? item.examples[0].ptIntent : item.examples[0].enIntent);
  }
});
test('UUID assignments persist on rerun and reject conflicting existing identifiers', () => {
  const manifest = {};
  const id = assigned(manifest, 'key');
  assert.equal(assigned(manifest, 'key'), id);
  assert.equal(assigned(manifest, 'key', id), id);
  assert.throws(() => assigned(manifest, 'key', 'not-a-uuid'));
  assert.throws(() => assigned(manifest, 'key', assigned({}, 'other')));
});
test('relationship hashes ignore ordering and translated content, while set checks detect differences', () => {
  assert.equal(hashSet(['b', 'a']), hashSet(['a', 'b']));
  assert.notEqual(hashSet(['a']), hashSet(['a', 'b']));
  assert.ok(equalSets(new Set(['a', 'b']), new Set(['b', 'a'])));
  assert.ok(!equalSets(new Set(['a']), new Set(['b'])));
});
test('matching anchor includes the Portuguese highlighted span and ignores locale-local media', () => {
  assert.equal(anchor(item.examples[0]), anchor({ ...item.examples[0], en: 'Une phrase.', hqImage: 'other' }));
  assert.notEqual(anchor(item.examples[0]), anchor({ ...item.examples[0], ptIntent: 'Uma frase' }));
});
test('migration refuses to overwrite a conflicting unknown destination field', () => {
  assert.throws(() => migrateIntention({ ...item, structure: 'different' }, 'en-US', () => 'id'));
});
