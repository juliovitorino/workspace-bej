import { readSmallTalkPersonalAnswers } from '../../services/smallTalkPersonalAnswersService';

/** Substituições privadas locais. Jamais gravar em public/ ou no repositório. */
export const SMALL_TALK_ANSWER_OVERRIDES_KEY = 'bej:small-talk:answer-overrides:v1';
export interface AnswerOverride { text: string | null; updatedAt: string }
export type AnswerOverrides = Record<string, AnswerOverride>;

export function readAnswerOverrides(storage: Storage = window.localStorage): AnswerOverrides {
  const raw = storage.getItem(SMALL_TALK_ANSWER_OVERRIDES_KEY);
  if (!raw) return {};
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Formato de revisões inválido. Nenhum dado foi apagado.');
  for (const entry of Object.values(data)) {
    if (!entry || typeof entry !== 'object' || !('text' in entry) || !('updatedAt' in entry) ||
      !((entry.text === null) || (typeof entry.text === 'string' && entry.text.trim().length > 0)) || typeof entry.updatedAt !== 'string') {
      throw new Error('Revisões locais inválidas. Faça backup antes de alterar.');
    }
  }
  return data as AnswerOverrides;
}
export function saveAnswerOverride(itemId: string, text: string | null, storage: Storage = window.localStorage): AnswerOverrides {
  const next = { ...readAnswerOverrides(storage), [itemId]: { text, updatedAt: new Date().toISOString() } };
  storage.setItem(SMALL_TALK_ANSWER_OVERRIDES_KEY, JSON.stringify(next));
  return next;
}
export function restoreOriginalAnswer(itemId: string, storage: Storage = window.localStorage): AnswerOverrides {
  const next = { ...readAnswerOverrides(storage) };
  delete next[itemId];
  storage.setItem(SMALL_TALK_ANSWER_OVERRIDES_KEY, JSON.stringify(next));
  return next;
}
export function getSmallTalkActiveAnswer(itemId: string, storage: Storage = window.localStorage): string {
  const overrides = readAnswerOverrides(storage);
  if (Object.prototype.hasOwnProperty.call(overrides, itemId)) return overrides[itemId].text ?? '';
  return readSmallTalkPersonalAnswers(storage).answersByItemId[itemId]?.original?.segments.map(s => s.text).join('\n\n') ?? '';
}
export function answerOverridesBackup(storage: Storage = window.localStorage): string {
  return JSON.stringify({ schemaVersion: '1.0.0', module: 'small-talk', dataType: 'answer-overrides', overrides: readAnswerOverrides(storage) }, null, 2);
}
