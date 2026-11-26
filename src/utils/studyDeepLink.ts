import type { StudentLanguage } from "../config/languages";

export type StudyDeepLinkModule = "intention" | "chunk" | "wrg" | "small-talk" | "interpretation";
export type StudyDeepLink = {
  module: StudyDeepLinkModule;
  id: string;
  source: StudentLanguage;
  target: StudentLanguage;
  topic?: string;
  level?: string;
};

const BASE_URL = "https://bejapp.com.br/";
const LANGUAGES: StudentLanguage[] = ["pt-BR", "en-US", "es-ES", "fr-FR"];
const MODULES: StudyDeepLinkModule[] = ["intention", "chunk", "wrg", "small-talk", "interpretation"];

/** Public, stable catalog IDs only. Never put private answers or generated story text in URLs. */
export function createStudyDeepLink(link: StudyDeepLink): string {
  const url = new URL(BASE_URL);
  url.searchParams.set("bej", link.module);
  url.searchParams.set("id", link.id);
  url.searchParams.set("source", link.source);
  url.searchParams.set("target", link.target);
  if (link.topic) url.searchParams.set("topic", link.topic);
  if (link.level) url.searchParams.set("level", link.level);
  return url.toString();
}

export function readStudyDeepLink(search?: string): StudyDeepLink | null {
  const params = new URLSearchParams(search ?? (typeof window === "undefined" ? "" : window.location.search));
  const module = params.get("bej");
  const id = params.get("id");
  const source = params.get("source");
  const target = params.get("target");
  if (!module || !MODULES.includes(module as StudyDeepLinkModule) || !id || id.length > 160 ||
      !source || !LANGUAGES.includes(source as StudentLanguage) ||
      !target || !LANGUAGES.includes(target as StudentLanguage) || source === target) return null;
  const topic = params.get("topic") ?? undefined;
  const level = params.get("level") ?? undefined;
  if ((topic && topic.length > 160) || (level && !/^(A1|A2|B1|B2|C1|C2)$/.test(level))) return null;
  return { module: module as StudyDeepLinkModule, id, source: source as StudentLanguage,
    target: target as StudentLanguage, topic, level };
}
