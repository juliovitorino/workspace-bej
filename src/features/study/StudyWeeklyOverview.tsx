import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { EXTRA_CATEGORIES, type ExtraCategory, type StudyData } from "./studyStorage";
import { previousDay, studyEntries } from "./studyStats";
import { localDay } from "./studyTrackingService";

/** Read-only dashboard projection. Uses the same >=60s qualification as studyStats.streak. */
export function StudyWeeklyOverview({ data, now, hideZeroData = false }: { data: StudyData; now: Date; hideZeroData?: boolean }) {
  const { t, i18n } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<ExtraCategory | null>(null);
  const week = useMemo(() => {
    const today = localDay(now);
    const weekday = new Date(today + "T12:00:00").getDay();
    const monday = previousDay(today, -(weekday + 6) % 7);
    const days = Array.from({ length: 7 }, (_, i) => previousDay(monday, i));
    const entries = studyEntries(data);
    const byDay = new Map<string, number>();
    const byCategoryDay = new Map<ExtraCategory, Map<string, number>>(
      EXTRA_CATEGORIES.map(category => [category, new Map<string, number>()])
    );
    for (const entry of entries) if (entry.seconds > 0 && entry.date <= today) {
      byDay.set(entry.date, (byDay.get(entry.date) ?? 0) + entry.seconds);
      if (entry.module === "extra-activities" && entry.category && byCategoryDay.has(entry.category)) {
        const daily = byCategoryDay.get(entry.category)!;
        daily.set(entry.date, (daily.get(entry.date) ?? 0) + entry.seconds);
      }
    }
    let streak = 0;
    let cursor = (byDay.get(today) ?? 0) >= 60 ? today : previousDay(today, -1);
    // This card represents the current week: do not include days from a prior week.
    while (cursor >= monday && (byDay.get(cursor) ?? 0) >= 60) { streak++; cursor = previousDay(cursor, -1); }
    const categories = EXTRA_CATEGORIES.map(category => ({
      category,
      days: new Set(entries.filter(e => e.module === "extra-activities" && e.category === category && e.seconds > 0 && e.date >= monday && e.date <= today).map(e => e.date)).size
    }));
    return { today, days, byDay, byCategoryDay, streak, categories };
  }, [data, now]);
  const fmt = (day: string, options: Intl.DateTimeFormatOptions) => new Date(day + "T12:00:00").toLocaleDateString(i18n.language, options);
  const time = (seconds: number) => `${Math.floor(seconds / 3600)}h ${String(Math.floor(seconds % 3600 / 60)).padStart(2, "0")}min`;
  // Compact labels prevent overlaps between the seven bars.
  const barTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (!hours && !minutes) return "";
    if (!hours) return `${minutes}min`;
    if (!minutes) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };
  const chartByDay = selectedCategory ? week.byCategoryDay.get(selectedCategory) ?? new Map<string, number>() : week.byDay;
  const weekTotal = week.days.reduce((sum, day) => sum + (chartByDay.get(day) ?? 0), 0);
  const max = Math.max(60, ...week.days.map(day => chartByDay.get(day) ?? 0));
  const categoryIcons: Record<string, string> = { conversation: "💬", reading: "📖", writing: "✏️", "active-listening": "🎧", "private-class": "🎓", other: "✨" };
  return <div className="bej-overview-grid">
    <section className="study-panel bej-streak-card" aria-labelledby="bej-streak-title">
      <div className="bej-card-heading"><div><h3 id="bej-streak-title"><span aria-hidden="true">🔥</span> Days Streak</h3><p>{t("bejOverview.currentWeek")} · {fmt(week.days[0], { day: "numeric", month: "short" })} – {fmt(week.days[6], { day: "numeric", month: "short", year: "numeric" })}</p></div><div className="bej-streak-value"><strong>{week.streak}</strong><span>{t("bejOverview.consecutiveDays")}</span></div></div>
      <div className="bej-week-days" role="list" aria-label={t("bejOverview.weeklyActivity")}>
        {week.days.map(day => { const seconds = week.byDay.get(day) ?? 0; const active = seconds >= 60; const future = day > week.today; const todayInProgress = day === week.today; return <div className="bej-week-day" key={day} role="listitem" aria-label={`${fmt(day, { weekday: "long", day: "numeric", month: "long" })}: ${future ? t("bejOverview.future") : todayInProgress ? `${t("bejOverview.inProgress")}${seconds > 0 ? ` · ${time(seconds)}` : ""}` : active ? time(seconds) : t("bejOverview.noStudy")}`}><span className="bej-week-day-name">{fmt(day, { weekday: "short" }).replace(".", "").slice(0, 3)}</span><span className="bej-week-day-number">{Number(day.slice(-2))}</span><span className={`bej-week-day-box${active && !todayInProgress ? " is-active" : ""}${todayInProgress ? " is-in-progress" : ""}`}>{todayInProgress ? "◷" : active ? "✓" : "—"}</span></div>; })}
      </div>
      <div className="bej-streak-bottom"><h4>{t("bejOverview.weeklyExtra")}</h4><div className="bej-category-mini-grid">{week.categories.filter(({ days }) => !hideZeroData || days > 0).map(({ category, days }) => <button type="button" className={`bej-category-mini bej-category-${category}${days === 0 ? " is-zero-study" : ""}${selectedCategory === category ? " is-selected" : ""}`} key={category} aria-pressed={selectedCategory === category} aria-label={`${t(`extras.categories.${category}`)}: ${days} / 7 ${t("bejOverview.days")}`} onClick={() => setSelectedCategory(current => current === category ? null : category)}><div className="bej-category-mini-label"><span className="bej-category-icon" aria-hidden="true">{categoryIcons[category]}</span><span>{t(`extras.categories.${category}`)}</span></div><strong>{days} / 7 {t("bejOverview.days")}</strong><div className="bej-mini-track"><span style={{ width: `${days / 7 * 100}%` }} /></div></button>)}</div></div>
    </section>
    <section className="study-panel bej-week-time" aria-labelledby="bej-week-time-title"><div className="bej-card-heading"><div><h3 id="bej-week-time-title"><span aria-hidden="true">◷</span> {t("bejOverview.studyTime")}</h3><p>{t("bejOverview.currentWeek")}{selectedCategory ? ` · ${t(`extras.categories.${selectedCategory}`)}` : ""}</p></div></div><div className="bej-week-total">{time(weekTotal)}</div><div className="bej-week-bars" role="list" aria-label={t("bejOverview.dailyTime")}>{week.days.map(day => { const seconds = chartByDay.get(day) ?? 0; return <div className="bej-week-bar-column" role="listitem" key={day} aria-label={`${fmt(day, { weekday: "long" })}: ${barTime(seconds) || t("bejOverview.noStudy")}`}><div className="bej-week-bar-space"><div className={`bej-week-bar-fill${seconds ? " has-study" : ""}${selectedCategory ? ` bej-week-bar-${selectedCategory}` : ""}`} style={{ height: `${seconds > 0 ? Math.max(3, seconds / max * 100) : 0}%` }} /></div><span>{fmt(day, { weekday: "short" }).replace(".", "").slice(0, 3)}</span>{barTime(seconds) && <small>{barTime(seconds)}</small>}</div>; })}</div></section>
  </div>;
}
