import { useEffect, useRef, useState } from "react";
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
  const [shareError, setShareError] = useState<string | null>(null);
  const [hqZoom, setHqZoom] = useState(1);
  const hqViewportRef = useRef<HTMLDivElement | null>(null);

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
    setShareError(null);
    setHqZoom(1);
  }, [item?.id]);

  useEffect(() => {
    if (!hqImage) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setHqImage(null);
        setShareError(null);
        setHqZoom(1);
        return;
      }

      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setHqZoom((current) => Math.min(3, current + 0.25));
        return;
      }

      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        setHqZoom((current) => Math.max(0.5, current - 0.25));
        return;
      }

      if (event.key === "0") {
        event.preventDefault();
        setHqZoom(1);
      }
    }

    function handleWheel(event: WheelEvent) {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      event.preventDefault();

      setHqZoom((current) => {
        const nextZoom =
          event.deltaY < 0
            ? current + 0.25
            : current - 0.25;

        return Math.min(3, Math.max(0.5, nextZoom));
      });
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("wheel", handleWheel);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [hqImage]);

  function handleScrollHqVertical(direction: "up" | "down") {
    const viewport = hqViewportRef.current;

    if (!viewport) {
      return;
    }

    const distance = Math.max(180, viewport.clientHeight * 0.55);

    viewport.scrollBy({
      top: direction === "down" ? distance : -distance,
      behavior: "smooth"
    });
  }

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

  async function handleShareHq() {
    if (!hqImage) return;

    setShareError(null);

    if (!navigator.share) {
      setShareError("O compartilhamento não está disponível neste navegador.");
      return;
    }

    try {
      const absoluteImageUrl = new URL(hqImage, window.location.href).href;
      const response = await fetch(absoluteImageUrl);

      if (!response.ok) {
        throw new Error("Não foi possível carregar a imagem da HQ.");
      }

      const blob = await response.blob();
      const extension =
        blob.type === "image/jpeg"
          ? "jpg"
          : blob.type === "image/webp"
            ? "webp"
            : "png";

      const safeName = item?.id
        ? item.id.replace(/[^a-zA-Z0-9-_]/g, "-")
        : "mental-hashmap-hq";

      const file = new File(
        [blob],
        `${safeName}.${extension}`,
        { type: blob.type || "image/png" }
      );

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `HQ - ${item?.intention ?? "Mental Hashmap"}`,
          text: item?.english
            ? `${item.intention} — ${item.english}`
            : item?.intention ?? "Mental Hashmap",
          files: [file]
        });
        return;
      }

      await navigator.share({
        title: `HQ - ${item?.intention ?? "Mental Hashmap"}`,
        text: item?.english
          ? `${item.intention} — ${item.english}`
          : item?.intention ?? "Mental Hashmap",
        url: absoluteImageUrl
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setShareError("Não foi possível compartilhar a HQ neste dispositivo.");
    }
  }

  function handlePrintHq() {
    if (!hqImage) {
      return;
    }

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      return;
    }

    const absoluteImageUrl = new URL(hqImage, window.location.href).href;

    printWindow.document.title = `HQ - ${item?.intention ?? "Mental Hashmap"}`;
    printWindow.document.documentElement.style.margin = "0";
    printWindow.document.body.style.margin = "0";
    printWindow.document.body.style.display = "flex";
    printWindow.document.body.style.alignItems = "center";
    printWindow.document.body.style.justifyContent = "center";

    const style = printWindow.document.createElement("style");
    style.textContent = `
      @page {
        size: A4 portrait;
        margin: 0;
      }

      html,
      body {
        margin: 0 !important;
        padding: 0 !important;
        width: 210mm !important;
        height: 297mm !important;
        min-width: 210mm !important;
        min-height: 297mm !important;
        max-width: 210mm !important;
        max-height: 297mm !important;
        overflow: hidden !important;
        background: #ffffff !important;
      }

      body {
        display: block !important;
      }

      img {
        position: fixed !important;
        top: 8mm !important;
        left: 8mm !important;
        width: 194mm !important;
        height: 281mm !important;
        max-width: 194mm !important;
        max-height: 281mm !important;
        object-fit: contain !important;
        object-position: center center !important;
        margin: 0 !important;
        padding: 0 !important;
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
    `;
    printWindow.document.head.appendChild(style);

    const image = printWindow.document.createElement("img");
    image.src = absoluteImageUrl;
    image.alt = `HQ relacionada à intenção: ${item?.intention ?? ""}`;

    image.onload = () => {
      printWindow.focus();
      printWindow.print();
    };

    image.onerror = () => {
      printWindow.close();
    };

    printWindow.addEventListener(
      "afterprint",
      () => {
        printWindow.close();
      },
      { once: true }
    );

    printWindow.document.body.appendChild(image);
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
                          onClick={() => {
                            setShareError(null);
                            setHqZoom(1);
                            setHqImage(example.hqImage ?? null);
                          }}
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
              setShareError(null);
              setHqZoom(1);
            }}
            style={{
              position: "fixed",
              inset: 0,
              width: "100vw",
              height: "100dvh",
              zIndex: 10000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              overflow: "hidden",
              background: "rgba(0, 0, 0, 0.88)"
            }}
          >
            <div
              ref={hqViewportRef}
              onMouseDown={(event) => event.stopPropagation()}
              onWheel={(event) => {
                if (
                  event.ctrlKey ||
                  event.metaKey ||
                  event.shiftKey ||
                  hqZoom <= 1
                ) {
                  return;
                }

                event.preventDefault();

                const multiplier =
                  event.deltaMode === 1
                    ? 24
                    : event.deltaMode === 2
                      ? event.currentTarget.clientHeight
                      : 1;

                event.currentTarget.scrollBy({
                  top: event.deltaY * multiplier,
                  behavior: "auto"
                });
              }}
              style={{
                position: "relative",
                display: "flex",
                alignItems: hqZoom > 1 ? "flex-start" : "center",
                justifyContent: hqZoom > 1 ? "flex-start" : "center",
                width: "100vw",
                height: "100dvh",
                maxWidth: "100vw",
                maxHeight: "100dvh",
                boxSizing: "border-box",
                overflowX: "auto",
                overflowY: "auto",
                padding: hqZoom > 1 ? "4rem 1rem 4rem" : 0
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
                  borderRadius: "12px",
                  transform: `scale(${hqZoom})`,
                  transformOrigin: hqZoom > 1 ? "top left" : "top center",
                  transition: "transform 120ms ease"
                }}
              />

              <button
                type="button"
                onClick={handlePrintHq}
                aria-label="Imprimir HQ"
                title="Imprimir HQ"
                style={{
                  position: "fixed",
                  top: "max(0.75rem, env(safe-area-inset-top))",
                  left: "max(0.75rem, env(safe-area-inset-left))",
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
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <svg
                  aria-hidden="true"
                  width="21"
                  height="21"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
              </button>

              <button
                type="button"
                onClick={handleShareHq}
                aria-label="Compartilhar HQ"
                title="Compartilhar HQ"
                style={{
                  position: "fixed",
                  top: "max(0.75rem, env(safe-area-inset-top))",
                  left: "calc(max(0.75rem, env(safe-area-inset-left)) + 3.35rem)",
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
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <svg
                  aria-hidden="true"
                  width="21"
                  height="21"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="10.51" x2="15.42" y2="6.49" />
                  <line x1="8.59" y1="13.49" x2="15.42" y2="17.51" />
                </svg>
              </button>

              {shareError && (
                <div
                  role="status"
                  style={{
                    position: "fixed",
                    top: "calc(max(0.75rem, env(safe-area-inset-top)) + 3.35rem)",
                    left: "max(0.75rem, env(safe-area-inset-left))",
                    zIndex: 10001,
                    maxWidth: "min(22rem, calc(100vw - 1.5rem))",
                    padding: "0.65rem 0.8rem",
                    borderRadius: "10px",
                    background: "rgba(0, 0, 0, 0.82)",
                    color: "#ffffff",
                    fontSize: "0.9rem"
                  }}
                >
                  {shareError}
                </div>
              )}

              {hqZoom > 1 && (
                <div
                  role="group"
                  aria-label="Controles de movimento vertical da HQ"
                  style={{
                    position: "fixed",
                    right: "max(0.75rem, env(safe-area-inset-right))",
                    top: "50%",
                    transform: "translateY(-50%)",
                    zIndex: 10001,
                    display: "inline-flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.35rem",
                    padding: "0.35rem",
                    border: "1px solid rgba(255, 255, 255, 0.35)",
                    borderRadius: "999px",
                    background: "rgba(0, 0, 0, 0.72)",
                    color: "#ffffff"
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleScrollHqVertical("up")}
                    aria-label="Mover HQ para cima"
                    title="Mover para cima"
                    style={{
                      width: "2.5rem",
                      height: "2.5rem",
                      padding: 0,
                      border: "1px solid rgba(255, 255, 255, 0.25)",
                      borderRadius: "999px",
                      background: "rgba(255, 255, 255, 0.08)",
                      color: "#ffffff",
                      fontSize: "1.25rem",
                      lineHeight: 1,
                      cursor: "pointer"
                    }}
                  >
                    ↑
                  </button>

                  <button
                    type="button"
                    onClick={() => handleScrollHqVertical("down")}
                    aria-label="Mover HQ para baixo"
                    title="Mover para baixo"
                    style={{
                      width: "2.5rem",
                      height: "2.5rem",
                      padding: 0,
                      border: "1px solid rgba(255, 255, 255, 0.25)",
                      borderRadius: "999px",
                      background: "rgba(255, 255, 255, 0.08)",
                      color: "#ffffff",
                      fontSize: "1.25rem",
                      lineHeight: 1,
                      cursor: "pointer"
                    }}
                  >
                    ↓
                  </button>
                </div>
              )}

              <div
                role="group"
                aria-label="Controles de zoom da HQ"
                style={{
                  position: "fixed",
                  left: "50%",
                  bottom: "max(0.75rem, env(safe-area-inset-bottom))",
                  transform: "translateX(-50%)",
                  zIndex: 10001,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  padding: "0.35rem",
                  border: "1px solid rgba(255, 255, 255, 0.35)",
                  borderRadius: "999px",
                  background: "rgba(0, 0, 0, 0.72)",
                  color: "#ffffff"
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setHqZoom((current) => Math.max(0.5, current - 0.25))
                  }
                  disabled={hqZoom <= 0.5}
                  aria-label="Diminuir zoom da HQ"
                  title="Diminuir zoom"
                  style={{
                    width: "2.5rem",
                    height: "2.5rem",
                    padding: 0,
                    border: "1px solid rgba(255, 255, 255, 0.25)",
                    borderRadius: "999px",
                    background: "rgba(255, 255, 255, 0.08)",
                    color: "#ffffff",
                    fontSize: "1.4rem",
                    cursor: hqZoom <= 0.5 ? "default" : "pointer",
                    opacity: hqZoom <= 0.5 ? 0.45 : 1
                  }}
                >
                  −
                </button>

                <button
                  type="button"
                  onClick={() => setHqZoom(1)}
                  aria-label="Restaurar zoom da HQ para 100%"
                  title="Restaurar zoom para 100%"
                  style={{
                    minWidth: "4.25rem",
                    height: "2.5rem",
                    padding: "0 0.75rem",
                    border: "1px solid rgba(255, 255, 255, 0.25)",
                    borderRadius: "999px",
                    background: "rgba(255, 255, 255, 0.08)",
                    color: "#ffffff",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  {Math.round(hqZoom * 100)}%
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setHqZoom((current) => Math.min(3, current + 0.25))
                  }
                  disabled={hqZoom >= 3}
                  aria-label="Aumentar zoom da HQ"
                  title="Aumentar zoom"
                  style={{
                    width: "2.5rem",
                    height: "2.5rem",
                    padding: 0,
                    border: "1px solid rgba(255, 255, 255, 0.25)",
                    borderRadius: "999px",
                    background: "rgba(255, 255, 255, 0.08)",
                    color: "#ffffff",
                    fontSize: "1.4rem",
                    cursor: hqZoom >= 3 ? "default" : "pointer",
                    opacity: hqZoom >= 3 ? 0.45 : 1
                  }}
                >
                  +
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setHqImage(null);
                  setShareError(null);
                  setHqZoom(1);
                }}
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
