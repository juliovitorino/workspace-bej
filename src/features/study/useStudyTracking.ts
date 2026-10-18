import { useEffect, useState } from "react";
import type { StudentLanguage } from "../../config/languages";
import { IDLE_MS, studyTracker, type StudyContext } from "./studyTrackingService";
import type { StudyMode, StudyModule } from "./studyStorage";

export interface StudySignal { view: string; language: StudentLanguage; active: boolean; mode: StudyMode; activeUntil?: number }
export function effectiveStudyView(view: string, trainingMode: "basic" | "advanced" | "review" | null): string {
  return trainingMode === "basic" ? "basic-training" : trainingMode === "advanced" ? "advanced-training" : trainingMode === "review" ? "review-training" : view;
}
export function useStudyTracking(view: string, language: StudentLanguage, signal: StudySignal | null, blocked: boolean) {
  const [warning, setWarning] = useState("");
  useEffect(() => studyTracker.subscribe(status => setWarning(status)), []);
  useEffect(() => studyTracker.start(), []);
  useEffect(() => () => studyTracker.set(null, false), []);
  useEffect(() => {
    const module: StudyModule | null = view === "favorite-chunks" ? "chunk-favorites"
      : ["hashmap", "memory-flashcards", "chunk-flashcards", "shadowing", "basic-training", "advanced-training", "speaking-game", "interpretation"].includes(view) ? view as StudyModule : null;
    studyTracker.setExtraView(view === "extra-activities");
    let lastInteraction = 0;
    const context: StudyContext | null = module ? { language, module, mode: signal?.mode ?? "manual" } : null;
    if (context?.module === "hashmap") context.mode = "manual";
    const refresh = () => {
      const walking = context?.mode === "walking";
      const active = !!context && !blocked && (walking || document.visibilityState === "visible") &&
        (module === "hashmap" ? Date.now() < lastInteraction + IDLE_MS && lastInteraction > 0
          : signal?.view === view && signal.language === language && signal.active);
      studyTracker.set(context, !!active, module === "hashmap" ? lastInteraction + IDLE_MS : signal?.activeUntil ?? Infinity,
        blocked || (!walking && document.visibilityState !== "visible"));
    };
    const interaction = (event: Event) => {
      if (module !== "hashmap" || !event.isTrusted) return;
      const target = event.target;
      if (target instanceof Element && (target.closest(".sidebar, .mobile-floating-controls, .app-settings-dialog"))) return;
      lastInteraction = Date.now(); refresh();
    };
    for (const event of ["pointerdown", "keydown", "input", "scroll"]) window.addEventListener(event, interaction, { passive: true, capture: true });
    document.addEventListener("visibilitychange", refresh);
    refresh();
    return () => {
      for (const event of ["pointerdown", "keydown", "input", "scroll"]) window.removeEventListener(event, interaction, { capture: true });
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [view, language, signal, blocked]);
  return warning;
}
