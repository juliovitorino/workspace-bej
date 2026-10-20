import { speakStudyAudio, cancelStudyAudio } from "../features/study/studyAudio";
import type { FavoriteChunk } from "../utils/favoriteChunks";
import { t, languageName as localizedLanguageName } from "../i18n";
import { useTranslation } from "react-i18next";
import { LANGUAGES, type SourceLanguage, type StudentLanguage } from "../config/languages";
import { isAuthorMode } from "../utils/authorMode";
import { useEffect, useRef, useState } from "react";
import type { Example, MentalIntention } from "../types/hashmap";
import { ConnectedSpeechButton } from "./ConnectedSpeechStudio";
import { useExampleAudio } from "../features/study/useExampleAudio";


/** Campos de destino do contrato 4.0; pt/ptIntent vêm da associação por UUID no serviço. */
function targetSentence(example: Example): string {
  return example.exampleItem || example.en;
}

function targetIntent(example: Example): string | undefined {
  return example.intent || example.enIntent;
}

function renderHighlightedText(text: string, highlight?: string) {
  const phrase = highlight?.trim();
  if (!phrase) return text;

  // Preserva a capitalização original da frase e evita falhas por diferença de caixa.
  const index = text.toLocaleLowerCase().indexOf(phrase.toLocaleLowerCase());
  if (index < 0) return text;

  return (
    <>
      {text.slice(0, index)}
      <strong className="intention-highlight">
        {text.slice(index, index + phrase.length)}
      </strong>
      {text.slice(index + phrase.length)}
    </>
  );
}

/** Aceita somente links HTTP(S) do YouTube. */
function getYoutubeUrl(value?: string): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const allowedHosts = new Set([
      "youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"
    ]);
    return allowedHosts.has(url.hostname.toLowerCase()) ? url.href : null;
  } catch {
    return null;
  }
}

interface IntentionDetailsProps {
  favorites?: FavoriteChunk[];
  onToggleFavorite?: (id: string, type?: "example") => void;
  language: StudentLanguage;
  sourceLanguage: SourceLanguage;
  item: MentalIntention | null;
  allItems: MentalIntention[];
  onClose: () => void;
  onSelectRelated: (item: MentalIntention) => void;
  onBasicTraining: (item: MentalIntention) => void;
  onAdvancedTraining: (item: MentalIntention) => void;
  onReviewTraining: (item: MentalIntention) => void;
}

export function IntentionDetails({
  favorites = [],
  onToggleFavorite,
  language,
  sourceLanguage,
  item,
  allItems,
  onClose,
  onSelectRelated,
  onBasicTraining,
  onAdvancedTraining,
  onReviewTraining
}: IntentionDetailsProps) {
  const { t } = useTranslation();
  const { playback, play } = useExampleAudio();

  const [copiedExampleIndex, setCopiedExampleIndex] =
    useState<number | null>(null);
  const [copiedHqPromptExampleIndex, setCopiedHqPromptExampleIndex] =
    useState<number | null>(null);
  const [copiedSection, setCopiedSection] = useState<"pattern" | "examples" | null>(null);
  const [copySectionError, setCopySectionError] = useState<string | null>(null);
  const [copiedIntentionId, setCopiedIntentionId] = useState<string | null>(null);
  const [copyIntentionIdError, setCopyIntentionIdError] = useState<string | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [hqImage, setHqImage] = useState<string | null>(null);
  const [showMetadataModal, setShowMetadataModal] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [hqZoom, setHqZoom] = useState(1);
  const hqViewportRef = useRef<HTMLDivElement | null>(null);
  const detailPanelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        cancelStudyAudio();
      }
    };
  }, []);

  useEffect(() => {
    cancelStudyAudio();

    setCopiedExampleIndex(null);
    setCopiedHqPromptExampleIndex(null);
    setCopiedSection(null);
    setCopySectionError(null);
    setCopiedIntentionId(null);
    setCopyIntentionIdError(null);
    setSpeechError(null);
    setHqImage(null);
    setShowMetadataModal(false);
    setShareError(null);
    setHqZoom(1);
  }, [item?.id, language]);

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

  useEffect(() => {
    if (!showMetadataModal) return;

    function handleMetadataEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopImmediatePropagation();
        setShowMetadataModal(false);
      }
    }

    window.addEventListener("keydown", handleMetadataEscape, true);
    return () => window.removeEventListener("keydown", handleMetadataEscape, true);
  }, [showMetadataModal]);

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
    const example = item?.examples?.[index];
    if (!example || !text.trim()) {
      setSpeechError(t("details.thereIsNoTextToPlay"));
      return;
    }
    setSpeechError(null);
    play(example, language, () => setSpeechError(t("details.couldNotPlayTheExample")));
  }

  async function handleCopyIntentionId() {
    if (!isAuthorMode() || !item?.id) return;

    try {
      // Mesmo fallback de cópia já utilizado neste componente.
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(item.id);
        } catch {
          copyIntentionIdFallback(item.id);
        }
      } else {
        copyIntentionIdFallback(item.id);
      }
      setCopiedIntentionId(item.id);
      setCopyIntentionIdError(null);
    } catch {
      setCopiedIntentionId(null);
      setCopyIntentionIdError(t("details.couldNotCopyThisIntentionSId"));
    }
  }

  function copyIntentionIdFallback(id: string) {
    const textarea = document.createElement("textarea");
    textarea.value = id;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    try {
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, id.length);
      if (!document.execCommand("copy")) {
        throw new Error(t("common.failedToCopyId"));
      }
    } finally {
      document.body.removeChild(textarea);
    }
  }

  async function handleCopySection(section: "pattern" | "examples") {
    if (!item) return;

    const content = section === "pattern"
      ? item.pattern ?? ""
      : (item.examples ?? [])
          .map((example) => `${example.pt}\r\n${targetSentence(example)}`)
          .join("\r\n\r\n");

    if (!content.trim()) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = content;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        textarea.style.pointerEvents = "none";
        document.body.appendChild(textarea);

        try {
          textarea.select();
          textarea.setSelectionRange(0, textarea.value.length);
          if (!document.execCommand("copy")) {
            throw new Error(t("details.failedToCopyText"));
          }
        } finally {
          document.body.removeChild(textarea);
        }
      }

      setCopySectionError(null);
      setCopiedSection(section);
      window.setTimeout(() => {
        setCopiedSection((current) => current === section ? null : current);
      }, 1500);
    } catch {
      setCopiedSection(null);
      setCopySectionError(t("details.couldNotCopyTheContentTryAgain"));
    }
  }

  async function handleCopyExample(text: string, index: number) {
    const targetText = text.trim();

    if (!targetText) {
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(targetText);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = targetText;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        textarea.style.pointerEvents = "none";

        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);

        const copied = document.execCommand("copy");
        document.body.removeChild(textarea);

        if (!copied) {
          throw new Error(t("details.couldNotCopyTheExample"));
        }
      }

      setCopiedExampleIndex(index);

      window.setTimeout(() => {
        setCopiedExampleIndex((current) => (current === index ? null : current));
      }, 1500);
    } catch {
      setCopiedExampleIndex(null);
    }
  }

  async function handleCopyHqPrompt(
    sentenceText: string,
    sentenceIntention: string | undefined,
    index: number
  ) {
    if (!isAuthorMode()) return;
    const sentence = sentenceText.trim();
    const intention = (sentenceIntention ?? item?.english ?? "").trim();

    if (!sentence || !intention) {
      return;
    }

    const hqPrompt = `Frase:
**${sentence}**

Mandatório:
- Crie uma história HQ em proporção A4 vertical (210 × 297 mm), mantendo todo o conteúdo dentro da área segura para impressão;
- faça uma variação do personagem, por exemplo: criança, homem ou mulher (jovem, mais maduro, com ou sem barba, cabelos variados); 
- seja criativo nos ambientes de acordo com a frase;
- não coloque tradução pt-br;
- destaque o termo "${intention}" em toda a história;`;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(hqPrompt);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = hqPrompt;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        textarea.style.pointerEvents = "none";

        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);

        const copied = document.execCommand("copy");
        document.body.removeChild(textarea);

        if (!copied) {
          throw new Error(t("details.couldNotCopyTheComicPrompt"));
        }
      }

      setCopiedHqPromptExampleIndex(index);

      window.setTimeout(() => {
        setCopiedHqPromptExampleIndex((current) =>
          current === index ? null : current
        );
      }, 1500);
    } catch {
      setCopiedHqPromptExampleIndex(null);
    }
  }

  async function handleShareHq() {
    if (!hqImage) return;

    setShareError(null);

    if (!navigator.share) {
      setShareError(t("common.sharingIsUnavailableInThisBrowser"));
      return;
    }

    try {
      const absoluteImageUrl = new URL(hqImage, window.location.href).href;
      const response = await fetch(absoluteImageUrl);

      if (!response.ok) {
        throw new Error(t("common.couldNotLoadTheComicImage"));
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
          title: t("details.comicIntention", { intention: (item?.intention ?? "Mental Hashmap") }),
          text: item?.english
            ? `${item.intention} — ${item.english}`
            : item?.intention ?? "Mental Hashmap",
          files: [file]
        });
        return;
      }

      await navigator.share({
        title: t("details.comicIntention", { intention: (item?.intention ?? "Mental Hashmap") }),
        text: item?.english
          ? `${item.intention} — ${item.english}`
          : item?.intention ?? "Mental Hashmap",
        url: absoluteImageUrl
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setShareError(t("common.couldNotShareTheComicOnThisDevice"));
    }
  }

  function handlePrintExamples() {
    if (!item?.examples?.length) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const doc = printWindow.document;
    doc.title = `Exemplos - ${item.intention}`;

    const style = doc.createElement("style");
    style.textContent = `
      @page { size: A4 portrait; margin: 15mm; }
      body { font-family: Arial, Helvetica, sans-serif; color: var(--text); margin: 0; }
      h1 { font-size: 20pt; margin: 0 0 5mm; }
      .subtitle { color: var(--text-secondary); font-size: 12pt; margin-bottom: 10mm; }
      .example-print { break-inside: avoid; page-break-inside: avoid;
        padding: 4mm 0; border-bottom: 1px solid var(--border); }
      .number { font-size: 9pt; color: var(--muted); margin-bottom: 2mm; }
      .pt, .en { font-size: 12pt; line-height: 1.5; margin: 2mm 0; }
      .en { color: var(--accent-hover); }
      strong { font-weight: 700; }
    `;
    doc.head.appendChild(style);

    const title = doc.createElement("h1");
    title.textContent = `Exemplos — ${item.intention}`;
    doc.body.appendChild(title);

    const subtitle = doc.createElement("div");
    subtitle.className = "subtitle";
    subtitle.textContent = item.structure || item.pattern || item.english;
    doc.body.appendChild(subtitle);

    function appendHighlightedText(element: HTMLElement, value: string, highlight?: string) {
      const index = highlight ? value.indexOf(highlight) : -1;
      if (index < 0 || !highlight) {
        element.textContent = value;
        return;
      }
      element.appendChild(doc.createTextNode(value.slice(0, index)));
      const strong = doc.createElement("strong");
      strong.textContent = highlight;
      element.appendChild(strong);
      element.appendChild(doc.createTextNode(value.slice(index + highlight.length)));
    }

    item.examples.forEach((example, index) => {
      const wrapper = doc.createElement("div");
      wrapper.className = "example-print";
      const number = doc.createElement("div");
      number.className = "number";
      number.textContent = `Exemplo ${index + 1}`;
      wrapper.appendChild(number);

      const pt = doc.createElement("p");
      pt.className = "pt";
      appendHighlightedText(pt, example.pt, example.ptIntent);
      wrapper.appendChild(pt);

      const en = doc.createElement("p");
      en.className = "en";
      appendHighlightedText(en, targetSentence(example), targetIntent(example));
      wrapper.appendChild(en);
      doc.body.appendChild(wrapper);
    });

    // Fecha a aba temporária tanto após imprimir quanto após cancelar.
    // O fallback por foco cobre navegadores que não disparam afterprint.
    let printStarted = false;
    let closed = false;

    const closePrintWindow = () => {
      if (closed || printWindow.closed) return;
      closed = true;
      printWindow.close();
    };

    const handleReturnToPrintWindow = () => {
      if (!printStarted) return;
      // Aguarda a finalização do diálogo antes de tentar fechar.
      window.setTimeout(closePrintWindow, 350);
    };

    printWindow.addEventListener("afterprint", closePrintWindow, { once: true });
    printWindow.addEventListener("focus", handleReturnToPrintWindow);

    printWindow.setTimeout(() => {
      if (printWindow.closed) return;
      printWindow.focus();
      printStarted = true;
      printWindow.print();
    }, 200);
  }

  function handlePrintIntention() {
    const panel = detailPanelRef.current;

    if (!panel) {
      return;
    }

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      return;
    }

    const clonedPanel = panel.cloneNode(true) as HTMLElement;

    clonedPanel
      .querySelectorAll(
        ".close-button, .training-actions, .copy-section-button, .example .secondary-button, [role='dialog'][aria-label='Visualização da HQ'], [role='dialog'][aria-label='Tags e termos de busca']"
      )
      .forEach((element) => element.remove());

    clonedPanel.querySelectorAll("section").forEach((section) => {
      const heading = section.querySelector("h3")?.textContent?.trim();

      if (heading === "Tags" || heading === "Relacionados") {
        section.remove();
      }
    });

    const styles = Array.from(
      document.querySelectorAll('link[rel="stylesheet"], style')
    )
      .map((element) => element.outerHTML)
      .join("\n");

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>${item?.intention ?? "Mental Hashmap"}</title>
          ${styles}
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm;
            }

            html,
            body {
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              min-height: 0 !important;
              height: auto !important;
              overflow: visible !important;
              background: var(--surface) !important;
            }

            body {
              display: block !important;
            }

            .detail-panel {
              position: static !important;
              width: 100% !important;
              max-width: none !important;
              min-height: 0 !important;
              height: auto !important;
              max-height: none !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: visible !important;
              border: 0 !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              background: var(--surface) !important;
            }

            .example {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }

            h1,
            h2,
            h3 {
              break-after: avoid !important;
              page-break-after: avoid !important;
            }
          </style>
        </head>
        <body></body>
      </html>
    `);
    printWindow.document.close();

    printWindow.document.body.appendChild(
      printWindow.document.importNode(clonedPanel, true)
    );

    const doPrint = () => {
      printWindow.focus();
      printWindow.print();
    };

    if (printWindow.document.fonts?.ready) {
      printWindow.document.fonts.ready.then(() => {
        window.setTimeout(doPrint, 150);
      });
    } else {
      window.setTimeout(doPrint, 300);
    }

    printWindow.addEventListener(
      "afterprint",
      () => {
        printWindow.close();
      },
      { once: true }
    );
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
        background: var(--surface) !important;
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

  const targetLanguageName = localizedLanguageName(language);
  const sourceLanguageName = localizedLanguageName(sourceLanguage);
  const targetLevel = item.level ?? item.englishLevel;
  const youtubeVideoUrl = getYoutubeUrl(item.youtubeVideo);
  const youtubeShortUrl = getYoutubeUrl(item.youtubeShort);

  const relatedItems = (item.related ?? [])
    .map((id) => allItems.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is MentalIntention => Boolean(candidate));

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <article
        ref={detailPanelRef}
        className="detail-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t("details.detailsForIntention", { intention: (item.intention) })}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="close-button"
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
        >
          ×
        </button>

        <p className="eyebrow">{t("common.communicativeIntention")}</p>
        <h2>{item.intention}</h2>
        <p className="detail-english" lang={language}>{item.targetIntention ?? item.english}</p>

        {(targetLevel || item.category || youtubeVideoUrl || youtubeShortUrl || (isAuthorMode() && item.allowLanguageChunkPractice === true)) && (
          <div
            className="detail-level"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              flexWrap: "wrap"
            }}
          >
            {targetLevel && (
              <span className="pill english-level-pill">
                
                {t("common.level")} {targetLevel}
              </span>
            )}

            {item.category && (
              <span className="pill">
                {item.category}
              </span>
            )}
            {isAuthorMode() && item.allowLanguageChunkPractice === true && (
              <span className="pill">
                flashcard
              </span>
            )}

            {youtubeVideoUrl && (
              <a
                className="youtube-image-link"
                href={youtubeVideoUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={t("details.openVideoOnYoutubeInANewTab")}
                aria-label={t("details.viewThisIntentionSVideoOnYoutubeNewTab")}
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "40px", height: "40px", textDecoration: "none", cursor: "pointer" }}
              >
                <img
                  src="/images/youtube-video.png"
                  alt=""
                  aria-hidden="true"
                  width={34}
                  height={34}
                  style={{ display: "block", width: "34px", height: "34px", objectFit: "contain" }}
                />
              </a>
            )}

            {youtubeShortUrl && (
              <a
                className="youtube-image-link"
                href={youtubeShortUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={t("details.openShortOnYoutubeInANewTab")}
                aria-label={t("details.viewThisIntentionSShortOnYoutubeNewTab")}
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "40px", height: "40px", textDecoration: "none", cursor: "pointer" }}
              >
                <img
                  src="/images/youtube-short.png"
                  alt=""
                  aria-hidden="true"
                  width={34}
                  height={34}
                  style={{ display: "block", width: "34px", height: "34px", objectFit: "contain" }}
                />
              </a>
            )}
          </div>
        )}

        <div className="training-actions">
          <button
            type="button"
            className="primary-button"
            onClick={() => onBasicTraining(item)}
          >
            
            {t("common.basicPractice")}
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={() => onAdvancedTraining(item)}
          >
            
            {t("common.advancedPractice")}
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={() => onReviewTraining(item)}
          >
            
            {t("common.review")}
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={handlePrintIntention}
            title={t("details.printThisIntention")}
            aria-label={t("details.printThisIntention")}
          >
            <span aria-hidden="true">🖨️</span>
            <span>{t("common.print")}</span>
          </button>
          {language === "en-US" && <ConnectedSpeechButton
            title={t("common.intentionIntention", { intention: (item.intention) })}
            blocks={(item.examples ?? []).map((example) => ({ original: targetSentence(example), portuguese: example.pt }))}
          />}
          {isAuthorMode() && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => void handleCopyIntentionId()}
              title={copiedIntentionId === item.id ? t("common.idCopied") : t("common.copyIntentionId")}
              aria-label={copiedIntentionId === item.id ? t("common.idCopied") : t("common.copyIntentionId")}
              style={{ minWidth: "2.75rem" }}
            >
              <span aria-hidden="true">{copiedIntentionId === item.id ? "✓" : "🔢"}</span>
            </button>
          )}
          {isAuthorMode() && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => setShowMetadataModal(true)}
              title={t("details.viewTagsAndSearchtermsForThisIntention")}
              aria-label={t("details.viewTagsAndSearchTerms")}
            >
              <span aria-hidden="true">🏷️</span>
              <span>{t("details.tagsAndTerms")}</span>
            </button>
          )}
        </div>

        {copySectionError && (
          <p role="alert" style={{ color: "var(--bad)" }}>{copySectionError}</p>
        )}
        {copyIntentionIdError && (
          <p role="alert" style={{ color: "var(--bad)" }}>{copyIntentionIdError}</p>
        )}

        {item.pattern && (
          <section>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <h3>{t("details.pattern")}</h3>
              <button
                type="button"
                className="secondary-button copy-section-button"
                onClick={() => void handleCopySection("pattern")}
                title={copiedSection === "pattern" ? t("stories.copied") : t("details.copyPattern")}
                aria-label={copiedSection === "pattern" ? t("details.patternCopied") : t("details.copyPattern")}
                style={{
                  width: "2.25rem",
                  minWidth: "2.25rem",
                  height: "2.25rem",
                  minHeight: "2.25rem",
                  padding: 0,
                  borderRadius: "999px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                {copiedSection === "pattern" ? (
                  <span aria-hidden="true" style={{ fontWeight: 700 }}>✓</span>
                ) : (
                  <svg
                    aria-hidden="true"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
            </div>
            <p>{item.pattern}</p>
          </section>
        )}

        {item.description && (
          <section>
            <h3>{t("details.description")}</h3>
            <p>{item.description}</p>
          </section>
        )}

        {item.examples && item.examples.length > 0 && (
          <section>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <h3>{t("details.examples")}</h3>
              <button
                type="button"
                className="secondary-button copy-section-button"
                onClick={() => void handleCopySection("examples")}
                title={copiedSection === "examples" ? t("stories.copied") : t("details.copyExamplesInSourcelanguageAndTargetlanguage", { sourceLanguage: (sourceLanguageName.toLowerCase()), targetLanguage: (targetLanguageName.toLowerCase()) })}
                aria-label={copiedSection === "examples" ? t("details.examplesCopied") : t("details.copyExamplesInSourcelanguageAndTargetlanguage", { sourceLanguage: (sourceLanguageName.toLowerCase()), targetLanguage: (targetLanguageName.toLowerCase()) })}
                style={{
                  width: "2.25rem",
                  minWidth: "2.25rem",
                  height: "2.25rem",
                  minHeight: "2.25rem",
                  padding: 0,
                  borderRadius: "999px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                {copiedSection === "examples" ? (
                  <span aria-hidden="true" style={{ fontWeight: 700 }}>✓</span>
                ) : (
                  <svg
                    aria-hidden="true"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                className="secondary-button copy-section-button"
                onClick={handlePrintExamples}
                title={t("details.printExamplesInSourcelanguageAndTargetlanguage", { sourceLanguage: (sourceLanguageName.toLowerCase()), targetLanguage: (targetLanguageName.toLowerCase()) })}
                aria-label={t("details.printExamplesInSourcelanguageAndTargetlanguage", { sourceLanguage: (sourceLanguageName.toLowerCase()), targetLanguage: (targetLanguageName.toLowerCase()) })}
                style={{
                  width: "2.25rem",
                  minWidth: "2.25rem",
                  height: "2.25rem",
                  minHeight: "2.25rem",
                  padding: 0,
                  borderRadius: "999px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <span aria-hidden="true">🖨️</span>
              </button>
            </div>
            <div className="examples">
              {item.examples.map((example, index) => (
                <div className="example" key={example.id}>
                  <p>
                    {renderHighlightedText(
                      example.pt,
                      example.ptIntent
                    )}
                  </p>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "stretch",
                      gap: "0.45rem"
                    }}
                  >
                    <p
                      className="english"
                      style={{
                        width: "100%",
                        minWidth: 0,
                        margin: 0
                      }}
                    >
                      {renderHighlightedText(
                        targetSentence(example),
                        targetIntent(example)
                      )}
                    </p>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        flexWrap: "wrap",
                        gap: "0.45rem",
                        width: "100%"
                      }}
                    >
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => handleSpeakExample(targetSentence(example), index)}
                        disabled={playback?.id === example.id && playback.state === "loading"}
                        aria-busy={playback?.id === example.id && playback.state === "loading"}
                        aria-pressed={playback?.id === example.id && playback.state === "playing"}
                        title={t("details.listenToThisExampleInTargetlanguage", { targetLanguage: (LANGUAGES[language].name.toLowerCase()) })}
                        aria-label={t("details.listenToExampleNumberInTargetlanguage", { number: (index + 1), targetLanguage: (LANGUAGES[language].name.toLowerCase()) })}
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
                        <span aria-hidden="true">{playback?.id === example.id ? playback.state === "loading" ? "\u2026" : playback.state === "playing" ? "\u25a0" : "\u26a0" : "\ud83d\udd0a"}</span>
                      </button>

                      {language === "en-US" && <ConnectedSpeechButton
                        title={t("details.intentionExampleNumber", { intention: (item.intention), number: (index + 1) })}
                        blocks={[{ original: targetSentence(example), portuguese: example.pt }]}
                        compact
                      />}

                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => void handleCopyExample(targetSentence(example), index)}
                        title={
                          copiedExampleIndex === index
                            ? t("common.sentenceCopied")
                            : t("details.copySentenceInTargetlanguage", { targetLanguage: (targetLanguageName.toLowerCase()) })
                        }
                        aria-label={
                          copiedExampleIndex === index
                            ? t("details.exampleNumberCopied", { number: (index + 1) })
                            : t("details.copyExampleNumberInTargetlanguage", { number: (index + 1), targetLanguage: (targetLanguageName.toLowerCase()) })
                        }
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
                        {copiedExampleIndex === index ? (
                          <span
                            aria-hidden="true"
                            style={{ fontSize: "1.1rem", fontWeight: 700 }}
                          >
                            ✓
                          </span>
                        ) : (
                          <svg
                            aria-hidden="true"
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        )}
                      </button>

                      {isAuthorMode() && (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                          void handleCopyHqPrompt(
                            targetSentence(example),
                            targetIntent(example),
                            index
                          )
                        }
                        title={
                          copiedHqPromptExampleIndex === index
                            ? t("details.comicPromptCopied")
                            : t("details.copyPromptToCreateAComic")
                        }
                        aria-label={
                          copiedHqPromptExampleIndex === index
                            ? t("details.comicPromptForExampleNumberCopied", { number: (index + 1) })
                            : t("details.copyPromptToCreateAComicForExampleNumber", { number: (index + 1) })
                        }
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
                        {copiedHqPromptExampleIndex === index ? (
                          <span
                            aria-hidden="true"
                            style={{ fontSize: "1.1rem", fontWeight: 700 }}
                          >
                            ✓
                          </span>
                        ) : (
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
                            <rect x="3" y="5" width="14" height="14" rx="2" />
                            <path d="m3 15 4-4 3 3 2-2 5 5" />
                            <path d="M19 3v4" />
                            <path d="M17 5h4" />
                          </svg>
                        )}
                      </button>
                      )}

                      {example.hqImage && (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => {
                            setShareError(null);
                            setHqZoom(1);
                            setHqImage(example.hqImage ?? null);
                          }}
                          title={t("details.viewComicForThisExample")}
                          aria-label={t("details.viewComicForExampleNumber", { number: (index + 1) })}
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
                      {onToggleFavorite && example.id && targetSentence(example).trim() && (
                        <button
                          type="button"
                          className="chunk-favorite-button"
                          aria-label={t(favorites.some(favorite => favorite.type === "example" && favorite.id === example.id && favorite.language === language) ? "favorites.remove" : "favorites.add")}
                          title={t(favorites.some(favorite => favorite.type === "example" && favorite.id === example.id && favorite.language === language) ? "favorites.remove" : "favorites.add")}
                          aria-pressed={favorites.some(favorite => favorite.type === "example" && favorite.id === example.id && favorite.language === language)}
                          onClick={event => {
                            event.stopPropagation();
                            onToggleFavorite(example.id, "example");
                          }}
                          style={{
                            width: "2.5rem",
                            minWidth: "2.5rem",
                            height: "2.5rem",
                            minHeight: "2.5rem",
                            flex: "0 0 2.5rem",
                            margin: 0,
                            padding: 0,
                            border: "none",
                            background: "transparent",
                            color: "var(--accent)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer"
                          }}
                        >
                          <span aria-hidden="true">{favorites.some(favorite => favorite.type === "example" && favorite.id === example.id && favorite.language === language) ? "★" : "☆"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {speechError && (
              <div className="status-card error-card google-translation-error">
                <h3>{t("common.couldNotPlayTheAudio")}</h3>
                <p>{speechError}</p>
              </div>
            )}
          </section>
        )}


        {relatedItems.length > 0 && (
          <section>
            <h3>{t("details.related")}</h3>
            <div className="related-list">
              {relatedItems.map((related) => (
                <button
                  type="button"
                  className="related-button"
                  key={related.id}
                  onClick={() => onSelectRelated(related)}
                >
                  {related.intention}
                  <span>{related.targetIntention ?? related.english}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {isAuthorMode() && showMetadataModal && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("details.tagsAndSearchTerms")}
            onMouseDown={(event) => {
              event.stopPropagation();
              if (event.target === event.currentTarget) {
                setShowMetadataModal(false);
              }
            }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 10002,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1rem",
              background: "rgba(0, 0, 0, 0.65)"
            }}
          >
            <div
              className="detail-panel"
              style={{
                position: "relative",
                width: "min(100%, 36rem)",
                maxWidth: "36rem",
                maxHeight: "min(85dvh, 760px)",
                minHeight: 0,
                overflowY: "auto",
                padding: "1.5rem",
                borderRadius: "14px"
              }}
            >
              <button
                type="button"
                className="close-button"
                onClick={() => setShowMetadataModal(false)}
                aria-label={t("details.closeTagsAndSearchTerms")}
                title={t("common.close")}
              >
                ×
              </button>
              <p className="eyebrow">{t("details.authorMode")}</p>
              <h2 style={{ marginRight: "2rem" }}>{t("details.tagsAndSearchTerms")}</h2>
              <p style={{ overflowWrap: "anywhere" }}>{item.intention}</p>
              <section>
                <h3>searchTerms ({item.searchTerms?.length ?? 0})</h3>
                {item.searchTerms?.length ? (
                  <div className="tag-list">
                    {item.searchTerms.map((term, index) => (
                      <span className="pill" key={`${term}-${index}`}>{term}</span>
                    ))}
                  </div>
                ) : (
                  <p>{t("details.noSearchTermsAdded")}</p>
                )}
              </section>
              <section>
                <h3>{t("filters.tags")}{item.tags?.length ?? 0})</h3>
                {item.tags?.length ? (
                  <div className="tag-list">
                    {item.tags.map((tag, index) => (
                      <span className="pill" key={`${tag}-${index}`}>{tag}</span>
                    ))}
                  </div>
                ) : (
                  <p>{t("details.noTagsAdded")}</p>
                )}
              </section>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowMetadataModal(false)}
                >
                  
                  {t("common.close")}
                </button>
              </div>
            </div>
          </div>
        )}

        {hqImage && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("details.comicPreview")}
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
                alt={t("details.comicRelatedToTheIntentionIntention", { intention: (item.intention) })}
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
                aria-label={t("common.printComic")}
                title={t("common.printComic")}
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
                aria-label={t("common.shareComic")}
                title={t("common.shareComic")}
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
                  aria-label={t("common.comicVerticalMovementControls")}
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
                    aria-label={t("common.moveComicUp")}
                    title={t("common.moveUp")}
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
                    aria-label={t("common.moveComicDown")}
                    title={t("common.moveDown")}
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
                aria-label={t("common.comicZoomControls")}
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
                  aria-label={t("common.zoomComicOut")}
                  title={t("common.zoomOut")}
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
                  aria-label={t("common.resetComicZoomTo100")}
                  title={t("common.resetZoomTo100")}
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
                  aria-label={t("common.zoomComicIn")}
                  title={t("common.zoomIn")}
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
                aria-label={t("common.closeComic")}
                title={t("common.close")}
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
