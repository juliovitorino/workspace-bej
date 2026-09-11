import type { HashmapData } from "../types/hashmap";

const CACHE_KEY = "mental-hashmap-data";

export function saveHashmapCache(data: HashmapData): void {
  localStorage.setItem(CACHE_KEY, JSON.stringify(data));
}

export function getHashmapCache(): HashmapData | null {
  const raw = localStorage.getItem(CACHE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as HashmapData;
  } catch {
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

export function clearHashmapCache(): void {
  localStorage.removeItem(CACHE_KEY);
}
