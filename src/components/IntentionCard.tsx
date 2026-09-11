import type { MentalIntention } from "../types/hashmap";

interface IntentionCardProps {
  item: MentalIntention;
  onSelect: (item: MentalIntention) => void;
}

export function IntentionCard({ item, onSelect }: IntentionCardProps) {
  return (
    <button
      type="button"
      className="intention-card"
      onClick={() => onSelect(item)}
    >
      <div>
        <h2>{item.intention}</h2>
        <p className="english">{item.english}</p>
      </div>

      <div className="card-meta">
        {item.pattern && <span>{item.pattern}</span>}
        {item.category && <span className="pill">{item.category}</span>}
      </div>
    </button>
  );
}
