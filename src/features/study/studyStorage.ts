import { isStudentLanguage, type StudentLanguage } from "../../config/languages";

export const STUDY_KEY = "bej-study-data";
export const STUDY_CHANGED = "bej-study-changed";
export const APPLICATION = "Brazilian English Journey";
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
export const STUDY_MODULES = ["hashmap", "memory-flashcards", "chunk-flashcards", "chunk-favorites", "shadowing", "basic-training", "advanced-training", "speaking-game", "interpretation", "extra-activities"] as const;
export const EXTRA_CATEGORIES = ["conversation", "writing", "private-class", "reading", "active-listening", "other"] as const;
export type ExtraCategory = typeof EXTRA_CATEGORIES[number];
export type StudyModule = typeof STUDY_MODULES[number];
export type StudyMode = "manual" | "walking";
export interface StudySession {
  id: string; language: StudentLanguage; module: StudyModule; mode: StudyMode;
  startedAt: string; endedAt: string; activeSeconds: number;
  dailySeconds?: Record<string, number>;
  category?: ExtraCategory;
  note?: string;
}
// Unconfirmed external time is deliberately separate from automatic checkpoints.
export interface ExtraActivityDraft {
  id: string; owner: string; language: StudentLanguage; category: ExtraCategory; note?: string;
  startedAt: string; updatedAt: string; state: "running" | "paused";
  accumulatedMs: number; dailyMs: Record<string, number>; runningSince: string | null;
  recoveryAt?: string;
}
export interface ManualAdjustment {
  id: string; language: StudentLanguage; seconds: number; date: string; description: string;
}
export interface StudyData {
  goals: Partial<Record<StudentLanguage, number>>;
  monthlyGoals: Partial<Record<StudentLanguage, number>>;
  sessions: StudySession[];
  manualAdjustments: ManualAdjustment[];
}
export interface StudyStore { schemaVersion: 1; studyData: StudyData; activeSession: StudySession | null; extraActivity?: ExtraActivityDraft | null }
export interface StudyBackup { schemaVersion: 1; application: typeof APPLICATION; exportedAt: string; studyData: StudyData }
export type StudyErrorCode = "invalid" | "version" | "storage" | "conflict" | "stale" | "tooLarge" | "duplicate" | "extraActive" | "otherTab" | "zero";
export class StudyError extends Error { constructor(public code: StudyErrorCode) { super(code); } }
type StorageLike = Pick<Storage, "getItem" | "setItem">;
const invalid = (): never => { throw new StudyError("invalid"); };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const seconds = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v <= 1e12;
const id = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= 128;
export function validDay(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
}
function instant(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)) return false;
  return validDay(v.slice(0, 10)) && Number.isFinite(Date.parse(v)) && Number(v.slice(11, 13)) < 24 && Number(v.slice(14, 16)) < 60 && Number(v.slice(17, 19)) < 60;
}
function session(v: unknown): StudySession {
  if (!object(v) || !id(v.id) || !isStudentLanguage(v.language) || !STUDY_MODULES.includes(v.module as StudyModule) ||
    !["manual", "walking"].includes(v.mode as string) || !instant(v.startedAt) || !instant(v.endedAt) || !seconds(v.activeSeconds) ||
    Date.parse(v.endedAt) < Date.parse(v.startedAt) || v.activeSeconds > Math.floor((Date.parse(v.endedAt) - Date.parse(v.startedAt)) / 1000)) return invalid();
  if (v.module === "extra-activities" && (!EXTRA_CATEGORIES.includes(v.category as ExtraCategory) || v.mode !== "manual" || v.activeSeconds === 0)) return invalid();
  if (v.category !== undefined && !EXTRA_CATEGORIES.includes(v.category as ExtraCategory)) return invalid();
  if (v.note !== undefined && (typeof v.note !== "string" || v.note.length > 1000)) return invalid();
  let dailySeconds: Record<string, number> | undefined;
  if (v.dailySeconds !== undefined) {
    if (!object(v.dailySeconds)) return invalid();
    dailySeconds = {};
    for (const [day, value] of Object.entries(v.dailySeconds).sort(([a], [b]) => a.localeCompare(b))) {
      if (!validDay(day) || !seconds(value)) return invalid();
      if (Date.parse(day) < Date.parse(v.startedAt.slice(0, 10)) - 86400000 || Date.parse(day) > Date.parse(v.endedAt.slice(0, 10)) + 86400000) return invalid();
      dailySeconds[day] = value;
    }
    if (Object.values(dailySeconds).reduce((a, b) => a + b, 0) !== v.activeSeconds) return invalid();
  }
  return { id: v.id, language: v.language, module: v.module as StudyModule, mode: v.mode as StudyMode,
    startedAt: new Date(v.startedAt).toISOString(), endedAt: new Date(v.endedAt).toISOString(), activeSeconds: v.activeSeconds,
    ...(dailySeconds ? { dailySeconds } : {}), ...(v.category !== undefined ? { category: v.category as ExtraCategory } : {}),
    ...(v.note !== undefined ? { note: v.note as string } : {}) };
}
function extraDraft(v: unknown): ExtraActivityDraft {
  if (!object(v) || !id(v.id) || !id(v.owner) || !isStudentLanguage(v.language) || !EXTRA_CATEGORIES.includes(v.category as ExtraCategory) ||
    (v.note !== undefined && (typeof v.note !== "string" || v.note.length > 1000)) || !instant(v.startedAt) || !instant(v.updatedAt) ||
    !["running", "paused"].includes(v.state as string) || !seconds(v.accumulatedMs) || !object(v.dailyMs)) return invalid();
  const start = Date.parse(v.startedAt), updated = Date.parse(v.updatedAt);
  if (updated < start || v.accumulatedMs > updated - start ||
    (v.state === "running" ? v.runningSince !== v.updatedAt : v.runningSince !== null) ||
    (v.recoveryAt !== undefined && (!instant(v.recoveryAt) || Date.parse(v.recoveryAt) < updated))) return invalid();
  const dailyMs: Record<string, number> = {};
  for (const [day, ms] of Object.entries(v.dailyMs).sort(([a], [b]) => a.localeCompare(b))) {
    if (!validDay(day) || !seconds(ms) || ms > 90000000 || Date.parse(day) < start - 172800000 || Date.parse(day) > updated + 86400000) return invalid();
    dailyMs[day] = ms;
  }
  if (Object.values(dailyMs).reduce((a, b) => a + b, 0) !== v.accumulatedMs) return invalid();
  return { id: v.id, owner: v.owner, language: v.language, category: v.category as ExtraCategory,
    ...(v.note !== undefined ? { note: v.note as string } : {}), startedAt: v.startedAt, updatedAt: v.updatedAt,
    state: v.state as ExtraActivityDraft["state"], accumulatedMs: v.accumulatedMs, dailyMs, runningSince: v.runningSince as string | null,
    ...(v.recoveryAt !== undefined ? { recoveryAt: v.recoveryAt as string } : {}) };
}
function adjustment(v: unknown): ManualAdjustment {
  if (!object(v) || !id(v.id) || !isStudentLanguage(v.language) || !seconds(v.seconds) || !validDay(v.date) ||
    typeof v.description !== "string" || v.description.length > 1000) return invalid();
  return { id: v.id, language: v.language, seconds: v.seconds, date: v.date, description: v.description };
}
function goals(v: unknown): StudyData["goals"] {
  if (!object(v)) return invalid();
  const result: StudyData["goals"] = {};
  for (const [key, value] of Object.entries(v)) {
    if (!isStudentLanguage(key) || typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 1e7) return invalid();
    result[key] = value;
  }
  return result;
}
function records<T extends { id: string }>(v: unknown, parse: (v: unknown) => T): T[] {
  if (!Array.isArray(v) || v.length > 100000) return invalid();
  const seen = new Map<string, T>();
  return v.map(raw => {
    const item = parse(raw), previous = seen.get(item.id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(item)) throw new StudyError("conflict");
    seen.set(item.id, item);
    return item;
  });
}
export function validateStudyData(v: unknown): StudyData {
  if (!object(v)) return invalid();
  const result = { goals: goals(v.goals), monthlyGoals: goals(v.monthlyGoals === undefined ? {} : v.monthlyGoals),
    sessions: records(v.sessions, session), manualAdjustments: records(v.manualAdjustments, adjustment) };
  totalSeconds(result); // Reject sums that would lose integer precision.
  return result;
}
export function emptyStore(): StudyStore {
  return { schemaVersion: 1, studyData: { goals: { "en-US": 750 }, monthlyGoals: {}, sessions: [], manualAdjustments: [] }, activeSession: null };
}
export function totalSeconds(data: StudyData): number {
  const sum = data.sessions.reduce((n, s) => n + s.activeSeconds, 0) + data.manualAdjustments.reduce((n, a) => n + a.seconds, 0);
  if (!Number.isSafeInteger(sum)) return invalid();
  return sum;
}
export function readStudyStore(storage: StorageLike = localStorage): StudyStore {
  let raw: string | null;
  try { raw = storage.getItem(STUDY_KEY); } catch { throw new StudyError("storage"); }
  if (raw === null) return emptyStore();
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return invalid(); }
  if (!object(v)) return invalid();
  if (v.schemaVersion !== 1) throw new StudyError("version");
  const studyData = validateStudyData(v.studyData);
  // Persisted history must already be deduplicated.
  if (new Set(studyData.sessions.map(s => s.id)).size !== studyData.sessions.length ||
    new Set(studyData.manualAdjustments.map(a => a.id)).size !== studyData.manualAdjustments.length) return invalid();
  const activeSession = v.activeSession === null ? null : session(v.activeSession);
  if (activeSession && studyData.sessions.some(s => s.id === activeSession.id)) throw new StudyError("conflict");
  const extraActivity = v.extraActivity == null ? v.extraActivity : extraDraft(v.extraActivity);
  if (extraActivity && (studyData.sessions.some(s => s.id === extraActivity.id) || activeSession?.module === "extra-activities")) throw new StudyError("conflict");
  return { schemaVersion: 1, studyData, activeSession, ...(extraActivity !== undefined ? { extraActivity } : {}) };
}
export function writeStudyStore(store: StudyStore, storage: StorageLike = localStorage): void {
  const serialized = JSON.stringify(store);
  // Validate the entire candidate before the single atomic localStorage write.
  readStudyStore({ getItem: () => serialized, setItem: () => {} });
  try { storage.setItem(STUDY_KEY, serialized); } catch { throw new StudyError("storage"); }
}
export async function updateStudyStore(change: (store: StudyStore) => StudyStore): Promise<StudyStore> {
  const commit = () => {
    const next = change(readStudyStore());
    writeStudyStore(next);
    window.dispatchEvent(new Event(STUDY_CHANGED));
    return next;
  };
  return typeof navigator.locks?.request === "function" ? navigator.locks.request("bej-study-write", commit) : commit();
}
export function parseStudyBackup(text: string): StudyBackup {
  if (new Blob([text]).size > MAX_BACKUP_BYTES) throw new StudyError("tooLarge");
  let v: unknown;
  try { v = JSON.parse(text); } catch { return invalid(); }
  if (!object(v) || v.application !== APPLICATION) return invalid();
  if (v.schemaVersion !== 1) throw new StudyError("version");
  if (!instant(v.exportedAt)) return invalid();
  const studyData = validateStudyData(v.studyData);
  if (studyData.sessions.some(s => Date.parse(s.endedAt) > Date.parse(v.exportedAt as string))) return invalid();
  return { schemaVersion: 1, application: APPLICATION, exportedAt: v.exportedAt, studyData };
}
export function backupOf(store: StudyStore, now = new Date()): StudyBackup {
  if (store.activeSession) throw new StudyError("stale"); // The tracker must seal its confirmed segment first.
  return parseStudyBackup(JSON.stringify({ schemaVersion: 1, application: APPLICATION, exportedAt: now.toISOString(), studyData: store.studyData }));
}
export function mergeStudyData(local: StudyData, incoming: StudyData, preferIncomingGoals = false) {
  let newSessions = 0, duplicates = 0, newAdjustments = 0;
  const conflicts: string[] = [];
  function merge<T extends { id: string }>(existing: T[], extra: T[], kind: string): T[] {
    const byId = new Map(existing.map(item => [item.id, item]));
    for (const item of extra) {
      const previous = byId.get(item.id);
      if (!previous) { byId.set(item.id, item); if (kind === "session") newSessions++; else newAdjustments++; }
      else if (JSON.stringify(previous) !== JSON.stringify(item)) conflicts.push(`${kind}: ${item.id}`);
      else if (kind === "session") duplicates++;
    }
    return [...byId.values()];
  }
  const goalDifferences = (["goals", "monthlyGoals"] as const).flatMap(kind => Object.keys(incoming[kind]).flatMap(key => {
    const language = key as StudentLanguage;
    return local[kind][language] !== undefined && local[kind][language] !== incoming[kind][language]
      ? [{ kind, language, local: local[kind][language]!, incoming: incoming[kind][language]! }] : [];
  }));
  const studyData: StudyData = {
    goals: preferIncomingGoals ? { ...local.goals, ...incoming.goals } : { ...incoming.goals, ...local.goals },
    monthlyGoals: preferIncomingGoals ? { ...local.monthlyGoals, ...incoming.monthlyGoals } : { ...incoming.monthlyGoals, ...local.monthlyGoals },
    sessions: merge(local.sessions, incoming.sessions, "session"),
    manualAdjustments: merge(local.manualAdjustments, incoming.manualAdjustments, "adjustment")
  };
  return { studyData, newSessions, duplicates, newAdjustments, conflicts, goalDifferences, currentSeconds: totalSeconds(local), afterSeconds: totalSeconds(studyData) };
}
export function restoreStudyBackup(store: StudyStore, backup: StudyBackup, expected: string, preferIncomingGoals = false): StudyStore {
  if (store.extraActivity) throw new StudyError("extraActive");
  if (JSON.stringify(store) !== expected || store.activeSession) throw new StudyError("stale");
  const merge = mergeStudyData(store.studyData, backup.studyData, preferIncomingGoals);
  if (merge.conflicts.length) throw new StudyError("conflict");
  return { ...store, studyData: validateStudyData(merge.studyData) };
}
export function newStudyId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  return [...bytes].map((b, i) => ([4, 6, 8, 10].includes(i) ? "-" : "") + b.toString(16).padStart(2, "0")).join("");
}
