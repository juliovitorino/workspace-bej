import { useEffect, useState } from "react";
import { readStudyStore, STUDY_CHANGED, isStudyStorageKey, StudyError, type ExtraActivityDraft } from "./studyStorage";
import { studyTracker } from "./studyTrackingService";

export function useExtraActivity() {
  const [draft, setDraft] = useState<ExtraActivityDraft | null>(null);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const refresh = () => {
      try { setDraft(readStudyStore().extraActivity ?? null); setError(""); }
      catch (e) { setError(e instanceof StudyError ? e.code : "storage"); }
      setAvailable(studyTracker.hasExtraControl());
    };
    const storage = (e: StorageEvent) => { if (isStudyStorageKey(e.key)) refresh(); };
    window.addEventListener(STUDY_CHANGED, refresh); window.addEventListener("storage", storage);
    const unsubscribe = studyTracker.subscribe(refresh); refresh();
    return () => { unsubscribe(); window.removeEventListener(STUDY_CHANGED, refresh); window.removeEventListener("storage", storage); };
  }, []);
  return { draft, available, error };
}
