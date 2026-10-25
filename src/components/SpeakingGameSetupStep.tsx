import { t } from "../i18n";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
        <span style={styles.step}>{t("speaking.step1Of3")}</span>
        <h1 id="speaking-game-title" style={styles.title}>
          
          {t("common.speakingGame")}
        </h1>
        <p style={styles.subtitle}>
          
          {t("speaking.setUpYourPracticeBeforeStarting")}
        </p>
      </header>

      <div style={styles.group}>
        <h2 style={styles.groupTitle}>{t("speaking.time")}</h2>

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
            
            {t("common.manual")}
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
            
            {t("common.automatic")}
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
            aria-label={t("speaking.decreaseByOneSecond")}
            style={styles.roundButton}
          >
            −
          </button>

          <div style={styles.seconds} aria-live="polite">
            <strong style={styles.secondsNumber}>{settings.seconds}</strong>
            <span style={styles.secondsLabel}>{t("speaking.sec")}</span>
          </div>

          <button
            type="button"
            onClick={increaseSeconds}
            disabled={settings.timeMode !== "automatic"}
            aria-label={t("speaking.increaseByOneSecond")}
            style={styles.roundButton}
          >
            +
          </button>
        </div>
      </div>

      <div style={styles.group}>
        <h2 style={styles.groupTitle}>{t("speaking.practice")}</h2>

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
            
            {t("speaking.sequential")}
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
            
            {t("speaking.random")}
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
            
            {"← "}{t("common.previous")}
          </button>
        ) : (
          <span />
        )}

        <button type="button" onClick={onNext} style={styles.primaryButton}>
          
          {t("speaking.next")}{" →"}
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
    border: "1px solid var(--border-strong)",
    borderRadius: "18px",
    background: "var(--surface)",
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
    color: "var(--muted)"
  },
  title: {
    margin: 0,
    fontSize: "clamp(1.65rem, 7vw, 2.15rem)",
    lineHeight: 1.15,
    color: "var(--text)"
  },
  subtitle: {
    margin: "0.6rem 0 0",
    fontSize: "0.98rem",
    color: "var(--muted)"
  },
  group: {
    marginBottom: "2rem"
  },
  groupTitle: {
    margin: "0 0 0.75rem",
    fontSize: "1rem",
    color: "var(--text-secondary)"
  },
  segmentedControl: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "0.55rem"
  },
  segmentButton: {
    minHeight: "3rem",
    padding: "0.75rem",
    border: "1px solid var(--border-strong)",
    borderRadius: "12px",
    background: "var(--surface-soft)",
    color: "var(--text-secondary)",
    fontSize: "1rem",
    fontWeight: 700,
    cursor: "pointer"
  },
  segmentButtonSelected: {
    borderColor: "var(--accent)",
    background: "var(--accent-soft)",
    color: "var(--accent-hover)",
    boxShadow: "inset 0 0 0 1px var(--accent)"
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
    border: "1px solid var(--border-strong)",
    borderRadius: "999px",
    background: "var(--surface-soft)",
    color: "var(--text)",
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
    color: "var(--text)"
  },
  secondsLabel: {
    fontSize: "1rem",
    color: "var(--muted)"
  },
  footer: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    alignItems: "center",
    gap: "0.75rem",
    paddingTop: "1rem",
    borderTop: "1px solid var(--border)"
  },
  primaryButton: {
    minHeight: "3.1rem",
    padding: "0.8rem 1rem",
    border: 0,
    borderRadius: "12px",
    background: "var(--accent)",
    color: "var(--on-accent)",
    fontSize: "1rem",
    fontWeight: 800,
    cursor: "pointer"
  },
  secondaryButton: {
    minHeight: "3.1rem",
    padding: "0.8rem 1rem",
    border: "1px solid var(--border-strong)",
    borderRadius: "12px",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontSize: "1rem",
    fontWeight: 700,
    cursor: "pointer"
  }
};
