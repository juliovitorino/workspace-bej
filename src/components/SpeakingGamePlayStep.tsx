import { useEffect, useState, type CSSProperties } from "react";
import type { SpeakingGameForm } from "../config/speakingGameForms";
import type { EnglishVerb } from "../types/englishVerb";
import type {
  SpeakingGameSettings,
  SpeakingGameStatus
} from "../types/speakingGameTypes";

type SentenceMode = "afirmativa" | "negativa" | "interrogativa";

interface VocabularyItem {
  id: string;
  meanings?: string[];
}

interface AdjectiveItem extends VocabularyItem {
  adjective: string;
}

interface NounItem extends VocabularyItem {
  noun: string;
}

function drawDifferentItem<T extends VocabularyItem>(
  items: T[],
  previous: T | null
): T | null {
  if (items.length === 0) return null;
  const alternatives = items.filter((item) => item.id !== previous?.id);
  const pool = alternatives.length > 0 ? alternatives : items;
  return pool[Math.floor(Math.random() * pool.length)];
}

const sentenceModes: SentenceMode[] = [
  "afirmativa",
  "negativa",
  "interrogativa"
];

function drawSentenceMode(): SentenceMode {
  return sentenceModes[Math.floor(Math.random() * sentenceModes.length)];
}

interface SpeakingGamePlayStepProps {
  verb: EnglishVerb;
  form: SpeakingGameForm;
  settings: SpeakingGameSettings;
  status: SpeakingGameStatus;
  remainingSeconds: number;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onNext: () => void;
  onNewVerb?: () => void;
}

export function SpeakingGamePlayStep({
  verb,
  form,
  settings,
  status,
  remainingSeconds,
  onPause,
  onResume,
  onStop,
  onNext,
  onNewVerb
}: SpeakingGamePlayStepProps) {
  const [showVerbForms, setShowVerbForms] = useState(true);
  const [adjectives, setAdjectives] = useState<AdjectiveItem[]>([]);
  const [nouns, setNouns] = useState<NounItem[]>([]);
  const [selectedAdjective, setSelectedAdjective] = useState<AdjectiveItem | null>(null);
  const [selectedNoun, setSelectedNoun] = useState<NounItem | null>(null);
  const [sentenceMode, setSentenceMode] = useState<SentenceMode>(
    drawSentenceMode
  );

  const isAutomatic = settings.timeMode === "automatic";
  const isPaused = status === "paused";

  useEffect(() => {
    let active = true;

    async function loadVocabulary() {
      try {
        const [adjectivesResponse, nounsResponse] = await Promise.all([
          fetch("/english-adjectives-common.json"),
          fetch("/english-nouns-common.json")
        ]);
        if (!adjectivesResponse.ok || !nounsResponse.ok) {
          throw new Error("Não foi possível carregar adjetivos e substantivos.");
        }
        const adjectivesData = (await adjectivesResponse.json()) as {
          adjectives?: AdjectiveItem[];
        };
        const nounsData = (await nounsResponse.json()) as {
          nouns?: NounItem[];
        };
        if (!active) return;
        setAdjectives(adjectivesData.adjectives ?? []);
        setNouns(nounsData.nouns ?? []);
      } catch (error) {
        console.error("Erro ao carregar vocabulário do Jogo da Fala:", error);
      }
    }

    void loadVocabulary();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setSelectedAdjective((previous) => drawDifferentItem(adjectives, previous));
    setSelectedNoun((previous) => drawDifferentItem(nouns, previous));
  }, [verb.id, adjectives, nouns]);

  useEffect(() => {
    setSentenceMode(drawSentenceMode());
  }, [verb.id, form]);

  function openGoogleTranslate() {
    window.open(
      "https://translate.google.com/?hl=pt-BR&sl=en&tl=pt&op=translate",
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <section style={styles.card} aria-labelledby="speaking-game-verb">
      <header style={styles.header}>

        <h1 id="speaking-game-verb" style={styles.verb}>
          <span style={styles.toParticle}>TO</span>{" "}
          {verb.base.toUpperCase()}
        </h1>

        <span style={styles.meanings}>
          {verb.meanings.join(" • ")}
        </span>
      </header>

      <div style={styles.vocabularyGrid} aria-label="Vocabulário sorteado">
        <div style={styles.vocabularyCard}>
          <span style={styles.vocabularyLabel}>Adjetivo</span>
          <strong style={styles.vocabularyWord}>
            {selectedAdjective?.adjective ?? "—"}
          </strong>
          {selectedAdjective?.meanings?.length ? (
            <span style={styles.vocabularyMeaning}>
              {selectedAdjective.meanings.join(" • ")}
            </span>
          ) : null}
        </div>

        <div style={styles.vocabularyCard}>
          <span style={styles.vocabularyLabel}>Substantivo (Noun)</span>
          <strong style={styles.vocabularyWord}>
            {selectedNoun?.noun ?? "—"}
          </strong>
          {selectedNoun?.meanings?.length ? (
            <span style={styles.vocabularyMeaning}>
              {selectedNoun.meanings.join(" • ")}
            </span>
          ) : null}
        </div>
      </div>

      <div style={styles.challenge}>
        <span style={styles.challengeLabel}>
          Fale em voz alta uma frase na forma:
        </span>

        <strong style={styles.sentenceMode}>
          {sentenceMode.toUpperCase()}
        </strong>

        <span style={styles.challengeLabel}>usando:</span>

        <strong style={styles.challengeForm}>{form}</strong>
      </div>


      {!isAutomatic && (
        <button
          type="button"
          onClick={onNext}
          style={styles.primaryButton}
        >
          Próximo →
        </button>
      )}

      {!isAutomatic && onNewVerb && (
        <button
          type="button"
          onClick={onNewVerb}
          style={styles.newVerbButton}
          title="Sortear outro verbo mantendo a mesma forma verbal"
          aria-label="Sortear outro verbo mantendo a mesma forma verbal"
        >
          <span aria-hidden="true" style={styles.newVerbIcon}>+</span>
          <span>Novo verbo</span>
        </button>
      )}

      <button
        type="button"
        onClick={() => setShowVerbForms((current) => !current)}
        style={styles.visibilityButton}
        aria-expanded={showVerbForms}
      >
        {showVerbForms ? "👁 Ocultar formas do verbo" : "👁 Mostrar formas do verbo"}
      </button>

      {showVerbForms && (
        <div style={styles.verbForms}>
          <div style={styles.formRow}>
            <span style={styles.formLabel}>Presente</span>
            <strong style={styles.formValue}>
              {verb.base} / {verb.thirdPerson}
            </strong>
          </div>

          <div style={styles.formRow}>
            <span style={styles.formLabel}>Passado</span>
            <strong style={styles.formValue}>{verb.past}</strong>
          </div>

          <div style={styles.formRow}>
            <span style={styles.formLabel}>Particípio</span>
            <strong style={styles.formValue}>{verb.pastParticiple}</strong>
          </div>

          <div style={styles.formRow}>
            <span style={styles.formLabel}>Gerúndio</span>
            <strong style={styles.formValue}>{verb.gerund}</strong>
          </div>
        </div>
      )}

      {(!isAutomatic || isPaused) && (
        <button
          type="button"
          onClick={openGoogleTranslate}
          style={styles.googleTranslateButton}
          title="Abrir Google Tradutor: inglês para português"
          aria-label="Abrir Google Tradutor: inglês para português"
        >
          <span aria-hidden="true">🇺🇸 🇧🇷</span>
          <span>Abrir Google Tradutor</span>
        </button>
      )}

      {isAutomatic && (
        <div style={styles.timerArea} aria-live="polite">
          <span style={styles.timerLabel}>
            {isPaused ? "Pausado" : "Próxima rodada em"}
          </span>

          <strong style={styles.timer}>
            {remainingSeconds}s
          </strong>
        </div>
      )}

      <footer style={styles.controls}>
        <button
          type="button"
          onClick={isPaused ? onResume : onPause}
          style={styles.secondaryButton}
        >
          {isPaused ? "▶ Continuar" : "⏸ Pausar"}
        </button>

        <button
          type="button"
          onClick={onStop}
          style={styles.stopButton}
        >
          ■ Parar
        </button>

      </footer>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    width: "min(100%, 34rem)",
    margin: "0 auto",
    boxSizing: "border-box",
    padding: "clamp(1rem, 4vw, 1.75rem)",
    border: "1px solid #d8dde6",
    borderRadius: "18px",
    background: "#ffffff",
    boxShadow: "0 8px 28px rgba(15, 23, 42, 0.08)"
  },
  header: {
    display: "grid",
    justifyItems: "center",
    marginBottom: "1.25rem",
    textAlign: "center"
  },
  gameLabel: {
    marginBottom: "0.55rem",
    fontSize: "0.8rem",
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#64748b"
  },
  verb: {
    margin: 0,
    fontSize: "clamp(2.4rem, 12vw, 4rem)",
    lineHeight: 1,
    letterSpacing: "0.02em",
    color: "#0f172a",
    overflowWrap: "anywhere"
  },
  toParticle: {
    fontSize: "0.52em",
    fontWeight: 700,
    letterSpacing: "0",
    textTransform: "none",
    color: "#64748b",
    verticalAlign: "0.18em"
  },
  meanings: {
    marginTop: "0.55rem",
    fontSize: "0.92rem",
    fontWeight: 500,
    lineHeight: 1.35,
    color: "#64748b",
    textTransform: "lowercase"
  },
  verbType: {
    marginTop: "0.55rem",
    padding: "0.3rem 0.65rem",
    borderRadius: "999px",
    background: "#f1f5f9",
    fontSize: "0.85rem",
    fontWeight: 700,
    color: "#475569"
  },
  newVerbButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.45rem",
    width: "100%",
    minHeight: "2.8rem",
    marginBottom: "0.65rem",
    padding: "0.65rem 0.8rem",
    border: "1px solid #93c5fd",
    borderRadius: "10px",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: "0.92rem",
    fontWeight: 800,
    cursor: "pointer"
  },
  newVerbIcon: {
    fontSize: "1.25rem",
    lineHeight: 1
  },
  visibilityButton: {
    width: "100%",
    minHeight: "2.8rem",
    marginBottom: "1rem",
    padding: "0.65rem 0.8rem",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    background: "#ffffff",
    color: "#334155",
    fontSize: "0.92rem",
    fontWeight: 700,
    cursor: "pointer"
  },
  verbForms: {
    display: "grid",
    gap: "0.6rem",
    marginBottom: "1.5rem",
    padding: "1rem",
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    background: "#f8fafc"
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "minmax(5.5rem, 0.8fr) minmax(0, 1.2fr)",
    alignItems: "baseline",
    gap: "0.75rem"
  },
  formLabel: {
    fontSize: "0.9rem",
    color: "#64748b"
  },
  formValue: {
    minWidth: 0,
    fontSize: "0.98rem",
    color: "#0f172a",
    overflowWrap: "anywhere"
  },
  vocabularyGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 12rem), 1fr))",
    gap: "0.7rem",
    marginBottom: "1rem"
  },
  vocabularyCard: {
    display: "grid",
    justifyItems: "center",
    alignContent: "start",
    gap: "0.35rem",
    padding: "0.85rem",
    border: "1px solid #dbeafe",
    borderRadius: "12px",
    background: "#f8fafc",
    textAlign: "center"
  },
  vocabularyLabel: {
    fontSize: "0.78rem",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "#64748b"
  },
  vocabularyWord: {
    fontSize: "1.35rem",
    color: "#1d4ed8",
    overflowWrap: "anywhere"
  },
  vocabularyMeaning: {
    fontSize: "0.88rem",
    color: "#475569",
    overflowWrap: "anywhere"
  },
  challenge: {
    display: "grid",
    justifyItems: "center",
    gap: "0.75rem",
    margin: "1.5rem 0",
    padding: "1.4rem 1rem",
    border: "2px solid #bfdbfe",
    borderRadius: "16px",
    background: "#eff6ff",
    textAlign: "center"
  },
  challengeLabel: {
    fontSize: "0.95rem",
    fontWeight: 700,
    color: "#475569"
  },
  sentenceMode: {
    padding: "0.4rem 0.8rem",
    borderRadius: "999px",
    background: "#dbeafe",
    fontSize: "clamp(1rem, 4.5vw, 1.2rem)",
    lineHeight: 1.2,
    letterSpacing: "0.04em",
    color: "#1d4ed8"
  },
  challengeForm: {
    fontSize: "clamp(1.35rem, 6vw, 1.9rem)",
    lineHeight: 1.25,
    color: "#1d4ed8",
    overflowWrap: "anywhere"
  },
  googleTranslateButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.55rem",
    width: "100%",
    minHeight: "3.1rem",
    margin: "0 0 1.5rem",
    padding: "0.8rem 1rem",
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    background: "#ffffff",
    color: "#334155",
    fontSize: "0.98rem",
    fontWeight: 800,
    cursor: "pointer"
  },
  timerArea: {
    display: "grid",
    justifyItems: "center",
    gap: "0.2rem",
    margin: "1.25rem 0"
  },
  timerLabel: {
    fontSize: "0.9rem",
    color: "#64748b"
  },
  timer: {
    fontSize: "2rem",
    lineHeight: 1.1,
    color: "#0f172a"
  },
  controls: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.65rem",
    paddingTop: "1rem",
    borderTop: "1px solid #e2e8f0"
  },
  primaryButton: {
    width: "100%",
    minHeight: "3.1rem",
    margin: "0 0 0.65rem",
    padding: "0.8rem 1rem",
    border: 0,
    borderRadius: "12px",
    background: "#2563eb",
    color: "#ffffff",
    fontSize: "0.98rem",
    fontWeight: 800,
    cursor: "pointer"
  },
  secondaryButton: {
    flex: "1 1 8rem",
    minHeight: "3.1rem",
    padding: "0.8rem 1rem",
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    background: "#ffffff",
    color: "#334155",
    fontSize: "0.98rem",
    fontWeight: 700,
    cursor: "pointer"
  },
  stopButton: {
    flex: "1 1 7rem",
    minHeight: "3.1rem",
    padding: "0.8rem 1rem",
    border: "1px solid #fecaca",
    borderRadius: "12px",
    background: "#fff7f7",
    color: "#b91c1c",
    fontSize: "0.98rem",
    fontWeight: 800,
    cursor: "pointer"
  }
};
