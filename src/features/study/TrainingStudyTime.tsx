import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { StudentLanguage } from "../../config/languages";
import type { StudyModule } from "./studyStorage";
import { studyTracker, type StudyReading } from "./studyTrackingService";
import "./study.css";
import { ControlIcon } from "../../components/ControlIcon";

export function TrainingStudyTime({ module, language, paused = false, onTogglePause }: {
  module: StudyModule; language: StudentLanguage; paused?: boolean; onTogglePause?: () => void;
}) {
  const { t } = useTranslation();
  const [reading, setReading] = useState<StudyReading>({ seconds: 0, state: "waiting" });
  useEffect(() => {
    const refresh = () => setReading(studyTracker.readSession({ module, language, mode: "manual" }));
    const unsubscribe = studyTracker.subscribe(refresh);
    const timer = window.setInterval(refresh, 1000);
    return () => { unsubscribe(); window.clearInterval(timer); };
  }, [module, language]);
  const time = [Math.floor(reading.seconds / 3600), Math.floor(reading.seconds % 3600 / 60), reading.seconds % 60].map(n => String(n).padStart(2, "0")).join(":");
  return <aside className="training-study-time" aria-label={t("common.studyTime")}>
    <span>{t("common.studyTime")}</span><time aria-live="off">{time}</time><span role="status">{paused ? t("common.paused") : t(`study.tracking.${reading.state}`)}</span>
    {onTogglePause && <button type="button" className="secondary-button training-study-pause"
      aria-label={t(paused ? "flashcards.resumeStudyTime" : "flashcards.pauseStudyTime")}
      title={t(paused ? "flashcards.resumeStudyTime" : "flashcards.pauseStudyTime")}
      aria-pressed={paused}
      disabled={reading.state === "waiting" && !paused}
      onClick={event => { event.stopPropagation(); onTogglePause(); }}>
      <ControlIcon name={paused ? "play" : "pause"} />
    </button>}
  </aside>;
}
