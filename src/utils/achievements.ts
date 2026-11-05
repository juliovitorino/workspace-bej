/** Cosmetic milestones, separate from the study timer and sync data. */
export const ACHIEVEMENT_EVENT = "bej:achievement";
const ACHIEVEMENTS_KEY = "bej:achievements:celebrated:v1";
export interface AchievementDetail { key: string; title: string; description: string }
const announced = new Set<string>();

/** Counts distinct presented chunks (not individual audio repetitions). */
export function recordPracticedChunk(language: string, id: string): void {
  if (typeof window === "undefined" || !id) return;
  const key = `bej:achievements:practiced-chunks:${language}:v1`;
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    const ids = Array.isArray(stored) ? stored.filter((value): value is string => typeof value === "string") : [];
    if (ids.length >= 100 || ids.includes(id)) return;
    ids.push(id);
    window.localStorage.setItem(key, JSON.stringify(ids));
    if (ids.length >= 100) celebrateAchievement(`practiced-100-chunks:${language}`, "100 chunks praticados!", "Você praticou 100 chunks diferentes. Keep it up!");
  } catch { /* This optional tracker must never block chunk practice. */ }
}

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
