import { useTranslation } from "react-i18next";
import { languageName } from "../i18n";
import { LANGUAGES, type SourceLanguage, type StudentLanguage } from "../config/languages";

export interface LanguageSettingsProps {
  language: StudentLanguage;
  sourceLanguage: SourceLanguage;
  languageLocked: boolean;
  onLanguageChange: (language: StudentLanguage) => void;
  onSourceLanguageChange: (language: SourceLanguage) => void;
}

export function LanguageSettingsFields({ language, sourceLanguage, languageLocked,
  onLanguageChange, onSourceLanguageChange, helpId = "language-selection-help"
}: LanguageSettingsProps & { helpId?: string }) {
  const { t } = useTranslation();
  const codes = Object.keys(LANGUAGES) as StudentLanguage[];
  return <>
    <div className="settings-language-fields">
      <label>
        <span>{t("settings.sourceLanguageSource")}</span>
        <select aria-label={t("common.sourceLanguage")} aria-describedby={helpId} value={sourceLanguage} disabled={languageLocked}
          onChange={event => onSourceLanguageChange(event.target.value as SourceLanguage)}>
          {codes.map(code => <option key={code} value={code}>{LANGUAGES[code].flag} {languageName(code)}</option>)}
        </select>
      </label>
      <label>
        <span>{t("settings.studyLanguageTarget")}</span>
        <select aria-label={t("settings.studyLanguage")} aria-describedby={helpId} value={language} disabled={languageLocked}
          onChange={event => onLanguageChange(event.target.value as StudentLanguage)}>
          {codes.map(code => <option key={code} value={code}>{LANGUAGES[code].flag} {languageName(code)}</option>)}
        </select>
      </label>
    </div>
    <p id={helpId} className="settings-dialog-help">{t(languageLocked
      ? "settings.exitWalkingModeToChangeLanguages"
      : "settings.choosingTheOtherLanguageSwapsTheSourceAndStudyLanguages")}</p>
  </>;
}
