import { DEFAULT_STUDENT_LANGUAGE, type StudentLanguage } from "../config/languages";
import type { HashmapData } from "../types/hashmap";

const CACHE_KEY = "mental-hashmap-data";

export function saveHashmapCache(data: HashmapData, language: StudentLanguage = DEFAULT_STUDENT_LANGUAGE): void {
  localStorage.setItem(`${CACHE_KEY}-${language}`, JSON.stringify(data));
}

export function getHashmapCache(language: StudentLanguage = DEFAULT_STUDENT_LANGUAGE): HashmapData | null {
  const raw = localStorage.getItem(`${CACHE_KEY}-${language}`);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as HashmapData;
  } catch {
    localStorage.removeItem(`${CACHE_KEY}-${language}`);
    return null;
  }
}

export function clearHashmapCache(language: StudentLanguage = DEFAULT_STUDENT_LANGUAGE): void {
  localStorage.removeItem(`${CACHE_KEY}-${language}`);
}
