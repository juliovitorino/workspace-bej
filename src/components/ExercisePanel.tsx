import { useMemo, useState } from "react";
import type { Example, MentalIntention } from "../types/hashmap";

type ExerciseMode = "basic" | "advanced";

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
  const availableIntentions = useMemo(
    () =>
      intentions.filter(
        (item) => (item.examples?.length ?? 0) > 0
      ),
    [intentions]
  );

  const maxAmount = availableIntentions.length;

  const [amount, setAmount] = useState(
    Math.min(5, Math.max(1, maxAmount))
  );

  const [mode, setMode] = useState<ExerciseMode>("basic");
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);

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
      setExercises([]);
      return;
    }

    setExercises(
      generateExercises(
        availableIntentions,
        Math.min(amount, maxAmount)
      )
    );
  }

  function handleModeChange(nextMode: ExerciseMode) {
    setMode(nextMode);
    setExercises([]);
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
          <span>intenções com exemplos disponíveis</span>
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
                    ? "Treino básico"
                    : "Treino avançado"}
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
