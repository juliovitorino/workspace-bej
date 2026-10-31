export const WYR_FAVORITES_KEY = "bej:would-you-rather:favorites:v1";
export const WYR_PROGRESS_KEY = "bej:would-you-rather:progress:v1";
export type WyrChoice = "A" | "B";
export interface WyrStored { favorites: string[]; choices: Record<string, WyrChoice>; storageError: boolean }

const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id);
export function readWyrStored(): WyrStored {
  let storageError = false;
  let favorites: string[] = [];
  let choices: Record<string, WyrChoice> = {};
  try {
    const value: unknown = JSON.parse(localStorage.getItem(WYR_FAVORITES_KEY) || "[]");
    if (Array.isArray(value)) favorites = value.filter((id): id is string => typeof id === "string" && isUuid(id));
    const progress: unknown = JSON.parse(localStorage.getItem(WYR_PROGRESS_KEY) || "{}");
    if (progress && typeof progress === "object" && !Array.isArray(progress)) {
      choices = Object.fromEntries(Object.entries(progress).filter(([id, choice]) => isUuid(id) && (choice === "A" || choice === "B"))) as Record<string, WyrChoice>;
    }
  } catch { storageError = true; }
  return { favorites, choices, storageError };
}
export function saveWyrFavorites(ids: string[]): boolean {
  try { localStorage.setItem(WYR_FAVORITES_KEY, JSON.stringify(ids)); return true; } catch { return false; }
}
export function saveWyrChoices(choices: Record<string, WyrChoice>): boolean {
  try { localStorage.setItem(WYR_PROGRESS_KEY, JSON.stringify(choices)); return true; } catch { return false; }
}


export const WYR_CUSTOM_ANSWERS_KEY = "bej:would-you-rather:custom-answers:v1";
export const WYR_FONT_SIZE_KEY = "bej:would-you-rather:answer-font:v1";
export type WyrFontSize = "small" | "medium" | "large";
export type WyrCustomAnswer = { text: string | null; updatedAt: string };
export type WyrCustomAnswers = Record<string, WyrCustomAnswer>;
export const wyrAnswerKey = (locale: string, questionId: string, choice: WyrChoice) => locale + ":" + questionId + ":" + choice;
function validAnswer(value: unknown): value is WyrCustomAnswer {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Partial<WyrCustomAnswer>;
  return (item.text === null || (typeof item.text === "string" && !!item.text.trim() && item.text.length <= 10000)) &&
    typeof item.updatedAt === "string" && !Number.isNaN(Date.parse(item.updatedAt));
}
export function validateWyrAnswers(value: unknown): WyrCustomAnswers {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: WyrCustomAnswers = {};
  for (const [key, item] of Object.entries(value)) {
    if (/^(en-US|pt-BR|es-ES|fr-FR):[a-f0-9-]{36}:[AB]$/i.test(key) && validAnswer(item)) result[key] = item;
  }
  return result;
}
export function readWyrAnswers(): WyrCustomAnswers {
  try { return validateWyrAnswers(JSON.parse(localStorage.getItem(WYR_CUSTOM_ANSWERS_KEY) || "{}")); }
  catch { return {}; }
}
export function saveWyrAnswers(answers: WyrCustomAnswers): boolean {
  try { localStorage.setItem(WYR_CUSTOM_ANSWERS_KEY, JSON.stringify(answers)); return true; }
  catch { return false; }
}
export function mergeWyrAnswers(...sources: WyrCustomAnswers[]): WyrCustomAnswers {
  const result: WyrCustomAnswers = {};
  for (const source of sources) for (const [key, answer] of Object.entries(validateWyrAnswers(source))) {
    const existing = result[key];
    if (!existing || answer.updatedAt > existing.updatedAt ||
      (answer.updatedAt === existing.updatedAt && JSON.stringify(answer) > JSON.stringify(existing))) result[key] = answer;
  }
  return result;
}
export function readWyrFontSize(): WyrFontSize {
  try { const value = localStorage.getItem(WYR_FONT_SIZE_KEY); return value === "small" || value === "large" ? value : "medium"; }
  catch { return "medium"; }
}
export function saveWyrFontSize(value: WyrFontSize): boolean {
  try { localStorage.setItem(WYR_FONT_SIZE_KEY, value); return true; }
  catch { return false; }
}
