import { isStudentLanguage, type StudentLanguage } from "../config/languages";

/** Compact, per-language/per-chunk grow-only counters. Each device owns its own counter. */
export const CHUNK_LIKES_KEY = "bej:likes:v1";
export const CHUNK_LIKES_CHANGED = "bej:likes:changed";
export type ChunkLikes = Partial<Record<StudentLanguage, Record<string, Record<string, number>>>>;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Reject corrupt remote data instead of silently discarding likes during synchronization. */
export function validateChunkLikes(value: unknown): ChunkLikes {
  if (!record(value)) throw new Error("Invalid chunk likes data.");
  const languages: ChunkLikes = {};
  for (const [language, chunks] of Object.entries(value)) {
    if (!isStudentLanguage(language) || !record(chunks)) throw new Error("Invalid chunk likes language.");
    const validChunks: Record<string, Record<string, number>> = Object.create(null);
    for (const [chunkId, devices] of Object.entries(chunks)) {
      if (!chunkId.trim() || chunkId === "__proto__" || !record(devices)) throw new Error("Invalid chunk likes ID.");
      const validDevices: Record<string, number> = Object.create(null);
      for (const [device, count] of Object.entries(devices)) {
        if (!device.trim() || device === "__proto__" || !Number.isSafeInteger(count) || (count as number) <= 0)
          throw new Error("Invalid chunk likes counter.");
        validDevices[device] = count as number;
      }
      if (Object.keys(validDevices).length) validChunks[chunkId] = validDevices;
    }
    if (Object.keys(validChunks).length) languages[language] = validChunks;
  }
  return languages;
}

export function readChunkLikes(storage: Storage = localStorage): ChunkLikes {
  const raw = storage.getItem(CHUNK_LIKES_KEY);
  if (raw === null) return {};
  try { return validateChunkLikes(JSON.parse(raw)); }
  catch { throw new Error("Could not read saved chunk likes."); }
}

export function writeChunkLikes(value: ChunkLikes, storage: Storage = localStorage): void {
  storage.setItem(CHUNK_LIKES_KEY, JSON.stringify(validateChunkLikes(value)));
  if (typeof window !== "undefined" && storage === localStorage) {
    window.dispatchEvent(new Event(CHUNK_LIKES_CHANGED));
  }
}

/** Merge by maximum for each device, never by adding already-synced snapshots. */
export function mergeChunkLikes(left: ChunkLikes, right: ChunkLikes): ChunkLikes {
  const merged = validateChunkLikes(left);
  for (const [language, chunks] of Object.entries(validateChunkLikes(right))) {
    const lang = language as StudentLanguage;
    const current = merged[lang] ?? (merged[lang] = Object.create(null));
    for (const [chunkId, devices] of Object.entries(chunks)) {
      const counters = current[chunkId] ?? (current[chunkId] = Object.create(null));
      for (const [device, count] of Object.entries(devices)) {
        counters[device] = Math.max(counters[device] ?? 0, count);
      }
    }
  }
  return merged;
}

export function chunkLikeTotal(likes: ChunkLikes, language: StudentLanguage, chunkId: string): number {
  return Object.values(likes[language]?.[chunkId] ?? {}).reduce((sum, count) => Math.min(Number.MAX_SAFE_INTEGER, sum + count), 0);
}

export function incrementChunkLike(language: StudentLanguage, chunkId: string, device: string, storage: Storage = localStorage): ChunkLikes {
  if (!chunkId.trim() || !device.trim()) throw new Error("Invalid chunk likes ID.");
  const likes = readChunkLikes(storage);
  const chunks = likes[language] ?? (likes[language] = Object.create(null));
  const devices = chunks[chunkId] ?? (chunks[chunkId] = Object.create(null));
  const previous = devices[device] ?? 0;
  if (previous >= Number.MAX_SAFE_INTEGER) return likes;
  devices[device] = previous + 1;
  writeChunkLikes(likes, storage);
  return likes;
}
