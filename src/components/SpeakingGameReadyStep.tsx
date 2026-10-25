import { t } from "../i18n";
import { useTranslation } from "react-i18next";
import type { CSSProperties } from "react";
import { getSpeakingGameForms } from "../config/speakingGameForms";
import type { StudentLanguage } from "../config/languages";
import type { SpeakingGameSettings } from "../types/speakingGameTypes";

interface SpeakingGameReadyStepProps {
  language: StudentLanguage;
  loading?: boolean;
  settings: SpeakingGameSettings;
  lastStudySeconds?: number | null;
  onPrevious: () => void;
  onStart: () => void;
}

export function SpeakingGameReadyStep({
  language,
  loading = false,
  settings,
  lastStudySeconds = null,
  onPrevious,
  onStart
}: SpeakingGameReadyStepProps) {
  const { t } = useTranslation();
  const timeDescription =
    settings.timeMode === "automatic"
      ? t("speaking.automaticSecondsS", { seconds: (settings.seconds) })
      : t("common.manual");

  const orderDescription =
    settings.order === "sequential" ? t("speaking.sequential") : t("speaking.random");

  const studyTimeDescription =
    lastStudySeconds === null ? null : formatStudyTime(lastStudySeconds);

  return (
    <section style={styles.card} aria-labelledby="speaking-game-ready-title">
      <header style={styles.header}>
        <span style={styles.step}>{t("speaking.step3Of3")}</span>

        <h1 id="speaking-game-ready-title" style={styles.title}>
          
          {t("common.speakingGame")}
        </h1>

        <p style={styles.subtitle}>{t("speaking.everythingIsReadyToStart")}</p>
      </header>

      {studyTimeDescription && (
        <div style={styles.studyResult} role="status">
          <span style={styles.studyResultLabel}>{t("common.studyTime")}</span>
          <strong style={styles.studyResultValue}>{studyTimeDescription}</strong>
        </div>
      )}

      <div style={styles.summary} aria-label={t("speaking.settingsSummary")}>
        <div style={styles.summaryRow}>
          <span style={styles.summaryLabel}>{t("speaking.time")}</span>
          <strong style={styles.summaryValue}>{timeDescription}</strong>
        </div>

        <div style={styles.summaryRow}>
          <span style={styles.summaryLabel}>{t("speaking.practice")}</span>
          <strong style={styles.summaryValue}>{orderDescription}</strong>
        </div>

        <div style={styles.summaryRow}>
          <span style={styles.summaryLabel}>{t("speaking.extraVocabulary")}</span>
          <strong style={styles.summaryValue}>
            {[
              settings.includeAdjective && t("common.adjective"),
              settings.includeNoun && t("common.noun"),
              settings.includeRandomChunk && t("speaking.randomChunkIntention")
            ].filter(Boolean).join(" • ") || t("speaking.noneSelected")}
          </strong>
        </div>
        <div style={styles.summaryRow}>
          <span style={styles.summaryLabel}>{t("speaking.forms")}</span>
          <strong style={styles.summaryValue}>
            {getSpeakingGameForms(language).length}
          </strong>
        </div>
      </div>

      <div style={styles.startArea}>
        <p style={styles.instruction}>
          
          {t("speaking.whenReadyTapTheButtonAndSayEachSentenceAloud")}
        </p>

        <button
          type="button"
          onClick={onStart}
          disabled={loading}
          style={styles.startButton}
        >
          
          {t("speaking.startGame")}
        </button>
      </div>

      <footer style={styles.footer}>
        <button
          type="button"
          onClick={onPrevious}
          style={styles.secondaryButton}
        >
          
          {"← "}{t("common.previous")}
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
  studyResult: {
    display: "grid",
    justifyItems: "center",
    gap: "0.25rem",
    marginBottom: "1.25rem",
    padding: "1rem",
    border: "1px solid var(--accent-border)",
    borderRadius: "14px",
    background: "var(--accent-soft)"
  },
  studyResultLabel: {
    fontSize: "0.85rem",
    fontWeight: 700,
    color: "var(--muted)"
  },
  studyResultValue: {
    fontSize: "1.45rem",
    lineHeight: 1.2,
    color: "var(--accent-hover)"
  },
  summary: {
    display: "grid",
    gap: "0.75rem",
    marginBottom: "2rem",
    padding: "1rem",
    border: "1px solid var(--border)",
    borderRadius: "14px",
    background: "var(--surface-soft)"
  },
  summaryRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem"
  },
  summaryLabel: {
    fontSize: "0.95rem",
    color: "var(--muted)"
  },
  summaryValue: {
    textAlign: "right",
    fontSize: "0.98rem",
    color: "var(--text)"
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
    color: "var(--text-secondary)"
  },
  startButton: {
    width: "100%",
    minHeight: "3.6rem",
    padding: "0.9rem 1rem",
    border: 0,
    borderRadius: "14px",
    background: "var(--accent)",
    color: "var(--on-accent)",
    fontSize: "1.08rem",
    fontWeight: 800,
    cursor: "pointer"
  },
  footer: {
    paddingTop: "1rem",
    borderTop: "1px solid var(--border)"
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
