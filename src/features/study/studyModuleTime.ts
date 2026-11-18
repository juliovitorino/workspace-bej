/** The two largest nonzero duration units, in descending order. */
export function moduleDurationParts(seconds: number) {
  const parts = [
    ["durationHours", Math.floor(seconds / 3600)],
    ["durationMinutes", Math.floor((seconds % 3600) / 60)],
    ["durationSeconds", Math.floor(seconds % 60)],
  ] as const;
  return parts.filter(([, value]) => value > 0).slice(0, 2);
}

export type ModuleValueMode = "both" | "time" | "percentage";

/** Mobile module values cycle: both -> time -> percentage -> both. */
export function nextModuleValueMode(mode: ModuleValueMode): ModuleValueMode {
  return mode === "both" ? "time" : mode === "time" ? "percentage" : "both";
}

/**
 * Fill the Time by Module bar according to the module's share of total study time.
 * The full track represents 100%, exactly like the percentage shown beside it.
 * No visual minimum: even small percentages retain their proportional width.
 */
export function modulePercentageBarWidth(seconds: number, totalSeconds: number): number {
  if (!Number.isFinite(seconds) || !Number.isFinite(totalSeconds) || seconds <= 0 || totalSeconds <= 0) return 0;
  return Math.min(100, seconds / totalSeconds * 100);
}
