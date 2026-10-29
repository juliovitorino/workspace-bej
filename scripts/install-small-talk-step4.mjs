import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const dryRun = process.argv.includes('--check');
const files = new Map();
const sep = '\n';
function assert(condition, file, description) {
  if (!condition) throw new Error(`Estrutura não reconhecida em ${file}: ${description}. Nenhum arquivo foi modificado.`);
}
function edit(file, transform) {
  const absolute = path.join(root, file);
  assert(fs.existsSync(absolute), file, 'arquivo inexistente');
  const before = fs.readFileSync(absolute, 'utf8');
  const after = transform(before, file);
  files.set(file, { before, after });
}
function requireReplace(text, pattern, replacement, file, description) {
  assert(pattern.test(text), file, description);
  return text.replace(pattern, replacement);
}
function ensureReplace(text, present, pattern, replacement, file, description) {
  return present.test(text) ? text : requireReplace(text, pattern, replacement, file, description);
}
const branch = execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim();
if (branch !== 'feature/smalltalk') throw new Error(`Branch atual: ${branch}. Exigida: feature/smalltalk. Nada foi alterado.`);

edit('src/components/Sidebar.tsx', (s, file) => {
  if (!/export\s+type\s+AppView\s*=/.test(s)) throw new Error(`${file}: tipo AppView não localizado.`);
  if (!/export\s+type\s+AppView\s*=[^;]*["']small-talk["']/.test(s)) {
    s = requireReplace(s, /(export\s+type\s+AppView\s*=\s*[^;]+)(;)/, '$1 | "small-talk"$2', file, 'união AppView');
  }
  if (!/\bid:\s*["']small-talk["']/.test(s)) {
    // O menu usa um objeto para Hashmap. Aceitar LF/CRLF, espaços e objetos de uma ou várias linhas.
    const multi = /(^[ \t]*\{[ \t]*\r?\n[ \t]*id:\s*["']hashmap["']\s*,)/m;
    const single = /(^[ \t]*\{[ \t]*id:\s*["']hashmap["']\s*,)/m;
    const anchor = multi.test(s) ? multi : single;
    s = requireReplace(s, anchor, (_, target) => `    { id: "small-talk", label: "Small Talk", icon: "💬" },${sep}${target}`, file, 'entrada Hashmap no menu');
  }
  return s;
});

edit('src/App.tsx', (s, file) => {
  s = ensureReplace(s, /import\s*\{\s*SmallTalkPage\s*\}/,
    /(import\s*\{\s*StoryShadowing\s*\}\s*from\s*["']\.\/components\/StoryShadowing["'];?)/,
    '$1\nimport { SmallTalkPage } from "./features/small-talk/SmallTalkPage";', file, 'import StoryShadowing');
  s = ensureReplace(s, /import\s*["']\.\/features\/small-talk\/smallTalk\.css["']/,
    /(import\s*\{\s*SmallTalkPage\s*\}\s*from\s*["']\.\/features\/small-talk\/SmallTalkPage["'];?)/,
    '$1\nimport "./features/small-talk/smallTalk.css";', file, 'import SmallTalkPage');
  s = ensureReplace(s, /\[\s*["']shadowing["']\s*,\s*["']would-you-rather["']\s*,\s*["']small-talk["']\s*\]\.includes\(studyView\)/,
    /\[\s*["']shadowing["']\s*,\s*["']would-you-rather["']\s*\]\.includes\(studyView\)/,
    '["shadowing", "would-you-rather", "small-talk"].includes(studyView)', file, 'regra de carregamento independente');
  s = ensureReplace(s, /view\s*===\s*["']small-talk["']\s*\|\|\s*view\s*===\s*["']would-you-rather["']/,
    /view\s*===\s*["']shadowing["']\s*\|\|\s*view\s*===\s*["']would-you-rather["']/,
    'view === "shadowing" || view === "small-talk" || view === "would-you-rather"', file, 'reset de navegação');
  if (!/currentView\s*===\s*["']small-talk["']\s*&&\s*<SmallTalkPage/.test(s)) {
    s = requireReplace(s, /(^[ \t]*\{currentView\s*===\s*["']shadowing["']\s*&&\s*<StoryShadowing)/m,
      '            {currentView === "small-talk" && <SmallTalkPage onStudyState={reportStudy} onWalkingChange={setWalkingActive} />}\n$1', file, 'renderização StoryShadowing');
  }
  const exclusion = /currentView\s*!==\s*["']shadowing["']\s*&&\s*currentView\s*!==\s*["']would-you-rather["']/g;
  assert(s.includes('currentView !== "small-talk"') || exclusion.test(s), file, 'condições de loading e erro');
  s = s.replace(exclusion, 'currentView !== "shadowing" && currentView !== "small-talk" && currentView !== "would-you-rather"');
  return s;
});

edit('src/features/study/studyStorage.ts', (s, file) => ensureReplace(s,
  /STUDY_MODULES\s*=\s*\[[^\]]*["']small-talk["']/,
  /(["']would-you-rather["']\s*,\s*["']interpretation["'])(\s*,\s*["']extra-activities["']\s*\]\s*as\s+const)/,
  '$1, "small-talk"$2', file, 'STUDY_MODULES'));
edit('src/features/study/useStudyTracking.ts', (s, file) => ensureReplace(s,
  /["']small-talk["']\s*\]\s*\.includes\(view\)/,
  /(["']would-you-rather["']\s*,\s*["']interpretation["'])(\s*\]\s*\.includes\(view\))/,
  '$1, "small-talk"$2', file, 'mapeamento do rastreamento'));
edit('src/features/study/StudyDashboard.tsx', (s, file) => {
  s = ensureReplace(s, /["']small-talk["']\s*:\s*["']Small Talk["']/,
    /(["']extra-activities["']\s*:\s*["']extras\.title["']\s*,\s*)(previous\s*:)/,
    '$1"small-talk": "Small Talk", $2', file, 'rótulo de módulo');
  s = ensureReplace(s, /key\s*===\s*["']small-talk["']\s*\?\s*["']Small Talk["']/,
    /key\s*===\s*["']hashmap["']\s*\?\s*["']Mental Hashmap["']\s*:\s*t\(moduleKeys\[key\]\)/,
    'key === "hashmap" ? "Mental Hashmap" : key === "small-talk" ? "Small Talk" : t(moduleKeys[key])', file, 'exibição no Dashboard');
  return s;
});

const changed = [...files].filter(([, value]) => value.before !== value.after);
if (!changed.length) { console.log('Etapa 4 já está integrada. Nenhum arquivo precisa ser modificado.'); process.exit(0); }
console.log(`Pré-validação OK: ${files.size} arquivos verificados; ${changed.length} arquivos com alterações.`);
for (const [name] of changed) console.log(`  ${name}`);
if (dryRun) { console.log('Modo --check: nenhuma alteração foi gravada.'); process.exit(0); }
const backup = path.join(root, `.smalltalk-step4-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(backup, { recursive: true });
for (const [name] of changed) {
  const target = path.join(backup, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(root, name), target);
}
try {
  for (const [name, { after }] of changed) fs.writeFileSync(path.join(root, name), after, 'utf8');
} catch (error) {
  for (const [name] of changed) fs.copyFileSync(path.join(backup, name), path.join(root, name));
  throw error;
}
console.log(`Instalação concluída. Backup: ${path.basename(backup)} (não adicionar ao Git).`);
