import { readAnswerOverrides, SMALL_TALK_ANSWER_OVERRIDES_KEY, type AnswerOverrides } from "../small-talk/smallTalkAnswerOverrides";
import { readQuestionOverrides, SMALL_TALK_QUESTION_OVERRIDES_KEY, type QuestionOverrides } from "../small-talk/smallTalkQuestionOverrides";
import { readCustomItems, mergeCustomItems, isCustomItems, SMALL_TALK_CUSTOM_ITEMS_KEY, type CustomSmallTalkItems } from "../small-talk/smallTalkCustomItems";
import { emptySmallTalkPersonalAnswers, readSmallTalkPersonalAnswers, parseSmallTalkPersonalAnswers, planSmallTalkPersonalImport, SMALL_TALK_PERSONAL_ANSWERS_KEY } from "../../services/smallTalkPersonalAnswersService";
import type { SmallTalkPersonalAnswers } from "../../types/smallTalk";

export type SmallTalkSyncData = {
  questions: QuestionOverrides;
  answers: AnswerOverrides;
  customItems: CustomSmallTalkItems;
  personalAnswers: SmallTalkPersonalAnswers;
};
export const SMALL_TALK_SYNC_KEYS = [SMALL_TALK_QUESTION_OVERRIDES_KEY, SMALL_TALK_ANSWER_OVERRIDES_KEY, SMALL_TALK_CUSTOM_ITEMS_KEY, SMALL_TALK_PERSONAL_ANSWERS_KEY] as const;

export function readSmallTalkSync(storage: Storage = localStorage): SmallTalkSyncData {
  return {
    questions: readQuestionOverrides(storage),
    answers: readAnswerOverrides(storage),
    customItems: readCustomItems(storage),
    personalAnswers: readSmallTalkPersonalAnswers(storage)
  };
}
export function validateSmallTalkSync(input: unknown): SmallTalkSyncData {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Small Talk sync inválido.");
  const value = input as Partial<SmallTalkSyncData>;
  const memory = new Map<string, string>();
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, text: string) => { memory.set(key, text); },
    removeItem: (key: string) => { memory.delete(key); },
    clear: () => { memory.clear(); },
    key: (index: number) => [...memory.keys()][index] ?? null,
    get length() { return memory.size; }
  } as Storage;
  if (!isCustomItems(value.customItems)) throw new Error("Cards do Small Talk inválidos.");
  storage.setItem(SMALL_TALK_QUESTION_OVERRIDES_KEY, JSON.stringify(value.questions));
  storage.setItem(SMALL_TALK_ANSWER_OVERRIDES_KEY, JSON.stringify(value.answers));
  const questions = readQuestionOverrides(storage);
  const answers = readAnswerOverrides(storage);
  const personal = value.personalAnswers;
  if (!personal || typeof personal !== "object" || !("answersByItemId" in personal)) throw new Error("Respostas pessoais do Small Talk inválidas.");
  const personalAnswers = Object.keys(personal.answersByItemId).length
    ? parseSmallTalkPersonalAnswers(JSON.stringify(personal))
    : (() => {
        const empty = emptySmallTalkPersonalAnswers();
        if (JSON.stringify(personal) !== JSON.stringify(empty)) throw new Error("Respostas pessoais vazias inválidas.");
        return empty;
      })();
  return { questions, answers, customItems: value.customItems, personalAnswers };
}
function latest<T extends { updatedAt: string }>(left: Record<string, T>, right: Record<string, T>): Record<string, T> {
  const merged = { ...left };
  for (const [id, record] of Object.entries(right)) {
    if (!merged[id] || Date.parse(record.updatedAt) > Date.parse(merged[id].updatedAt)) merged[id] = record;
  }
  return merged;
}
export function mergeSmallTalkSync(local: SmallTalkSyncData, incoming: SmallTalkSyncData): SmallTalkSyncData {
  const a = validateSmallTalkSync(local);
  const b = validateSmallTalkSync(incoming);
  const ids = new Set([...Object.keys(a.personalAnswers.answersByItemId), ...Object.keys(b.personalAnswers.answersByItemId)]);
  // The personal-answer service preserves immutable originals, revision UUIDs and local selections.
  const plan = planSmallTalkPersonalImport(b.personalAnswers, a.personalAnswers, ids);
  if (!plan.merged || plan.errors.length) throw new Error("Conflito de respostas pessoais do Small Talk: " + plan.errors.join("; "));
  return {
    questions: latest(a.questions, b.questions),
    answers: latest(a.answers, b.answers),
    customItems: mergeCustomItems(a.customItems, b.customItems),
    personalAnswers: plan.merged
  };
}
export function writeSmallTalkSync(value: SmallTalkSyncData, storage: Storage = localStorage): void {
  const valid = validateSmallTalkSync(value);
  const entries = [
    [SMALL_TALK_QUESTION_OVERRIDES_KEY, valid.questions],
    [SMALL_TALK_ANSWER_OVERRIDES_KEY, valid.answers],
    [SMALL_TALK_CUSTOM_ITEMS_KEY, valid.customItems],
    [SMALL_TALK_PERSONAL_ANSWERS_KEY, valid.personalAnswers]
  ] as const;
  // Preflight quota/availability and restore every previous value on write failure.
  const old = entries.map(([key]) => storage.getItem(key));
  try {
    entries.forEach(([key, data]) => storage.setItem(key, JSON.stringify(data)));
  } catch (error) {
    entries.forEach(([key], index) => {
      try { if (old[index] === null) storage.removeItem(key); else storage.setItem(key, old[index]!); } catch { /* preserve original error */ }
    });
    throw error;
  }
  entries.forEach(([key]) => window.dispatchEvent(new StorageEvent("storage", { key })));
}
