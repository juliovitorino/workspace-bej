import type {
  SmallTalkOriginalAnswer,
  SmallTalkPersonalAnswer,
  SmallTalkPersonalAnswers,
  SmallTalkSegment,
  SmallTalkAnswerRevision
} from '../types/smallTalk';

/** Dados privados; esta chave NÃO é atualmente coberta pelo Google Drive Sync do BEJ. */
export const SMALL_TALK_PERSONAL_ANSWERS_KEY = 'bej:small-talk:personal-answers:v1';
const MAX_IMPORT_BYTES = 8 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REVIEW = new Set(['pending', 'approved', 'rejected']);
const REVISION = new Set(['draft', 'approved', 'rejected']);

export interface SmallTalkStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export interface SmallTalkImportPlan {
  incomingRecords: number;
  newRecords: number;
  updatedRecords: number;
  unchangedRecords: number;
  originals: number;
  unanswered: number;
  revisionsAdded: number;
  errors: string[];
  merged: SmallTalkPersonalAnswers | null;
  baselineSnapshot: string;
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function isUuid(value: unknown): value is string { return typeof value === 'string' && UUID.test(value); }
function isSegment(value: unknown): value is SmallTalkSegment {
  return record(value) && isUuid(value.id) && typeof value.text === 'string' && value.text.trim().length > 0 &&
    (value.sourceParagraphIndex === undefined || (typeof value.sourceParagraphIndex === 'number' && Number.isInteger(value.sourceParagraphIndex) && value.sourceParagraphIndex >= 0));
}
function segmentsValid(value: unknown): value is SmallTalkSegment[] {
  return Array.isArray(value) && value.every(isSegment) && new Set(value.map(v => v.id)).size === value.length;
}
function isOriginal(value: unknown): value is SmallTalkOriginalAnswer {
  return record(value) && isUuid(value.id) && typeof value.source === 'string' && segmentsValid(value.segments) && value.segments.length > 0;
}
function isRevision(value: unknown): value is SmallTalkAnswerRevision {
  return record(value) && isUuid(value.id) && isUuid(value.basedOnAnswerId) && REVISION.has(value.status as string) &&
    segmentsValid(value.segments) && value.segments.length > 0 &&
    (value.createdAt === undefined || typeof value.createdAt === 'string') &&
    (value.reviewNotes === undefined || typeof value.reviewNotes === 'string') &&
    (value.source === undefined || typeof value.source === 'string');
}
function isAnswer(value: unknown, id: string): value is SmallTalkPersonalAnswer {
  if (!record(value) || value.itemId !== id || value.locale !== 'en-US' ||
      !(value.original === null || isOriginal(value.original)) ||
      !Array.isArray(value.revisions) || !value.revisions.every(isRevision) ||
      !(value.activeAnswerId === null || isUuid(value.activeAnswerId)) ||
      !REVIEW.has(value.importReviewStatus as string) ||
      !segmentsValid(value.sourceLeadIn) || !segmentsValid(value.sourceAnnotations)) return false;
  const answer = value as unknown as SmallTalkPersonalAnswer;
  const ids = [answer.original?.id, ...answer.revisions.map(r => r.id)].filter(Boolean);
  if (new Set(ids).size !== ids.length) return false;
  const revisionsById = new Map(answer.revisions.map(r => [r.id, r]));
  if (answer.revisions.some(r => r.basedOnAnswerId !== answer.original?.id && !revisionsById.has(r.basedOnAnswerId))) return false;
  if (answer.activeAnswerId !== null && answer.activeAnswerId !== answer.original?.id &&
      revisionsById.get(answer.activeAnswerId)?.status !== 'approved') return false;
  return true;
}
export function parseSmallTalkPersonalAnswers(input: string): SmallTalkPersonalAnswers {
  if (new TextEncoder().encode(input).length > MAX_IMPORT_BYTES) throw new Error('Arquivo excede 8 MB.');
  let data: unknown;
  try { data = JSON.parse(input); } catch { throw new Error('O arquivo não contém JSON válido.'); }
  if (!record(data) || data.schemaVersion !== '1.0.0' || data.module !== 'small-talk' ||
      data.dataType !== 'personal-answers' || data.locale !== 'en-US' || !record(data.answersByItemId)) {
    throw new Error('Contrato de respostas pessoais incompatível com Small Talk v1.0.0 (en-US).');
  }
  const entries = Object.entries(data.answersByItemId);
  if (entries.length === 0) throw new Error('Arquivo sem respostas para importar.');
  for (const [id, answer] of entries) {
    if (!isUuid(id) || !isAnswer(answer, id)) throw new Error(`Registro inválido ou referência quebrada: ${id.slice(0, 80)}`);
  }
  return data as unknown as SmallTalkPersonalAnswers;
}
export function emptySmallTalkPersonalAnswers(): SmallTalkPersonalAnswers {
  return { schemaVersion: '1.0.0', module: 'small-talk', dataType: 'personal-answers', locale: 'en-US', answersByItemId: {} };
}
export function readSmallTalkPersonalAnswers(storage: SmallTalkStorage): SmallTalkPersonalAnswers {
  const raw = storage.getItem(SMALL_TALK_PERSONAL_ANSWERS_KEY);
  if (!raw) return emptySmallTalkPersonalAnswers();
  // Nunca remover ou zerar dados em caso de corrupção: lançar erro e solicitar backup.
  return parseSmallTalkPersonalAnswersAllowEmpty(raw);
}
function parseSmallTalkPersonalAnswersAllowEmpty(raw: string): SmallTalkPersonalAnswers {
  const obj: unknown = JSON.parse(raw);
  if (record(obj) && record(obj.answersByItemId) && Object.keys(obj.answersByItemId).length === 0 &&
      obj.schemaVersion === '1.0.0' && obj.module === 'small-talk' && obj.dataType === 'personal-answers' && obj.locale === 'en-US') {
    return obj as unknown as SmallTalkPersonalAnswers;
  }
  return parseSmallTalkPersonalAnswers(raw);
}
function same(a: unknown, b: unknown): boolean { return JSON.stringify(a) === JSON.stringify(b); }
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

/** Planejamento puro, sem escrever em storage. Conflitos impedem toda a importação. */
export function planSmallTalkPersonalImport(
  incoming: SmallTalkPersonalAnswers,
  existing: SmallTalkPersonalAnswers,
  catalogItemIds: ReadonlySet<string>
): SmallTalkImportPlan {
  const merged = clone(existing);
  const plan: SmallTalkImportPlan = {
    incomingRecords: 0, newRecords: 0, updatedRecords: 0, unchangedRecords: 0,
    originals: 0, unanswered: 0, revisionsAdded: 0, errors: [], merged: null,
    baselineSnapshot: JSON.stringify(existing)
  };
  for (const [id, next] of Object.entries(incoming.answersByItemId)) {
    plan.incomingRecords++;
    if (!catalogItemIds.has(id)) { plan.errors.push(`ID não encontrado no catálogo: ${id}`); continue; }
    if (next.original) plan.originals++; else plan.unanswered++;
    const old = merged.answersByItemId[id];
    if (!old) {
      merged.answersByItemId[id] = clone(next);
      plan.newRecords++;
      plan.revisionsAdded += next.revisions.length;
      continue;
    }
    if (old.locale !== next.locale || old.itemId !== next.itemId) {
      plan.errors.push(`Identidade divergente: ${id}`); continue;
    }
    if (old.original && next.original && !same(old.original, next.original)) {
      plan.errors.push(`Original imutável divergente: ${id}`); continue;
    }
    const updated = clone(old);
    if (!updated.original && next.original) updated.original = clone(next.original);
    for (const revision of next.revisions) {
      const prior = updated.revisions.find(r => r.id === revision.id);
      if (prior && !same(prior, revision)) {
        plan.errors.push(`Revisão UUID conflitante: ${revision.id}`);
      } else if (!prior) {
        updated.revisions.push(clone(revision));
        plan.revisionsAdded++;
      }
    }
    // Nunca substituir seleção ativa, revisões locais ou anotações locais.
    if (!(updated.sourceLeadIn?.length) && next.sourceLeadIn?.length) updated.sourceLeadIn = clone(next.sourceLeadIn);
    if (!(updated.sourceAnnotations?.length) && next.sourceAnnotations?.length) updated.sourceAnnotations = clone(next.sourceAnnotations);
    if (same(updated, old)) plan.unchangedRecords++;
    else { merged.answersByItemId[id] = updated; plan.updatedRecords++; }
  }
  if (plan.errors.length === 0) plan.merged = merged;
  return plan;
}
/** Commit único: localStorage.setItem é atômico por chave; falha não deve apagar o anterior. */
export function commitSmallTalkPersonalImport(plan: SmallTalkImportPlan, storage: SmallTalkStorage): void {
  if (!plan.merged || plan.errors.length) throw new Error('Importação bloqueada por conflitos.');
  // Verifica alterações entre prévia e gravação, inclusive em outra aba.
  const latest = readSmallTalkPersonalAnswers(storage);
  if (JSON.stringify(latest) !== plan.baselineSnapshot) {
    throw new Error('Os dados foram alterados em outra aba. Refaça a prévia antes de importar.');
  }
  storage.setItem(SMALL_TALK_PERSONAL_ANSWERS_KEY, JSON.stringify(plan.merged));
}
export function smallTalkPersonalBackupText(storage: SmallTalkStorage): string {
  return JSON.stringify(readSmallTalkPersonalAnswers(storage), null, 2);
}
/** Somente o original do DOCX; revisões e activeAnswerId são ignorados. */
export function getSmallTalkDefaultAnswer(itemId: string, storage: SmallTalkStorage): SmallTalkSegment[] | null {
  return readSmallTalkPersonalAnswers(storage).answersByItemId[itemId]?.original?.segments ?? null;
}
