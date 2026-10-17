import type { StudentLanguage } from "../config/languages";

export interface FavoriteChunk { id: string; language: StudentLanguage }
export const FAVORITE_CHUNKS_KEY = "bej-favorite-chunks";

export function parseFavoriteChunks(raw: string | null): FavoriteChunk[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(value)) return [];
    const result: FavoriteChunk[] = [];
    for (const entry of value) {
      if (!entry || typeof entry.id !== "string" || !entry.id.trim() ||
        !["pt-BR", "en-US", "es-ES", "fr-FR"].includes(entry.language)) continue;
      if (!result.some(item => item.id === entry.id && item.language === entry.language)) {
        result.push({ id: entry.id, language: entry.language });
      }
    }
    return result;
  } catch { return []; }
}

export function readFavoriteChunks(): FavoriteChunk[] {
  try { return parseFavoriteChunks(localStorage.getItem(FAVORITE_CHUNKS_KEY)); }
  catch { return []; }
}

export function toggleFavoriteChunk(items: FavoriteChunk[], id: string, language: StudentLanguage): FavoriteChunk[] {
  return items.some(item => item.id === id && item.language === language)
    ? items.filter(item => item.id !== id || item.language !== language)
    : [...items, { id, language }];
}
