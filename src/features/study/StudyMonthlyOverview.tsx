import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { StudentLanguage } from "../../config/languages";
import type { StudyData } from "./studyStorage";
import { studyEntries } from "./studyStats";

const compactTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (!hours && !minutes) return seconds > 0 ? "<1min" : "";
  if (!hours) return `${minutes}min`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};

/** Read-only yearly projection: never writes to the study store. */
export function StudyMonthlyOverview({ data, now, language }: { data: StudyData; now: Date; language: StudentLanguage | "all" }) {
  const { t, i18n } = useTranslation();
  const currentYear = now.getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const entries = useMemo(() => studyEntries(data).filter(entry => language === "all" || entry.language === language), [data, language]);
  const years = useMemo(() => {
    const available = new Set(entries.map(entry => Number(entry.date.slice(0, 4))));
    available.add(currentYear);
    available.add(selectedYear);
    return [...available].sort((a, b) => b - a);
  }, [entries, currentYear, selectedYear]);
  const months = useMemo(() => {
    const sums = Array.from({ length: 12 }, () => 0);
    for (const entry of entries) {
      if (Number(entry.date.slice(0, 4)) === selectedYear) sums[Number(entry.date.slice(5, 7)) - 1] += entry.seconds;
    }
    return sums.map((seconds, month) => ({ month, seconds })).filter(item => item.seconds > 0);
  }, [entries, selectedYear]);
  const max = Math.max(1, ...months.map(item => item.seconds));
  const total = months.reduce((sum, item) => sum + item.seconds, 0);
  const monthName = (month: number) => new Date(Date.UTC(selectedYear, month, 1)).toLocaleDateString(i18n.language, { month: "short", timeZone: "UTC" }).replace(".", "");
  return <section className="study-panel bej-monthly-overview" aria-labelledby="bej-monthly-title">
    <div className="bej-monthly-heading">
      <div><h3 id="bej-monthly-title">{t("bejOverview.monthlyStudyTime")}</h3><p>{t("bejOverview.monthlyDescription")}</p></div>
      <label className="bej-monthly-year">{t("bejOverview.year")}
        <select value={selectedYear} onChange={event => setSelectedYear(Number(event.target.value))}>
          {years.map(year => <option key={year} value={year}>{year}</option>)}
        </select>
      </label>
    </div>
    <div className="bej-monthly-total"><span>{t("bejOverview.yearTotal")}</span><strong>{compactTime(total) || "0min"}</strong></div>
    {months.length ? <div className="bej-month-bars" role="list" aria-label={t("bejOverview.monthlyStudyTime")}>
      {months.map(({ month, seconds }) => <div className="bej-month-column" key={month} role="listitem" aria-label={`${monthName(month)}: ${compactTime(seconds)}`}>
        <div className="bej-month-value">{compactTime(seconds)}</div>
        <div className="bej-month-bar-space"><div className="bej-month-bar-fill" style={{ height: `${Math.max(3, seconds / max * 100)}%` }} /></div>
        <span className="bej-month-name">{monthName(month)}</span>
      </div>)}
    </div> : <p className="bej-monthly-empty">{t("bejOverview.noMonthlyStudy")}</p>}
  </section>;
}
