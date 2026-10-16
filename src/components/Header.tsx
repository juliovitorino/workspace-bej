import { LANGUAGES, type SourceLanguage, type StudentLanguage } from "../config/languages";

interface HeaderProps {
  language: StudentLanguage;
  sourceLanguage: SourceLanguage;
}

export function Header({ language, sourceLanguage }: HeaderProps) {
  const pairLabel = LANGUAGES[sourceLanguage].name + " → " + LANGUAGES[language].name;
  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">Brazilian English Journey</p>
        <h1>Mental Hashmap</h1>
        <p className="subtitle">Estude intenções de um idioma para outro.</p>
      </div>
      <span className="language-pair-indicator" role="status" aria-label={pairLabel} title={pairLabel}>
        <span aria-hidden="true">{LANGUAGES[sourceLanguage].flag} → {LANGUAGES[language].flag}</span>
      </span>
    </header>
  );
}
