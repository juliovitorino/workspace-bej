import { useEffect, useMemo, useState } from "react";
import type { MentalIntention } from "../types/hashmap";

interface AdvancedTrainingProps {
  intention: MentalIntention;
  onBack: () => void;
}

interface VerbItem {
  id: string;
  base: string;
  meanings?: string[];
}

interface NounItem {
  id: string;
  noun: string;
  meanings?: string[];
}

interface AdjectiveItem {
  id: string;
  adjective: string;
  meanings?: string[];
}

interface ConnectorItem {
  id: string;
  connector: string;
  meaning?: string;
  meanings?: string[];
  type?: string;
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

interface ConnectorData {
  connectors: ConnectorItem[];
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

function pickRandomItems<T>(items: T[], amount: number): T[] {
  return shuffle(items).slice(0, Math.min(amount, items.length));
}

function connectorMeaning(connector: ConnectorItem): string {
  if (connector.meanings && connector.meanings.length > 0) {
    return connector.meanings.join(" / ");
  }

  return connector.meaning ?? "";
}

export function AdvancedTraining({
  intention,
  onBack
}: AdvancedTrainingProps) {
  const [verbs, setVerbs] = useState<VerbItem[]>([]);
  const [nouns, setNouns] = useState<NounItem[]>([]);
  const [adjectives, setAdjectives] = useState<AdjectiveItem[]>([]);
  const [connectors, setConnectors] = useState<ConnectorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadVocabulary() {
      setLoading(true);
      setError(null);

      try {
        const [
          verbsResponse,
          nounsResponse,
          adjectivesResponse,
          connectorsResponse
        ] = await Promise.all([
          fetch("/english-verbs-common.json"),
          fetch("/english-nouns-common.json"),
          fetch("/english-adjectives-common.json"),
          fetch("/english-connectors-common.json")
        ]);

        if (
          !verbsResponse.ok ||
          !nounsResponse.ok ||
          !adjectivesResponse.ok ||
          !connectorsResponse.ok
        ) {
          throw new Error(
            "Não foi possível carregar os arquivos de vocabulário."
          );
        }

        const verbsData = (await verbsResponse.json()) as VerbData;
        const nounsData = (await nounsResponse.json()) as NounData;
        const adjectivesData =
          (await adjectivesResponse.json()) as AdjectiveData;
        const connectorsData =
          (await connectorsResponse.json()) as ConnectorData;

        if (!active) {
          return;
        }

        setVerbs(verbsData.verbs ?? []);
        setNouns(nounsData.nouns ?? []);
        setAdjectives(adjectivesData.adjectives ?? []);
        setConnectors(connectorsData.connectors ?? []);
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
      verbs: pickRandomItems(verbs, 2),
      adjectives: pickRandomItems(adjectives, 2),
      nouns: pickRandomItems(nouns, 2),
      connectors: pickRandomItems(connectors, 4)
    };
  }, [verbs, nouns, adjectives, connectors, round]);

  const hasEnoughVocabulary =
    trainingItems.verbs.length === 2 &&
    trainingItems.adjectives.length === 2 &&
    trainingItems.nouns.length === 2 &&
    trainingItems.connectors.length === 4;

  function generateNewRound() {
    setRound((current) => current + 1);
  }

  return (
    <section className="advanced-training">
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
        <p className="eyebrow">Treino avançado</p>
        <h1>{intention.intention}</h1>
        <p className="detail-english">{intention.english}</p>

        {intention.pattern && (
          <p className="training-pattern">{intention.pattern}</p>
        )}

        <p className="training-instruction">
          Crie duas frases independentes usando os elementos sorteados.
          Depois escolha um ou mais conectores para juntar as ideias
          em uma frase mais complexa.
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

      {!loading && !error && !hasEnoughVocabulary && (
        <div className="status-card error-card">
          <h2>Vocabulário insuficiente.</h2>
          <p>
            O treino avançado precisa de pelo menos 2 verbos,
            2 adjetivos, 2 substantivos e 4 conectores.
          </p>
        </div>
      )}

      {!loading && !error && hasEnoughVocabulary && (
        <>
          <div className="advanced-training-grid">
            <article className="training-group-card">
              <p className="eyebrow">Verbos</p>

              <div className="training-token-list">
                {trainingItems.verbs.map((verb) => (
                  <div className="training-token" key={verb.id}>
                    <strong>{verb.base}</strong>
                    <span>{verb.meanings?.join(" / ")}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="training-group-card">
              <p className="eyebrow">Adjetivos</p>

              <div className="training-token-list">
                {trainingItems.adjectives.map((adjective) => (
                  <div className="training-token" key={adjective.id}>
                    <strong>{adjective.adjective}</strong>
                    <span>{adjective.meanings?.join(" / ")}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="training-group-card">
              <p className="eyebrow">Nouns</p>

              <div className="training-token-list">
                {trainingItems.nouns.map((noun) => (
                  <div className="training-token" key={noun.id}>
                    <strong>{noun.noun}</strong>
                    <span>{noun.meanings?.join(" / ")}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="training-group-card connectors-card">
              <p className="eyebrow">Conectores disponíveis</p>

              <div className="training-token-list">
                {trainingItems.connectors.map((connector) => (
                  <div className="training-token" key={connector.id}>
                    <strong>{connector.connector}</strong>

                    {connectorMeaning(connector) && (
                      <span>{connectorMeaning(connector)}</span>
                    )}

                    {connector.type && (
                      <small>{connector.type}</small>
                    )}
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="advanced-writing-grid">
            <div className="training-writing-area">
              <label htmlFor="advanced-sentence-one">
                Frase 1
              </label>

              <textarea
                id="advanced-sentence-one"
                rows={4}
                placeholder="Crie a primeira frase em inglês..."
              />
            </div>

            <div className="training-writing-area">
              <label htmlFor="advanced-sentence-two">
                Frase 2
              </label>

              <textarea
                id="advanced-sentence-two"
                rows={4}
                placeholder="Crie a segunda frase em inglês..."
              />
            </div>
          </div>

          <div className="training-writing-area combined-sentence-area">
            <label htmlFor="advanced-combined-sentence">
              Junte as duas ideias
            </label>

            <textarea
              id="advanced-combined-sentence"
              rows={5}
              placeholder="Use um ou mais conectores para juntar suas duas frases..."
            />
          </div>
        </>
      )}
    </section>
  );
}
