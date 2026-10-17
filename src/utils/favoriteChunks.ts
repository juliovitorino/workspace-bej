import type { StudentLanguage } from "../config/languages";

export interface FavoriteChunk { id: string; language: StudentLanguage; type?: "example" }
export const FAVORITE_CHUNKS_KEY = "bej-favorite-chunks";

export function parseFavoriteChunks(raw: string | null): FavoriteChunk[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(value)) return [];
    const result: FavoriteChunk[] = [];
    for (const entry of value) {
      if (!entry || typeof entry.id !== "string" || !entry.id.trim() ||
        (entry.type !== undefined && entry.type !== "example") ||
        !["pt-BR", "en-US", "es-ES", "fr-FR"].includes(entry.language)) continue;
      if (!result.some(item => item.id === entry.id && item.language === entry.language && item.type === entry.type)) {
        result.push({ id: entry.id, language: entry.language, ...(entry.type === "example" ? { type: "example" as const } : {}) });
      }
    }
    return result;
  } catch { return []; }
}

export function readFavoriteChunks(): FavoriteChunk[] {
  try { return parseFavoriteChunks(localStorage.getItem(FAVORITE_CHUNKS_KEY)); }
  catch { return []; }
}

export function toggleFavoriteChunk(items: FavoriteChunk[], id: string, language: StudentLanguage, type?: "example"): FavoriteChunk[] {
  return items.some(item => item.id === id && item.language === language && item.type === type)
    ? items.filter(item => item.id !== id || item.language !== language || item.type !== type)
    : [...items, { id, language, ...(type ? { type } : {}) }];
}
