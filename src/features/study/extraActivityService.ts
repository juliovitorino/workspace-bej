import { newStudyId, StudyError, updateStudyStore, type ExtraCategory, type OtherStudySubcategory } from "./studyStorage";
import type { StudentLanguage } from "../../config/languages";
import { studyTracker } from "./studyTrackingService";
import { advanceExtra, extraEstimate, finishExtra, rewindExtra } from "./extraActivityTime";

export async function startExtraActivity(language: StudentLanguage, category: ExtraCategory, note: string, subcategory?: OtherStudySubcategory) {
  await studyTracker.acquireExtraControl();
  await studyTracker.seal();
  return updateStudyStore(store => {
    studyTracker.requireExtraControl();
    if (store.extraActivity) throw new StudyError("extraActive");
    const now = new Date(Date.now()).toISOString();
    return { ...store, extraActivity: { id: newStudyId(), owner: studyTracker.extraOwner, language, category,
      ...(category === "other" && subcategory ? { subcategory } : {}),
      ...(note.trim() ? { note: note.trim() } : {}), startedAt: now, updatedAt: now, state: "running",
      accumulatedMs: 0, dailyMs: {}, runningSince: now } };
  }, "extra-activities");
}
export function changeExtraActivity(id: string, action: "pause" | "resume" | "rewind" | "stop" | "confirm" | "discard", confirmedSeconds?: number) {
  return updateStudyStore(store => {
    studyTracker.requireExtraControl();
    const draft = store.extraActivity;
    if (!draft) {
      if ((action === "stop" || action === "confirm") && store.studyData.sessions.some(s => s.id === id && s.module === "extra-activities")) return store;
      throw new StudyError("stale");
    }
    if (draft.id !== id) throw new StudyError("stale");
    if (action === "discard") return { ...store, extraActivity: null };
    if (action !== "confirm" && (draft.recoveryAt || draft.owner !== studyTracker.extraOwner)) throw new StudyError("stale");
    const now = Date.now();
    if (now < Date.parse(draft.updatedAt)) throw new StudyError("invalid");
    if (action === "rewind") {
      const current = extraEstimate(draft, now);
      if (current.accumulatedMs <= 0) throw new StudyError("zero");
      return { ...store, extraActivity: rewindExtra(draft, now) };
    }
    if (action === "pause" || action === "resume") {
      if ((action === "pause") !== (draft.state === "running")) throw new StudyError("stale");
      const next = advanceExtra(draft, now), state = action === "pause" ? "paused" : "running";
      return { ...store, extraActivity: { ...next, state, runningSince: state === "running" ? next.updatedAt : null } };
    }
    if (action === "confirm" && !draft.recoveryAt) throw new StudyError("stale");
    const maximum = Math.floor(extraEstimate(draft, now).accumulatedMs / 1000);
    const seconds = action === "confirm" ? confirmedSeconds : maximum;
    if (seconds === 0) throw new StudyError("zero");
    if (!Number.isSafeInteger(seconds) || seconds! < 0 || seconds! > maximum) throw new StudyError("invalid");
    const session = finishExtra(draft, now, seconds!);
    return { ...store, extraActivity: null, studyData: { ...store.studyData, sessions: [...store.studyData.sessions, session] } };
  }, "extra-activities");
}
