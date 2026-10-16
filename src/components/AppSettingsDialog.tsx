import { useEffect, useRef } from "react";
import { LANGUAGES, type SourceLanguage, type StudentLanguage } from "../config/languages";
import type { HashmapMetadata } from "../types/hashmap";

interface AppSettingsDialogProps {
  kind: "languages" | "about";
  language: StudentLanguage;
  sourceLanguage: SourceLanguage;
  languageLocked: boolean;
  onLanguageChange: (language: StudentLanguage) => void;
  onSourceLanguageChange: (language: SourceLanguage) => void;
  metadata?: HashmapMetadata;
  source?: "remote" | "cache";
  onClose: () => void;
}

export function AppSettingsDialog({ kind, language, sourceLanguage, languageLocked,
  onLanguageChange, onSourceLanguageChange, metadata, source, onClose }: AppSettingsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);

  const codes = Object.keys(LANGUAGES) as StudentLanguage[];
  return (
    <dialog ref={dialogRef} className="app-settings-dialog" aria-labelledby="settings-dialog-title"
      onCancel={event => { event.preventDefault(); onClose(); }}>
      <div className="settings-dialog-heading">
        <h2 id="settings-dialog-title">{kind === "languages" ? "Idiomas" : "Sobre o app"}</h2>
        <button type="button" className="secondary-button" onClick={onClose} aria-label="Fechar modal" autoFocus>Fechar</button>
      </div>
      {kind === "languages" ? <>
        <div className="settings-language-fields">
          <label>
            <span>Idioma de origem (Source)</span>
            <select aria-label="Idioma de origem" aria-describedby="language-selection-help" value={sourceLanguage} disabled={languageLocked}
              onChange={event => onSourceLanguageChange(event.target.value as SourceLanguage)}>
              {codes.map(code => <option key={code} value={code}>{LANGUAGES[code].flag} {LANGUAGES[code].name}</option>)}
            </select>
          </label>
          <label>
            <span>Idioma de estudo (Target)</span>
            <select aria-label="Idioma de estudo" aria-describedby="language-selection-help" value={language} disabled={languageLocked}
              onChange={event => onLanguageChange(event.target.value as StudentLanguage)}>
              {codes.map(code => <option key={code} value={code}>{LANGUAGES[code].flag} {LANGUAGES[code].name}</option>)}
            </select>
          </label>
        </div>
        <p id="language-selection-help" className="settings-dialog-help">{languageLocked
          ? "Encerre o Modo Caminhada para trocar os idiomas."
          : "Ao escolher o outro idioma, origem e estudo serão invertidos. As alterações são salvas automaticamente."}</p>
      </> : <>
        <p>Brazilian English Journey — Mental Hashmap</p>
        {metadata ? <dl className="settings-app-metadata">
          <dt>Nome</dt><dd>{metadata.name}</dd>
          <dt>Versão</dt><dd>{metadata.version}</dd>
          <dt>Última atualização</dt><dd>{metadata.updatedAt}</dd>
        </dl> : <p role="status">Metadados indisponíveis no momento.</p>}
        {source === "cache" && <span className="cache-badge">cache local</span>}
      </>}
    </dialog>
  );
}
