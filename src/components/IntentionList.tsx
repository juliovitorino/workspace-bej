import { t, languageName as localizedLanguageName } from "../i18n";
import { useTranslation } from "react-i18next";
import { LANGUAGES, type SourceLanguage, type StudentLanguage } from "../config/languages";
import type { MentalIntention } from "../types/hashmap";
import { IntentionCard } from "./IntentionCard";

interface IntentionListProps {
  items: MentalIntention[];
  sourceLanguage: SourceLanguage;
  language: StudentLanguage;
  onSelect: (item: MentalIntention) => void;
}

export function IntentionList({ items, sourceLanguage, language, onSelect }: IntentionListProps) {
  const { t } = useTranslation();
  if (items.length === 0) {
    return (
      <div className="empty-state">
        <h2>{t("hashmap.noIntentionsFound")}</h2>
        <p>{t("hashmap.emptyHint", { sourceLanguage: localizedLanguageName(sourceLanguage), targetLanguage: localizedLanguageName(language) })}</p>
      </div>
    );
  }

  return (
    <div className="intention-list">
      {items.map((item) => (
        <IntentionCard key={item.id} item={item} sourceLanguage={sourceLanguage} language={language} onSelect={onSelect} />
      ))}
    </div>
  );
}
