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

        {item.category && (
          <span className="pill category-pill">{item.category}</span>
        )}

        {item.tags && item.tags.length > 0 && (
          <div className="card-tags">
            {item.tags.map((tag) => (
              <span className="tag-pill" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
