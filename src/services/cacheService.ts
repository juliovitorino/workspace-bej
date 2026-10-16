import { DEFAULT_SOURCE_LANGUAGE, DEFAULT_STUDENT_LANGUAGE, type SourceLanguage, type StudentLanguage } from "../config/languages";
import type { HashmapData } from "../types/hashmap";

const CACHE_KEY = "mental-hashmap-data-v4-target-hq-only";
const keyFor = (language: StudentLanguage, source: SourceLanguage) => `${CACHE_KEY}-${source}-${language}`;

export function saveHashmapCache(data: HashmapData, language: StudentLanguage = DEFAULT_STUDENT_LANGUAGE, source: SourceLanguage = DEFAULT_SOURCE_LANGUAGE): void {
  try {
    localStorage.setItem(keyFor(language, source), JSON.stringify(data));
  } catch {
    // Cache is optional: quota or storage restrictions must not block loaded data.
  }
}

export function getHashmapCache(language: StudentLanguage = DEFAULT_STUDENT_LANGUAGE, source: SourceLanguage = DEFAULT_SOURCE_LANGUAGE): HashmapData | null {
  try {
    const raw = localStorage.getItem(keyFor(language, source));
    if (!raw) return null;
    return JSON.parse(raw) as HashmapData;
  } catch {
    clearHashmapCache(language, source);
    return null;
  }
}

export function clearHashmapCache(language: StudentLanguage = DEFAULT_STUDENT_LANGUAGE, source: SourceLanguage = DEFAULT_SOURCE_LANGUAGE): void {
  try {
    localStorage.removeItem(keyFor(language, source));
  } catch {
    // Storage may also be unavailable when reading or clearing the cache.
  }
}
