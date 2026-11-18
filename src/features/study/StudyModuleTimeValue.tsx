import { useTranslation } from "react-i18next";
import type { ModuleValueMode } from "./studyModuleTime";

interface StudyModuleTimeValueProps {
  moduleName: string;
  time: string;
  percentage: string;
  mode: ModuleValueMode;
  onToggle: () => void;
}

/** Desktop remains static; mobile rows share the same display mode from the dashboard. */
export function StudyModuleTimeValue({ moduleName, time, percentage, mode, onToggle }: StudyModuleTimeValueProps) {
  const { t } = useTranslation();
  const fullValue = `${time} · ${percentage}`;
  const visibleValue = mode === "both" ? fullValue : mode === "time" ? time : percentage;

  return (
    <>
      <strong className="study-module-value-desktop">{fullValue}</strong>
      <button
        type="button"
        className="study-module-value-mobile"
        onClick={onToggle}
        aria-live="polite"
        aria-label={`${moduleName}: ${visibleValue}. ${t("study.toggleModuleTimePercentage")}`}
        title={t("study.toggleModuleTimePercentage")}
      >
        {visibleValue}
      </button>
    </>
  );
}
