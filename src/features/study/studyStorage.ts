import { LANGUAGES, isStudentLanguage, type StudentLanguage } from "../../config/languages";
import { getStudyLocks } from "./studyLocks";
import { finishExtra } from "./extraActivityTime";

export const STUDY_KEY = "bej-study-v2:";
export const isStudyStorageKey = (key: string | null) => key === null || key.startsWith(STUDY_KEY);
export const STUDY_CHANGED = "bej-study-changed";
export const APPLICATION = "Brazilian English Journey";
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
export const STUDY_MODULES = ["hashmap", "memory-flashcards", "chunk-flashcards", "chunk-favorites", "shadowing", "basic-training", "advanced-training", "review-training", "speaking-game", "would-you-rather", "interpretation", "small-talk", "extra-activities"] as const;
export const EXTRA_CATEGORIES = ["conversation", "writing", "private-class", "reading", "active-listening", "other"] as const;
export type ExtraCategory = typeof EXTRA_CATEGORIES[number];
// Optional: old sessions and active drafts remain valid without this field.
export const OTHER_STUDY_SUBCATEGORIES = ["shadowing", "self-speaking", "misc"] as const;
export type OtherStudySubcategory = typeof OTHER_STUDY_SUBCATEGORIES[number];
export type StudyModule = typeof STUDY_MODULES[number];
export type StudyMode = "manual" | "walking";
export interface StudySession {
  id: string; language: StudentLanguage; module: StudyModule; mode: StudyMode;
  startedAt: string; endedAt: string; activeSeconds: number;
  dailySeconds?: Record<string, number>;
  category?: ExtraCategory;
  subcategory?: OtherStudySubcategory;
  note?: string;
}
// Unconfirmed external time is deliberately separate from automatic checkpoints.
export interface ExtraActivityDraft {
  id: string; owner: string; language: StudentLanguage; category: ExtraCategory; subcategory?: OtherStudySubcategory; note?: string;
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
export interface StudyStore { schemaVersion: 1; studyData: StudyData; activeSession: StudySession | null; extraActivity?: ExtraActivityDraft | null; resetGeneration?: Record<string, string> }
export interface StudyBackup { schemaVersion: 1; application: typeof APPLICATION; exportedAt: string; studyData: StudyData }
export type StudyErrorCode = "invalid" | "version" | "storage" | "conflict" | "stale" | "tooLarge" | "duplicate" | "extraActive" | "otherTab" | "zero" | "unsupported" | "resetActive";
export class StudyError extends Error { constructor(public code: StudyErrorCode) { super(code); } }
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;
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
  if (v.subcategory !== undefined && (v.category !== "other" || !OTHER_STUDY_SUBCATEGORIES.includes(v.subcategory as OtherStudySubcategory))) return invalid();
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
    ...(v.subcategory !== undefined ? { subcategory: v.subcategory as OtherStudySubcategory } : {}),
    ...(v.note !== undefined ? { note: v.note as string } : {}) };
}
function extraDraft(v: unknown): ExtraActivityDraft {
  if (!object(v) || !id(v.id) || !id(v.owner) || !isStudentLanguage(v.language) || !EXTRA_CATEGORIES.includes(v.category as ExtraCategory) ||
    (v.note !== undefined && (typeof v.note !== "string" || v.note.length > 1000)) ||
    (v.subcategory !== undefined && (v.category !== "other" || !OTHER_STUDY_SUBCATEGORIES.includes(v.subcategory as OtherStudySubcategory))) || !instant(v.startedAt) || !instant(v.updatedAt) ||
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
    ...(v.subcategory !== undefined ? { subcategory: v.subcategory as OtherStudySubcategory } : {}),
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
// The aggregate is a read model only; records are persisted independently.
function validateStore(v: StudyStore): StudyStore {
  const studyData = validateStudyData(v.studyData);
  if (new Set(studyData.sessions.map(s => s.id)).size !== studyData.sessions.length ||
    new Set(studyData.manualAdjustments.map(a => a.id)).size !== studyData.manualAdjustments.length) return invalid();
  const activeSession = v.activeSession == null ? null : session(v.activeSession);
  const extraActivity = v.extraActivity == null ? null : extraDraft(v.extraActivity);
  return { schemaVersion: 1, studyData, activeSession, extraActivity, ...(v.resetGeneration ? { resetGeneration: v.resetGeneration } : {}) };
}
const recordKey = (kind: string, identity: string) => STUDY_KEY + kind + ":" + encodeURIComponent(identity);
export type StudyResetScope = { scope: "all" } | { scope: "language"; language: StudentLanguage };
type ResetJournal = { generation: string; keys: string[] };
// Only records actually read by the Dashboard. Similar prefixes owned by other
// features are not reset candidates, including unknown active:* keys.
function dashboardResetKey(key: string): boolean {
  return ["session:", "adjustment:"].some(prefix => key.startsWith(STUDY_KEY + prefix) && key.length > (STUDY_KEY + prefix).length) ||
    STUDY_MODULES.some(module => key === STUDY_KEY + "active:" + module);
}
function dashboardRecordLanguage(key: string, value: unknown): StudentLanguage {
  if (key.startsWith(STUDY_KEY + "session:")) {
    const item = session(value);
    if (key !== recordKey("session", item.id)) return invalid();
    return item.language;
  }
  if (key.startsWith(STUDY_KEY + "adjustment:")) {
    const item = adjustment(value);
    if (key !== recordKey("adjustment", item.id)) return invalid();
    return item.language;
  }
  if (key === STUDY_KEY + "active:extra-activities") return extraDraft(value).language;
  const item = session(value);
  if (key !== STUDY_KEY + "active:" + item.module || !dashboardResetKey(key)) return invalid();
  return item.language;
}
function resetJournals(storage: StorageLike): [StudentLanguage, ResetJournal][] {
  return (Object.keys(LANGUAGES) as StudentLanguage[]).flatMap(language => {
    const raw = storage.getItem(STUDY_KEY + "reset:" + language);
    if (raw === null) return [];
    const value = JSON.parse(raw);
    if (!object(value) || !id(value.generation) || !Array.isArray(value.keys) || !value.keys.every(key => typeof key === "string" && dashboardResetKey(key))) return invalid();
    return [[language, value as ResetJournal]];
  });
}
export function readResetGenerations(storage: StorageLike = localStorage): Record<string, string> {
  return Object.fromEntries(resetJournals(storage).map(([language, journal]) => [language, journal.generation]));
}
function pendingResetKeys(storage: StorageLike): Set<string> {
  return new Set(resetJournals(storage).flatMap(([, journal]) => journal.keys));
}
// A durable per-language journal hides pending deletions immediately. Repeating
// physical deletion is safe after interruption, before any coordinated writer.
function completePendingResets(storage: StorageLike) {
  for (const [language, journal] of resetJournals(storage)) if (journal.keys.length) {
    for (const key of journal.keys) {
      const raw = storage.getItem(key);
      if (raw !== null) {
        const value = JSON.parse(raw);
        if (dashboardRecordLanguage(key, value) !== language) return invalid();
        storage.removeItem(key);
      }
    }
    storage.setItem(STUDY_KEY + "reset:" + language, JSON.stringify({ generation: journal.generation, keys: [] }));
  }
}
function resetLanguages(scope: StudyResetScope): StudentLanguage[] {
  if (!scope || (scope.scope !== "all" && scope.scope !== "language") ||
    (scope.scope === "language" && !isStudentLanguage(scope.language))) return invalid();
  return scope.scope === "all" ? Object.keys(LANGUAGES) as StudentLanguage[] : [scope.language];
}
async function protectReset<T>(scope: StudyResetScope, operation: (languages: StudentLanguage[]) => T, recover = true): Promise<T> {
  const languages = resetLanguages(scope), locks = getStudyLocks();
  if (!locks) throw new StudyError("unsupported");
  return locks.request("bej-study-v2:write", async lock => {
    if (!lock) throw new StudyError("otherTab");
    if (recover) completePendingResets(localStorage);
    // Validate every source used by the Dashboard before planning deletion.
    readStudyStore(); readStudyCheckpoints();
    const extra = readExtraActivity();
    if (extra && languages.includes(extra.language)) throw new StudyError("resetActive");
    const guard = (index: number): Promise<T> => {
      if (index === STUDY_MODULES.length) return Promise.resolve(operation(languages));
      const module = STUDY_MODULES[index];
      return locks.request(STUDY_KEY + "control:" + module, { ifAvailable: true }, control => {
        if (!control) {
          const current = readJSON(localStorage, STUDY_KEY + "active:" + module);
          // A held control with no checkpoint may be starting. Fail closed.
          if (!object(current) || !isStudentLanguage(current.language) || languages.includes(current.language)) throw new StudyError("resetActive");
        }
        return guard(index + 1);
      });
    };
    return guard(0);
  });
}
export async function checkStudyReset(scope: StudyResetScope): Promise<void> {
  await protectReset(scope, () => undefined, false);
}
function resetRecords(languages: StudentLanguage[]) {
  return Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
    .filter((key): key is string => !!key && dashboardResetKey(key)).sort().flatMap(key => {
      const raw = localStorage.getItem(key)!;
      return languages.includes(dashboardRecordLanguage(key, JSON.parse(raw))) ? [[key, raw] as const] : [];
    });
}
export function readStudyResetImpact(scope: StudyResetScope) {
  const languages = resetLanguages(scope), data = studyDataWithCheckpoints(readStudyStore().studyData, readStudyCheckpoints());
  const rows = languages.map(language => {
    const sessions = data.sessions.filter(item => item.language === language);
    const manualAdjustments = data.manualAdjustments.filter(item => item.language === language);
    return { language, seconds: totalSeconds({ ...data, sessions, manualAdjustments }), sessions: sessions.length, adjustments: manualAdjustments.length };
  });
  return { fingerprint: JSON.stringify(resetRecords(languages)), rows,
    seconds: rows.reduce((sum, row) => sum + row.seconds, 0), sessions: rows.reduce((sum, row) => sum + row.sessions, 0),
    adjustments: rows.reduce((sum, row) => sum + row.adjustments, 0) };
}
export async function resetStudyData(scope: StudyResetScope, expectedImpact?: string): Promise<void> {
  try {
    await protectReset(scope, languages => {
      if (expectedImpact !== undefined && expectedImpact !== JSON.stringify(resetRecords(languages))) throw new StudyError("stale");
      const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
        .filter((key): key is string => !!key && dashboardResetKey(key));
      const plan = languages.map(language => ({ language, keys: keys.filter(key => {
        const value = JSON.parse(localStorage.getItem(key)!);
        return dashboardRecordLanguage(key, value) === language;
      }) }));
      for (const { language, keys } of plan) {
        localStorage.setItem(STUDY_KEY + "reset:" + language, JSON.stringify({ generation: newStudyId(), keys }));
      }
      completePendingResets(localStorage);
    });
  } catch (error) {
    if (error instanceof StudyError) throw error;
    throw new StudyError("storage");
  } finally { window.dispatchEvent(new Event(STUDY_CHANGED)); }
}
function readJSON(storage: StorageLike, key: string, excluded = pendingResetKeys(storage)): unknown {
  if (excluded.has(key)) return null;
  const raw = storage.getItem(key);
  return raw === null ? null : JSON.parse(raw);
}
export function readExtraActivity(storage: StorageLike = localStorage, excluded = pendingResetKeys(storage)): ExtraActivityDraft | null {
  try {
    const raw = readJSON(storage, STUDY_KEY + "active:extra-activities", excluded);
    if (raw === null) return null;
    const draft = extraDraft(raw);
    return storage.getItem(recordKey("session", draft.id)) === null ? draft : null;
  } catch (error) {
    if (error instanceof StudyError) throw error;
    if (error instanceof SyntaxError) return invalid();
    throw new StudyError("storage");
  }
}
export function readStudyStore(storage: StorageLike = localStorage, module?: StudyModule): StudyStore {
  try {
    const result = emptyStore();
    const excluded = pendingResetKeys(storage);
    const generations = readResetGenerations(storage);
    if (Object.keys(generations).length) result.resetGeneration = generations;
    result.extraActivity = readExtraActivity(storage, excluded);
    if (module && module !== "extra-activities") result.activeSession = readJSON(storage, STUDY_KEY + "active:" + module, excluded) as StudySession | null;
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((k): k is string => !!k && k.startsWith(STUDY_KEY));
    for (const key of keys.sort()) {
      const value = readJSON(storage, key, excluded);
      if (value === null) continue;
      if (key.startsWith(STUDY_KEY + "session:")) {
        const item = session(value);
        if (key !== recordKey("session", item.id)) return invalid();
        result.studyData.sessions.push(item);
      } else if (key.startsWith(STUDY_KEY + "adjustment:")) {
        const item = adjustment(value);
        if (key !== recordKey("adjustment", item.id)) return invalid();
        result.studyData.manualAdjustments.push(item);
      }
      else if (key.startsWith(STUDY_KEY + "goal:")) {
        const language = decodeURIComponent(key.slice((STUDY_KEY + "goal:").length));
        if (!isStudentLanguage(language) || !object(value)) return invalid();
        // An empty goal record explicitly clears the built-in default after restoration.
        if (value.total === undefined) delete result.studyData.goals[language];
        else Object.assign(result.studyData.goals, goals({ [language]: value.total }));
        if (value.monthly !== undefined) Object.assign(result.studyData.monthlyGoals, goals({ [language]: value.monthly }));
      }
    }
    // History precedes draft removal. A crash between writes cannot resurrect it.
    if (result.activeSession && result.studyData.sessions.some(s => s.id === result.activeSession!.id)) result.activeSession = null;
    if (result.activeSession && result.activeSession.module !== module) return invalid();
    if (result.extraActivity && result.studyData.sessions.some(s => s.id === result.extraActivity!.id)) result.extraActivity = null;
    return validateStore(result);
  } catch (error) {
    if (error instanceof StudyError) throw error;
    if (error instanceof SyntaxError) return invalid();
    throw new StudyError("storage");
  }
}
// Confirmed checkpoints are visible progress, but remain separate from completed
// history and backups. Never estimate wall time for internal activity here.
export function readStudyCheckpoints(storage: StorageLike = localStorage): StudySession[] {
  try {
    const checkpoints: StudySession[] = [];
    const excluded = pendingResetKeys(storage);
    for (const module of STUDY_MODULES) {
      if (module === "extra-activities") continue; // Its draft has a separate shape.
      const raw = readJSON(storage, STUDY_KEY + "active:" + module, excluded);
      if (raw === null) continue;
      const item = session(raw);
      if (item.module !== module) return invalid();
      if (item.activeSeconds > 0) checkpoints.push(item);
    }
    const extra = readExtraActivity(storage, excluded);
    if (extra && extra.accumulatedMs >= 1000) {
      // Only the durable accumulated part is confirmed, never an estimated gap.
      checkpoints.push(finishExtra({ ...extra, state: "paused", runningSince: null, recoveryAt: undefined },
        Date.parse(extra.updatedAt), Math.floor(extra.accumulatedMs / 1000)));
    }
    return checkpoints;
  } catch (error) {
    if (error instanceof StudyError) throw error;
    if (error instanceof SyntaxError) return invalid();
    throw new StudyError("storage");
  }
}
export function studyDataWithCheckpoints(data: StudyData, checkpoints: StudySession[]): StudyData {
  const sessions = new Map(data.sessions.map(item => [item.id, item]));
  for (const checkpoint of checkpoints) if (!sessions.has(checkpoint.id)) sessions.set(checkpoint.id, checkpoint);
  return { ...data, sessions: [...sessions.values()] };
}
function entries(store: StudyStore, module?: StudyModule): Map<string, string> {
  const values = new Map<string, string>();
  const add = (key: string, value: unknown) => { if (value != null) values.set(key, JSON.stringify(value)); };
  for (const item of store.studyData.sessions) add(recordKey("session", item.id), item);
  for (const item of store.studyData.manualAdjustments) add(recordKey("adjustment", item.id), item);
  for (const language of new Set([...Object.keys(store.studyData.goals), ...Object.keys(store.studyData.monthlyGoals)])) {
    const key = language as StudentLanguage;
    add(recordKey("goal", key), { total: store.studyData.goals[key], monthly: store.studyData.monthlyGoals[key] });
  }
  add(STUDY_KEY + "active:extra-activities", store.extraActivity);
  if (module && module !== "extra-activities") add(STUDY_KEY + "active:" + module, store.activeSession);
  return values;
}
export function writeStudyStore(store: StudyStore, storage: StorageLike = localStorage, previous = readStudyStore(storage), module?: StudyModule, expectedGenerations = store.resetGeneration): void {
  const next = validateStore(store), before = entries(previous, module), after = entries(next, module);
  const generations = readResetGenerations(storage);
  for (const [key, value] of after) {
    if (before.get(key) === value || key.startsWith(STUDY_KEY + "goal:")) continue;
    const language = (JSON.parse(value) as { language: string }).language;
    if ((next.resetGeneration?.[language] ?? "") !== (generations[language] ?? "") ||
      (expectedGenerations?.[language] ?? "") !== (generations[language] ?? "")) throw new StudyError("stale");
  }
  for (const item of next.studyData.sessions) {
    const raw = storage.getItem(recordKey("session", item.id));
    if (raw && JSON.stringify(session(JSON.parse(raw))) !== JSON.stringify(item)) throw new StudyError("conflict");
    if (!raw && item.module !== module) {
      const active = readJSON(storage, STUDY_KEY + "active:" + item.module);
      if (object(active) && active.id === item.id) throw new StudyError("stale");
    }
  }
  try {
    for (const [key, value] of after) if (before.get(key) !== value) storage.setItem(key, value);
    for (const key of before.keys()) if (!after.has(key) && !key.startsWith(STUDY_KEY + "session:")) storage.removeItem(key);
  } catch { throw new StudyError("storage"); }
}
export async function updateStudyStore(change: (store: StudyStore) => StudyStore, module?: StudyModule, expectedGenerations = readResetGenerations()): Promise<StudyStore> {
  // Short transaction lock, independent of the long-lived module control locks.
  const locks = getStudyLocks();
  if (!locks) throw new StudyError("unsupported");
  return locks.request("bej-study-v2:write", { controlResource: module }, lock => {
    if (!lock) throw new StudyError("otherTab");
    completePendingResets(localStorage);
    const previous = readStudyStore(localStorage, module);
    const next = change(structuredClone(previous));
    writeStudyStore(next, localStorage, previous, module, expectedGenerations);
    window.dispatchEvent(new Event(STUDY_CHANGED));
    return readStudyStore(localStorage, module);
  });
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
/** Consolidation keeps all local records and deduplicates incoming records by ID. */
export function consolidateStudyBackup(store: StudyStore, backup: StudyBackup, expected: string, preferIncomingGoals = false): StudyStore {
  if (store.extraActivity) throw new StudyError("extraActive");
  if (JSON.stringify(store) !== expected || store.activeSession) throw new StudyError("stale");
  const merge = mergeStudyData(store.studyData, backup.studyData, preferIncomingGoals);
  if (merge.conflicts.length) throw new StudyError("conflict");
  return { ...store, studyData: validateStudyData(merge.studyData) };
}

/** Explicit replacement of confirmed study records and goals, independent of merging. */
export async function restoreStudyBackup(backup: StudyBackup, expected: string): Promise<StudyStore> {
  const validated = parseStudyBackup(JSON.stringify(backup));
  try {
    return await protectReset({ scope: "all" }, languages => {
      const current = readStudyStore();
      if (JSON.stringify(current) !== expected) throw new StudyError("stale");
      // Also protect interrupted sessions that no longer hold a live control lock.
      if (STUDY_MODULES.some(module => localStorage.getItem(STUDY_KEY + "active:" + module) !== null)) throw new StudyError("resetActive");
      const next: StudyStore = { ...current, studyData: validated.studyData };
      const before = entries(current), after = entries(next);
      if (!after.has(recordKey("goal", "en-US"))) after.set(recordKey("goal", "en-US"), "{}");
      for (const language of languages) {
        const key = STUDY_KEY + "reset:" + language;
        const original = localStorage.getItem(key);
        if (original !== null) before.set(key, original);
        after.set(key, JSON.stringify({ generation: newStudyId(), keys: [] }));
      }
      const keys = new Set([...before.keys(), ...after.keys()]);
      // Preserve exact original bytes for rollback on a failed multi-key write.
      const originals = new Map([...keys].map(key => [key, localStorage.getItem(key)]));
      try {
        for (const [key, value] of after) if (originals.get(key) !== value) localStorage.setItem(key, value);
        for (const key of before.keys()) if (!after.has(key)) localStorage.removeItem(key);
        const result = readStudyStore();
        const actual = entries(result), planned = entries(next);
        if (actual.size !== planned.size || [...planned].some(([key, value]) => actual.get(key) !== value)) throw new StudyError("storage");
        return result;
      } catch (cause) {
        // Clear only owned keys, then restore the snapshot while all controls are locked.
        for (const key of keys) localStorage.removeItem(key);
        for (const [key, value] of originals) if (value !== null) localStorage.setItem(key, value);
        throw Object.assign(new StudyError("storage"), { cause });
      }
    });
  } catch (error) {
    if (error instanceof StudyError) throw error;
    throw new StudyError("storage");
  } finally { window.dispatchEvent(new Event(STUDY_CHANGED)); }
}
export function newStudyId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  return [...bytes].map((b, i) => ([4, 6, 8, 10].includes(i) ? "-" : "") + b.toString(16).padStart(2, "0")).join("");
}
