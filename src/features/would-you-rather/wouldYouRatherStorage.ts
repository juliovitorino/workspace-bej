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
