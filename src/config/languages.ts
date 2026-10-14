export type StudentLanguage = "en-US" | "es-ES" | "fr-FR";

export const DEFAULT_STUDENT_LANGUAGE: StudentLanguage = "en-US";
export const STUDENT_LANGUAGE_KEY = "mental-hashmap-student-language";

export const LANGUAGES: Record<StudentLanguage, { name: string; flag: string; url: string }> = {
  "en-US": { name: "Inglês americano", flag: "🇺🇸", url: "/sample-hashmap-en-US.json" },
  "es-ES": { name: "Espanhol", flag: "🇪🇸", url: "/sample-hashmap-es-ES.json" },
  "fr-FR": { name: "Francês", flag: "🇫🇷", url: "/sample-hashmap-fr-FR.json" }
};

export function isStudentLanguage(value: unknown): value is StudentLanguage {
  return value === "en-US" || value === "es-ES" || value === "fr-FR";
}

export function getStudentLanguage(): StudentLanguage {
  try {
    const saved = localStorage.getItem(STUDENT_LANGUAGE_KEY);
    return isStudentLanguage(saved) ? saved : DEFAULT_STUDENT_LANGUAGE;
  } catch {
    return DEFAULT_STUDENT_LANGUAGE;
  }
}
