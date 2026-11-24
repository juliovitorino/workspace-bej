import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync("src/utils/filteredIntentionCollection.ts", "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
});
const module = { exports: {} };
vm.runInNewContext(outputText, { module, exports: module.exports, Map, Error }, { filename: "filteredIntentionCollection.ts" });
const { selectOriginalIntentions } = module.exports;
const app = readFileSync("src/App.tsx", "utf8");
const service = readFileSync("src/services/hashmapService.ts", "utf8");

test("exporta registros V4 completos, sem aliases normalizados e na ordem do filtro", () => {
  const catalog = [
    { id: "a", intention: "Even if", structure: "even if + clause", examples: [{ id: "ex-a", exampleItem: "Even if it rains", intent: "Even if" }], tags: ["condition"], customOptionalField: { value: 42 } },
    { id: "b", intention: "Even though", examples: [{ id: "ex-b", exampleItem: "Even though it was late", intent: "Even though" }] },
    { id: "c", intention: "Not even", examples: [] }
  ];
  const filtered = selectOriginalIntentions(catalog, ["b", "a"]);
  assert.equal(filtered[0], catalog[1]);
  assert.equal(filtered[1], catalog[0]);
  const json = JSON.parse(JSON.stringify({ "collection-filtered": filtered }));
  assert.deepEqual(json["collection-filtered"], [catalog[1], catalog[0]]);
  assert.equal(json["collection-filtered"][1].customOptionalField.value, 42);
  assert.equal(json["collection-filtered"][1].examples[0].id, "ex-a");
  assert.equal(json["collection-filtered"][0].english, undefined);
});

test("falha em vez de exportar uma coleção parcial quando um ID não existe", () => {
  assert.throws(() => selectOriginalIntentions([{ id: "a", intention: "A" }], ["a", "missing"]), /missing/);
});

test("o botão de autor usa o resultado filtrado e a raiz collection-filtered", () => {
  assert.match(app, /authorMode && \(\s*<div className="hashmap-collection-control">/);
  assert.match(app, /filteredItems\.map\(item => item\.id\)/);
  assert.match(app, /getOriginalFilteredIntentions\(selectedLanguage, ids\)/);
  assert.match(app, /JSON\.stringify\(\{ "collection-filtered": originals \}, null, 2\)/);
  assert.match(app, /navigator\.clipboard\?\.writeText\(json\)/);
  assert.match(app, /document\.execCommand\("copy"\)/);
  assert.match(service, /selectOriginalIntentions\(catalog\.mentalMap, ids\)/);
});
