import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const locales = ["pt-BR", "en-US", "es-ES", "fr-FR"];
const flatten = (obj, prefix = "", output = {}) => {
  for (const [key, value] of Object.entries(obj)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") output[name] = value;
    else if (value && typeof value === "object" && !Array.isArray(value)) flatten(value, name, output);
    else throw new Error(`Invalid translation value: ${name}`);
  }
  return output;
};
const dict = Object.fromEntries(locales.map(lang => [
  lang, flatten(JSON.parse(readFileSync(`src/i18n/locales/${lang}.json`, "utf8")))
]));
const reference = Object.keys(dict["pt-BR"]).sort();
const vars = value => [...new Set([...value.matchAll(/{{\s*(\w+)\s*}}/g)].map(match => match[1]))].sort().join(",");
const problems = [];
for (const lang of locales) {
  const keys = Object.keys(dict[lang]).sort();
  if (keys.join("\n") !== reference.join("\n")) problems.push(`${lang}: translation keys differ from pt-BR`);
  for (const key of reference) {
    if (!dict[lang][key]?.trim()) problems.push(`${lang}: empty or missing ${key}`);
    else if (vars(dict[lang][key]) !== vars(dict["pt-BR"][key]))
      problems.push(`${lang}: interpolation variables differ for ${key}`);
  }
}
const sourceFiles = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? sourceFiles(join(dir, entry.name)) : /\.tsx?$/.test(entry.name) ? [join(dir, entry.name)] : []
);
const used = new Set();
for (const file of sourceFiles("src")) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/\bt\(\s*["']([^"']+)["']/g)) {
    const key = match[1];
    used.add(key);
    if (!(key in dict["pt-BR"]) && !(`${key}_one` in dict["pt-BR"]) && !(`${key}_other` in dict["pt-BR"]))
      problems.push(`${relative(".", file)}: missing translation ${key}`);
  }
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`i18n OK: ${locales.length} locales, ${reference.length} entries each, ${used.size} translation keys referenced.`);
}
