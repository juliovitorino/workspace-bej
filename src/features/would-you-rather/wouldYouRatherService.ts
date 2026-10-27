import type { StudentLanguage } from "../../config/languages";

export interface WyrOption { text: string; answer: string }
export interface WyrQuestion { id: string; order: number; level: string; question: string; options: { A: WyrOption; B: WyrOption }; tags: string[] }
export interface WyrTopic { id: string; order: number; title: string; category: string; level: string; levelNote: string; questions: WyrQuestion[] }
export interface WyrData { metadata: { name: string; schemaVersion: string; language: StudentLanguage; totalTopics: number; totalQuestions: number; totalAnswers: number; levelRange: string }; topics: WyrTopic[] }
export interface WyrLoaded { data: WyrData; locale: StudentLanguage; fallback: boolean }

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const filled = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

export function validateWouldYouRather(raw: unknown): WyrData {
  if (!isRecord(raw) || !isRecord(raw.metadata) || !Array.isArray(raw.topics)) throw new Error("Estrutura do arquivo inválida.");
  const meta = raw.metadata;
  if (!filled(meta.schemaVersion) || !filled(meta.language) || !Number.isInteger(meta.totalTopics) || !Number.isInteger(meta.totalQuestions) || !Number.isInteger(meta.totalAnswers)) {
    throw new Error("Metadados do jogo inválidos.");
  }
  if (raw.topics.length !== 50 || meta.totalTopics !== 50 || meta.totalQuestions !== 500 || meta.totalAnswers !== 1000) {
    throw new Error("O conteúdo deve conter 50 tópicos, 500 perguntas e 1.000 respostas.");
  }
  const topicIds = new Set<string>();
  const questionIds = new Set<string>();
  for (const topic of raw.topics) {
    if (!isRecord(topic) || !filled(topic.id) || !filled(topic.title) || !filled(topic.category) || !Number.isInteger(topic.order) ||
        !Array.isArray(topic.questions) || topic.questions.length !== 10 || topicIds.has(topic.id)) throw new Error("Tópico inválido ou duplicado.");
    topicIds.add(topic.id);
    for (const q of topic.questions) {
      if (!isRecord(q) || !filled(q.id) || !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(q.id) ||
          questionIds.has(q.id) || !Number.isInteger(q.order) || !filled(q.question) || !filled(q.level) || !isRecord(q.options) ||
          !isRecord(q.options.A) || !isRecord(q.options.B) || !filled(q.options.A.text) || !filled(q.options.B.text) ||
          !filled(q.options.A.answer) || !filled(q.options.B.answer) || !Array.isArray(q.tags)) throw new Error("Pergunta incompleta ou ID duplicado.");
      questionIds.add(q.id);
    }
  }
  if (questionIds.size !== 500) throw new Error("Quantidade de perguntas inconsistente.");
  return raw as unknown as WyrData;
}

async function getLocale(locale: StudentLanguage, signal: AbortSignal): Promise<WyrData> {
  const base = import.meta.env.BASE_URL ?? "/";
  const url = `${base.replace(/\/$/, "")}/would-you-rather/${locale}.json`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Arquivo indisponível (${response.status}): ${locale}`);
  const data = validateWouldYouRather(await response.json());
  if (data.metadata.language !== locale) throw new Error(`Idioma do conteúdo divergente: ${locale}`);
  return data;
}

export async function loadWouldYouRather(locale: StudentLanguage, signal: AbortSignal): Promise<WyrLoaded> {
  if (locale !== "en-US") {
    try { return { data: await getLocale(locale, signal), locale, fallback: false }; }
    catch (error) { if (signal.aborted) throw error; /* Arquivos não publicados não são conteúdo válido. */ }
  }
  return { data: await getLocale("en-US", signal), locale: "en-US", fallback: locale !== "en-US" };
}

export function normalizeWyrSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
}
