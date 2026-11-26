import type { StudentLanguage } from "../../config/languages";
import { localDay } from "./studyTrackingService";
import { EXTRA_CATEGORIES, OTHER_STUDY_SUBCATEGORIES, type OtherStudySubcategory, type ExtraCategory, type StudyData, type StudyMode, type StudyModule } from "./studyStorage";

export type StudyPeriod = "today" | "yesterday" | "week" | "7" | "30" | "month" | "90" | "all" | "custom";
/** Standard periods available for one-click cycling in Time by Module. */
export const STUDY_PERIOD_ORDER: readonly StudyPeriod[] = ["today", "yesterday", "week", "7", "30", "month", "90", "all"];
/** The full filter still supports an explicitly chosen custom date range. */
export const STUDY_FILTER_PERIOD_ORDER: readonly StudyPeriod[] = [...STUDY_PERIOD_ORDER, "custom"];
export function nextStudyPeriod(period: StudyPeriod): StudyPeriod {
  const index = STUDY_PERIOD_ORDER.indexOf(period);
  return STUDY_PERIOD_ORDER[(index + 1) % STUDY_PERIOD_ORDER.length];
}
export interface StudyFilters {
  language: StudentLanguage | "all"; module: StudyModule | "all"; mode: StudyMode | "all";
  period: StudyPeriod; from: string; to: string;
  origin?: "all" | "internal" | "external";
  extraCategory?: ExtraCategory | "all";
  extraSubcategory?: OtherStudySubcategory | "all";
}
export interface StudyEntry { id: string; date: string; language: StudentLanguage; module: StudyModule | "previous"; mode: StudyMode | "previous"; seconds: number; description?: string; category?: ExtraCategory; subcategory?: OtherStudySubcategory; note?: string }
export function previousDay(day: string, offset: number): string {
  const d = new Date(day + "T12:00:00"); d.setDate(d.getDate() + offset); return localDay(d);
}
/** Monday of the current calendar week, matching the weekly study chart. */
export function currentWeekStart(day: string): string {
  const weekday = new Date(day + "T12:00:00").getDay();
  return previousDay(day, -(weekday + 6) % 7);
}
/** The immediately preceding, non-overlapping calendar period for ranking comparisons. */
export function previousStudyPeriodRange(filters: Pick<StudyFilters, "period" | "from" | "to">, now: Date): { from: string; to: string } | null {
  const today = localDay(now);
  const yesterday = previousDay(today, -1);
  if (filters.period === "all") return null;
  if (filters.period === "today") return { from: yesterday, to: yesterday };
  if (filters.period === "yesterday") {
    const day = previousDay(today, -2);
    return { from: day, to: day };
  }
  if (filters.period === "week") {
    const monday = currentWeekStart(today);
    return { from: previousDay(monday, -7), to: previousDay(monday, -1) };
  }
  if (filters.period === "month") {
    const first = today.slice(0, 7) + "-01";
    return { from: previousDay(first, -1).slice(0, 7) + "-01", to: previousDay(first, -1) };
  }
  if (filters.period === "custom") {
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(filters.from) || !/^\\d{4}-\\d{2}-\\d{2}$/.test(filters.to) || filters.from > filters.to) return null;
    const days = Math.round((Date.parse(filters.to) - Date.parse(filters.from)) / 86400000) + 1;
    if (days <= 0 || !Number.isFinite(days)) return null;
    return { from: previousDay(filters.from, -days), to: previousDay(filters.from, -1) };
  }
  const days = Number(filters.period);
  return { from: previousDay(today, -(days * 2 - 1)), to: previousDay(today, -days) };
}
export function studyEntries(data: StudyData): StudyEntry[] {
  return [
    ...data.sessions.flatMap(s => Object.entries(s.dailySeconds ?? { [localDay(new Date(s.startedAt))]: s.activeSeconds }).map(([date, seconds]) =>
      ({ id: s.id, date, language: s.language, module: s.module, mode: s.mode, seconds, ...(s.category ? { category: s.category } : {}), ...(s.subcategory ? { subcategory: s.subcategory } : {}), ...(s.note ? { note: s.note } : {}) }))),
    ...data.manualAdjustments.map(a => ({ id: a.id, date: a.date, language: a.language, module: "previous" as const, mode: "previous" as const, seconds: a.seconds, description: a.description }))
  ];
}
/** Select entries for the active study language, preserving the explicit all-languages view. */
export function studyEntriesForLanguage(data: StudyData, language: StudyFilters["language"]): StudyEntry[] {
  return studyEntries(data).filter(entry => language === "all" || entry.language === language);
}
export function studyStats(data: StudyData, filters: StudyFilters, now = new Date()) {
  const today = localDay(now), month = today.slice(0, 7) + "-01";
  const matching = studyEntries(data).filter(e => (filters.language === "all" || filters.language === e.language) &&
    (filters.module === "all" || filters.module === e.module) && (filters.mode === "all" || filters.mode === e.mode) &&
    (filters.origin !== "internal" || (e.module !== "extra-activities" && e.module !== "previous")) &&
    (filters.origin !== "external" || e.module === "extra-activities") &&
    (!filters.extraCategory || filters.extraCategory === "all" || filters.origin === "internal" || (e.module === "extra-activities" && e.category === filters.extraCategory)) &&
    (!filters.extraSubcategory || filters.extraSubcategory === "all" || filters.origin === "internal" || (e.module === "extra-activities" && e.category === "other" && (e.subcategory ?? "misc") === filters.extraSubcategory)));
  const earliest = matching.reduce((day, e) => e.date < day ? e.date : day, today);
  const from = filters.period === "custom" ? filters.from : filters.period === "today" ? today : filters.period === "yesterday" ? previousDay(today, -1) : filters.period === "month" ? month : filters.period === "week" ? currentWeekStart(today) : filters.period === "all" ? earliest : previousDay(today, 1 - Number(filters.period));
  const to = filters.period === "custom" ? filters.to : filters.period === "yesterday" ? from : today;
  const entries = matching.filter(e => e.date >= from && e.date <= to);
  const sum = (list: StudyEntry[]) => list.reduce((n, e) => n + e.seconds, 0);
  function group(key: (entry: StudyEntry) => string) {
    const result: Record<string, number> = {};
    entries.forEach(e => { const k = key(e); result[k] = (result[k] ?? 0) + e.seconds; });
    return result;
  }
  const daily = group(e => e.date);
  const qualified = Object.keys(daily).filter(day => daily[day] >= 60).sort();
  let longest = 0, run = 0, previous = "";
  for (const day of qualified) { run = previous && previousDay(previous, 1) === day ? run + 1 : 1; longest = Math.max(longest, run); previous = day; }
  let streak = 0, cursor = daily[today] >= 60 ? today : previousDay(today, -1);
  while (daily[cursor] >= 60) { streak++; cursor = previousDay(cursor, -1); }
  // UTC arithmetic on date-only values counts calendar days without DST drift.
  const days = Math.max(1, (Date.parse(to) - Date.parse(from)) / 86400000 + 1);
  const timeline = group(e => {
    if (filters.period === "all" || filters.period === "90" || (filters.period === "custom" && days > 90)) return e.date.slice(0, 7);
    if (filters.period === "30" || (filters.period === "custom" && days > 31)) {
      const weekday = new Date(e.date + "T12:00:00").getDay(); return previousDay(e.date, -(weekday + 6) % 7);
    }
    return e.date;
  });
  return { entries, from, to, total: sum(entries), today: sum(entries.filter(e => e.date === today)),
    internal: sum(entries.filter(e => e.module !== "extra-activities" && e.module !== "previous")),
    external: sum(entries.filter(e => e.module === "extra-activities")),
    byExtraCategory: Object.fromEntries(EXTRA_CATEGORIES.map(category => [category, sum(entries.filter(e => e.module === "extra-activities" && e.category === category))])),
    byOtherSubcategory: Object.fromEntries(OTHER_STUDY_SUBCATEGORIES.map(subcategory => [subcategory, sum(entries.filter(e =>
      e.module === "extra-activities" && e.category === "other" && (e.subcategory ?? "misc") === subcategory))])),
    week: sum(entries.filter(e => e.date >= previousDay(today, -6) && e.date <= today)),
    month: sum(entries.filter(e => e.date >= month && e.date <= today)), average: sum(entries) / days,
    studyDays: Object.values(daily).filter(seconds => seconds > 0).length, streak, longest,
    byModule: group(e => e.module), byLanguage: group(e => e.language), timeline };
}
