import { useEffect, useState } from "react";
import type { StudentLanguage } from "../../config/languages";
import type { StudyModule } from "./studyStorage";
import { studyTracker } from "./studyTrackingService";

// Presentation only. Reading a clock never confirms time or writes storage.
export function useStudyReading(module: StudyModule, language: StudentLanguage): number | null {
  const [seconds, setSeconds] = useState<number | null>(null);
  useEffect(() => {
    const refresh = () => setSeconds(studyTracker.isViewing(module, language)
      ? studyTracker.readSession({ module, language, mode: "manual" }).seconds : null);
    const unsubscribe = studyTracker.subscribe(refresh);
    const timer = window.setInterval(refresh, 1000);
    window.addEventListener("focus", refresh);
    return () => { unsubscribe(); window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [module, language]);
  return seconds;
}
