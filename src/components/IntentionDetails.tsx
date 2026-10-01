import { useEffect, useState } from "react";
import type { MentalIntention } from "../types/hashmap";


function renderHighlightedText(
  text: string,
  highlight?: string
) {
  if (!highlight) {
    return text;
  }

  const index = text.indexOf(highlight);

  if (index === -1) {
    return text;
  }

  const before = text.slice(0, index);
  const after = text.slice(index + highlight.length);

  return (
    <>
      {before}
      <strong className="intention-highlight">
        {highlight}
      </strong>
      {after}
    </>
  );
}

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
  const [speakingExampleIndex, setSpeakingExampleIndex] =
    useState<number | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setSpeakingExampleIndex(null);
    setSpeechError(null);
  }, [item?.id]);

  function handleSpeakExample(text: string, index: number) {
    const englishText = text.trim();

    if (!englishText) {
      setSpeechError("Não há texto em inglês para reproduzir.");
      return;
    }

    if (!("speechSynthesis" in window)) {
      setSpeechError(
        "O recurso de voz não está disponível neste navegador."
      );
      return;
    }

    window.speechSynthesis.cancel();
    setSpeechError(null);
    setSpeakingExampleIndex(null);

    const utterance = new SpeechSynthesisUtterance(englishText);
    const voices = window.speechSynthesis.getVoices();
    const americanVoice = voices.find(
      (voice) => voice.lang.toLowerCase() === "en-us"
    );

    if (americanVoice) {
      utterance.voice = americanVoice;
    }

    utterance.lang = "en-US";
    utterance.rate = 0.9;
    utterance.pitch = 1;

    utterance.onstart = () => {
      setSpeakingExampleIndex(index);
    };

    utterance.onend = () => {
      setSpeakingExampleIndex(null);
    };

    utterance.onerror = () => {
      setSpeakingExampleIndex(null);
      setSpeechError("Não foi possível reproduzir o exemplo em inglês.");
    };

    window.speechSynthesis.speak(utterance);
  }

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

        {item.englishLevel && (
          <div className="detail-level">
            <span className="pill english-level-pill">
              Nível {item.englishLevel}
            </span>
          </div>
        )}

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
                  <p>
                    {renderHighlightedText(
                      example.pt,
                      example.ptIntent
                    )}
                  </p>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.6rem"
                    }}
                  >
                    <p
                      className="english"
                      style={{ flex: 1, margin: 0 }}
                    >
                      {renderHighlightedText(
                        example.en,
                        example.enIntent
                      )}
                    </p>

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => handleSpeakExample(example.en, index)}
                      disabled={speakingExampleIndex === index}
                      title="Ouvir este exemplo em inglês"
                      aria-label={`Ouvir exemplo ${index + 1} em inglês`}
                      style={{
                        width: "2.5rem",
                        minWidth: "2.5rem",
                        height: "2.5rem",
                        minHeight: "2.5rem",
                        padding: 0,
                        borderRadius: "999px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0
                      }}
                    >
                      <span aria-hidden="true">🔊</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {speechError && (
              <div className="status-card error-card google-translation-error">
                <h3>Não foi possível reproduzir o áudio.</h3>
                <p>{speechError}</p>
              </div>
            )}
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
