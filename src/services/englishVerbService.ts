import type {
  EnglishVerb,
  EnglishVerbsData
} from "../types/englishVerb";

/**
 * Fonte dos verbos do JOGO DA FALA.
 *
 * O arquivo JSON deve ficar em:
 * public/english-verbs-common.json
 *
 * Opcionalmente, a URL pode ser sobrescrita no .env:
 * VITE_ENGLISH_VERBS_URL=/outro-arquivo.json
 */
const ENGLISH_VERBS_URL =
  import.meta.env.VITE_ENGLISH_VERBS_URL ?? "/english-verbs-common.json";

let cachedData: EnglishVerbsData | null = null;

function isEnglishVerbsData(value: unknown): value is EnglishVerbsData {
  if (!value || typeof value !== "object") {
    return false;
  }

  const data = value as Partial<EnglishVerbsData>;

  return (
    !!data.metadata &&
    typeof data.metadata === "object" &&
    Array.isArray(data.verbs)
  );
}

export async function loadEnglishVerbs(): Promise<EnglishVerbsData> {
  if (cachedData) {
    return cachedData;
  }

  const response = await fetch(ENGLISH_VERBS_URL);

  if (!response.ok) {
    throw new Error(
      `Não foi possível carregar os verbos (${response.status} ${response.statusText}).`
    );
  }

  const data: unknown = await response.json();

  if (!isEnglishVerbsData(data)) {
    throw new Error("O arquivo de verbos possui uma estrutura inválida.");
  }

  cachedData = data;

  return cachedData;
}

export async function getEnglishVerbs(): Promise<EnglishVerb[]> {
  const data = await loadEnglishVerbs();

  return data.verbs;
}

export async function getRandomEnglishVerb(
  previousVerbId?: string
): Promise<EnglishVerb> {
  const verbs = await getEnglishVerbs();

  if (verbs.length === 0) {
    throw new Error("Nenhum verbo está disponível para o Jogo da Fala.");
  }

  if (verbs.length === 1) {
    return verbs[0];
  }

  let verb = verbs[Math.floor(Math.random() * verbs.length)];

  while (verb.id === previousVerbId) {
    verb = verbs[Math.floor(Math.random() * verbs.length)];
  }

  return verb;
}

export function clearEnglishVerbsCache(): void {
  cachedData = null;
}
