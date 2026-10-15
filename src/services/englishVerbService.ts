import type { StudentLanguage } from "../config/languages";
import type { EnglishVerb, EnglishVerbsData, SpeakingVerb, GameAdjective, GameNoun } from "../types/englishVerb";

export interface SpeakingVocabulary {
  verbs: SpeakingVerb[];
  adjectives: GameAdjective[];
  nouns: GameNoun[];
}

// Share pending requests and completed data only within the same language/URL.
const catalogs = new Map<string, Promise<unknown>>();
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object");
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.length > 0 && value.every(text);

function catalogUrl(category: keyof SpeakingVocabulary, language: StudentLanguage): string {
  const override = import.meta.env.VITE_ENGLISH_VERBS_URL;
  if (category === "verbs" && override) {
    if (override.includes("{language}")) return override.replaceAll("{language}", language);
    if (language === "en-US") return override;
  }
  return `/english-${category}-common-${language}.json`;
}

async function loadCatalog(category: keyof SpeakingVocabulary, language: StudentLanguage): Promise<unknown> {
  const url = catalogUrl(category, language);
  const key = `${language}:${url}`;
  const cached = catalogs.get(key);
  if (cached) return cached;
  const pending = (async () => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Não foi possível carregar ${category} (${response.status}).`);
    const data: unknown = await response.json();
    if (!record(data) || !record(data.metadata) || !Array.isArray(data[category])) throw new Error("Catálogo de vocabulário inválido.");
    if (![language, language.slice(0, 2)].includes(String(data.metadata.language))) throw new Error("O idioma do catálogo não corresponde ao idioma de estudo.");
    const entries = data[category];
    if (!entries.length) throw new Error("O catálogo de vocabulário está vazio.");
    const seen = new Set<string>();
    for (const item of entries) {
      if (!record(item) || !text(item.id) || seen.has(item.id) || !strings(item.meanings)) throw new Error("Registro de vocabulário inválido ou duplicado.");
      seen.add(item.id);
      if (category === "verbs") {
        if (!text(item.base)) throw new Error("Verbo sem forma principal.");
        if (language === "en-US") {
          if (![item.past, item.pastParticiple, item.thirdPerson, item.gerund].every(text)) throw new Error("Formas inglesas incompletas.");
        } else if (!record(item.forms) || !record(item.trainingForms) || !Object.values(item.trainingForms).length || !Object.values(item.trainingForms).every(text) ||
          !["infinitive", "present", "past", "imperfect", "participle", "gerund", "perfect", "pluperfect", "perfectInfinitive"].every(field => record(item.forms) && text(item.forms[field]))) throw new Error("Formas verbais incompletas.");
      } else if (category === "adjectives") {
        if (!text(item.adjective) || (language !== "en-US" && (!record(item.forms) || !["masculine", "feminine", "masculinePlural", "femininePlural"].every(k => record(item.forms) && text(item.forms[k]))))) throw new Error("Adjetivo inválido.");
      } else if (!text(item.noun) || (language !== "en-US" && (!text(item.article) || !["masculine", "feminine", "invariant"].includes(String(item.gender))))) throw new Error("Substantivo inválido.");
    }
    return data;
  })();
  catalogs.set(key, pending);
  try { return await pending; }
  catch (error) { if (catalogs.get(key) === pending) catalogs.delete(key); throw error; }
}

export async function getSpeakingVocabulary(language: StudentLanguage): Promise<SpeakingVocabulary> {
  const [verbs, adjectives, nouns] = await Promise.all([
    loadCatalog("verbs", language), loadCatalog("adjectives", language), loadCatalog("nouns", language)
  ]);
  return {
    verbs: (verbs as { verbs: SpeakingVerb[] }).verbs,
    adjectives: (adjectives as { adjectives: GameAdjective[] }).adjectives,
    nouns: (nouns as { nouns: GameNoun[] }).nouns,
  };
}

export async function loadEnglishVerbs(): Promise<EnglishVerbsData> {
  return await loadCatalog("verbs", "en-US") as EnglishVerbsData;
}
export async function getEnglishVerbs(): Promise<EnglishVerb[]> { return (await loadEnglishVerbs()).verbs; }
export async function getRandomEnglishVerb(previousVerbId?: string): Promise<EnglishVerb> {
  const verbs = await getEnglishVerbs();
  const pool = verbs.filter(verb => verb.id !== previousVerbId);
  const available = pool.length ? pool : verbs;
  return available[Math.floor(Math.random() * available.length)];
}
export function clearEnglishVerbsCache(): void { catalogs.clear(); }
