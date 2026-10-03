import type { CSSProperties } from "react";
import type { SpeakingGameSettings } from "../types/speakingGameTypes";
import { clampSpeakingGameSeconds } from "../utils/speakingGameEngine";

interface SpeakingGameSetupStepProps {
  settings: SpeakingGameSettings;
  onSettingsChange: (settings: SpeakingGameSettings) => void;
  onNext: () => void;
  onPrevious?: () => void;
}

export function SpeakingGameSetupStep({
  settings,
  onSettingsChange,
  onNext,
  onPrevious
}: SpeakingGameSetupStepProps) {
  function updateSettings(patch: Partial<SpeakingGameSettings>) {
    onSettingsChange({
      ...settings,
      ...patch
    });
  }

  function decreaseSeconds() {
    updateSettings({
      seconds: clampSpeakingGameSeconds(settings.seconds - 1)
    });
  }

  function increaseSeconds() {
    updateSettings({
      seconds: clampSpeakingGameSeconds(settings.seconds + 1)
    });
  }

  return (
    <section style={styles.card} aria-labelledby="speaking-game-title">
      <header style={styles.header}>
        <span style={styles.step}>Etapa 1 de 2</span>
        <h1 id="speaking-game-title" style={styles.title}>
          Jogo da Fala
        </h1>
        <p style={styles.subtitle}>
          Configure o treino antes de começar.
        </p>
      </header>

      <div style={styles.group}>
        <h2 style={styles.groupTitle}>Tempo</h2>

        <div style={styles.segmentedControl}>
          <button
            type="button"
            aria-pressed={settings.timeMode === "manual"}
            onClick={() => updateSettings({ timeMode: "manual" })}
            style={{
              ...styles.segmentButton,
              ...(settings.timeMode === "manual"
                ? styles.segmentButtonSelected
                : {})
            }}
          >
            Manual
          </button>

          <button
            type="button"
            aria-pressed={settings.timeMode === "automatic"}
            onClick={() => updateSettings({ timeMode: "automatic" })}
            style={{
              ...styles.segmentButton,
              ...(settings.timeMode === "automatic"
                ? styles.segmentButtonSelected
                : {})
            }}
          >
            Automático
          </button>
        </div>

        <div
          style={{
            ...styles.timeControl,
            opacity: settings.timeMode === "automatic" ? 1 : 0.5
          }}
        >
          <button
            type="button"
            onClick={decreaseSeconds}
            disabled={settings.timeMode !== "automatic"}
            aria-label="Diminuir um segundo"
            style={styles.roundButton}
          >
            −
          </button>

          <div style={styles.seconds} aria-live="polite">
            <strong style={styles.secondsNumber}>{settings.seconds}</strong>
            <span style={styles.secondsLabel}>seg</span>
          </div>

          <button
            type="button"
            onClick={increaseSeconds}
            disabled={settings.timeMode !== "automatic"}
            aria-label="Aumentar um segundo"
            style={styles.roundButton}
          >
            +
          </button>
        </div>
      </div>

      <div style={styles.group}>
        <h2 style={styles.groupTitle}>Treino</h2>

        <div style={styles.segmentedControl}>
          <button
            type="button"
            aria-pressed={settings.order === "sequential"}
            onClick={() => updateSettings({ order: "sequential" })}
            style={{
              ...styles.segmentButton,
              ...(settings.order === "sequential"
                ? styles.segmentButtonSelected
                : {})
            }}
          >
            Sequencial
          </button>

          <button
            type="button"
            aria-pressed={settings.order === "random"}
            onClick={() => updateSettings({ order: "random" })}
            style={{
              ...styles.segmentButton,
              ...(settings.order === "random"
                ? styles.segmentButtonSelected
                : {})
            }}
          >
            Aleatório
          </button>
        </div>
      </div>

      <footer style={styles.footer}>
        {onPrevious ? (
          <button
            type="button"
            onClick={onPrevious}
            style={styles.secondaryButton}
          >
            ← Anterior
          </button>
        ) : (
          <span />
        )}

        <button type="button" onClick={onNext} style={styles.primaryButton}>
          Próxima →
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
  group: {
    marginBottom: "2rem"
  },
  groupTitle: {
    margin: "0 0 0.75rem",
    fontSize: "1rem",
    color: "#334155"
  },
  segmentedControl: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "0.55rem"
  },
  segmentButton: {
    minHeight: "3rem",
    padding: "0.75rem",
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    background: "#f8fafc",
    color: "#334155",
    fontSize: "1rem",
    fontWeight: 700,
    cursor: "pointer"
  },
  segmentButtonSelected: {
    borderColor: "#2563eb",
    background: "#eff6ff",
    color: "#1d4ed8",
    boxShadow: "inset 0 0 0 1px #2563eb"
  },
  timeControl: {
    display: "grid",
    gridTemplateColumns: "3.25rem 1fr 3.25rem",
    alignItems: "center",
    gap: "0.85rem",
    marginTop: "1rem",
    transition: "opacity 160ms ease"
  },
  roundButton: {
    width: "3.25rem",
    height: "3.25rem",
    border: "1px solid #cbd5e1",
    borderRadius: "999px",
    background: "#f8fafc",
    color: "#0f172a",
    fontSize: "1.65rem",
    fontWeight: 700,
    cursor: "pointer"
  },
  seconds: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "center",
    gap: "0.35rem",
    minHeight: "3.25rem"
  },
  secondsNumber: {
    fontSize: "2rem",
    color: "#0f172a"
  },
  secondsLabel: {
    fontSize: "1rem",
    color: "#64748b"
  },
  footer: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    alignItems: "center",
    gap: "0.75rem",
    paddingTop: "1rem",
    borderTop: "1px solid #e2e8f0"
  },
  primaryButton: {
    minHeight: "3.1rem",
    padding: "0.8rem 1rem",
    border: 0,
    borderRadius: "12px",
    background: "#2563eb",
    color: "#ffffff",
    fontSize: "1rem",
    fontWeight: 800,
    cursor: "pointer"
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
