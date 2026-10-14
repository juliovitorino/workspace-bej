import { DEFAULT_STUDENT_LANGUAGE, type StudentLanguage } from "../config/languages";
import type { HashmapData } from "../types/hashmap";

const CACHE_KEY = "mental-hashmap-data";

export function saveHashmapCache(data: HashmapData, language: StudentLanguage = DEFAULT_STUDENT_LANGUAGE): void {
  try {
    localStorage.setItem(`${CACHE_KEY}-${language}`, JSON.stringify(data));
  } catch {
    // Cache is optional: quota or storage restrictions must not block loaded data.
  }
}

export function getHashmapCache(language: StudentLanguage = DEFAULT_STUDENT_LANGUAGE): HashmapData | null {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY}-${language}`);
    if (!raw) return null;
    return JSON.parse(raw) as HashmapData;
  } catch {
    clearHashmapCache(language);
    return null;
  }
}

export function clearHashmapCache(language: StudentLanguage = DEFAULT_STUDENT_LANGUAGE): void {
  try {
    localStorage.removeItem(`${CACHE_KEY}-${language}`);
  } catch {
    // Storage may also be unavailable when reading or clearing the cache.
  }
}
