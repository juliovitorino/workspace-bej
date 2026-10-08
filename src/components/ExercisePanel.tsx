import { useEffect, useMemo, useState } from "react";
import type { Example, MentalIntention } from "../types/hashmap";

type ExerciseMode = "basic" | "advanced";
type EnglishLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

const ENGLISH_LEVELS: EnglishLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

interface ExercisePanelProps {
  intentions: MentalIntention[];
  onStartTraining: (
    intention: MentalIntention,
    mode: ExerciseMode
  ) => void;
}

interface ExerciseItem {
  intention: MentalIntention;
  example: Example;
}

// Guardamos apenas identificadores: as intenções e os exemplos são recuperados
// do hashmap atual, evitando salvar uma cópia desatualizada do conteúdo.
interface SavedExercise {
  intentionId: string;
  exampleIndex: number;
}

interface ExerciseSession {
  englishLevel: EnglishLevel;
  mode: ExerciseMode;
  category: string;
  amount: number;
  exercises: SavedExercise[];
}

const EXERCISE_SESSION_KEY = "mental-hashmap-exercise-session-v1";

const DEFAULT_EXERCISE_SESSION: ExerciseSession = {
  englishLevel: "B1",
  mode: "basic",
  category: "Todas",
  amount: 5,
  exercises: []
};

function readExerciseSession(): ExerciseSession {
  try {
    const stored = window.sessionStorage.getItem(EXERCISE_SESSION_KEY);
    if (!stored) return DEFAULT_EXERCISE_SESSION;

    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") return DEFAULT_EXERCISE_SESSION;

    const saved = parsed as Partial<ExerciseSession>;
    return {
      englishLevel: ENGLISH_LEVELS.includes(saved.englishLevel as EnglishLevel)
        ? (saved.englishLevel as EnglishLevel)
        : DEFAULT_EXERCISE_SESSION.englishLevel,
      mode: saved.mode === "advanced" ? "advanced" : "basic",
      category: typeof saved.category === "string"
        ? saved.category
        : DEFAULT_EXERCISE_SESSION.category,
      amount: typeof saved.amount === "number" &&
        Number.isInteger(saved.amount) && saved.amount > 0
        ? saved.amount
        : DEFAULT_EXERCISE_SESSION.amount,
      exercises: Array.isArray(saved.exercises)
        ? saved.exercises.filter((item): item is SavedExercise =>
            item !== null &&
            typeof item === "object" &&
            typeof item.intentionId === "string" &&
            Number.isInteger(item.exampleIndex) &&
            item.exampleIndex >= 0
          )
        : []
    };
  } catch {
    // O treino continua funcionando mesmo se o armazenamento estiver bloqueado.
    return DEFAULT_EXERCISE_SESSION;
  }
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

function pickRandomExample(item: MentalIntention): Example | null {
  const examples = item.examples ?? [];

  if (examples.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * examples.length);
  return examples[randomIndex];
}

function generateExercises(
  intentions: MentalIntention[],
  amount: number
): ExerciseItem[] {
  const availableIntentions = intentions.filter(
    (item) => (item.examples?.length ?? 0) > 0
  );

  return shuffle(availableIntentions)
    .slice(0, amount)
    .map((intention) => {
      const example = pickRandomExample(intention);

      return example
        ? {
            intention,
            example
          }
        : null;
    })
    .filter((item): item is ExerciseItem => item !== null);
}

export function ExercisePanel({
  intentions,
  onStartTraining
}: ExercisePanelProps) {
  const [savedSession] = useState(readExerciseSession);
  const [englishLevel, setEnglishLevel] = useState<EnglishLevel>(savedSession.englishLevel);
  const [mode, setMode] = useState<ExerciseMode>(savedSession.mode);
  const [category, setCategory] = useState(savedSession.category);
  const [amount, setAmount] = useState(savedSession.amount);
  const [savedExercises, setSavedExercises] = useState<SavedExercise[]>(savedSession.exercises);

  // Reconstrói o mesmo sorteio (inclusive a ordem e os exemplos escolhidos)
  // quando a tela é remontada depois de um treino.
  const exercises = useMemo<ExerciseItem[]>(() => {
    const byId = new Map(intentions.map((item) => [item.id, item]));

    return savedExercises.flatMap(({ intentionId, exampleIndex }) => {
      const intention = byId.get(intentionId);
      const example = intention?.examples?.[exampleIndex];
      return intention && example ? [{ intention, example }] : [];
    });
  }, [intentions, savedExercises]);

  useEffect(() => {
    try {
      const session: ExerciseSession = {
        englishLevel, mode, category, amount, exercises: savedExercises
      };
      window.sessionStorage.setItem(EXERCISE_SESSION_KEY, JSON.stringify(session));
    } catch {
      // Armazenamento indisponível: não impede a utilização dos exercícios.
    }
  }, [englishLevel, mode, category, amount, savedExercises]);

  const availableCategories = useMemo(() => {
    const categoryCounts = new Map<string, number>();

    intentions
      .filter(
        (item) =>
          item.englishLevel === englishLevel &&
          (item.examples?.length ?? 0) > 0 &&
          Boolean(item.category)
      )
      .forEach((item) => {
        const itemCategory = item.category as string;
        categoryCounts.set(
          itemCategory,
          (categoryCounts.get(itemCategory) ?? 0) + 1
        );
      });

    return Array.from(categoryCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [intentions, englishLevel]);

  const totalIntentionsForLevel = useMemo(
    () =>
      intentions.filter(
        (item) =>
          item.englishLevel === englishLevel &&
          (item.examples?.length ?? 0) > 0
      ).length,
    [intentions, englishLevel]
  );

  const availableIntentions = useMemo(
    () =>
      intentions.filter(
        (item) =>
          item.englishLevel === englishLevel &&
          (category === "Todas" || item.category === category) &&
          (item.examples?.length ?? 0) > 0
      ),
    [intentions, englishLevel, category]
  );

  const maxAmount = availableIntentions.length;

  function handleAmountChange(value: number) {
    if (Number.isNaN(value)) {
      return;
    }

    const normalizedValue = Math.min(
      Math.max(value, 1),
      Math.max(maxAmount, 1)
    );

    setAmount(normalizedValue);
  }

  function handleGenerate() {
    if (maxAmount === 0) {
      setSavedExercises([]);
      return;
    }

    const generated = generateExercises(
      availableIntentions,
      Math.min(amount, maxAmount)
    );
    setSavedExercises(generated.map(({ intention, example }) => ({
      intentionId: intention.id,
      exampleIndex: (intention.examples ?? []).indexOf(example)
    })));
  }

  function handleModeChange(nextMode: ExerciseMode) {
    setMode(nextMode);
    setSavedExercises([]);
  }

  function handleLevelChange(nextLevel: EnglishLevel) {
    const levelCount = intentions.filter(
      (item) =>
        item.englishLevel === nextLevel &&
        (item.examples?.length ?? 0) > 0
    ).length;

    setEnglishLevel(nextLevel);
    setCategory("Todas");
    setSavedExercises([]);
    setAmount((current) =>
      Math.min(Math.max(current, 1), Math.max(levelCount, 1))
    );
  }

  function handleCategoryChange(nextCategory: string) {
    const categoryCount = intentions.filter(
      (item) =>
        item.englishLevel === englishLevel &&
        (nextCategory === "Todas" || item.category === nextCategory) &&
        (item.examples?.length ?? 0) > 0
    ).length;

    setCategory(nextCategory);
    setSavedExercises([]);
    setAmount((current) =>
      Math.min(Math.max(current, 1), Math.max(categoryCount, 1))
    );
  }

  return (
    <section className="exercise-panel">
      <div className="exercise-header">
        <div>
          <p className="eyebrow">Exercícios</p>
          <h1>Treino de intenções</h1>

          <p className="exercise-description">
            Escolha o tipo de treino e quantas intenções você quer praticar.
            O aplicativo vai sortear as intenções e você poderá iniciar
            o treino de cada uma delas.
          </p>
        </div>

        <div className="exercise-total">
          <strong>{maxAmount}</strong>
          <span>
            intenções com exemplos no nível {englishLevel}
            {category !== "Todas" ? ` · ${category}` : ""}
          </span>
        </div>
      </div>

      {maxAmount === 0 ? (
        <div className="empty-state">
          <h2>Nenhuma intenção com exemplo disponível.</h2>
          <p>
            Adicione exemplos ao JSON para utilizar a área de exercícios.
          </p>
        </div>
      ) : (
        <>
          <div className="exercise-mode-selector">
            <p className="exercise-mode-label">Tipo de treino</p>

            <div className="exercise-mode-buttons">
              <button
                type="button"
                className={
                  mode === "basic"
                    ? "exercise-mode-button active"
                    : "exercise-mode-button"
                }
                onClick={() => handleModeChange("basic")}
              >
                <strong>Treino básico</strong>
                <span>1 verbo + 1 adjetivo + 1 noun</span>
              </button>

              <button
                type="button"
                className={
                  mode === "advanced"
                    ? "exercise-mode-button active"
                    : "exercise-mode-button"
                }
                onClick={() => handleModeChange("advanced")}
              >
                <strong>Treino avançado</strong>
                <span>
                  2 verbos + 2 adjetivos + 2 nouns + 4 conectores
                </span>
              </button>
            </div>
          </div>

          <div className="exercise-level-selector">
            <p className="exercise-mode-label">Nível de inglês</p>

            <div className="exercise-level-buttons">
              {ENGLISH_LEVELS.map((level) => (
                <button
                  type="button"
                  key={level}
                  className={
                    englishLevel === level
                      ? "exercise-level-button active"
                      : "exercise-level-button"
                  }
                  onClick={() => handleLevelChange(level)}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div className="exercise-level-selector">
            <p className="exercise-mode-label">Categoria</p>

            <div className="field">
              <select
                id="exercise-category"
                value={category}
                onChange={(event) =>
                  handleCategoryChange(event.target.value)
                }
              >
                <option value="Todas">
                  Todas ({totalIntentionsForLevel})
                </option>
                {availableCategories.map((availableCategory) => (
                  <option
                    key={availableCategory.name}
                    value={availableCategory.name}
                  >
                    {availableCategory.name} ({availableCategory.count})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="exercise-controls">
            <div className="field exercise-amount-field">
              <label htmlFor="exercise-amount">
                Quantas intenções você quer treinar?
              </label>

              <input
                id="exercise-amount"
                type="number"
                min={1}
                max={maxAmount}
                value={amount}
                onChange={(event) =>
                  handleAmountChange(Number(event.target.value))
                }
              />
            </div>

            <button
              type="button"
              className="primary-button"
              onClick={handleGenerate}
            >
              {exercises.length > 0
                ? "Sortear novamente"
                : "Gerar treino"}
            </button>
          </div>

          {exercises.length > 0 && (
            <>
              <div className="exercise-results-header">
                <p className="eyebrow">
                  {mode === "basic"
                    ? `Treino básico · ${englishLevel}${
                        category !== "Todas" ? ` · ${category}` : ""
                      }`
                    : `Treino avançado · ${englishLevel}${
                        category !== "Todas" ? ` · ${category}` : ""
                      }`}
                </p>

                <h2>
                  {exercises.length}{" "}
                  {exercises.length === 1
                    ? "intenção sorteada"
                    : "intenções sorteadas"}
                </h2>

                <p className="exercise-description">
                  Clique em <strong>Treinar</strong> para abrir o exercício
                  completo daquela intenção.
                </p>
              </div>

              <div className="exercise-list">
                {exercises.map(({ intention, example }, index) => (
                  <article
                    className="exercise-card"
                    key={intention.id}
                  >
                    <div className="exercise-card-number">
                      {index + 1}
                    </div>

                    <div className="exercise-card-content">
                      <h2>{intention.intention}</h2>

                      <p className="english">
                        {intention.english}
                      </p>

                      {intention.pattern && (
                        <p className="exercise-pattern">
                          {intention.pattern}
                        </p>
                      )}

                      <div className="exercise-example">
                        <span className="exercise-example-label">
                          Exemplo do Hashmap
                        </span>

                        <p>{example.pt}</p>
                        <p className="english">{example.en}</p>
                      </div>

                      <div className="exercise-card-meta">
                        {intention.category && (
                          <span className="pill category-pill">
                            {intention.category}
                          </span>
                        )}

                        {(intention.tags ?? []).map((tag) => (
                          <span
                            className="tag-pill"
                            key={`${intention.id}-${tag}`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      <div className="exercise-card-actions">
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() =>
                            onStartTraining(intention, mode)
                          }
                        >
                          Treinar
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
