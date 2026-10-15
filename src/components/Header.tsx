import { LANGUAGES, type StudentLanguage } from "../config/languages";
import type { HashmapMetadata } from "../types/hashmap";

interface HeaderProps {
  language: StudentLanguage;
  languageLocked?: boolean;
  onLanguageChange: (language: StudentLanguage) => void;
  metadata?: HashmapMetadata;
  source?: "remote" | "cache";
}

export function Header({ metadata, source, language, onLanguageChange, languageLocked }: HeaderProps) {
  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">Brazilian English Journey</p>
        <h1>Mental Hashmap</h1>
        <p className="subtitle">
          Busque pela intenção em português ou pela estrutura em inglês.
        </p>
      </div>

      <div className="header-tools">
        <div className="language-selector" role="group" aria-label="Idioma do estudante">
          {(Object.keys(LANGUAGES) as StudentLanguage[]).map((code) => (
            <button key={code} type="button" aria-label={LANGUAGES[code].name}
              title={languageLocked ? "Encerre o Modo Caminhada para trocar o idioma" : LANGUAGES[code].name} aria-pressed={language === code}
              disabled={languageLocked}
              onClick={() => onLanguageChange(code)}>
              <span aria-hidden="true">{LANGUAGES[code].flag}</span>
            </button>
          ))}
        </div>
      {metadata && (
        <div className="metadata">
          <span>v{metadata.version}</span>
          <span>Atualizado em {metadata.updatedAt}</span>
          {source === "cache" && <span className="cache-badge">cache local</span>}
        </div>
      )}
      </div>
    </header>
  );
}
