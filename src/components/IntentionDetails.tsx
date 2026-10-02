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
  const [hqImage, setHqImage] = useState<string | null>(null);

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
    setHqImage(null);
  }, [item?.id]);

  useEffect(() => {
    if (!hqImage) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setHqImage(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [hqImage]);

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
                      gap: "0.6rem",
                      flexWrap: "wrap"
                    }}
                  >
                    <p
                      className="english"
                      style={{
                        flex: "1 1 12rem",
                        minWidth: 0,
                        margin: 0
                      }}
                    >
                      {renderHighlightedText(
                        example.en,
                        example.enIntent
                      )}
                    </p>

                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.45rem",
                        flexShrink: 0,
                        marginLeft: "auto"
                      }}
                    >
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
                          justifyContent: "center"
                        }}
                      >
                        <span aria-hidden="true">🔊</span>
                      </button>

                      {example.hqImage && (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setHqImage(example.hqImage ?? null)}
                          title="Ver HQ deste exemplo"
                          aria-label={`Ver HQ do exemplo ${index + 1}`}
                          style={{
                            width: "2.5rem",
                            minWidth: "2.5rem",
                            height: "2.5rem",
                            minHeight: "2.5rem",
                            padding: 0,
                            borderRadius: "999px",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}
                        >
                          <svg
                            aria-hidden="true"
                            width="19"
                            height="19"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M14.5 4h-5L7.8 6H5a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V9a3 3 0 0 0-3-3h-2.8z" />
                            <circle cx="12" cy="13" r="3" />
                          </svg>
                        </button>
                      )}
                    </div>
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

        {hqImage && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Visualização da HQ"
            onMouseDown={(event) => {
              event.stopPropagation();
              setHqImage(null);
            }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 10000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "clamp(0.5rem, 2vw, 1.25rem)",
              background: "rgba(0, 0, 0, 0.88)"
            }}
          >
            <div
              onMouseDown={(event) => event.stopPropagation()}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                height: "100%",
                maxWidth: "1200px"
              }}
            >
              <img
                src={hqImage}
                alt={`HQ relacionada à intenção: ${item.intention}`}
                style={{
                  display: "block",
                  width: "auto",
                  height: "auto",
                  maxWidth: "100%",
                  maxHeight: "calc(100dvh - 1rem)",
                  objectFit: "contain",
                  borderRadius: "12px"
                }}
              />

              <button
                type="button"
                onClick={() => setHqImage(null)}
                aria-label="Fechar HQ"
                title="Fechar"
                style={{
                  position: "fixed",
                  top: "max(0.75rem, env(safe-area-inset-top))",
                  right: "max(0.75rem, env(safe-area-inset-right))",
                  zIndex: 10001,
                  width: "2.75rem",
                  minWidth: "2.75rem",
                  height: "2.75rem",
                  minHeight: "2.75rem",
                  padding: 0,
                  border: "1px solid rgba(255, 255, 255, 0.35)",
                  borderRadius: "999px",
                  background: "rgba(0, 0, 0, 0.68)",
                  color: "#ffffff",
                  fontSize: "1.6rem",
                  lineHeight: 1,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                ×
              </button>
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
