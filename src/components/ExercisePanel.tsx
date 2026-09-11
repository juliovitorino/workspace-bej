import { useMemo, useState } from "react";
import type { Example, MentalIntention } from "../types/hashmap";

interface ExercisePanelProps {
  intentions: MentalIntention[];
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
  intentions
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

  return (
    <section className="exercise-panel">
      <div className="exercise-header">
        <div>
          <p className="eyebrow">Exercícios</p>
          <h1>Treino de intenções</h1>
          <p className="exercise-description">
            Escolha quantas intenções você quer treinar.
            O aplicativo vai sortear as intenções e selecionar
            um exemplo existente no Mental Hashmap para cada uma.
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
                : "Gerar exercício"}
            </button>
          </div>

          {exercises.length > 0 && (
            <>
              <div className="exercise-results-header">
                <p className="eyebrow">Treino gerado</p>
                <h2>
                  {exercises.length}{" "}
                  {exercises.length === 1
                    ? "intenção sorteada"
                    : "intenções sorteadas"}
                </h2>
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
                          Exemplo
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
