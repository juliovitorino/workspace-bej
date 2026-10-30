import type { SmallTalkItem } from '../../types/smallTalk';

export const SMALL_TALK_QUESTION_OVERRIDES_KEY = 'bej:small-talk:question-overrides:v1';
export interface QuestionOverride { text: string; updatedAt: string }
export type QuestionOverrides = Record<string, QuestionOverride>;
export function readQuestionOverrides(storage: Storage = window.localStorage): QuestionOverrides {
  const raw = storage.getItem(SMALL_TALK_QUESTION_OVERRIDES_KEY);
  if (!raw) return {};
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object' || Array.isArray(data) || Object.values(data).some(v =>
    !v || typeof v !== 'object' || !('text' in v) || !('updatedAt' in v) || typeof v.text !== 'string' || !v.text.trim() || typeof v.updatedAt !== 'string'))
    throw Error('Perguntas locais inválidas. Dados preservados.');
  return data as QuestionOverrides;
}
export function saveQuestionOverride(id: string, text: string, publicText?: string, storage: Storage = window.localStorage): QuestionOverrides {
  if (!text.trim()) throw Error('Pergunta vazia');
  const next = { ...readQuestionOverrides(storage) };
  const normalized = text.trim();
  if (typeof publicText === 'string' && normalized === publicText) delete next[id];
  else next[id] = { text: normalized, updatedAt: new Date().toISOString() };
  storage.setItem(SMALL_TALK_QUESTION_OVERRIDES_KEY, JSON.stringify(next));
  return next;
}
export function restoreOriginalQuestion(id: string, storage: Storage = window.localStorage): QuestionOverrides {
  const next = { ...readQuestionOverrides(storage) }; delete next[id];
  storage.setItem(SMALL_TALK_QUESTION_OVERRIDES_KEY, JSON.stringify(next)); return next;
}
export function pruneRedundantQuestionOverrides(items: SmallTalkItem[], storage: Storage = window.localStorage): QuestionOverrides {
  const current = readQuestionOverrides(storage);
  const next = { ...current };
  let changed = false;
  for (const item of items) {
    const original = item.question?.text;
    const saved = next[item.id];
    if (typeof original === 'string' && saved && saved.text === original) {
      delete next[item.id]; changed = true;
    }
  }
  if (changed) storage.setItem(SMALL_TALK_QUESTION_OVERRIDES_KEY, JSON.stringify(next));
  return next;
}
