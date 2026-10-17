import { useTranslation } from "react-i18next";

export function FavoriteChunkButton({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const label = t(active ? "favorites.remove" : "favorites.add");
  return <button type="button" className="chunk-flashcards-details chunk-favorite-button"
    aria-label={label} title={label} aria-pressed={active}
    onClick={event => { event.stopPropagation(); onToggle(); }}>
    <span aria-hidden="true">{active ? "★" : "☆"}</span>
  </button>;
}
