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
  if (items.length === 0) {
    return (
      <div className="empty-state">
        <h2>Nenhuma intenção encontrada.</h2>
        <p>Experimente outros termos em {LANGUAGES[sourceLanguage].name} ou {LANGUAGES[language].name}, ou limpe os filtros.</p>
      </div>
    );
  }

  return (
    <div className="intention-list">
      {items.map((item) => (
        <IntentionCard key={item.id} item={item} onSelect={onSelect} />
      ))}
    </div>
  );
}
