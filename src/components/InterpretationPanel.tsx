import {
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type { MentalIntention } from "../types/hashmap";
import {
  generateInterpretationStory,
  type StoryGenerationResult
} from "../services/storyGenerationService";
import {
  searchLocalStories,
  type LocalStory
} from "../services/localStoryService";

type EnglishLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

interface InterpretationPanelProps {
  intentions: MentalIntention[];
  onSelectIntention: (item: MentalIntention) => void;
}

const THEMES = [
  "cotidiano",
  "trabalho",
  "viagem",
  "tecnologia",
  "família",
  "amizade",
  "surpresa",
  "decisão"
];

const TOPIC_MAP: Record<string, string> = {
  cotidiano: "daily-life",
  trabalho: "work",
  viagem: "travel",
  tecnologia: "technology",
  família: "family",
  amizade: "friendship",
  surpresa: "surprise",
  decisão: "decision"
};


function renderHighlightedText(
  text: string,
  highlights: string[]
) {
  const ranges = highlights
    .map((highlight) => {
      const start = text.indexOf(highlight);

      return start >= 0
        ? {
            start,
            end: start + highlight.length,
            highlight
          }
        : null;
    })
    .filter(
      (
        range
      ): range is {
        start: number;
        end: number;
        highlight: string;
      } => range !== null
    )
    .sort((a, b) => a.start - b.start);

  if (ranges.length === 0) {
    return text;
  }

const parts: ReactNode[] = [];
  let cursor = 0;

  ranges.forEach((range, index) => {
    if (range.start < cursor) {
      return;
    }

    if (range.start > cursor) {
      parts.push(text.slice(cursor, range.start));
    }

    parts.push(
      <strong
        className="intention-highlight"
        key={`${range.start}-${range.end}-${index}`}
      >
        {text.slice(range.start, range.end)}
      </strong>
    );

    cursor = range.end;
  });

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return <>{parts}</>;
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));

    [result[index], result[randomIndex]] = [
      result[randomIndex],
      result[index]
    ];
  }

  return result;
}

export function InterpretationPanel({
  intentions,
  onSelectIntention
}: InterpretationPanelProps) {
  const [englishLevel, setEnglishLevel] =
    useState<EnglishLevel>("B1");
  const [amount, setAmount] = useState(5);
  const [theme, setTheme] = useState("cotidiano");
  const [story, setStory] =
    useState<StoryGenerationResult | null>(null);
  const [selectedIntentions, setSelectedIntentions] = useState<
    MentalIntention[]
  >([]);
  const [showEnglish, setShowEnglish] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportJson, setExportJson] = useState<string | null>(null);
  const [exportFileName, setExportFileName] = useState<string>("");
  const [copyFeedback, setCopyFeedback] = useState("Copiar JSON");
  const [speaking, setSpeaking] = useState(false);
  const [speakingParagraphIndex, setSpeakingParagraphIndex] =
    useState<number | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLevel, setSearchLevel] =
    useState<EnglishLevel>("B1");
  const [searchTitle, setSearchTitle] = useState("");
  const [showHqImage, setShowHqImage] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (!showHqImage) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowHqImage(false);
        setShareError(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showHqImage]);

  const availableIntentions = useMemo(
    () =>
      intentions.filter(
        (item) => item.englishLevel === englishLevel
      ),
    [intentions, englishLevel]
  );

  const searchResults = useMemo(
    () => searchLocalStories(searchLevel, searchTitle),
    [searchLevel, searchTitle]
  );

  const maxAmount = Math.max(1, availableIntentions.length);

  function handleLevelChange(nextLevel: EnglishLevel) {
    setEnglishLevel(nextLevel);
    setStory(null);
    setShowHqImage(false);
    setSelectedIntentions([]);
    setShowEnglish(false);
    setError(null);
    setSpeechError(null);
    setSpeaking(false);
    setSpeakingParagraphIndex(null);

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    const levelCount = intentions.filter(
      (item) => item.englishLevel === nextLevel
    ).length;

    setAmount((current) =>
      Math.min(Math.max(current, 1), Math.max(levelCount, 1))
    );
  }

  function handleAmountChange(value: number) {
    if (Number.isNaN(value)) {
      return;
    }

    setAmount(
      Math.min(
        Math.max(value, 1),
        Math.max(availableIntentions.length, 1)
      )
    );
  }

  function handleToggleStorySearch() {
    setSearchOpen((current) => {
      const nextValue = !current;

      if (nextValue) {
        setSearchLevel(englishLevel);
        setSearchTitle("");
      }

      return nextValue;
    });
  }

  function handleLoadLocalStory(localStory: LocalStory) {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setEnglishLevel(searchLevel);
    setStory({
      ...localStory,
      source: "local"
    });
    setShowHqImage(false);
    setSelectedIntentions([]);
    setShowEnglish(false);
    setGenerating(false);
    setError(null);
    setSpeechError(null);
    setSpeaking(false);
    setSpeakingParagraphIndex(null);
    setExportJson(null);
    setSearchOpen(false);
  }

  async function handleGenerateStory() {
    if (availableIntentions.length === 0) {
      setError(
        `Não há intenções disponíveis para o nível ${englishLevel}.`
      );
      return;
    }

    const pickedIntentions = shuffle(availableIntentions).slice(
      0,
      Math.min(amount, availableIntentions.length)
    );

    setGenerating(true);
    setError(null);
    setStory(null);
    setShowHqImage(false);
    setShowEnglish(false);
    setSelectedIntentions(pickedIntentions);
    setSpeechError(null);
    setSpeaking(false);
    setSpeakingParagraphIndex(null);

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    try {
      const result = await generateInterpretationStory({
        intentions: pickedIntentions,
        englishLevel,
        theme
      });

      setStory(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível gerar a história."
      );
    } finally {
      setGenerating(false);
    }
  }

  function handleToggleEnglish() {
    setShowEnglish((current) => {
      const nextValue = !current;

      if (!nextValue && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        setSpeaking(false);
        setSpeakingParagraphIndex(null);
        setSpeechError(null);
      }

      return nextValue;
    });
  }

  function handleSpeakStory() {
    if (!story) {
      return;
    }

    const englishText = [
      story.titleEn,
      ...story.paragraphs.map((paragraph) => paragraph.en)
    ]
      .filter(Boolean)
      .join(". ")
      .trim();

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
    setSpeakingParagraphIndex(null);

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
      setSpeaking(true);
    };

    utterance.onend = () => {
      setSpeaking(false);
      setSpeakingParagraphIndex(null);
    };

    utterance.onerror = () => {
      setSpeaking(false);
      setSpeakingParagraphIndex(null);
      setSpeechError("Não foi possível reproduzir a história em inglês.");
    };

    window.speechSynthesis.speak(utterance);
  }

  function handleSpeakParagraph(text: string, index: number) {
    const englishText = text.trim();

    if (!englishText) {
      setSpeechError("Não há texto em inglês para reproduzir neste parágrafo.");
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
    setSpeaking(false);
    setSpeakingParagraphIndex(null);

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
      setSpeaking(false);
      setSpeakingParagraphIndex(index);
    };

    utterance.onend = () => {
      setSpeakingParagraphIndex(null);
    };

    utterance.onerror = () => {
      setSpeakingParagraphIndex(null);
      setSpeechError("Não foi possível reproduzir este parágrafo em inglês.");
    };

    window.speechSynthesis.speak(utterance);
  }

  function handleOpenExportJson() {
    if (!story || story.source !== "ai") {
      return;
    }

    try {
      const topic = TOPIC_MAP[theme] ?? "daily-life";

      const uuid =
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
              /[xy]/g,
              (character) => {
                const random = Math.floor(Math.random() * 16);
                const value =
                  character === "x"
                    ? random
                    : (random & 0x3) | 0x8;

                return value.toString(16);
              }
            );

      const id =
        `${englishLevel.toLowerCase()}-${topic}-${uuid}`;

      const localStory = {
        id,
        englishLevel,
        topic,
        titlePt: story.titlePt,
        titleEn: story.titleEn,
        paragraphs: story.paragraphs,
        intentionsUsed: story.intentionsUsed
      };

      setExportJson(JSON.stringify(localStory, null, 2));
      setExportFileName(`${id}.json`);
      setCopyFeedback("Copiar JSON");
    } catch (error) {
      console.error(
        "[InterpretationPanel] Erro ao preparar JSON da história:",
        error
      );

      setError(
        "Não foi possível preparar o JSON da história para exportação."
      );
    }
  }

  async function handleCopyJson() {
    if (!exportJson) {
      return;
    }

    try {
      if (
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === "function"
      ) {
        await navigator.clipboard.writeText(exportJson);
      } else {
        const textArea = document.createElement("textarea");

        textArea.value = exportJson;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const copied = document.execCommand("copy");
        textArea.remove();

        if (!copied) {
          throw new Error("O navegador não permitiu copiar o JSON.");
        }
      }

      setCopyFeedback("Copiado!");
    } catch (error) {
      console.error(
        "[InterpretationPanel] Erro ao copiar JSON:",
        error
      );

      setCopyFeedback("Não foi possível copiar");
    }
  }

  async function handleShareHq() {
    const hqImage = story?.hqImage?.trim();

    if (!hqImage) {
      return;
    }

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

      const safeName = story?.id
        ? story.id.replace(/[^a-zA-Z0-9-_]/g, "-")
        : "mental-hashmap-story-hq";

      const file = new File(
        [blob],
        `${safeName}.${extension}`,
        { type: blob.type || "image/png" }
      );

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `HQ - ${story?.titlePt ?? "Mental Hashmap"}`,
          text: story?.titleEn
            ? `${story.titlePt} — ${story.titleEn}`
            : story?.titlePt ?? "Mental Hashmap",
          files: [file]
        });
        return;
      }

      await navigator.share({
        title: `HQ - ${story?.titlePt ?? "Mental Hashmap"}`,
        text: story?.titleEn
          ? `${story.titlePt} — ${story.titleEn}`
          : story?.titlePt ?? "Mental Hashmap",
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
    const hqImage = story?.hqImage?.trim();

    if (!hqImage) {
      return;
    }

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      return;
    }

    const absoluteImageUrl = new URL(hqImage, window.location.href).href;

    printWindow.document.title = `HQ - ${story?.titlePt ?? "Mental Hashmap"}`;
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
    image.alt = `HQ da história: ${story?.titlePt ?? ""}`;

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

  function handlePrintStory() {
    if (!story) {
      return;
    }

    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const exerciseParagraphs = story.paragraphs
      .map(
        (paragraph, index) => `
          <section class="exercise-paragraph">
            <p><strong>${index + 1}.</strong> ${escapeHtml(paragraph.pt)}</p>
            <div class="answer-line"></div>
            <div class="answer-line"></div>
          </section>
        `
      )
      .join("");

    const solutionParagraphs = story.paragraphs
      .map(
        (paragraph, index) => `
          <section class="solution-paragraph">
            <p class="pt"><strong>${index + 1}.</strong> ${escapeHtml(paragraph.pt)}</p>
            <p class="en">${escapeHtml(paragraph.en)}</p>
          </section>
        `
      )
      .join("");

    const printWindow = window.open("", "_blank", "width=900,height=700");

    if (!printWindow) {
      setError(
        "O navegador bloqueou a janela de impressão. Permita pop-ups para imprimir a história."
      );
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(story.titlePt)} - Mental Hashmap</title>
          <style>
            @page {
              size: A4;
              margin: 14mm 16mm;
            }

            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              color: #111827;
              background: #ffffff;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 11pt;
              line-height: 1.42;
            }

            .page {
              width: 100%;
            }

            .exercise-page {
              break-after: page;
              page-break-after: always;
            }

            .header {
              border-bottom: 1px solid #d1d5db;
              margin-bottom: 14px;
              padding-bottom: 9px;
            }

            .brand {
              margin: 0 0 4px;
              font-size: 9pt;
              font-weight: 700;
              letter-spacing: 0.08em;
              text-transform: uppercase;
              color: #6b7280;
            }

            h1 {
              margin: 0 0 5px;
              font-size: 18pt;
              line-height: 1.2;
            }

            .meta {
              margin: 0;
              color: #4b5563;
              font-size: 9.5pt;
            }

            .instructions {
              margin: 0 0 12px;
              padding: 8px 10px;
              border: 1px solid #e5e7eb;
              border-radius: 7px;
              background: #f9fafb;
              font-size: 9.5pt;
            }

            .exercise-paragraph {
              break-inside: avoid;
              page-break-inside: avoid;
              margin: 0 0 10px;
            }

            .exercise-paragraph p,
            .solution-paragraph p {
              margin: 0 0 5px;
            }

            .answer-line {
              height: 34px;
              border-bottom: 1px solid #cbd5e1;
            }

            .solution-paragraph {
              break-inside: avoid;
              page-break-inside: avoid;
              margin: 0 0 10px;
              padding-bottom: 8px;
              border-bottom: 1px solid #e5e7eb;
            }

            .solution-paragraph .pt {
              font-weight: 600;
            }

            .solution-paragraph .en {
              margin-left: 18px;
              color: #374151;
            }

            .solution-label {
              margin: 0 0 10px;
              font-size: 9.5pt;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.06em;
              color: #6b7280;
            }

            @media print {
              body {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <main>
            <section class="page exercise-page">
              <header class="header">
                <p class="brand">Brazilian English Journey · Mental Hashmap</p>
                <h1>${escapeHtml(story.titlePt)}</h1>
                <p class="meta">Nível ${escapeHtml(englishLevel)} · Exercício de interpretação</p>
              </header>

              <p class="instructions">
                Leia a história em português e escreva sua interpretação em inglês
                nos espaços abaixo. A solução está na página 2.
              </p>

              ${exerciseParagraphs}
            </section>

            <section class="page solution-page">
              <header class="header">
                <p class="brand">Brazilian English Journey · Mental Hashmap</p>
                <h1>${escapeHtml(story.titlePt)}</h1>
                <p class="meta">${escapeHtml(story.titleEn)}</p>
              </header>

              <p class="solution-label">Solução · PT-BR + EN-US</p>

              ${solutionParagraphs}
            </section>
          </main>

          <script>
            window.addEventListener("load", function () {
              window.focus();
              window.print();
            });
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  }

  function handleDownloadJson() {
    if (!exportJson || !exportFileName) {
      return;
    }

    const blob = new Blob([exportJson], {
      type: "application/json;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = exportFileName;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  return (
    <section className="interpretation-panel">
      <div className="interpretation-header">
        <div>
          <p className="eyebrow">Interpretação</p>
          <h1>História por intenções</h1>

          <p className="interpretation-description">
            Escolha um nível, a quantidade de intenções e um tema.
            O aplicativo vai sortear as estruturas e gerar uma história
            curta para você interpretar antes de revelar o inglês.
          </p>
        </div>

        <div className="interpretation-total">
          <strong>{availableIntentions.length}</strong>
          <span>
            intenções disponíveis no nível {englishLevel}
          </span>
        </div>
      </div>

      <div className="interpretation-controls">
        <div className="field">
          <label htmlFor="interpretation-level">
            Nível de inglês
          </label>

          <select
            id="interpretation-level"
            value={englishLevel}
            onChange={(event) =>
              handleLevelChange(
                event.target.value as EnglishLevel
              )
            }
          >
            <option value="A1">A1</option>
            <option value="A2">A2</option>
            <option value="B1">B1</option>
            <option value="B2">B2</option>
            <option value="C1">C1</option>
            <option value="C2">C2</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="interpretation-amount">
            Quantas intenções usar?
          </label>

          <input
            id="interpretation-amount"
            type="number"
            min={1}
            max={maxAmount}
            value={amount}
            onChange={(event) =>
              handleAmountChange(Number(event.target.value))
            }
          />
        </div>

        <div className="field">
          <label htmlFor="interpretation-theme">Tema</label>

          <select
            id="interpretation-theme"
            value={theme}
            onChange={(event) => {
              setTheme(event.target.value);
              setStory(null);
              setShowHqImage(false);
              setShowEnglish(false);
              setError(null);
              setSpeechError(null);
              setSpeaking(false);
              setSpeakingParagraphIndex(null);

              if ("speechSynthesis" in window) {
                window.speechSynthesis.cancel();
              }
            }}
          >
            {THEMES.map((themeOption) => (
              <option
                key={themeOption}
                value={themeOption}
              >
                {themeOption}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "0.75rem",
            flexWrap: "wrap"
          }}
        >
          <button
            type="button"
            className="primary-button"
            onClick={handleGenerateStory}
            disabled={
              generating || availableIntentions.length === 0
            }
          >
            {generating
              ? "Gerando história..."
              : "Gerar história"}
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={handleToggleStorySearch}
            title={
              searchOpen
                ? "Fechar pesquisa de histórias"
                : "Pesquisar histórias da biblioteca"
            }
            aria-label={
              searchOpen
                ? "Fechar pesquisa de histórias"
                : "Pesquisar histórias da biblioteca"
            }
            aria-expanded={searchOpen}
            style={{
              width: "3rem",
              minWidth: "3rem",
              height: "3rem",
              minHeight: "3rem",
              padding: 0,
              borderRadius: "999px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </button>
        </div>
      </div>

      {searchOpen && (
        <div
          className="status-card"
          style={{
            marginTop: "1rem",
            textAlign: "left"
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "1rem",
              marginBottom: "1rem"
            }}
          >
            <div>
              <p className="eyebrow">Biblioteca local</p>
              <h2 style={{ margin: 0 }}>Pesquisar história</h2>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={() => setSearchOpen(false)}
            >
              Fechar
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(120px, 180px) minmax(220px, 1fr)",
              gap: "1rem",
              alignItems: "end"
            }}
          >
            <div className="field">
              <label htmlFor="story-search-level">Nível</label>

              <select
                id="story-search-level"
                value={searchLevel}
                onChange={(event) =>
                  setSearchLevel(event.target.value as EnglishLevel)
                }
              >
                <option value="A1">A1</option>
                <option value="A2">A2</option>
                <option value="B1">B1</option>
                <option value="B2">B2</option>
                <option value="C1">C1</option>
                <option value="C2">C2</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="story-search-title">Título da história</label>

              <input
                id="story-search-title"
                type="search"
                value={searchTitle}
                onChange={(event) => setSearchTitle(event.target.value)}
                placeholder="Digite parte do título em português ou inglês..."
                autoComplete="off"
              />
            </div>
          </div>

          <div style={{ marginTop: "1.25rem" }}>
            <p
              style={{
                margin: "0 0 0.75rem",
                fontWeight: 700
              }}
            >
              {searchResults.length === 1
                ? "1 história encontrada"
                : `${searchResults.length} histórias encontradas`}
            </p>

            {searchResults.length === 0 ? (
              <p style={{ margin: 0 }}>
                Nenhuma história encontrada para o nível {searchLevel}
                {searchTitle.trim()
                  ? ` com o título "${searchTitle.trim()}".`
                  : "."}
              </p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: "0.65rem"
                }}
              >
                {searchResults.map((localStory, index) => (
                  <div
                    key={
                      localStory.id ??
                      `${localStory.titlePt}-${localStory.titleEn}-${index}`
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "1rem",
                      padding: "0.8rem 0.9rem",
                      border: "1px solid rgba(148, 163, 184, 0.35)",
                      borderRadius: "12px"
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <strong>{localStory.titlePt}</strong>
                      <p
                        className="english"
                        style={{
                          margin: "0.2rem 0 0"
                        }}
                      >
                        {localStory.titleEn}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => handleLoadLocalStory(localStory)}
                      style={{ flexShrink: 0 }}
                    >
                      Carregar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="status-card error-card">
          <h2>Não foi possível gerar a história.</h2>
          <p>{error}</p>
        </div>
      )}

      {generating && (
        <div className="status-card">
          <div className="spinner" />
          <p>
            Criando uma história com suas intenções...
          </p>
        </div>
      )}

      {!generating &&
        !error &&
        selectedIntentions.length > 0 && (
          <div className="interpretation-intentions">
            <p className="eyebrow">
              Intenções sorteadas
            </p>

            <div className="interpretation-intention-list">
              {selectedIntentions.map((item) => (
                <span
                  className="pill"
                  key={item.id}
                >
                  {item.intention}
                </span>
              ))}
            </div>
          </div>
        )}

      {!generating && story && (
        <article className="interpretation-story">
          <div className="interpretation-story-header">
            <div>
              <p className="eyebrow">História</p>
              <h2>{story.titlePt}</h2>

              {showEnglish && (
                <p className="english interpretation-title-en">
                  {story.titleEn}
                </p>
              )}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "0.75rem",
                flexWrap: "wrap"
              }}
            >
              <button
                type="button"
                className="secondary-button"
                style={{
                  borderRadius: "999px",
                  minWidth: "3.5rem",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
                title="Imprimir exercício e solução"
                aria-label="Imprimir exercício e solução"
                onClick={handlePrintStory}
              >
                <svg
                  aria-hidden="true"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 9V2h12v7" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
              </button>

              {story.source === "local" &&
                Boolean(story.hqImage?.trim()) && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setShareError(null);
                      setShowHqImage(true);
                    }}
                    title="Ver HQ da história"
                    aria-label="Ver HQ da história"
                    style={{
                      width: "3.5rem",
                      minWidth: "3.5rem",
                      height: "3rem",
                      minHeight: "3rem",
                      padding: 0,
                      borderRadius: "999px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}
                  >
                    <span aria-hidden="true">📷</span>
                  </button>
                )}

              {story.source === "ai" && (
                <button
                  type="button"
                  className="secondary-button"
                  style={{
                    borderRadius: "999px",
                    minWidth: "3.5rem"
                  }}
                  title="Exportar história gerada pela IA"
                  onClick={handleOpenExportJson}
                >
                  {"{...}"}
                </button>
              )}

              {showEnglish && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleSpeakStory}
                  disabled={speaking}
                  title="Ouvir a história completa em inglês"
                >
                  {speaking ? "🔊 Reproduzindo..." : "🔊 Ouvir inglês"}
                </button>
              )}

              <button
                type="button"
                className={
                  showEnglish
                    ? "secondary-button"
                    : "primary-button"
                }
                onClick={handleToggleEnglish}
              >
                {showEnglish
                  ? "Ocultar versão em inglês"
                  : "Mostrar versão em inglês"}
              </button>
            </div>
          </div>

          {speechError && (
            <div className="status-card error-card google-translation-error">
              <h2>Não foi possível reproduzir o áudio.</h2>
              <p>{speechError}</p>
            </div>
          )}

          <div className="interpretation-paragraphs">
            {story.paragraphs.map((paragraph, index) => (
              <section
                className="interpretation-paragraph"
                key={`${index}-${paragraph.pt}`}
              >
                <p className="interpretation-pt">
                  {renderHighlightedText(
                    paragraph.pt,
                    paragraph.intentions.map(
                      (intention) => intention.ptIntent
                    )
                  )}
                </p>

                {showEnglish && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "0.6rem"
                    }}
                  >
                    <p
                      className="english interpretation-en"
                      style={{ flex: 1 }}
                    >
                      {renderHighlightedText(
                        paragraph.en,
                        paragraph.intentions.map(
                          (intention) => intention.enIntent
                        )
                      )}
                    </p>

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        handleSpeakParagraph(paragraph.en, index)
                      }
                      disabled={speakingParagraphIndex === index}
                      title={
                        speakingParagraphIndex === index
                          ? "Reproduzindo este parágrafo"
                          : "Ouvir este parágrafo em inglês"
                      }
                      aria-label={
                        speakingParagraphIndex === index
                          ? `Reproduzindo parágrafo ${index + 1}`
                          : `Ouvir parágrafo ${index + 1} em inglês`
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
                        justifyContent: "center",
                        flexShrink: 0
                      }}
                    >
                      <span aria-hidden="true">🔊</span>
                    </button>
                  </div>
                )}
              </section>
            ))}
          </div>

          {showHqImage &&
            story.source === "local" &&
            story.hqImage?.trim() && (
              <div
                role="dialog"
                aria-modal="true"
                aria-label={`HQ da história ${story.titlePt}`}
                onMouseDown={(event) => {
                  event.stopPropagation();
                  setShowHqImage(false);
                  setShareError(null);
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
                    src={story.hqImage}
                    alt={`HQ da história: ${story.titlePt}`}
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

                  <button
                    type="button"
                    onClick={() => {
                      setShowHqImage(false);
                      setShareError(null);
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

          {exportJson && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="JSON da história"
              onClick={() => setExportJson(null)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "1rem",
                background: "rgba(0, 0, 0, 0.55)"
              }}
            >
              <div
                className="status-card"
                onClick={(event) => event.stopPropagation()}
                style={{
                  width: "min(900px, 95vw)",
                  maxHeight: "90vh",
                  overflow: "auto",
                  textAlign: "left"
                }}
              >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "1rem",
                  marginBottom: "1rem"
                }}
              >
                <div>
                  <p className="eyebrow">JSON da história</p>
                  <strong>Pronto para alimentar a biblioteca local</strong>
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setExportJson(null)}
                  title="Fechar"
                >
                  Fechar
                </button>
              </div>

              <pre
                style={{
                  maxHeight: "420px",
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  padding: "1rem",
                  borderRadius: "12px",
                  background: "rgba(0, 0, 0, 0.05)"
                }}
              >
                {exportJson}
              </pre>

              <div
                style={{
                  display: "flex",
                  gap: "0.75rem",
                  flexWrap: "wrap",
                  marginTop: "1rem"
                }}
              >
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleCopyJson}
                >
                  {copyFeedback}
                </button>

                <button
                  type="button"
                  className="primary-button"
                  onClick={handleDownloadJson}
                >
                  Baixar JSON
                </button>
              </div>
              </div>
            </div>
          )}

          {story.source === "local" && (
            <div
              role="status"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.75rem",
                marginTop: "1.5rem",
                padding: "0.9rem 1rem",
                border: "1px solid rgba(202, 138, 4, 0.28)",
                borderRadius: "12px",
                background: "rgba(254, 240, 138, 0.28)",
                color: "inherit"
              }}
            >
              <span aria-hidden="true">🟡</span>

              <div>
                <strong>História da biblioteca local</strong>
                <p style={{ margin: "0.25rem 0 0" }}>
                  Esta história foi carregada da biblioteca de histórias do
                  Mental Hashmap.
                </p>
              </div>
            </div>
          )}

          <div className="interpretation-used">
            <h3>Intenções utilizadas</h3>

            <div className="interpretation-used-list">
              {story.intentionsUsed.map((id) => {
                const intention = intentions.find(
                  (item) => item.id === id
                );

                return intention ? (
                  <button
                    type="button"
                    className="pill interpretation-used-button"
                    key={id}
                    onClick={() => onSelectIntention(intention)}
                    title={`Ver detalhes de ${intention.intention}`}
                  >
                    {intention.intention}
                  </button>
                ) : (
                  <span
                    className="pill"
                    key={id}
                  >
                    {id}
                  </span>
                );
              })}
            </div>
          </div>
        </article>
      )}
    </section>
  );
}
