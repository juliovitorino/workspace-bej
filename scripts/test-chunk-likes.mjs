import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";

const require = createRequire(import.meta.url);
const cache = new Map();
function load(file) {
  file = resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const output = transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 }
  }).outputText;
  vm.runInThisContext("(function(require,module,exports){" + output + "\n})", { filename: file })(
    name => {
      if (!name.startsWith(".")) return require(name);
      const base = resolve(dirname(file), name);
      const target = [base + ".ts", base + ".tsx", base].find(existsSync);
      if (!target) throw new Error("Missing dependency: " + name);
      return load(target);
    }, module, module.exports);
  return module.exports;
}

const likes = load("src/utils/chunkLikes.ts");
const data = new Map();
const storage = {
  getItem: key => data.get(key) ?? null,
  setItem: (key, value) => data.set(key, value),
  removeItem: key => data.delete(key)
};

test("compact storage uses only language, chunk ID, device ID, and positive count", () => {
  const first = likes.incrementChunkLike("en-US", "uuid-001", "device-a", storage);
  assert.equal(likes.chunkLikeTotal(first, "en-US", "uuid-001"), 1);
  likes.incrementChunkLike("en-US", "uuid-001", "device-a", storage);
  likes.incrementChunkLike("es-ES", "uuid-001", "device-a", storage);
  assert.deepEqual(JSON.parse(storage.getItem(likes.CHUNK_LIKES_KEY)), {
    "en-US": { "uuid-001": { "device-a": 2 } },
    "es-ES": { "uuid-001": { "device-a": 1 } }
  });
  assert.equal(likes.chunkLikeTotal(likes.readChunkLikes(storage), "fr-FR", "uuid-001"), 0);
});

test("merge uses per-device maximum; repeat and reversed order are idempotent", () => {
  const a = { "en-US": { "uuid-001": { "device-a": 3, "device-b": 2 } } };
  const b = { "en-US": { "uuid-001": { "device-a": 2, "device-b": 5 } }, "es-ES": { "uuid-001": { "device-c": 4 } } };
  const merged = likes.mergeChunkLikes(a, b);
  assert.equal(likes.chunkLikeTotal(merged, "en-US", "uuid-001"), 8);
  assert.equal(likes.chunkLikeTotal(merged, "es-ES", "uuid-001"), 4);
  assert.deepEqual(likes.mergeChunkLikes(merged, b), merged);
  assert.deepEqual(likes.mergeChunkLikes(b, a), merged);
  assert.deepEqual(a, { "en-US": { "uuid-001": { "device-a": 3, "device-b": 2 } } }, "merge must not mutate inputs");
});

test("malformed data is rejected instead of being silently overwritten", () => {
  for (const value of [null, [], { "en-US": { "id": { "device-a": -1 } } },
    { "en-US": { "id": { "device-a": 1.5 } } }, { "xx-XX": { id: { device: 1 } } }]) {
    assert.throws(() => likes.validateChunkLikes(value));
  }
  storage.setItem(likes.CHUNK_LIKES_KEY, "{not json");
  assert.throws(() => likes.readChunkLikes(storage), /Could not read/);
  assert.throws(() => likes.incrementChunkLike("en-US", "id", "device-a", storage), /Could not read/);
  assert.equal(storage.getItem(likes.CHUNK_LIKES_KEY), "{not json");
  storage.removeItem(likes.CHUNK_LIKES_KEY);
});


test("shared flashcard uses Google Translate SVG and like badge instead of training shortcuts", () => {
  const card = readFileSync("src/components/ChunkFlashcards.tsx", "utf8");
  assert.match(card, /<GoogleTranslateIcon size=\{26\} \/>/);
  assert.match(card, /onClick=\{translateChunk\}/);
  assert.match(card, /onClick=\{registerLike\}/);
  assert.match(card, /className="chunk-flashcards-like-count"/);
  assert.match(card, /encodeURIComponent\(text\)/);
  assert.doesNotMatch(card, /🚶🏻‍➡️|🏃|onBasicTraining\(origin!\)|onAdvancedTraining\(origin!\)/);
});
