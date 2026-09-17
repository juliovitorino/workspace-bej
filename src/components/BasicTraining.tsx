import { useEffect, useMemo, useState } from "react";
import type { MentalIntention } from "../types/hashmap";
import {
  evaluateTrainingWithAI,
  type AIEvaluationResult
} from "../services/aiEvaluationService";

const AI_ENABLED = import.meta.env.VITE_AI_ENABLED === "true";


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

interface BasicTrainingProps {
  intention: MentalIntention;
  onBack: () => void;
}

interface VerbItem {
  id: string;
  base: string;
  type?: "regular" | "irregular";
  past?: string;
  pastParticiple?: string;
  thirdPerson?: string;
  gerund?: string;
  meanings?: string[];
  examples?: Array<{
    en: string;
    pt: string;
  }>;
}

interface NounItem {
  id: string;
  noun: string;
  meanings?: string[];
  examples?: Array<{
    en: string;
    pt: string;
  }>;
}

interface AdjectiveItem {
  id: string;
  adjective: string;
  meanings?: string[];
  examples?: Array<{
    en: string;
    pt: string;
  }>;
}

interface VerbData {
  verbs: VerbItem[];
}

interface NounData {
  nouns: NounItem[];
}

interface AdjectiveData {
  adjectives: AdjectiveItem[];
}

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * items.length);
  return items[randomIndex];
}

export function BasicTraining({
  intention,
  onBack
}: BasicTrainingProps) {
  const [verbs, setVerbs] = useState<VerbItem[]>([]);
  const [nouns, setNouns] = useState<NounItem[]>([]);
  const [adjectives, setAdjectives] = useState<AdjectiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [studentText, setStudentText] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<AIEvaluationResult | null>(null);

  useEffect(() => {
    let active = true;

    async function loadVocabulary() {
      setLoading(true);
      setError(null);

      try {
        const [verbsResponse, nounsResponse, adjectivesResponse] =
          await Promise.all([
            fetch("/english-verbs-common.json"),
            fetch("/english-nouns-common.json"),
            fetch("/english-adjectives-common.json")
          ]);

        if (
          !verbsResponse.ok ||
          !nounsResponse.ok ||
          !adjectivesResponse.ok
        ) {
          throw new Error(
            "Não foi possível carregar os arquivos de vocabulário."
          );
        }

        const verbsData = (await verbsResponse.json()) as VerbData;
        const nounsData = (await nounsResponse.json()) as NounData;
        const adjectivesData =
          (await adjectivesResponse.json()) as AdjectiveData;

        if (!active) {
          return;
        }

        setVerbs(verbsData.verbs ?? []);
        setNouns(nounsData.nouns ?? []);
        setAdjectives(adjectivesData.adjectives ?? []);
      } catch (err) {
        if (!active) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Erro inesperado ao carregar o vocabulário."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadVocabulary();

    return () => {
      active = false;
    };
  }, []);

  const trainingItems = useMemo(() => {
    return {
      verb: pickRandom(verbs),
      noun: pickRandom(nouns),
      adjective: pickRandom(adjectives)
    };
  }, [verbs, nouns, adjectives, round]);

  function generateNewRound() {
    setRound((current) => current + 1);
    setStudentText("");
    setEvaluation(null);
    setEvaluationError(null);
  }

  async function handleEvaluate() {
    if (
      !trainingItems.verb ||
      !trainingItems.adjective ||
      !trainingItems.noun
    ) {
      return;
    }

    if (!studentText.trim()) {
      setEvaluationError(
        "Escreva ou dite uma frase antes de solicitar a avaliação."
      );
      return;
    }

    setEvaluating(true);
    setEvaluationError(null);
    setEvaluation(null);

    try {
      const result = await evaluateTrainingWithAI({
        mode: "basic",
        intention,
        studentText,
        vocabulary: {
          verbs: [trainingItems.verb.base],
          adjectives: [trainingItems.adjective.adjective],
          nouns: [trainingItems.noun.noun]
        }
      });

      setEvaluation(result);
    } catch (err) {
      setEvaluationError(
        err instanceof Error
          ? err.message
          : "Não foi possível avaliar a frase."
      );
    } finally {
      setEvaluating(false);
    }
  }

  return (
    <section className="basic-training">
      <div className="training-toolbar">
        <button
          type="button"
          className="secondary-button"
          onClick={onBack}
        >
          Voltar para o Hashmap
        </button>

        {!loading && !error && (
          <button
            type="button"
            className="primary-button"
            onClick={generateNewRound}
          >
            Sortear novamente
          </button>
        )}
      </div>

      <div className="training-page-header">
        <p className="eyebrow">Treino básico</p>
        <h1>{intention.intention}</h1>
        <p className="detail-english">{intention.english}</p>

        {intention.examples && intention.examples.length > 0 && (
          <section className="training-intention-example">
            <h3>Exemplo</h3>
            <div className="example">
              <p>
                {renderHighlightedText(
                  intention.examples[0].pt,
                  intention.examples[0].ptIntent
                )}
              </p>
              <p className="english">
                {renderHighlightedText(
                  intention.examples[0].en,
                  intention.examples[0].enIntent
                )}
              </p>
            </div>
          </section>
        )}

        {intention.pattern && (
          <p className="training-pattern">{intention.pattern}</p>
        )}

        <p className="training-instruction">
          Crie uma frase usando a intenção mental e tente incluir
          o verbo, o adjetivo e o substantivo sorteados abaixo.
        </p>
      </div>

      {loading && (
        <div className="status-card">
          <div className="spinner" />
          <p>Carregando vocabulário...</p>
        </div>
      )}

      {!loading && error && (
        <div className="status-card error-card">
          <h2>Não foi possível carregar o treino.</h2>
          <p>{error}</p>
        </div>
      )}

      {!loading &&
        !error &&
        trainingItems.verb &&
        trainingItems.adjective &&
        trainingItems.noun && (
          <div className="basic-training-grid">
            <article className="training-word-card">
              <p className="eyebrow">Verbo</p>
              <h2>{trainingItems.verb.base}</h2>

              {trainingItems.verb.meanings &&
                trainingItems.verb.meanings.length > 0 && (
                  <p className="training-translation">
                    {trainingItems.verb.meanings.join(" / ")}
                  </p>
                )}

              <div className="training-verb-forms">
                <div className="training-verb-form">
                  <span>Presente</span>
                  <strong>
                    {trainingItems.verb.thirdPerson
                      ? `${trainingItems.verb.base} / ${trainingItems.verb.thirdPerson}`
                      : trainingItems.verb.base}
                  </strong>
                </div>

                {trainingItems.verb.past && (
                  <div className="training-verb-form">
                    <span>Passado</span>
                    <strong>{trainingItems.verb.past}</strong>
                  </div>
                )}

                {trainingItems.verb.pastParticiple && (
                  <div className="training-verb-form">
                    <span>Particípio</span>
                    <strong>{trainingItems.verb.pastParticiple}</strong>
                  </div>
                )}

                {trainingItems.verb.type && (
                  <div className="training-verb-form">
                    <span>Tipo</span>
                    <strong>
                      {trainingItems.verb.type === "irregular"
                        ? "Irregular"
                        : "Regular"}
                    </strong>
                  </div>
                )}
              </div>
            </article>

            <article className="training-word-card">
              <p className="eyebrow">Adjetivo</p>
              <h2>{trainingItems.adjective.adjective}</h2>

              {trainingItems.adjective.meanings &&
                trainingItems.adjective.meanings.length > 0 && (
                  <p className="training-translation">
                    {trainingItems.adjective.meanings.join(" / ")}
                  </p>
                )}
            </article>

            <article className="training-word-card">
              <p className="eyebrow">Noun</p>
              <h2>{trainingItems.noun.noun}</h2>

              {trainingItems.noun.meanings &&
                trainingItems.noun.meanings.length > 0 && (
                  <p className="training-translation">
                    {trainingItems.noun.meanings.join(" / ")}
                  </p>
                )}
            </article>
          </div>
        )}

      {!loading && !error && (
        <>
          <div className="training-writing-area">
            <label htmlFor="basic-training-answer">
              Escreva (Dite) sua frase
            </label>

            <textarea
              id="basic-training-answer"
              rows={5}
              placeholder="Digite sua frase em inglês..."
              value={studentText}
              onChange={(event) => {
                setStudentText(event.target.value);
                setEvaluation(null);
                setEvaluationError(null);
              }}
            />

            {AI_ENABLED && (
              <button
                type="button"
                className="primary-button"
                onClick={handleEvaluate}
                disabled={evaluating || !studentText.trim()}
              >
                {evaluating
                  ? "Avaliando com IA..."
                  : "Avaliar com IA"}
              </button>
            )}
          </div>

          {AI_ENABLED && evaluationError && (
            <div className="status-card error-card ai-evaluation-error">
              <h2>Não foi possível avaliar a frase.</h2>
              <p>{evaluationError}</p>
            </div>
          )}

          {AI_ENABLED && evaluation && (
            <section className="ai-evaluation-card">
              <div className="ai-evaluation-header">
                <div>
                  <p className="eyebrow">Avaliação com IA</p>
                  <h2>Resultado do treino</h2>
                </div>

                <div className="ai-score">
                  <strong>{evaluation.score}</strong>
                  <span>/ 10</span>
                </div>
              </div>

              <div className="ai-evaluation-grid">
                <div>
                  <span>Gramática</span>
                  <strong>{evaluation.grammar}</strong>
                </div>

                <div>
                  <span>Naturalidade</span>
                  <strong>{evaluation.naturalness}</strong>
                </div>

                <div>
                  <span>Intenção mental</span>
                  <strong>
                    {evaluation.intentionUsedCorrectly
                      ? "Correta"
                      : "Precisa melhorar"}
                  </strong>
                </div>

                <div>
                  <span>Vocabulário sorteado</span>
                  <strong>
                    {evaluation.vocabularyUsedCorrectly
                      ? "Bom uso"
                      : "Precisa melhorar"}
                  </strong>
                </div>
              </div>

              <div className="ai-feedback-section">
                <h3>Feedback</h3>
                <p>{evaluation.feedbackPt}</p>
              </div>

              <div className="ai-feedback-section">
                <h3>Correção</h3>
                <p className="english">
                  {evaluation.correctedSentence}
                </p>
              </div>

              <div className="ai-feedback-section">
                <h3>Versão mais natural</h3>
                <p className="english">
                  {evaluation.betterVersion}
                </p>
              </div>
            </section>
          )}
        </>
      )}
    </section>
  );
}
