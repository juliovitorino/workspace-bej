import type { ExtraActivityDraft, StudySession, StudyStore } from "./studyStorage";

// Timestamp arithmetic, independent of foreground ticks or the internal idle cap.
export function advanceExtra(draft: ExtraActivityDraft, now: number): ExtraActivityDraft {
  if (now < Date.parse(draft.updatedAt)) throw new Error("clock");
  const dailyMs = { ...draft.dailyMs };
  let cursor = draft.runningSince ? Date.parse(draft.runningSince) : now;
  while (cursor < now) {
    const d = new Date(cursor);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const end = Math.min(now, new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime());
    dailyMs[day] = (dailyMs[day] ?? 0) + end - cursor;
    cursor = end;
  }
  const updatedAt = new Date(now).toISOString();
  return { ...draft, dailyMs, accumulatedMs: Object.values(dailyMs).reduce((a, b) => a + b, 0), updatedAt,
    runningSince: draft.state === "running" ? updatedAt : null };
}
export function recoverExtra(store: StudyStore, owner: string, now: number): StudyStore {
  const draft = store.extraActivity;
  return draft && draft.owner !== owner && !draft.recoveryAt
    ? { ...store, extraActivity: { ...draft, recoveryAt: new Date(Math.max(now, Date.parse(draft.updatedAt))).toISOString() } } : store;
}
export function extraEstimate(draft: ExtraActivityDraft, now: number) {
  return advanceExtra(draft, draft.recoveryAt ? Date.parse(draft.recoveryAt) : now);
}
export function finishExtra(draft: ExtraActivityDraft, now: number, confirmedSeconds: number): StudySession {
  const estimate = extraEstimate(draft, now);
  if (!Number.isSafeInteger(confirmedSeconds) || confirmedSeconds <= 0 || confirmedSeconds > Math.floor(estimate.accumulatedMs / 1000)) throw new Error("duration");
  // A reduced confirmation retains the earliest eligible study intervals.
  let remaining = confirmedSeconds * 1000, used = 0;
  const dailySeconds: Record<string, number> = {};
  for (const [day, ms] of Object.entries(estimate.dailyMs).sort(([a], [b]) => a.localeCompare(b))) {
    const take = Math.min(remaining, ms), seconds = Math.floor((used + take) / 1000) - Math.floor(used / 1000);
    if (seconds) dailySeconds[day] = seconds;
    used += take; remaining -= take;
  }
  return { id: draft.id, language: draft.language, module: "extra-activities", mode: "manual", category: draft.category,
    ...(draft.subcategory ? { subcategory: draft.subcategory } : {}),
    ...(draft.note ? { note: draft.note } : {}), startedAt: draft.startedAt, endedAt: estimate.updatedAt,
    activeSeconds: confirmedSeconds, dailySeconds };
}
