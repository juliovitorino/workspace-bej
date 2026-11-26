import { useTranslation } from "react-i18next";
import type { ModuleValueMode } from "./studyModuleTime";
import { moduleRecencyParts } from "./studyModuleRecency";

interface StudyModuleTimeValueProps {
  moduleName: string;
  time: string;
  percentage: string;
  lastActivity?: number;
  rankChange?: number;
  now: Date;
  mode: ModuleValueMode;
  onToggle: () => void;
}

/** One accessible, responsive control for the entire ranking, on every device. */
export function StudyModuleTimeValue({ moduleName, time, percentage, lastActivity, rankChange, now, mode, onToggle }: StudyModuleTimeValueProps) {
  const { t } = useTranslation();
  const parts = lastActivity === undefined ? null : moduleRecencyParts(lastActivity, now.getTime());
  const lastActivityLabel = parts
    ? t("study.moduleActivityAgo", { time: `${parts.count}${t(`study.moduleRecencyUnits.${parts.unit}${parts.count === 1 ? "One" : "Other"}`)}` })
    : t("study.noModuleActivity");
  const fullValue = `${time} · ${percentage}`;
  const movement = rankChange && Number.isFinite(rankChange)
    ? `${rankChange > 0 ? "↑ +" : "↓ −"}${Math.abs(rankChange)}`
    : null;
  // Unchanged and non-comparable modules never show a movement indicator.
  const visibleValue = mode === "both" ? fullValue : mode === "time" ? time : mode === "percentage" ? percentage
    : mode === "recent" ? lastActivityLabel : movement ?? "";
  const movementLabel = movement
    ? `${rankChange! > 0 ? "Subiu" : "Desceu"} ${Math.abs(rankChange!)} ${Math.abs(rankChange!) === 1 ? "posição" : "posições"}`
    : null;

  return (
    <button
      type="button"
      className="study-module-value"
      onClick={onToggle}
      aria-live="polite"
      aria-label={`${moduleName}: ${mode === "rankChange" ? movementLabel ?? "Sem alteração de posição" : visibleValue}. ${t("study.toggleModuleTimePercentage")}`}
      title={t("study.toggleModuleTimePercentage")}
    >
      {mode === "rankChange" && movement ? <span style={{ color: rankChange! > 0 ? "#15803d" : "#dc2626" }}>{visibleValue}</span> : visibleValue}
    </button>
  );
}
