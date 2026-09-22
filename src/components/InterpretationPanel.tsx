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
