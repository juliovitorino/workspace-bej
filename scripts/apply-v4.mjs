import fs from 'node:fs';
import path from 'node:path';
import { locales, outputRoot, read, digest } from './migration-v4-common.mjs';

const stateFile = path.join(outputRoot, 'applied-state.json');
const report = read(path.join(outputRoot, 'migration-report.json'));
const files = Object.keys(report.sources).filter(file =>
  locales.some(locale => file === `public/sample-hashmap-${locale}.json`) || /^src\/data\/stories\/stories-[abc][12]\.json$/.test(file));
const state = fs.existsSync(stateFile) ? read(stateFile) : { files: {} };
// Check the whole batch before writing; never replace unexpected local edits.
for (const file of files) {
  const prepared = path.join(outputRoot, file);
  read(prepared);
  const current = digest(fs.readFileSync(file));
  const expected = digest(fs.readFileSync(prepared));
  if (current !== report.sources[file] && current !== expected) throw new Error(`Arquivo alterado desde a preparacao: ${file}`);
  const backup = path.join(outputRoot, 'original-backups', file);
  if (fs.existsSync(backup) && digest(fs.readFileSync(backup)) !== report.sources[file]) throw new Error(`Backup divergente: ${file}`);
  if (!fs.existsSync(backup) && current !== report.sources[file]) throw new Error(`Original sem backup: ${file}`);
  state.files[file] = { backup: path.relative(process.cwd(), backup).split(path.sep).join('/'), originalHash: report.sources[file], appliedHash: expected };
}
// Save every original before changing any destination.
for (const file of files) {
  const backup = state.files[file].backup;
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup, fs.constants.COPYFILE_EXCL);
}
fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`);
let changed = 0;
for (const file of files) {
  if (digest(fs.readFileSync(file)) === state.files[file].appliedHash) continue;
  fs.copyFileSync(path.join(outputRoot, file), file);
  changed++;
}
console.log(`Aplicacao 4.0: ${changed} arquivos substituidos; ${files.length} backups originais preservados.`);
