import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { LANGUAGES, type StudentLanguage } from "../../config/languages";
import { languageName } from "../../i18n";
import type { StudyData } from "./studyStorage";
import { studyEntries } from "./studyStats";
import { localDay } from "./studyTrackingService";

const hoursAndMinutes = (seconds: number) => `${Math.floor(seconds / 3600)}h ${String(Math.floor(seconds % 3600 / 60)).padStart(2, "0")}min`;

/** SVG semi-circular gauge inspired by BI dashboards. Display only; no persistence changes. */
export function StudyGoalGauges({ data, goals, monthlyGoals, language, now, hideZeroData = false, explanationVisible, onToggleExplanation }: {
  data: StudyData;
  goals: StudyData["goals"];
  monthlyGoals: StudyData["monthlyGoals"];
  language: StudentLanguage | "all";
  now: Date;
  hideZeroData?: boolean;
  explanationVisible: boolean;
  onToggleExplanation: () => void;
}) {
  const { t } = useTranslation();
  const totals = useMemo(() => {
    const result: Record<string, { all: number; month: number }> = {};
    const month = localDay(now).slice(0, 7);
    for (const entry of studyEntries(data)) {
      const current = result[entry.language] ?? { all: 0, month: 0 };
      current.all += entry.seconds;
      if (entry.date.startsWith(month)) current.month += entry.seconds;
      result[entry.language] = current;
    }
    return result;
  }, [data, now]);
  const languages = (Object.keys(LANGUAGES) as StudentLanguage[]).filter(code => (language === "all" || code === language) && (!hideZeroData || (totals[code]?.all ?? 0) > 0));
  return <section className="study-panel bej-goal-gauges" aria-labelledby="bej-goals-title">
    <div className="study-goal-heading"><h3 id="bej-goals-title">{t("study.journey")}</h3>
      <button type="button" className="secondary-button study-goal-info" aria-label={t(explanationVisible ? "study.hideGoalExplanation" : "study.showGoalExplanation")} aria-expanded={explanationVisible} aria-controls="bej-goals-explanation" onClick={onToggleExplanation}>ⓘ</button>
    </div>
    <p id="bej-goals-explanation" className="study-goal-explanation" data-expanded={explanationVisible}>{t("study.historicalNote")}</p>
    <div className="bej-gauge-grid">{languages.map(code => {
      const actual = totals[code]?.all ?? 0;
      const target = goals[code];
      const percentage = target ? actual / (target * 3600) * 100 : 0;
      const fraction = Math.max(0, Math.min(1, percentage / 100));
      const monthly = monthlyGoals[code];
      // Half-circle with radius 88 and a 276.46 unit arc.
      const arc = Math.PI * 88;
      return <article className="bej-gauge-item" key={code} aria-label={`${languageName(code)}: ${hoursAndMinutes(actual)} / ${target ? `${target}h` : t("study.noGoal")}`}>
        <h4>{languageName(code)}</h4>
        <div className="bej-gauge-visual">
          <svg viewBox="0 0 240 150" role="img" aria-label={`${Math.round(percentage)}%`}>
            <path className="bej-gauge-track" d="M 32 118 A 88 88 0 0 1 208 118" fill="none" strokeWidth="19" strokeLinecap="round" />
            <path className="bej-gauge-progress" d="M 32 118 A 88 88 0 0 1 208 118" fill="none" strokeWidth="19" strokeLinecap="round" strokeDasharray={`${fraction * arc} ${arc}`} />
            <text x="120" y="102" textAnchor="middle" className="bej-gauge-percent">{target ? `${Math.round(percentage)}%` : "—"}</text>
            <text x="120" y="125" textAnchor="middle" className="bej-gauge-subtitle">{t("bejOverview.goalCompleted")}</text>
          </svg>
        </div>
        <div className="bej-gauge-numbers"><strong>{hoursAndMinutes(actual)}</strong><span>/ {target ? `${target}h` : t("study.noGoal")}</span></div>
        {target && <p className="bej-gauge-remaining">{percentage >= 100 ? t("study.reached") : `${t("bejOverview.remaining")}: ${hoursAndMinutes(Math.max(0, target * 3600 - actual))}`}</p>}
        {monthly && <p className="bej-gauge-monthly">{t("study.monthlyProgress", { actual: hoursAndMinutes(totals[code]?.month ?? 0), target: monthly })}</p>}
      </article>;
    })}</div>
  </section>;
}
