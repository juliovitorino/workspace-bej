export type StudentLanguage = "pt-BR" | "en-US" | "es-ES" | "fr-FR";
export type SourceLanguage = StudentLanguage;

export const DEFAULT_STUDENT_LANGUAGE: StudentLanguage = "en-US";
export const DEFAULT_SOURCE_LANGUAGE: SourceLanguage = "pt-BR";
export const STUDENT_LANGUAGE_KEY = "mental-hashmap-student-language";
export const SOURCE_LANGUAGE_KEY = "mental-hashmap-source-language";

export const LANGUAGES: Record<StudentLanguage, { name: string; flag: string; url: string }> = {
  "pt-BR": { name: "Português brasileiro", flag: "🇧🇷", url: "/sample-hashmap-pt-BR.json" },
  "en-US": { name: "Inglês americano", flag: "🇺🇸", url: "/sample-hashmap-en-US.json" },
  "es-ES": { name: "Espanhol", flag: "🇪🇸", url: "/sample-hashmap-es-ES.json" },
  "fr-FR": { name: "Francês", flag: "🇫🇷", url: "/sample-hashmap-fr-FR.json" }
};

export function isStudentLanguage(value: unknown): value is StudentLanguage {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(LANGUAGES, value);
}

export function getSourceLanguage(): SourceLanguage {
  try {
    const saved = localStorage.getItem(SOURCE_LANGUAGE_KEY);
    return isStudentLanguage(saved) ? saved : DEFAULT_SOURCE_LANGUAGE;
  } catch {
    return DEFAULT_SOURCE_LANGUAGE;
  }
}

export function getStudentLanguage(): StudentLanguage {
  try {
    const saved = localStorage.getItem(STUDENT_LANGUAGE_KEY);
    const source = getSourceLanguage();
    return isStudentLanguage(saved) && saved !== source
      ? saved : (source === DEFAULT_STUDENT_LANGUAGE ? DEFAULT_SOURCE_LANGUAGE : DEFAULT_STUDENT_LANGUAGE);
  } catch {
    return DEFAULT_STUDENT_LANGUAGE;
  }
}
