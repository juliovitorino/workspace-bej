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
export function saveQuestionOverride(id: string, text: string, storage: Storage = window.localStorage): QuestionOverrides {
  if (!text.trim()) throw Error('Pergunta vazia');
  const next = { ...readQuestionOverrides(storage), [id]: { text: text.trim(), updatedAt: new Date().toISOString() } };
  storage.setItem(SMALL_TALK_QUESTION_OVERRIDES_KEY, JSON.stringify(next));
  return next;
}
export function restoreOriginalQuestion(id: string, storage: Storage = window.localStorage): QuestionOverrides {
  const next = { ...readQuestionOverrides(storage) }; delete next[id];
  storage.setItem(SMALL_TALK_QUESTION_OVERRIDES_KEY, JSON.stringify(next)); return next;
}
