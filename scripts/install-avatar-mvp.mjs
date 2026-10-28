/**
 * Instalador LOCAL e idempotente do MVP de avatar.
 * Não executa checkout, commit, push, nem acessa GitHub.
 * Rode na raiz do workspace-bej, na feature/avatar.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const detailPath = path.join(root, 'src/components/IntentionDetails.tsx');
const neuralPath = path.join(root, 'src/features/study/neuralExampleAudio.ts');
const avatarPath = path.join(root, 'src/features/avatar/AvatarStage.tsx');
if (![detailPath, neuralPath, avatarPath].every(fs.existsSync)) {
  throw new Error('Arquivos esperados ausentes. Extraia o ZIP na raiz do projeto antes de executar.');
}
try {
  const branch = execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim();
  if (branch !== 'feature/avatar') throw new Error(`Branch atual: ${branch}. Alterações locais bloqueadas; use feature/avatar.`);
} catch (error) {
  if (String(error).includes('Branch atual:')) throw error;
  throw new Error('Não foi possível confirmar a branch Git. Execute dentro do repositório na feature/avatar.');
}

const backup = (file) => {
  const backupPath = file + '.pre-avatar.bak';
  if (!fs.existsSync(backupPath)) fs.copyFileSync(file, backupPath);
};
const change = (file, anchor, replacement, guard) => {
  const current = fs.readFileSync(file, 'utf8');
  if (current.includes(guard)) { console.log(`Já instalado: ${path.relative(root, file)} (${guard})`); return; }
  if (current.split(anchor).length !== 2) throw new Error(`Âncora ausente ou duplicada em ${file}: ${anchor}`);
  backup(file);
  fs.writeFileSync(file, current.replace(anchor, replacement), 'utf8');
  console.log(`Atualizado: ${path.relative(root, file)}`);
};

change(
  neuralPath,
  'let audio: HTMLAudioElement | null = null;',
  'let audio: HTMLAudioElement | null = null;\n/** Somente leitura: fornece o relógio real do MP3 para o avatar. */\nexport function getActiveNeuralAudio(): HTMLAudioElement | null { return audio; }',
  'export function getActiveNeuralAudio()'
);
change(
  detailPath,
  'import { useExampleAudio } from "../features/study/useExampleAudio";',
  'import { useExampleAudio } from "../features/study/useExampleAudio";\nimport { AvatarStage } from "../features/avatar/AvatarStage";',
  'import { AvatarStage }'
);
change(
  detailPath,
  '<p className="detail-english" lang={language}>{item.targetIntention ?? item.english}</p>',
  '<p className="detail-english" lang={language}>{item.targetIntention ?? item.english}</p>\n        {language === "en-US" && (\n          <AvatarStage\n            example={item.examples?.find((candidate) => candidate.id === playback?.id) ?? null}\n            isPlaying={playback?.state === "playing"}\n          />\n        )}',
  '<AvatarStage\n'
);
console.log('Integração concluída. Execute: npm install three && npm install -D @types/three && npm run build');
