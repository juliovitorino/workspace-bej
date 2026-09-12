import { useEffect, useMemo, useState } from "react";
import type { MentalIntention } from "../types/hashmap";

interface BasicTrainingProps {
  intention: MentalIntention;
  onBack: () => void;
}

interface VerbItem {
  id: string;
  base: string;
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
        <div className="training-writing-area">
          <label htmlFor="basic-training-answer">
            Escreva (Dite) sua frase
          </label>

          <textarea
            id="basic-training-answer"
            rows={5}
            placeholder="Digite sua frase em inglês..."
          />
        </div>
      )}
    </section>
  );
}
