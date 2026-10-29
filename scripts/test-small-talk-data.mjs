import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCatalog } from './validate-small-talk.mjs';

test('o catálogo en-US é estruturalmente válido e IDs são únicos', () => {
  const result=validateCatalog('public/small-talk');
  assert.deepEqual(result.errors, [], JSON.stringify(result.errors));
  assert.equal(result.summary.topics,55);
  assert.equal(result.summary.items,603);
  assert.equal(result.summary.uniqueItemIds,603);
});

test('pendências editoriais são sinalizadas sem impedir leitura do staging', () => {
  const result=validateCatalog('public/small-talk');
  assert.equal(result.summary.unclassifiedItems,603);
  assert.ok(result.warnings.some(w=>w.code==='STAGING_NOT_APPROVED_FOR_DEPLOY'));
});
