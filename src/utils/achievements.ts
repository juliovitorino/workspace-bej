/** Cosmetic milestones, separate from the study timer and sync data. */
export const ACHIEVEMENT_EVENT = "bej:achievement";
const ACHIEVEMENTS_KEY = "bej:achievements:celebrated:v1";
export interface AchievementDetail { key: string; title: string; description: string }
const announced = new Set<string>();

/** Emits only the first unlock. A storage failure must never interrupt studying. */
export function celebrateAchievement(key: string, title: string, description: string): void {
  if (typeof window === "undefined" || !key || announced.has(key)) return;
  let saved: string[] = [];
  try {
    const data: unknown = JSON.parse(window.localStorage.getItem(ACHIEVEMENTS_KEY) ?? "[]");
    if (Array.isArray(data)) saved = data.filter((item): item is string => typeof item === "string");
  } catch { /* Cosmetic data only. */ }
  if (saved.includes(key)) { announced.add(key); return; }
  announced.add(key);
  try { window.localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify([...saved, key])); }
  catch { /* Quota / blocked storage must not affect studying. */ }
  window.dispatchEvent(new CustomEvent<AchievementDetail>(ACHIEVEMENT_EVENT, {
    detail: { key, title, description }
  }));
}
