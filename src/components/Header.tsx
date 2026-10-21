import { t, languageName as localizedLanguageName } from "../i18n";
import { useTranslation } from "react-i18next";
import { LANGUAGES, type SourceLanguage, type StudentLanguage } from "../config/languages";

interface HeaderProps {
  language: StudentLanguage;
  sourceLanguage: SourceLanguage;
  onOpenLanguages: () => void;
}

export function Header({ language, sourceLanguage, onOpenLanguages }: HeaderProps) {
  const { t } = useTranslation();
  const pairLabel = localizedLanguageName(sourceLanguage) + " → " + localizedLanguageName(language);
  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">Brazilian English Journey</p>
        <h1>Mental Hashmap</h1>
        <p className="subtitle">{t("header.studyIntentionsFromOneLanguageToAnother")}</p>
      </div>
      <button type="button" className="language-pair-indicator"
        onClick={onOpenLanguages}
        aria-label={`${t("navigation.languages")}: ${pairLabel}`}
        aria-haspopup="dialog"
        title={`${t("navigation.languages")}: ${pairLabel}`}>
        <span aria-hidden="true">{LANGUAGES[sourceLanguage].flag} → {LANGUAGES[language].flag}</span>
      </button>
    </header>
  );
}
