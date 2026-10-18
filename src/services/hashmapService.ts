import { t } from "../i18n";
import { DEFAULT_SOURCE_LANGUAGE, DEFAULT_STUDENT_LANGUAGE, LANGUAGES, type SourceLanguage, type StudentLanguage } from "../config/languages";
import type {
  Example,
  HashmapData,
  HashmapDataV4,
  HashmapExampleV4,
  HashmapIntentionV4,
  MentalIntention
} from "../types/hashmap";
import { getHashmapCache, saveHashmapCache } from "./cacheService";



const LOCALE_HASHMAP_URLS: Record<string, string> = {
  "pt": LANGUAGES["pt-BR"].url,
  "pt-br": LANGUAGES["pt-BR"].url,
  "en": LANGUAGES["en-US"].url,
  "en-us": LANGUAGES["en-US"].url,
  "en-gb": LANGUAGES["en-US"].url,
  "es": LANGUAGES["es-ES"].url,
  "es-es": LANGUAGES["es-ES"].url,
  "es-mx": LANGUAGES["es-ES"].url,
  "fr": LANGUAGES["fr-FR"].url,
  "fr-fr": LANGUAGES["fr-FR"].url,
  "fr-ca": LANGUAGES["fr-FR"].url
};

export function resolveHashmapUrl(locale?: string | null): string {
  const configuredUrl = import.meta.env.VITE_HASHMAP_URL;
  const resolvedLocale = (locale ?? (typeof navigator !== "undefined" ? navigator.language : "") ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  const url = LOCALE_HASHMAP_URLS[resolvedLocale] ??
    LOCALE_HASHMAP_URLS[resolvedLocale.split("-")[0]] ??
    LANGUAGES[DEFAULT_STUDENT_LANGUAGE].url;

  if (configuredUrl?.includes("{language}")) {
    const fileLanguage = url.match(/sample-hashmap-(.+)\.json$/)?.[1] ?? DEFAULT_STUDENT_LANGUAGE;
    return configuredUrl.replaceAll("{language}", fileLanguage);
  }
  if (typeof configuredUrl === "string" && configuredUrl.trim() &&
      !configuredUrl.startsWith("/sample-hashmap")) {
    return configuredUrl.trim();
  }
  return url;
}

function getHashmapUrl(language: StudentLanguage): string {
  const configured = import.meta.env.VITE_HASHMAP_URL;
  if (configured?.includes("{language}")) {
    return configured.replaceAll("{language}", language);
  }
  if (language === DEFAULT_STUDENT_LANGUAGE && configured &&
      !configured.startsWith("/sample-hashmap")) {
    return configured;
  }
  return LANGUAGES[language].url;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isExampleV4(value: unknown): value is HashmapExampleV4 {
  return isObject(value) && typeof value.id === "string" &&
    typeof value.exampleItem === "string" && typeof value.intent === "string";
}

function isIntentionV4(value: unknown): value is HashmapIntentionV4 {
  return isObject(value) && typeof value.id === "string" &&
    typeof value.intention === "string" &&
    (value.examples === undefined ||
      (Array.isArray(value.examples) && value.examples.every(isExampleV4)));
}

function validateHashmapV4(value: unknown, language: string): HashmapDataV4 {
  if (!isObject(value) || !isObject(value.metadata) || !Array.isArray(value.mentalMap)) {
    throw new Error(t("catalog.invalidJsonLanguageMetadataOrMentalmapNotFound", { language: (language) }));
  }
  if (value.metadata.schemaVersion !== "4.0.0" || value.metadata.language !== language) {
    throw new Error(t("catalog.invalidJsonLanguageSchemaversionOrMetadataLanguageMismatch", { language: (language) }));
  }
  if (!value.mentalMap.length || !value.mentalMap.every(isIntentionV4)) {
    throw new Error(t("catalog.invalidJsonLanguageInvalidMentalIntentionsOrExamples", { language: (language) }));
  }
  return value as unknown as HashmapDataV4;
}

async function fetchCatalog(language: StudentLanguage): Promise<HashmapDataV4> {
  const response = await fetch(getHashmapUrl(language), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(t("catalog.couldNotLoadMentalHashmapLanguageHttpStatus", { language: (language), status: (response.status) }));
  }
  return validateHashmapV4(await response.json(), language);
}

/**
 * No contrato JSON 4.0, `intention` ainda é o identificador textual em pt-BR
 * em TODOS os catálogos. O rótulo localizado está em `structure` nos catálogos
 * en-US, es-ES e fr-FR. Não usar `intention` como título desses idiomas.
 *
 * Quando o JSON passar a fornecer um campo `intention` traduzido, este
 * adaptador poderá ser revisado sem alterar os componentes da listagem.
 */
function localizedIntention(item: HashmapIntentionV4, locale: string): string {
  if (locale === "pt-BR") return item.intention;
  return item.structure?.trim() || item.pattern?.trim() || item.intention;
}

/**
 * O JSON 4.0 guarda uma frase por idioma. As telas atuais usam pares pt/en;
 * por isso associamos exemplos SOMENTE pelo UUID, nunca pela posição no array.
 * Exemplos sem correspondência entre origem e estudo permanecem nos JSONs.
 */
function normalizeHashmap(target: HashmapDataV4, source: HashmapDataV4): HashmapData {
  const sourceById = new Map(source.mentalMap.map((item) => [item.id, item]));

  const mentalMap: MentalIntention[] = target.mentalMap.map((item) => {
    const original = sourceById.get(item.id);
    const sourceExamples = new Map((original?.examples ?? []).map((example) => [example.id, example]));

    const examples: Example[] = (item.examples ?? []).flatMap((example) => {
      const pt = sourceExamples.get(example.id);
      return [{
        ...example,
        pt: pt?.exampleItem ?? "",
        en: example.exampleItem,
        ptIntent: pt?.intent,
        enIntent: example.intent,
        // HQ pertence exclusivamente ao idioma de estudo (Target).
        // Não reutilizar a HQ do Source quando o Target não tiver imagem.
        hqImage: example.hqImage?.trim() || undefined
      }];
    });

    return {
      ...item,
      // A explicação acompanha o idioma de origem, sem fallback para o Target.
      description: original?.description,
      // Títulos visíveis sempre no par escolhido; não repetir o pt-BR fixo.
      intention: localizedIntention(original ?? item, source.metadata.language),
      english: item.structure || item.pattern || item.intention,
      targetIntention: localizedIntention(item, target.metadata.language),
      sourceAudioText: original ? localizedIntention(original, source.metadata.language) : "",
      // Inclui TODOS os exemplos do idioma de origem, mesmo sem par no destino.
      sourceExampleTexts: (original?.examples ?? []).map((example) => example.exampleItem),
      // Não perder os campos de busca da origem ao normalizar o catálogo de estudo.
      sourcePattern: original?.pattern,
      sourceStructure: original?.structure,
      sourceSearchTerms: original?.searchTerms ?? [],
      sourceCategory: original?.category,
      sourceTags: Array.from(new Set(original?.tags ?? [])),
      targetTags: Array.from(new Set(item.tags ?? [])),
      tags: Array.from(new Set([...(original?.tags ?? []), ...(item.tags ?? [])])),
      englishLevel: item.level ?? original?.level,
      examples
    };
  });

  return { metadata: { ...target.metadata, sourceLanguage: source.metadata.language }, mentalMap };
}

function isCachedHashmapV4(value: unknown, language: StudentLanguage, source: SourceLanguage): value is HashmapData {
  if (!isObject(value) || !isObject(value.metadata) ||
      value.metadata.schemaVersion !== "4.0.0" || value.metadata.language !== language ||
      value.metadata.sourceLanguage !== source ||
      !Array.isArray(value.mentalMap) || !value.mentalMap.length) return false;

  return value.mentalMap.every((item: unknown) =>
    isObject(item) && typeof item.id === "string" &&
    typeof item.intention === "string" && typeof item.english === "string" &&
    Array.isArray(item.sourceTags) && item.sourceTags.every((tag: unknown) => typeof tag === "string") &&
    Array.isArray(item.targetTags) && item.targetTags.every((tag: unknown) => typeof tag === "string") &&
    Array.isArray(item.examples) && item.examples.every((example: unknown) =>
      isExampleV4(example) && typeof (example as unknown as Record<string, unknown>).pt === "string" &&
      typeof (example as unknown as Record<string, unknown>).en === "string")
  );
}

export async function fetchHashmap(language: StudentLanguage = DEFAULT_STUDENT_LANGUAGE, source: SourceLanguage = DEFAULT_SOURCE_LANGUAGE): Promise<HashmapData> {
  if (language === source) throw new Error(t("catalog.theSourceAndStudyLanguagesMustBeDifferent"));
  const [targetCatalog, sourceCatalog] = await Promise.all([
    fetchCatalog(language),
    fetchCatalog(source)
  ]);
  const normalized = normalizeHashmap(targetCatalog, sourceCatalog);
  saveHashmapCache(normalized, language, source);
  return normalized;
}

export async function loadHashmap(language: StudentLanguage = DEFAULT_STUDENT_LANGUAGE, source: SourceLanguage = DEFAULT_SOURCE_LANGUAGE): Promise<{
  data: HashmapData;
  source: "remote" | "cache";
}> {
  try {
    const data = await fetchHashmap(language, source);
    return { data, source: "remote" };
  } catch (remoteError) {
    const cached = getHashmapCache(language, source);
    if (isCachedHashmapV4(cached, language, source)) {
      return { data: cached, source: "cache" };
    }
    throw remoteError;
  }
}
