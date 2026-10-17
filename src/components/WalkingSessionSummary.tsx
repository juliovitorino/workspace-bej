import { useTranslation } from "react-i18next";
import type { WalkingSummary } from "../utils/walkingSession";

export function WalkingSessionSummary({ summary, ended = false }: { summary: WalkingSummary; ended?: boolean }) {
  const { t, i18n } = useTranslation();
  const percent = summary.total ? Math.min(100, summary.completed / summary.total * 100) : 0;
  const progress = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(percent);
  const time = [Math.floor(summary.seconds / 3600), Math.floor(summary.seconds / 60) % 60, summary.seconds % 60]
    .map(value => String(value).padStart(2, "0")).join(":");
  return <section className="walking-session-summary" role="status" aria-live="polite">
    <h3>{t("walking.sessionSummary")}</h3>
    <p>{t(ended ? "walking.sessionEnded" : "common.paused")}</p>
    <dl>
      <div><dt>{t("walking.completedChunks")}</dt><dd>{summary.completed} / {summary.total}</dd></div>
      <div><dt>{t("walking.sessionProgress")}</dt><dd>{progress}%</dd></div>
      <div><dt>{t("walking.playedPhrases")}</dt><dd>{summary.phrases}</dd></div>
      <div><dt>{t("common.studyTime")}</dt><dd>{time}</dd></div>
    </dl>
  </section>;
}
