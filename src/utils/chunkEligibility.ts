import type { MentalIntention } from "../types/hashmap";

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type ChunkLevel = "all" | typeof CEFR_LEVELS[number];

export function eligibleChunks(intentions: MentalIntention[], level: ChunkLevel): MentalIntention[] {
  return intentions.filter(item =>
    item.allowLanguageChunkPractice === true &&
    typeof item.id === "string" &&
    typeof item.english === "string" && item.english.trim().length > 0 &&
    typeof item.intention === "string" && item.intention.trim().length > 0 &&
    (level === "all" || item.englishLevel?.trim().toUpperCase() === level)
  );
}

// Existing flashcard draw policy, shared by manual and automatic advancement.
// Keep this separate from eligibility so changing a filter uses the same draw.
export function drawChunk(pool: MentalIntention[], drawnIds: string[], currentId: string | null, restart = false) {
  if (pool.length === 0) return null;
  const newRound = restart || drawnIds.length === pool.length;
  const seen = new Set(drawnIds);
  const candidates = newRound
    ? pool.filter(item => restart || pool.length === 1 || item.id !== currentId)
    : pool.filter(item => !seen.has(item.id));
  if (candidates.length === 0) return null;
  const id = candidates[Math.floor(Math.random() * candidates.length)].id;
  return { id, drawnIds: newRound ? [id] : [...drawnIds, id], newRound };
}
