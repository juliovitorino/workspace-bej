import { t, languageName as localizedLanguageName } from "../i18n";
import { useTranslation } from "react-i18next";
import { useEffect, useRef } from "react";
import { LANGUAGES, type SourceLanguage, type StudentLanguage } from "../config/languages";
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

  const codes = Object.keys(LANGUAGES) as StudentLanguage[];
  return (
    <dialog ref={dialogRef} className="app-settings-dialog" aria-labelledby="settings-dialog-title"
      onCancel={event => { event.preventDefault(); onClose(); }}>
      <div className="settings-dialog-heading">
        <h2 id="settings-dialog-title">{kind === "languages" ? t("navigation.languages") : t("common.aboutTheApp")}</h2>
        <button type="button" className="secondary-button" onClick={onClose} aria-label={t("settings.closeDialog")} autoFocus>{t("common.close")}</button>
      </div>
      {kind === "languages" ? <>
        <div className="settings-language-fields">
          <label>
            <span>{t("settings.sourceLanguageSource")}</span>
            <select aria-label={t("common.sourceLanguage")} aria-describedby="language-selection-help" value={sourceLanguage} disabled={languageLocked}
              onChange={event => onSourceLanguageChange(event.target.value as SourceLanguage)}>
              {codes.map(code => <option key={code} value={code}>{LANGUAGES[code].flag} {localizedLanguageName(code)}</option>)}
            </select>
          </label>
          <label>
            <span>{t("settings.studyLanguageTarget")}</span>
            <select aria-label={t("settings.studyLanguage")} aria-describedby="language-selection-help" value={language} disabled={languageLocked}
              onChange={event => onLanguageChange(event.target.value as StudentLanguage)}>
              {codes.map(code => <option key={code} value={code}>{LANGUAGES[code].flag} {localizedLanguageName(code)}</option>)}
            </select>
          </label>
        </div>
        <p id="language-selection-help" className="settings-dialog-help">{languageLocked
          ? t("settings.exitWalkingModeToChangeLanguages")
          : t("settings.choosingTheOtherLanguageSwapsTheSourceAndStudyLanguages")}</p>
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
        {!metadata && <p role="status">{t("settings.metadataIsCurrentlyUnavailable")}</p>}
        {source === "cache" && <span className="cache-badge">{t("settings.localCache")}</span>}
      </>}
    </dialog>
  );
}
