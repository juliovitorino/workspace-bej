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
/** A versioned, per-question change log allows removals to survive multi-device merges. */
export const WYR_SYNC_STATE_KEY = "bej:would-you-rather:sync-state:v1";
export const WYR_SYNC_CHANGED = "bej-wyr-sync-changed";
const LEGACY_TIMESTAMP = "1970-01-01T00:00:00.000Z";
export type WyrFavoriteRevision = { value: boolean; updatedAt: string };
export type WyrChoiceRevision = { value: WyrChoice; updatedAt: string };
export type WyrProgressSync = {
  favorites: Record<string, WyrFavoriteRevision>;
  choices: Record<string, WyrChoiceRevision>;
};
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const validDate = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));
export function validateWyrProgress(value: unknown): WyrProgressSync {
  const result: WyrProgressSync = { favorites: {}, choices: {} };
  if (!isRecord(value)) return result;
  if (isRecord(value.favorites)) for (const [id, raw] of Object.entries(value.favorites)) {
    if (isUuid(id) && isRecord(raw) && typeof raw.value === "boolean" && validDate(raw.updatedAt))
      result.favorites[id] = { value: raw.value, updatedAt: raw.updatedAt };
  }
  if (isRecord(value.choices)) for (const [id, raw] of Object.entries(value.choices)) {
    if (isUuid(id) && isRecord(raw) && (raw.value === "A" || raw.value === "B") && validDate(raw.updatedAt))
      result.choices[id] = { value: raw.value, updatedAt: raw.updatedAt };
  }
  return result;
}
/** Upgrade old device-local choices and favorites without inventing a recent edit date. */
export function readWyrProgress(): WyrProgressSync {
  let saved: unknown;
  try { saved = JSON.parse(localStorage.getItem(WYR_SYNC_STATE_KEY) || "null"); } catch { saved = null; }
  const progress = validateWyrProgress(saved);
  const legacy = readWyrStored();
  for (const id of legacy.favorites)
    progress.favorites[id] ??= { value: true, updatedAt: LEGACY_TIMESTAMP };
  for (const [id, value] of Object.entries(legacy.choices))
    progress.choices[id] ??= { value, updatedAt: LEGACY_TIMESTAMP };
  return progress;
}
function nextEditTime(previous?: string): string {
  return new Date(Math.max(Date.now(), previous ? Date.parse(previous) + 1 : 0)).toISOString();
}
/** Write all three storage keys; roll back if any write fails. */
export function writeWyrProgress(value: WyrProgressSync): boolean {
  const progress = validateWyrProgress(value);
  const favorites = Object.entries(progress.favorites).filter(([, item]) => item.value).map(([id]) => id);
  const choices = Object.fromEntries(Object.entries(progress.choices).map(([id, item]) => [id, item.value]));
  const entries: [string, string][] = [
    [WYR_SYNC_STATE_KEY, JSON.stringify(progress)],
    [WYR_FAVORITES_KEY, JSON.stringify(favorites)],
    [WYR_PROGRESS_KEY, JSON.stringify(choices)]
  ];
  const originals = entries.map(([key]) => [key, localStorage.getItem(key)] as const);
  try {
    for (const [key, data] of entries) localStorage.setItem(key, data);
  } catch {
    for (const [key, data] of originals) {
      try { if (data === null) localStorage.removeItem(key); else localStorage.setItem(key, data); } catch { /* storage unavailable */ }
    }
    return false;
  }
  window.dispatchEvent(new Event(WYR_SYNC_CHANGED));
  return true;
}
export function saveWyrFavorites(ids: string[]): boolean {
  try {
    const progress = readWyrProgress();
    const previous = new Set(readWyrStored().favorites);
    const desired = new Set(ids.filter(isUuid));
    for (const id of new Set([...previous, ...desired])) {
      if (previous.has(id) !== desired.has(id))
        progress.favorites[id] = { value: desired.has(id), updatedAt: nextEditTime(progress.favorites[id]?.updatedAt) };
    }
    return writeWyrProgress(progress);
  } catch { return false; }
}
export function saveWyrChoices(choices: Record<string, WyrChoice>): boolean {
  try {
    const progress = readWyrProgress();
    for (const [id, value] of Object.entries(choices)) {
      if (!isUuid(id) || (value !== "A" && value !== "B")) continue;
      if (progress.choices[id]?.value !== value)
        progress.choices[id] = { value, updatedAt: nextEditTime(progress.choices[id]?.updatedAt) };
    }
    return writeWyrProgress(progress);
  } catch { return false; }
}
function latest<T extends { updatedAt: string }>(a: T | undefined, b: T): T {
  if (!a) return b;
  const time = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  if (time !== 0) return time > 0 ? b : a;
  // A simultaneous unfavorite must not be resurrected by an equally dated favorite.
  if ("value" in a && "value" in b && typeof a.value === "boolean" && typeof b.value === "boolean" && a.value !== b.value)
    return a.value ? b : a;
  return JSON.stringify(b) > JSON.stringify(a) ? b : a;
}
/** Commutative and idempotent merge, including tombstones for removed favorites. */
export function mergeWyrProgress(...sources: (WyrProgressSync | undefined)[]): WyrProgressSync {
  const merged: WyrProgressSync = { favorites: {}, choices: {} };
  for (const source of sources) {
    const valid = validateWyrProgress(source);
    for (const [id, revision] of Object.entries(valid.favorites))
      merged.favorites[id] = latest(merged.favorites[id], revision);
    for (const [id, revision] of Object.entries(valid.choices))
      merged.choices[id] = latest(merged.choices[id], revision);
  }
  return merged;
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
