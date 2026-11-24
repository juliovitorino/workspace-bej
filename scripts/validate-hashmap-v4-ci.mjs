import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const languages = ["pt-BR", "en-US", "es-ES", "fr-FR"];
const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const nonEmpty = value => typeof value === "string" && value.trim().length > 0;
const errors = [];
const check = (ok, message) => { if (!ok) errors.push(message); };

for (const language of languages) {
  const path = `public/sample-hashmap-${language}.json`;
  const catalog = JSON.parse(readFileSync(path, "utf8"));
  const { metadata, mentalMap } = catalog;
  check(metadata?.schemaVersion === "4.0.0", `${path}: expected schemaVersion 4.0.0`);
  check(metadata?.language === language, `${path}: wrong metadata.language`);
  check(Array.isArray(mentalMap) && mentalMap.length > 0, `${path}: missing mentalMap`);
  if (!Array.isArray(mentalMap)) continue;
  check(metadata?.totalIntentions === mentalMap.length, `${path}: totalIntentions differs from catalog length`);
  const ids = new Set();
  let examples = 0;
  for (const [index, item] of mentalMap.entries()) {
    const label = `${language}/intention ${index + 1}`;
    if (!item || typeof item !== "object") { check(false, `${label}: invalid record`); continue; }
    check(nonEmpty(item.id) && uuid.test(item.id), `${label}: invalid ID/UUID`);
    check(!ids.has(item.id), `${label}: duplicate ID ${item.id}`);
    ids.add(item.id);
    check(nonEmpty(item.intention), `${label}: missing intention`);
    for (const field of ["structure", "pattern", "description", "category"]) {
      if (item[field] !== undefined) check(typeof item[field] === "string", `${label}: invalid ${field}`);
    }
    if (item.level !== undefined) check(["A1", "A2", "B1", "B2", "C1", "C2"].includes(item.level), `${label}: invalid level`);
    for (const field of ["searchTerms", "tags", "related", "validationPatterns"]) {
      if (item[field] !== undefined)
        check(Array.isArray(item[field]) && item[field].every(v => typeof v === "string"), `${label}: invalid ${field}`);
    }
    if (item.validationPatterns && Array.isArray(item.validationPatterns)) {
      for (const pattern of item.validationPatterns) {
        try { new RegExp(pattern, "i"); } catch { check(false, `${label}: invalid validation regex`); }
      }
    }
    check(Array.isArray(item.examples), `${label}: missing examples array`);
    if (!Array.isArray(item.examples)) continue;
    const exampleIds = new Set();
    for (const [n, example] of item.examples.entries()) {
      examples++;
      const exampleLabel = `${label}/example ${n + 1}`;
      if (!example || typeof example !== "object") { check(false, `${exampleLabel}: invalid record`); continue; }
      check(nonEmpty(example.id) && uuid.test(example.id), `${exampleLabel}: invalid UUID`);
      check(!exampleIds.has(example.id), `${exampleLabel}: duplicate example UUID`);
      exampleIds.add(example.id);
      check(nonEmpty(example.exampleItem), `${exampleLabel}: missing exampleItem`);
      check(typeof example.intent === "string", `${exampleLabel}: missing intent`);
    }
  }
  console.log(`${language}: ${mentalMap.length} intentions, ${examples} examples checked (V4)`);
}
if (errors.length) {
  console.error(`${errors.length} catalog validation error(s):`);
  for (const error of errors.slice(0, 30)) console.error(error);
  if (errors.length > 30) console.error(`... and ${errors.length - 30} more`);
  process.exitCode = 1;
} else {
  console.log("All V4 catalog structures passed.");
}
