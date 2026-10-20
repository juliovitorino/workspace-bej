import termsOfUse from "../content/terms-of-use.md?raw";
import { LanguageSettingsFields } from "./LanguageSettingsFields";
import { useTranslation } from "react-i18next";
import { useEffect, useRef } from "react";
import { type SourceLanguage, type StudentLanguage } from "../config/languages";
import type { HashmapMetadata } from "../types/hashmap";
import { APP_VERSION } from "../config/appInfo";

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
  const { t } = useTranslation();
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

  return (
    <dialog ref={dialogRef} className="app-settings-dialog" aria-labelledby="settings-dialog-title"
      onCancel={event => { event.preventDefault(); onClose(); }}>
      <div className="settings-dialog-heading">
        <h2 id="settings-dialog-title">{kind === "languages" ? t("navigation.languages") : t("common.aboutTheApp")}</h2>
        <button type="button" className="secondary-button" onClick={onClose} aria-label={t("settings.closeDialog")} autoFocus>{t("common.close")}</button>
      </div>
      {kind === "languages" ? <>
        <LanguageSettingsFields language={language} sourceLanguage={sourceLanguage} languageLocked={languageLocked}
          onLanguageChange={onLanguageChange} onSourceLanguageChange={onSourceLanguageChange} />
      </> : <>
        <p>Brazilian English Journey — Mental Hashmap</p>
        <dl className="settings-app-metadata">
          <dt>{t("settings.appVersion")}</dt><dd>{APP_VERSION}</dd>
          {metadata && <>
            <dt>{t("settings.name")}</dt><dd>{metadata.name}</dd>
            <dt>{t("settings.dataVersion")}</dt><dd>{metadata.version}</dd>
            <dt>{t("settings.lastUpdated")}</dt><dd>{metadata.updatedAt}</dd>
          </>}
        </dl>
        <details className="bej-terms-disclosure">
          <summary>Termos de Uso (PT-BR)</summary>
          <div className="bej-terms-text" role="document">{termsOfUse}</div>
        </details>
        {!metadata && <p role="status">{t("settings.metadataIsCurrentlyUnavailable")}</p>}
        {source === "cache" && <span className="cache-badge">{t("settings.localCache")}</span>}
      </>}
    </dialog>
  );
}
