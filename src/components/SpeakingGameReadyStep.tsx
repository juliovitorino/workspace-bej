import type { CSSProperties } from "react";
import { SPEAKING_GAME_FORMS } from "../config/speakingGameForms";
import type { SpeakingGameSettings } from "../types/speakingGameTypes";

interface SpeakingGameReadyStepProps {
  settings: SpeakingGameSettings;
  lastStudySeconds?: number | null;
  onPrevious: () => void;
  onStart: () => void;
}

export function SpeakingGameReadyStep({
  settings,
  lastStudySeconds = null,
  onPrevious,
  onStart
}: SpeakingGameReadyStepProps) {
  const timeDescription =
    settings.timeMode === "automatic"
      ? `Automático — ${settings.seconds}s`
      : "Manual";

  const orderDescription =
    settings.order === "sequential" ? "Sequencial" : "Aleatório";

  const studyTimeDescription =
    lastStudySeconds === null ? null : formatStudyTime(lastStudySeconds);

  return (
    <section style={styles.card} aria-labelledby="speaking-game-ready-title">
      <header style={styles.header}>
        <span style={styles.step}>Etapa 2 de 2</span>

        <h1 id="speaking-game-ready-title" style={styles.title}>
          Jogo da Fala
        </h1>

        <p style={styles.subtitle}>Tudo pronto para começar.</p>
      </header>

      {studyTimeDescription && (
        <div style={styles.studyResult} role="status">
          <span style={styles.studyResultLabel}>Tempo de estudo</span>
          <strong style={styles.studyResultValue}>{studyTimeDescription}</strong>
        </div>
      )}

      <div style={styles.summary} aria-label="Resumo da configuração">
        <div style={styles.summaryRow}>
          <span style={styles.summaryLabel}>Tempo</span>
          <strong style={styles.summaryValue}>{timeDescription}</strong>
        </div>

        <div style={styles.summaryRow}>
          <span style={styles.summaryLabel}>Treino</span>
          <strong style={styles.summaryValue}>{orderDescription}</strong>
        </div>

        <div style={styles.summaryRow}>
          <span style={styles.summaryLabel}>Formas</span>
          <strong style={styles.summaryValue}>
            {SPEAKING_GAME_FORMS.length}
          </strong>
        </div>
      </div>

      <div style={styles.startArea}>
        <p style={styles.instruction}>
          Quando estiver pronto, toque no botão e fale cada frase em voz alta.
        </p>

        <button
          type="button"
          onClick={onStart}
          style={styles.startButton}
        >
          Começar o jogo
        </button>
      </div>

      <footer style={styles.footer}>
        <button
          type="button"
          onClick={onPrevious}
          style={styles.secondaryButton}
        >
          ← Anterior
        </button>
      </footer>
    </section>
  );
}

function formatStudyTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}min ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}min ${seconds}s`;
  }

  return `${seconds}s`;
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
    marginBottom: "2rem",
    textAlign: "center"
  },
  step: {
    display: "inline-block",
    marginBottom: "0.45rem",
    fontSize: "0.8rem",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "#64748b"
  },
  title: {
    margin: 0,
    fontSize: "clamp(1.65rem, 7vw, 2.15rem)",
    lineHeight: 1.15,
    color: "#0f172a"
  },
  subtitle: {
    margin: "0.6rem 0 0",
    fontSize: "0.98rem",
    color: "#64748b"
  },
  studyResult: {
    display: "grid",
    justifyItems: "center",
    gap: "0.25rem",
    marginBottom: "1.25rem",
    padding: "1rem",
    border: "1px solid #bfdbfe",
    borderRadius: "14px",
    background: "#eff6ff"
  },
  studyResultLabel: {
    fontSize: "0.85rem",
    fontWeight: 700,
    color: "#64748b"
  },
  studyResultValue: {
    fontSize: "1.45rem",
    lineHeight: 1.2,
    color: "#1d4ed8"
  },
  summary: {
    display: "grid",
    gap: "0.75rem",
    marginBottom: "2rem",
    padding: "1rem",
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    background: "#f8fafc"
  },
  summaryRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem"
  },
  summaryLabel: {
    fontSize: "0.95rem",
    color: "#64748b"
  },
  summaryValue: {
    textAlign: "right",
    fontSize: "0.98rem",
    color: "#0f172a"
  },
  startArea: {
    display: "grid",
    gap: "1rem",
    margin: "2rem 0"
  },
  instruction: {
    margin: 0,
    textAlign: "center",
    fontSize: "1rem",
    lineHeight: 1.55,
    color: "#475569"
  },
  startButton: {
    width: "100%",
    minHeight: "3.6rem",
    padding: "0.9rem 1rem",
    border: 0,
    borderRadius: "14px",
    background: "#2563eb",
    color: "#ffffff",
    fontSize: "1.08rem",
    fontWeight: 800,
    cursor: "pointer"
  },
  footer: {
    paddingTop: "1rem",
    borderTop: "1px solid #e2e8f0"
  },
  secondaryButton: {
    minHeight: "3.1rem",
    padding: "0.8rem 1rem",
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    background: "#ffffff",
    color: "#334155",
    fontSize: "1rem",
    fontWeight: 700,
    cursor: "pointer"
  }
};
