import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const languages = ["en-US", "es-ES", "fr-FR"];
const data = Object.fromEntries(languages.map(language => [language,
  JSON.parse(readFileSync(resolve(root, `public/sample-hashmap-${language}.json`), "utf8"))
]));
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const normalize = value => value.normalize("NFKC").replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
const baseline = data["en-US"].mentalMap;
const requestedLanguage = process.argv.find(value => value.startsWith("--language="))?.split("=")[1];
if (requestedLanguage && !languages.includes(requestedLanguage)) throw new Error("Unknown language");
const validatorSource = readFileSync(resolve(root, "src/services/intentionValidator.ts"), "utf8");
const compiled = ts.transpileModule(validatorSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
}).outputText;
const { validateIntention } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

for (const language of languages) {
  if (requestedLanguage && requestedLanguage !== language) continue;
  const { metadata, mentalMap } = data[language];
  const ids = new Set(mentalMap.map(item => item.id));
  check(metadata.targetStudent === language, `${language}: incorrect targetStudent`);
  check(metadata.language === "pt-BR", `${language}: incorrect source language`);
  check(metadata.totalIntentions === mentalMap.length, `${language}: incorrect totalIntentions`);
  for (const field of ["name", "version", "language", "source", "sourceBuild"]) {
    check(same(metadata[field], data["en-US"].metadata[field]), `${language}: shared metadata ${field} differs`);
  }
  check(ids.size === mentalMap.length, `${language}: duplicate IDs`);
  check(same(mentalMap.map(item => item.id), baseline.map(item => item.id)), `${language}: IDs or order differ`);
  let examples = 0;
  let untranslatedItems = 0;
  let untranslatedExamples = 0;
  for (const [index, item] of mentalMap.entries()) {
    const label = `${language}/${item.id}`;
    const source = baseline[index];
    check(same(Object.keys(item).sort(), Object.keys(source).sort()), `${label}: fields differ`);
    for (const field of ["id", "intention", "english", "pattern", "description", "category", "englishLevel"]) {
      check(typeof item[field] === "string" && item[field].trim().length > 0, `${label}: invalid ${field}`);
    }
    check(["A1", "A2", "B1", "B2", "C1", "C2"].includes(item.englishLevel), `${label}: invalid level`);
    for (const field of ["searchTerms", "tags", "related", "validationPatterns"]) {
      check(Array.isArray(item[field]) && item[field].every(value => typeof value === "string"), `${label}: invalid ${field}`);
    }
    check(item.allowLanguageChunkPractice === undefined || typeof item.allowLanguageChunkPractice === "boolean", `${label}: invalid practice flag`);
    for (const field of ["intention", "category", "englishLevel", "tags", "related", "allowLanguageChunkPractice", "youtubeVideo", "youtubeShort"]) {
      check(same(item[field], source[field]), `${label}: shared field ${field} differs`);
    }
    for (const related of item.related) check(ids.has(related), `${label}: broken related ${related}`);
    const patterns = [];
    for (const pattern of item.validationPatterns) {
      try { patterns.push(new RegExp(pattern, "i")); }
      catch (error) { errors.push(`${label}: invalid regex ${error.message}`); }
    }
    check(patterns.length > 0, `${label}: no valid patterns`);
    check(Array.isArray(item.examples) && item.examples.length > 0, `${label}: no examples`);
    check(item.examples.length === source.examples.length, `${label}: example count differs`);
    if (language !== "en-US" && item.english === source.english && item.pattern === source.pattern &&
        same(item.examples.map(example => example.en), source.examples.map(example => example.en))) untranslatedItems++;
    for (const [exampleIndex, example] of item.examples.entries()) {
      examples++;
      const exampleLabel = `${label}/example ${exampleIndex + 1}`;
      const sourceExample = source.examples[exampleIndex];
      check(same(Object.keys(example).sort(), Object.keys(sourceExample).sort()), `${exampleLabel}: fields differ`);
      for (const field of ["pt", "en", "ptIntent", "enIntent"]) {
        check(typeof example[field] === "string" && example[field].trim().length > 0, `${exampleLabel}: invalid ${field}`);
      }
      for (const field of ["pt", "ptIntent", "hqImage"]) {
        check(same(example[field], sourceExample[field]), `${exampleLabel}: shared field ${field} differs`);
      }
      check(example.pt.includes(example.ptIntent), `${exampleLabel}: PT highlight absent`);
      check(example.en.includes(example.enIntent), `${exampleLabel}: target highlight absent`);
      check(patterns.some(pattern => pattern.test(normalize(example.en))), `${exampleLabel}: patterns reject example`);
      if (patterns.length === item.validationPatterns.length) {
        check(validateIntention(example.en, item).status === "found", `${exampleLabel}: app validator rejects example`);
      }
      if (language !== "en-US" && example.en === sourceExample.en) untranslatedExamples++;
    }
  }
  check(language === "en-US" || untranslatedItems === 0, `${language}: ${untranslatedItems} target records still identical to English`);
  const presentState = mentalMap.find(item => item.id === "sou-estou-agora");
  if (language === "fr-FR") {
    check(validateIntention("Vous êtes prêts.", presentState).status === "found", "fr-FR: accented verb êtes not recognized");
    check(validateIntention("indéfiniment", presentState).status === "missing", "fr-FR: verb matched inside another word");
    const modals = mentalMap.find(item => item.id === "pode-podia-poderia-deveria-deve");
    check(validateIntention("Nous pouvons commencer demain.", modals).status === "found", "fr-FR: modal rejected in a new context");
    check(validateIntention("indevraisable", modals).status === "missing", "fr-FR: modal matched inside another word");
    check(validateIntention("œpouvons", modals).status === "missing", "fr-FR: ligature ignored at a word boundary");
  }
  if (language === "es-ES") {
    check(validateIntention("Estáis preparados.", presentState).status === "found", "es-ES: accented verb estáis not recognized");
    check(validateIntention("fiestas", presentState).status === "missing", "es-ES: verb matched inside another word");
    const modals = mentalMap.find(item => item.id === "pode-podia-poderia-deveria-deve");
    check(validateIntention("Podemos aprender juntos.", modals).status === "found", "es-ES: modal rejected in a new context");
    check(validateIntention("indeberíamosable", modals).status === "missing", "es-ES: modal matched inside another word");
  }
  const localization = language === "en-US" ? "" : `; ${untranslatedItems} unlocalized records, ${untranslatedExamples} identical target examples relative to EN`;
  console.log(`${language}: ${mentalMap.length} intentions, ${examples} examples${localization}`);
}

if (errors.length) {
  console.error(`${errors.length} validation error(s):`);
  const displayed = process.argv.includes("--all-errors") ? errors : errors.slice(0, 25);
  for (const error of displayed) console.error(error);
  if (displayed.length < errors.length) console.error("Use --all-errors to display every error.");
  process.exitCode = 1;
} else {
  console.log("Locale structure, references, highlights, regexes and app validation passed.");
}
