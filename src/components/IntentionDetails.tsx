import type { MentalIntention } from "../types/hashmap";

interface IntentionDetailsProps {
  item: MentalIntention | null;
  allItems: MentalIntention[];
  onClose: () => void;
  onSelectRelated: (item: MentalIntention) => void;
  onBasicTraining: (item: MentalIntention) => void;
  onAdvancedTraining: (item: MentalIntention) => void;
}

export function IntentionDetails({
  item,
  allItems,
  onClose,
  onSelectRelated,
  onBasicTraining,
  onAdvancedTraining
}: IntentionDetailsProps) {
  if (!item) return null;

  const relatedItems = (item.related ?? [])
    .map((id) => allItems.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is MentalIntention => Boolean(candidate));

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <article
        className="detail-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Detalhes de ${item.intention}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="close-button"
          type="button"
          onClick={onClose}
          aria-label="Fechar"
        >
          ×
        </button>

        <p className="eyebrow">Intenção Mental</p>
        <h2>{item.intention}</h2>
        <p className="detail-english">{item.english}</p>

        <div className="training-actions">
          <button
            type="button"
            className="primary-button"
            onClick={() => onBasicTraining(item)}
          >
            Treino básico
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={() => onAdvancedTraining(item)}
          >
            Treino avançado
          </button>
        </div>

        {item.pattern && (
          <section>
            <h3>Pattern</h3>
            <p>{item.pattern}</p>
          </section>
        )}

        {item.description && (
          <section>
            <h3>Descrição</h3>
            <p>{item.description}</p>
          </section>
        )}

        {item.examples && item.examples.length > 0 && (
          <section>
            <h3>Exemplos</h3>
            <div className="examples">
              {item.examples.map((example, index) => (
                <div className="example" key={`${item.id}-${index}`}>
                  <p>{example.pt}</p>
                  <p className="english">{example.en}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {item.tags && item.tags.length > 0 && (
          <section>
            <h3>Tags</h3>
            <div className="tag-list">
              {item.tags.map((tag) => (
                <span className="pill" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          </section>
        )}

        {relatedItems.length > 0 && (
          <section>
            <h3>Relacionados</h3>
            <div className="related-list">
              {relatedItems.map((related) => (
                <button
                  type="button"
                  className="related-button"
                  key={related.id}
                  onClick={() => onSelectRelated(related)}
                >
                  {related.intention}
                  <span>{related.english}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </article>
    </div>
  );
}
