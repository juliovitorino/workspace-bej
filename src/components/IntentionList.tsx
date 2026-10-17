import { t, languageName as localizedLanguageName } from "../i18n";
import { useTranslation } from "react-i18next";
import { LANGUAGES, type SourceLanguage, type StudentLanguage } from "../config/languages";
import type { MentalIntention } from "../types/hashmap";
import { IntentionCard, type IntentionCardFilters } from "./IntentionCard";
import type { FavoriteChunk } from "../utils/favoriteChunks";

interface IntentionListProps {
  filters?: IntentionCardFilters;
  items: MentalIntention[];
  sourceLanguage: SourceLanguage;
  language: StudentLanguage;
  onSelect: (item: MentalIntention) => void;
  favorites?: FavoriteChunk[];
  onToggleFavorite?: (id: string, type?: "example") => void;
}

export function IntentionList({ items, sourceLanguage, language, onSelect, favorites = [], onToggleFavorite, filters }: IntentionListProps) {
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
        <IntentionCard filters={filters} key={item.id} item={item} sourceLanguage={sourceLanguage} language={language} onSelect={onSelect}
          favorite={favorites.some(favorite => favorite.type === undefined && favorite.id === item.id && favorite.language === language)}
          onToggleFavorite={onToggleFavorite} />
      ))}
    </div>
  );
}
