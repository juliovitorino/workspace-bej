import termsOfUse from "../content/terms-of-use.md?raw";
import { StudyDataTransfer } from "../features/study/StudyDataTransfer";
import { StudyDangerZone } from "../features/study/StudyDangerZone";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ThemePreference } from "../theme";
import { LanguageSettingsFields, type LanguageSettingsProps } from "./LanguageSettingsFields";
import { NeuralVoiceSelect } from "./NeuralVoiceSelect";
import { SmallTalkPersonalImport } from "./SmallTalkPersonalImport";

const categories = ["audio", "languages", "study", "appearance", "data"] as const;
interface Props extends LanguageSettingsProps {
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  onOpenStudy: () => void;
  onOpenData: (section: "settings" | "history") => void;
}

export function AppSettingsPage({ theme, onThemeChange, onOpenStudy, onOpenData, ...languages }: Props) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<typeof categories[number]>("audio");
  const [consolidationVisible, setConsolidationVisible] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { title.current?.focus({ preventScroll: true }); }, []);
  return <section className="app-settings-page" aria-labelledby="app-settings-title">
    <header>
      <h2 ref={title} tabIndex={-1} id="app-settings-title">{t("settingsPage.title")}</h2>
      <p>{t("settingsPage.subtitle")}</p>
    </header>
    {!consolidationVisible && <nav className="settings-categories" aria-label={t("settingsPage.categories")}>
      {categories.map(key => <button type="button" key={key} aria-pressed={category === key}
        aria-controls="settings-category-content" onClick={() => setCategory(key)}>
        {t(`settingsPage.${key}`)}
      </button>)}
    </nav>}
    <section id="settings-category-content" className="settings-category-content" aria-labelledby="settings-category-title">
      {!consolidationVisible && <h3 id="settings-category-title">{t(`settingsPage.${category}`)}</h3>}
      {consolidationVisible && <StudyDataTransfer standalone onBack={() => setConsolidationVisible(false)} />}
      {!consolidationVisible && category === "audio" && <>
        <p>{t("settingsPage.audioHelp")}</p>
        <NeuralVoiceSelect />
      </>}
      {!consolidationVisible && category === "languages" && <LanguageSettingsFields {...languages} helpId="settings-page-language-help" />}
      {!consolidationVisible && category === "study" && <>
        <h4>{t("common.walkingMode")}</h4>
        <p>{t("settingsPage.walkingHelp")}</p>
        <p className="settings-dialog-help">{t("settingsPage.walkingLocal")}</p>
        <button type="button" className="secondary-button" onClick={onOpenStudy}>{t("settingsPage.openStudy")}</button>
      </>}
      {!consolidationVisible && category === "appearance" && <label className="settings-theme-field">
        {t("theme.label")}
        <select value={theme} onChange={event => onThemeChange(event.target.value as ThemePreference)}>
          <option value="light">{t("theme.light")}</option>
          <option value="dark">{t("theme.dark")}</option>
          <option value="auto">{t("theme.auto")}</option>
        </select>
      </label>}
      {!consolidationVisible && category === "data" && <>
        <StudyDataTransfer settings onOpenConsolidation={() => setConsolidationVisible(true)} />
        <div className="settings-shortcuts">
          <button type="button" className="secondary-button" onClick={() => onOpenData("settings")}>{t("settingsPage.openBackup")}</button>
          <button type="button" className="secondary-button" onClick={() => onOpenData("history")}>{t("study.history")}</button>
        </div>
        <details className="bej-terms-disclosure">
          <summary>Termos de Uso (PT-BR)</summary>
          <div className="bej-terms-text" role="document">{termsOfUse}</div>
        </details>
        <SmallTalkPersonalImport />
        <StudyDangerZone language={languages.language} onChanged={() => undefined} />
      </>}
    </section>
  </section>;
}
