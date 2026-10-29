/** Instala apenas o ponto de entrada da tela de importação em Configurações > Dados. */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim();
if (branch !== 'feature/smalltalk') throw new Error(`Branch incorreta: ${branch}. Esperada: feature/smalltalk.`);
const file = join(process.cwd(), 'src', 'components', 'AppSettingsPage.tsx');
let text = readFileSync(file, 'utf8');
const importLine = 'import { SmallTalkPersonalImport } from "./SmallTalkPersonalImport";';
const mountLine = '        <SmallTalkPersonalImport />';
if (text.includes(importLine) && text.includes(mountLine)) {
  console.log('Etapa 3 já integrada em AppSettingsPage.tsx.');
  process.exit(0);
}
if (text.includes(importLine) !== text.includes(mountLine)) {
  throw new Error('Integração parcial detectada. Revise AppSettingsPage.tsx manualmente.');
}
const importAnchor = 'import { NeuralVoiceSelect } from "./NeuralVoiceSelect";';
const mountAnchor = '        <StudyDangerZone language={languages.language} onChanged={() => undefined} />';
if (text.split(importAnchor).length !== 2 || text.split(mountAnchor).length !== 2) {
  throw new Error('AppSettingsPage.tsx difere da master consultada. Nenhuma alteração aplicada.');
}
text = text.replace(importAnchor, `${importAnchor}\n${importLine}`);
text = text.replace(mountAnchor, `${mountLine}\n${mountAnchor}`);
writeFileSync(file, text, 'utf8');
console.log('Importador Small Talk adicionado em Configurações > Dados.');
