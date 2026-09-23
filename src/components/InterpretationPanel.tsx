import {
  useMemo,
  useState,
  type ReactNode
} from "react";
import type { MentalIntention } from "../types/hashmap";
import {
  generateInterpretationStory,
  type StoryGenerationResult
} from "../services/storyGenerationService";

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

  const availableIntentions = useMemo(
    () =>
      intentions.filter(
        (item) => item.englishLevel === englishLevel
      ),
    [intentions, englishLevel]
  );

  const maxAmount = Math.max(1, availableIntentions.length);

  function handleLevelChange(nextLevel: EnglishLevel) {
    setEnglishLevel(nextLevel);
    setStory(null);
    setSelectedIntentions([]);
    setShowEnglish(false);
    setError(null);

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
    setShowEnglish(false);
    setSelectedIntentions(pickedIntentions);

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
              setShowEnglish(false);
              setError(null);
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
      </div>

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
                gap: "0.75rem"
              }}
            >
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

              <button
                type="button"
                className={
                  showEnglish
                    ? "secondary-button"
                    : "primary-button"
                }
                onClick={() =>
                  setShowEnglish((current) => !current)
                }
              >
                {showEnglish
                  ? "Ocultar versão em inglês"
                  : "Mostrar versão em inglês"}
              </button>
            </div>
          </div>

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
                  <p className="english interpretation-en">
                    {renderHighlightedText(
                      paragraph.en,
                      paragraph.intentions.map(
                        (intention) => intention.enIntent
                      )
                    )}
                  </p>
                )}
              </section>
            ))}
          </div>

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
                  Esta história foi carregada da biblioteca local porque a IA
                  não estava disponível no momento.
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
