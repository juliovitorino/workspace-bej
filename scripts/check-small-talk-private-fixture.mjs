/** Validador local opcional; NUNCA copie o JSON privado para o repositório. */
import { readFileSync } from 'node:fs';
import { parseSmallTalkPersonalAnswers } from '../src/services/smallTalkPersonalAnswersService.ts';
const path = process.argv[2];
if (!path) { console.error('Uso: node --experimental-strip-types scripts/check-small-talk-private-fixture.mjs <caminho-privado.json>'); process.exitCode = 1; }
else {
  try {
    const parsed = parseSmallTalkPersonalAnswers(readFileSync(path, 'utf8'));
    const values = Object.values(parsed.answersByItemId);
    console.log(JSON.stringify({ valid: true, records: values.length, originals: values.filter(v => v.original).length, revisions: values.reduce((n,v) => n + v.revisions.length, 0) }, null, 2));
  } catch (e) { console.error('Falha na validação:', e instanceof Error ? e.message : String(e)); process.exitCode = 1; }
}
