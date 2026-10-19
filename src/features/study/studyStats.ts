import type { StudentLanguage } from "../../config/languages";
import { localDay } from "./studyTrackingService";
import { EXTRA_CATEGORIES, type ExtraCategory, type StudyData, type StudyMode, type StudyModule } from "./studyStorage";

export type StudyPeriod = "today" | "yesterday" | "7" | "30" | "month" | "90" | "all" | "custom";
export interface StudyFilters {
  language: StudentLanguage | "all"; module: StudyModule | "all"; mode: StudyMode | "all";
  period: StudyPeriod; from: string; to: string;
  origin?: "all" | "internal" | "external";
  extraCategory?: ExtraCategory | "all";
}
export interface StudyEntry { id: string; date: string; language: StudentLanguage; module: StudyModule | "previous"; mode: StudyMode | "previous"; seconds: number; description?: string; category?: ExtraCategory; note?: string }
export function previousDay(day: string, offset: number): string {
  const d = new Date(day + "T12:00:00"); d.setDate(d.getDate() + offset); return localDay(d);
}
export function studyEntries(data: StudyData): StudyEntry[] {
  return [
    ...data.sessions.flatMap(s => Object.entries(s.dailySeconds ?? { [localDay(new Date(s.startedAt))]: s.activeSeconds }).map(([date, seconds]) =>
      ({ id: s.id, date, language: s.language, module: s.module, mode: s.mode, seconds, ...(s.category ? { category: s.category } : {}), ...(s.note ? { note: s.note } : {}) }))),
    ...data.manualAdjustments.map(a => ({ id: a.id, date: a.date, language: a.language, module: "previous" as const, mode: "previous" as const, seconds: a.seconds, description: a.description }))
  ];
}
export function studyStats(data: StudyData, filters: StudyFilters, now = new Date()) {
  const today = localDay(now), month = today.slice(0, 7) + "-01";
  const matching = studyEntries(data).filter(e => (filters.language === "all" || filters.language === e.language) &&
    (filters.module === "all" || filters.module === e.module) && (filters.mode === "all" || filters.mode === e.mode) &&
    (filters.origin !== "internal" || (e.module !== "extra-activities" && e.module !== "previous")) &&
    (filters.origin !== "external" || e.module === "extra-activities") &&
    (!filters.extraCategory || filters.extraCategory === "all" || filters.origin === "internal" || (e.module === "extra-activities" && e.category === filters.extraCategory)));
  const earliest = matching.reduce((day, e) => e.date < day ? e.date : day, today);
  const from = filters.period === "custom" ? filters.from : filters.period === "today" ? today : filters.period === "yesterday" ? previousDay(today, -1) : filters.period === "month" ? month : filters.period === "all" ? earliest : previousDay(today, 1 - Number(filters.period));
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
    week: sum(entries.filter(e => e.date >= previousDay(today, -6) && e.date <= today)),
    month: sum(entries.filter(e => e.date >= month && e.date <= today)), average: sum(entries) / days,
    studyDays: Object.values(daily).filter(seconds => seconds > 0).length, streak, longest,
    byModule: group(e => e.module), byLanguage: group(e => e.language), timeline };
}
