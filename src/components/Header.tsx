import { LANGUAGES, type SourceLanguage, type StudentLanguage } from "../config/languages";
import type { HashmapMetadata } from "../types/hashmap";

interface HeaderProps {
  language: StudentLanguage;
  sourceLanguage: SourceLanguage;
  languageLocked?: boolean;
  onLanguageChange: (language: StudentLanguage) => void;
  onSourceLanguageChange: (language: SourceLanguage) => void;
  metadata?: HashmapMetadata;
  source?: "remote" | "cache";
}

export function Header({ metadata, source, language, sourceLanguage, onLanguageChange, onSourceLanguageChange, languageLocked }: HeaderProps) {
  const codes = Object.keys(LANGUAGES) as StudentLanguage[];
  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">Brazilian English Journey</p>
        <h1>Mental Hashmap</h1>
        <p className="subtitle">Estude intenções de um idioma para outro.</p>
      </div>
      <div className="header-tools">
        <div className="language-pair-selector" style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.85rem" }}>
            <span>Idioma de origem</span>
            <select aria-label="Idioma de origem" value={sourceLanguage} disabled={languageLocked}
              onChange={event => onSourceLanguageChange(event.target.value as SourceLanguage)}
              style={{ padding: "0.5rem", borderRadius: "8px", maxWidth: "100%" }}>
              {codes.map(code => <option key={code} value={code}>{LANGUAGES[code].flag} {LANGUAGES[code].name}</option>)}
            </select>
          </label>
          <span aria-hidden="true" style={{ paddingBottom: "0.5rem" }}>→</span>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.85rem" }}>
            <span>Idioma de estudo</span>
            <select aria-label="Idioma de estudo" value={language} disabled={languageLocked}
              onChange={event => onLanguageChange(event.target.value as StudentLanguage)}
              style={{ padding: "0.5rem", borderRadius: "8px", maxWidth: "100%" }}>
              {codes.map(code => <option key={code} value={code}>{LANGUAGES[code].flag} {LANGUAGES[code].name}</option>)}
            </select>
          </label>
        </div>
        <small>{languageLocked ? "Encerre o Modo Caminhada para trocar os idiomas." : "Ao escolher o outro idioma, origem e estudo serão invertidos."}</small>
        {metadata && <div className="metadata">
          <span>v{metadata.version}</span>
          <span>Atualizado em {metadata.updatedAt}</span>
          {source === "cache" && <span className="cache-badge">cache local</span>}
        </div>}
      </div>
    </header>
  );
}
