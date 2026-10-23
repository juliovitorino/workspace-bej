import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { StudyData } from "./studyStorage";
import { studyEntries, previousDay } from "./studyStats";
import { localDay } from "./studyTrackingService";

/** Read-only averages per calendar day, including days with no study. */
export function StudyAverageOverview({ data, now }: { data: StudyData; now: Date }) {
  const { t } = useTranslation();
  const values = useMemo(() => {
    const today = localDay(now);
    const weekday = (now.getDay() + 6) % 7; // Monday is the first day of the week.
    const monday = previousDay(today, -weekday);
    const month = `${today.slice(0, 7)}-01`;
    const entries = studyEntries(data).filter(entry => entry.date <= today && entry.seconds > 0);
    const first = entries.reduce((earliest, entry) => entry.date < earliest ? entry.date : earliest, today);
    const dayCount = (from: string) => Math.max(1, Math.round((Date.parse(today) - Date.parse(from)) / 86400000) + 1);
    const average = (from: string) =>
      Math.round(entries.reduce((total, entry) => total + (entry.date >= from ? entry.seconds : 0), 0) / dayCount(from));
    return [
      ["thisWeek", average(monday)],
      ["last7Days", average(previousDay(today, -6))],
      ["thisMonth", average(month)],
      ["last90Days", average(previousDay(today, -89))],
      ["allTime", average(first)],
    ] as const;
  }, [data, now]);

  const duration = (seconds: number) => {
    const minutes = Math.round(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    if (!hours && !remaining) return t("study.zeroDuration");
    return [
      hours ? t("study.durationHours", { count: hours }) : "",
      remaining ? t("study.durationMinutes", { count: remaining }) : "",
    ].filter(Boolean).join(" ");
  };

  return <section className="study-panel bej-study-average" aria-labelledby="bej-study-average-title">
    <h3 id="bej-study-average-title">{t("studyAverages.title")}</h3>
    <div className="bej-study-average-rows">
      {values.map(([key, seconds]) => <div className="bej-study-average-row" key={key}>
        <span>{t(`studyAverages.${key}`)}</span>
        <strong>{duration(seconds)}</strong>
      </div>)}
    </div>
    <p className="study-note">{t("studyAverages.note")}</p>
  </section>;
}
