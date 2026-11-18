import { useState } from "react";
import { useTranslation } from "react-i18next";
import { nextModuleValueMode, type ModuleValueMode } from "./studyModuleTime";

interface StudyModuleTimeValueProps {
  moduleName: string;
  time: string;
  percentage: string;
}

/** Desktop is always static; each mobile module row owns its independent three-step cycle. */
export function StudyModuleTimeValue({ moduleName, time, percentage }: StudyModuleTimeValueProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<ModuleValueMode>("both");
  const fullValue = `${time} · ${percentage}`;
  const visibleValue = mode === "both" ? fullValue : mode === "time" ? time : percentage;

  return (
    <>
      <strong className="study-module-value-desktop">{fullValue}</strong>
      <button
        type="button"
        className="study-module-value-mobile"
        onClick={() => setMode(nextModuleValueMode)}
        aria-live="polite"
        aria-label={`${moduleName}: ${visibleValue}. ${t("study.toggleModuleTimePercentage")}`}
        title={t("study.toggleModuleTimePercentage")}
      >
        {visibleValue}
      </button>
    </>
  );
}
