import type { HashmapData, MentalIntention } from "../types/hashmap";
import { getHashmapCache, saveHashmapCache } from "./cacheService";

const HASHMAP_URL =
  import.meta.env.VITE_HASHMAP_URL || "/sample-hashmap.json";

function isMentalIntention(value: unknown): value is MentalIntention {
  if (!value || typeof value !== "object") return false;

  const item = value as MentalIntention;

  return (
    typeof item.id === "string" &&
    typeof item.intention === "string" &&
    typeof item.english === "string"
  );
}

function validateHashmapData(value: unknown): HashmapData {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid JSON: root object not found.");
  }

  const data = value as HashmapData;

  if (!data.metadata || typeof data.metadata.version !== "string") {
    throw new Error("Invalid JSON: metadata.version is required.");
  }

  if (!Array.isArray(data.mentalMap)) {
    throw new Error("Invalid JSON: mentalMap must be an array.");
  }

  const validItems = data.mentalMap.filter(isMentalIntention);

  if (validItems.length === 0) {
    throw new Error("Invalid JSON: no valid mental intentions were found.");
  }

  return {
    ...data,
    mentalMap: validItems
  };
}

export async function fetchHashmap(): Promise<HashmapData> {
  const response = await fetch(HASHMAP_URL, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(
      `Could not load Mental Hashmap. HTTP ${response.status}`
    );
  }

  const json = await response.json();
  const validated = validateHashmapData(json);

  saveHashmapCache(validated);
  return validated;
}

export async function loadHashmap(): Promise<{
  data: HashmapData;
  source: "remote" | "cache";
}> {
  try {
    const data = await fetchHashmap();
    return { data, source: "remote" };
  } catch (remoteError) {
    const cached = getHashmapCache();

    if (cached) {
      return { data: cached, source: "cache" };
    }

    throw remoteError;
  }
}
