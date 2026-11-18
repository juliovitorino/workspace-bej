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
