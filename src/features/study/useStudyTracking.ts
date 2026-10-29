import { useEffect, useRef, useState } from "react";
import type { StudentLanguage } from "../../config/languages";
import { studyTracker, type StudyContext } from "./studyTrackingService";
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
  const policy = useRef({ signal, blocked });
  policy.current = { signal, blocked };
  const refreshPolicy = useRef<(() => void) | null>(null);
  useEffect(() => {
    const module: StudyModule | null = view === "favorite-chunks" ? "chunk-favorites"
      : ["hashmap", "memory-flashcards", "chunk-flashcards", "shadowing", "basic-training", "advanced-training", "review-training", "speaking-game", "would-you-rather", "interpretation", "small-talk"].includes(view) ? view as StudyModule : null;
    studyTracker.setExtraView(view === "extra-activities");
    const context: StudyContext | null = module ? { language, module, mode: module === "hashmap" ? "manual" : signal?.mode ?? "manual" } : null;
    const refresh = () => {
      const { signal: current, blocked } = policy.current;
      const walking = context?.mode === "walking";
      const active = !!context && !blocked && (walking || document.visibilityState === "visible") &&
        (module === "hashmap" || (current?.view === view && current.language === language && current.active));
      studyTracker.set(context, !!active, current?.activeUntil ?? Infinity, blocked || (!walking && document.visibilityState !== "visible"));
    };
    refreshPolicy.current = refresh;
    let scrollIntent = -Infinity;
    const interaction = (event: Event) => {
      if (!event.isTrusted) return;
      const target = event.target;
      // Consulta e filtragem não são operações de estudo: evitar qualquer
      // checkpoint/re-render do monitoramento no meio da digitação (iOS).
      // Este retorno não altera as permissões de escrita nem o relógio da aba
      // proprietária de uma Atividade Extra em andamento.
      if (view === "hashmap" && typeof Element !== "undefined" && target instanceof Element &&
          target.closest("#hashmap-search-filters")) return;
      if (event.type === "scroll" && Date.now() - scrollIntent > 1500) return;
      studyTracker.interactExtra();
      if (typeof Element !== "undefined" && target instanceof Element && target.closest(".sidebar, .mobile-floating-controls, .app-settings-dialog, .app-header")) return;
      if (["wheel", "touchmove", "pointerdown", "keydown"].includes(event.type)) scrollIntent = Date.now();
      if (module && !policy.current.blocked) { refresh(); studyTracker.interact(); }
      else if (view === "extra-activities") studyTracker.interact();
    };
    const lifecycle = () => { refresh(); studyTracker.checkpoint(); };
    const blur = () => { if (context?.mode !== "walking") studyTracker.set(context, false, Infinity, true); studyTracker.checkpoint(); };
    const events = ["pointerdown", "click", "keydown", "input", "change", "wheel", "touchmove", "scroll"];
    for (const event of events) window.addEventListener(event, interaction, { passive: true, capture: true });
    document.addEventListener("visibilitychange", lifecycle);
    window.addEventListener("focus", lifecycle); window.addEventListener("blur", blur);
    refresh();
    return () => {
      for (const event of events) window.removeEventListener(event, interaction, { capture: true });
      document.removeEventListener("visibilitychange", lifecycle);
      window.removeEventListener("focus", lifecycle); window.removeEventListener("blur", blur);
      refreshPolicy.current = null;
    };
  }, [view, language, signal?.mode]);
  useEffect(() => { refreshPolicy.current?.(); }, [signal, blocked]);
  return warning;
}
