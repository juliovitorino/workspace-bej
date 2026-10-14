import { DEFAULT_STUDENT_LANGUAGE, LANGUAGES, type StudentLanguage } from "../config/languages";
import type { HashmapData, MentalIntention } from "../types/hashmap";
import { getHashmapCache, saveHashmapCache } from "./cacheService";

const DEFAULT_HASHMAP_URL = "/sample-hashmap.json";

const LOCALE_HASHMAP_URLS: Record<string, string> = {
  "en": "/sample-hashmap-en-US.json",
  "en-us": "/sample-hashmap-en-US.json",
  "en-gb": "/sample-hashmap-en-US.json",
  "es": "/sample-hashmap-es-ES.json",
  "es-es": "/sample-hashmap-es-ES.json",
  "es-mx": "/sample-hashmap-es-ES.json",
  "fr": "/sample-hashmap-fr-FR.json",
  "fr-fr": "/sample-hashmap-fr-FR.json",
  "fr-ca": "/sample-hashmap-fr-FR.json"
};

export function resolveHashmapUrl(locale?: string | null): string {
  const configuredUrl = import.meta?.env?.VITE_HASHMAP_URL;
  if (typeof configuredUrl === "string" && configuredUrl.trim()) {
    return configuredUrl.trim();
  }

  const resolvedLocale = (locale ?? (typeof navigator !== "undefined" ? navigator.language : "") ?? "")
    .trim();

  if (!resolvedLocale) {
    return DEFAULT_HASHMAP_URL;
  }

  const normalizedLocale = resolvedLocale.toLowerCase().replace(/_/g, "-");
  const candidateLocales = [normalizedLocale, normalizedLocale.split("-")[0]];

  for (const candidate of candidateLocales) {
    const mapped = LOCALE_HASHMAP_URLS[candidate];
    if (mapped) {
      return mapped;
    }
  }

  return DEFAULT_HASHMAP_URL;
}

// Legacy URL overrides only apply to the default language.
// A {language} template can explicitly configure all three sources.
function getHashmapUrl(language: StudentLanguage): string {
  const configured = import.meta.env.VITE_HASHMAP_URL;
  if (configured?.includes("{language}")) return configured.replaceAll("{language}", language);
  if (language === DEFAULT_STUDENT_LANGUAGE && configured &&
      !configured.startsWith("/sample-hashmap")) return configured;
  return LANGUAGES[language].url;
}

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

export async function fetchHashmap(language: StudentLanguage = DEFAULT_STUDENT_LANGUAGE): Promise<HashmapData> {
  const response = await fetch(getHashmapUrl(language), {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(
      `Could not load Mental Hashmap. HTTP ${response.status}`
    );
  }

  const json = await response.json();
  const validated = validateHashmapData(json);
  const targetStudent = (validated.metadata as typeof validated.metadata & { targetStudent?: string }).targetStudent;
  if (targetStudent !== undefined && targetStudent !== language) {
    throw new Error("Invalid JSON: targetStudent does not match the requested language.");
  }

  saveHashmapCache(validated, language);
  return validated;
}

export async function loadHashmap(language: StudentLanguage = DEFAULT_STUDENT_LANGUAGE): Promise<{
  data: HashmapData;
  source: "remote" | "cache";
}> {
  try {
    const data = await fetchHashmap(language);
    return { data, source: "remote" };
  } catch (remoteError) {
    const cached = getHashmapCache(language);

    if (cached) {
      return { data: validateHashmapData(cached), source: "cache" };
    }

    throw remoteError;
  }
}
