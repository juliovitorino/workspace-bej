import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateCatalog } from './validate-small-talk.mjs';

const catalogRoot = 'public/small-talk';
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));

test('o catálogo en-US é estruturalmente válido e IDs são únicos', () => {
  const result = validateCatalog(catalogRoot);
  const index = readJson(`${catalogRoot}/index.json`);
  assert.deepEqual(result.errors, [], JSON.stringify(result.errors));
  assert.equal(result.summary.topics, index.topics.length);
  assert.equal(new Set(index.topics.map(topic => topic.order)).size, index.topics.length);
  assert.equal(result.summary.uniqueItemIds, result.summary.items);
  assert.ok(result.summary.items > 0);
});

test('pendências editoriais são sinalizadas sem impedir leitura do staging', () => {
  const result = validateCatalog(catalogRoot);
  assert.ok(result.summary.unclassifiedItems > 0);
  assert.ok(result.summary.unclassifiedItems <= result.summary.items);
  assert.ok(result.warnings.some(w => w.code === 'STAGING_NOT_APPROVED_FOR_DEPLOY'));
});

test('Indonésia está indexada e seus 10 cards respeitam o contrato do Small Talk', () => {
  const index = readJson(`${catalogRoot}/index.json`);
  const topic = readJson(`${catalogRoot}/en-US/topics/indonesia.json`);
  const entry = index.topics.find(item => item.id === 'indonesia');
  assert.equal(entry?.enabled, true);
  assert.equal(entry?.order, 59);
  assert.equal(topic.topicId, 'indonesia');
  assert.equal(topic.locale, 'en-US');
  assert.equal(topic.items.length, 10);
  assert.deepEqual(topic.items.map(item => item.order), Array.from({ length: 10 }, (_, i) => i + 1));
  assert.deepEqual(topic.items.map(item => item.source.paragraphIndex), Array.from({ length: 10 }, (_, i) => i + 1));
  assert.ok(topic.items.every(item => item.question?.text?.trim() && item.answer?.text?.trim()));
});
