import type { StudyData } from "./studyStorage";
import type { StudyFilters } from "./studyStats";
import { EXTRA_MODULE_PREFIX, OTHER_SUBCATEGORY_MODULE_PREFIX } from "./studyModuleChart";

/** Latest confirmed study activity by chart row, independently of the selected period. */
export function moduleLastActivity(
  data: StudyData,
  filters: Pick<StudyFilters, "language" | "mode">,
): Record<string, number> {
  const latest: Record<string, number> = {};
  const add = (key: string, timestamp: number) => {
    if (Number.isFinite(timestamp) && (latest[key] === undefined || timestamp > latest[key])) latest[key] = timestamp;
  };
  for (const session of data.sessions) {
    if (session.activeSeconds <= 0 ||
      (filters.language !== "all" && session.language !== filters.language) ||
      (filters.mode !== "all" && session.mode !== filters.mode)) continue;
    const key = session.module === "extra-activities"
      ? session.category === "other"
        ? `${OTHER_SUBCATEGORY_MODULE_PREFIX}${session.subcategory ?? "misc"}`
        : session.category && `${EXTRA_MODULE_PREFIX}${session.category}`
      : session.module;
    if (key) add(key, Date.parse(session.endedAt));
  }
  // Prior-hours adjustments have a date, not a precise completion timestamp.
  // Use local noon for those records; never invent a clock time for a study module.
  if (filters.mode === "all") for (const adjustment of data.manualAdjustments) {
    if (filters.language !== "all" && adjustment.language !== filters.language) continue;
    add("previous", Date.parse(`${adjustment.date}T12:00:00`));
  }
  return latest;
}

export type ModuleRecencyUnit = "second" | "minute" | "hour" | "day" | "week" | "month" | "year";

/** Show only the largest nonzero unit; months and years use 30/365-day approximations. */
export function moduleRecencyParts(lastAt: number, now: number): { count: number; unit: ModuleRecencyUnit } | null {
  if (!Number.isFinite(lastAt) || !Number.isFinite(now)) return null;
  const seconds = Math.max(0, Math.floor((now - lastAt) / 1000));
  const units: readonly [ModuleRecencyUnit, number][] = [
    ["year", 365 * 86400], ["month", 30 * 86400], ["week", 7 * 86400],
    ["day", 86400], ["hour", 3600], ["minute", 60],
  ];
  for (const [unit, size] of units) if (seconds >= size) return { count: Math.floor(seconds / size), unit };
  return { count: seconds, unit: "second" };
}
