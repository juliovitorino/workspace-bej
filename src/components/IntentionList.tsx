import type { MentalIntention } from "../types/hashmap";
import { IntentionCard } from "./IntentionCard";

interface IntentionListProps {
  items: MentalIntention[];
  onSelect: (item: MentalIntention) => void;
}

export function IntentionList({ items, onSelect }: IntentionListProps) {
  if (items.length === 0) {
    return (
      <div className="empty-state">
        <h2>Nenhuma intenção encontrada.</h2>
        <p>Tente outro termo em português ou inglês.</p>
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
