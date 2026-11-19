import { useTranslation } from "react-i18next";
import type { ModuleValueMode } from "./studyModuleTime";
import { moduleRecencyParts } from "./studyModuleRecency";

interface StudyModuleTimeValueProps {
  moduleName: string;
  time: string;
  percentage: string;
  lastActivity?: number;
  now: Date;
  mode: ModuleValueMode;
  onToggle: () => void;
}

/** One accessible, responsive control for the entire ranking, on every device. */
export function StudyModuleTimeValue({ moduleName, time, percentage, lastActivity, now, mode, onToggle }: StudyModuleTimeValueProps) {
  const { t } = useTranslation();
  const parts = lastActivity === undefined ? null : moduleRecencyParts(lastActivity, now.getTime());
  const lastActivityLabel = parts
    ? t("study.moduleActivityAgo", { time: `${parts.count}${t(`study.moduleRecencyUnits.${parts.unit}`, { count: parts.count })}` })
    : t("study.noModuleActivity");
  const fullValue = `${time} · ${percentage}`;
  const visibleValue = mode === "both" ? fullValue : mode === "time" ? time : mode === "percentage" ? percentage : lastActivityLabel;

  return (
    <button
      type="button"
      className="study-module-value"
      onClick={onToggle}
      aria-live="polite"
      aria-label={`${moduleName}: ${visibleValue}. ${t("study.toggleModuleTimePercentage")}`}
      title={t("study.toggleModuleTimePercentage")}
    >
      {visibleValue}
    </button>
  );
}
