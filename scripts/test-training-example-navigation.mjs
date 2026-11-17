import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const helper = await read("../src/utils/trainingExampleNavigation.ts");
const compiled = ts.transpileModule(helper, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const { trainingExampleIndex, nextTrainingExampleIndex } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);

assert.equal(trainingExampleIndex(0, 3), 0);
assert.equal(trainingExampleIndex(5, 3), 2);
assert.equal(trainingExampleIndex(5, 0), 0);
assert.equal(nextTrainingExampleIndex(0, 3), 1);
assert.equal(nextTrainingExampleIndex(1, 3), 2);
assert.equal(nextTrainingExampleIndex(2, 3), 0);
assert.equal(nextTrainingExampleIndex(0, 1), 0);
assert.equal(nextTrainingExampleIndex(0, 0), 0);

const navigator = await read("../src/components/TrainingExampleNavigator.tsx");
assert.match(navigator, /total > 1/);
assert.match(navigator, /aria-label=\{t\("common\.nextExample"\)\}/);
assert.match(navigator, /<svg/);
assert.match(navigator, /common\.countOfTotal/);

for (const component of ["BasicTraining", "AdvancedTraining"]) {
  const source = await read("../src/components/" + component + ".tsx");
  assert.match(source, /<TrainingExampleNavigator/);
  assert.match(source, /useState\(0\)/);
  assert.match(source, /setSelectedExampleIndex\(0\).*\[intention\.id\]/);
  assert.match(source, /nextTrainingExampleIndex\(current, exampleCount\)/);
  assert.match(source, /referenceExample\.(pt|en)/);
}
const basic = await read("../src/components/BasicTraining.tsx");
const basicPrint = basic.slice(basic.indexOf('className="basic-training-print-sheet"'));
assert.match(basicPrint, /printReferenceExample\.pt/);
assert.doesNotMatch(basicPrint, /referenceExample\.pt/, "Printing must not follow manual browsing");
const advanced = await read("../src/components/AdvancedTraining.tsx");
const display = advanced.slice(advanced.indexOf('className="training-page-header"'), advanced.indexOf('className="training-instruction"'));
assert.doesNotMatch(display, /intention\.examples\[0\]/, "Advanced training display must use the selected example");

for (const locale of ["pt-BR", "en-US", "es-ES", "fr-FR"]) {
  const translations = JSON.parse(await read("../src/i18n/locales/" + locale + ".json"));
  assert.ok(translations.common.nextExample, locale + " missing nextExample");
  assert.ok(translations.common.countOfTotal, locale + " missing countOfTotal");
}
console.log("BEJ Basic/Advanced example navigation tests passed.");
