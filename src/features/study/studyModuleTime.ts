/** The two largest nonzero duration units, in descending order. */
export function moduleDurationParts(seconds: number) {
  const parts = [
    ["durationHours", Math.floor(seconds / 3600)],
    ["durationMinutes", Math.floor((seconds % 3600) / 60)],
    ["durationSeconds", Math.floor(seconds % 60)],
  ] as const;
  return parts.filter(([, value]) => value > 0).slice(0, 2);
}

export type ModuleValueMode = "both" | "time" | "percentage" | "recent" | "rankChange";

/** The rank-change step is only enabled when a comparable movement exists. */
export function nextModuleValueMode(mode: ModuleValueMode, hasRankChange = false): ModuleValueMode {
  return mode === "time" ? "percentage" : mode === "percentage" ? "recent" : mode === "recent" ? (hasRankChange ? "rankChange" : "both") : mode === "rankChange" ? "both" : "time";
}

/**
 * Fill the ranking bar relative to the leading module's duration.
 * The leader fills the track; displayed percentages still use total study time.
 * No visual minimum: even small values retain their proportional width.
 */
export function modulePercentageBarWidth(seconds: number, leaderSeconds: number): number {
  if (!Number.isFinite(seconds) || !Number.isFinite(leaderSeconds) || seconds <= 0 || leaderSeconds <= 0) return 0;
  return Math.min(100, seconds / leaderSeconds * 100);
}
