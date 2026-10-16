import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getSourceLanguage, type SourceLanguage, type StudentLanguage } from "../config/languages";
import pt from "./locales/pt-BR.json";
import en from "./locales/en-US.json";
import es from "./locales/es-ES.json";
import fr from "./locales/fr-FR.json";

void i18n.use(initReactI18next).init({
  resources: {
    "pt-BR": { translation: pt }, "en-US": { translation: en },
    "es-ES": { translation: es }, "fr-FR": { translation: fr }
  },
  lng: getSourceLanguage(),
  supportedLngs: ["pt-BR", "en-US", "es-ES", "fr-FR"],
  load: "currentOnly",
  fallbackLng: "en-US",
  initAsync: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false }
});

export function syncSourceLanguage(source: SourceLanguage): void {
  if (i18n.language !== source) void i18n.changeLanguage(source);
  if (typeof document !== "undefined") document.documentElement.lang = source;
}

// Services and event handlers resolve the current Source at invocation time.
export const t = i18n.t.bind(i18n);
const languageKeys: Record<StudentLanguage, string> = {
  "pt-BR": "languages.brazilianPortuguese", "en-US": "languages.americanEnglish",
  "es-ES": "languages.spanish", "fr-FR": "languages.french"
};
export function languageName(language: StudentLanguage): string { return t(languageKeys[language]); }
export default i18n;
