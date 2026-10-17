import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transpileModule } from 'typescript';

async function load(file) {
  const { outputText } = transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { target: 9, module: 99 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const { parseFavoriteChunks, toggleFavoriteChunk, readFavoriteChunks, FAVORITE_CHUNKS_KEY } = await load('src/utils/favoriteChunks.ts');
for (const raw of [null, '', '{', '{}', 'null', '42', '[null,{}, {"id":"x"}]']) assert.deepEqual(parseFavoriteChunks(raw), []);
const valid = parseFavoriteChunks(JSON.stringify([
  { id: 'x', language: 'en-US', text: 'must not be persisted' }, { id: 'x', language: 'en-US' },
  { id: 'x', language: 'es-ES' }, { id: '', language: 'fr-FR' }, { id: 'x', language: 'invalid' }
]));
assert.deepEqual(valid, [{ id: 'x', language: 'en-US' }, { id: 'x', language: 'es-ES' }]);
let stored = JSON.stringify(valid);
globalThis.localStorage = { getItem: key => { assert.equal(key, FAVORITE_CHUNKS_KEY); return stored; } };
assert.deepEqual(readFavoriteChunks(), valid);
const withoutSpanish = toggleFavoriteChunk(readFavoriteChunks(), 'x', 'es-ES');
assert.deepEqual(withoutSpanish, [{ id: 'x', language: 'en-US' }]);
stored = JSON.stringify(withoutSpanish);
assert.deepEqual(readFavoriteChunks(), withoutSpanish);
assert.deepEqual(toggleFavoriteChunk(withoutSpanish, 'x', 'es-ES'), valid);
globalThis.localStorage.getItem = () => { throw Error('unavailable'); };
assert.deepEqual(readFavoriteChunks(), []);

const { WalkingSession } = await load('src/utils/walkingSession.ts');
const session = new WalkingSession();
for (let i = 0; i < 2; i++) session.record(i, 'x', false);
session.record(1, 'x', false); // duplicate callback
assert.deepEqual(session.summary(2, 12), { completed: 0, total: 2, phrases: 2, seconds: 12 });
for (let i = 2; i < 5; i++) session.record(i, 'x', i === 4);
assert.deepEqual(session.summary(2, 15), { completed: 1, total: 2, phrases: 5, seconds: 15 });
session.record(5, 'x', true); // same chunk completed again in a later round
assert.equal(session.summary(2, 16).completed, 1);
assert.equal(session.summary(2, 16).phrases, 6);
assert.equal(session.summary(1, 17).completed, 1);
assert.equal(session.summary(0, 17).completed, 1); // removal never erases session history
assert.equal(new WalkingSession().summary(0, 0).phrases, 0);
console.log('Favorite persistence, malformed storage, language isolation, deduplication, session completion and callback deduplication passed.');
