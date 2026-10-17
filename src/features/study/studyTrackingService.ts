import { newStudyId, STUDY_CHANGED, StudyError, updateStudyStore, type StudyMode, type StudyModule, type StudySession, type StudyStore } from "./studyStorage";
import type { StudentLanguage } from "../../config/languages";
import { StudyLease } from "./studyLease";

export interface StudyContext { language: StudentLanguage; module: StudyModule; mode: StudyMode }
export interface StudyReading { seconds: number; state: "waiting" | "active" | "idle" | "unavailable" }
export const IDLE_MS = 5 * 60 * 1000;
export const CHECKPOINT_MS = 15000;
export function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// One interval accumulator for every module. Pausing keeps the stable session ID.
// Daily buckets preserve the actual local day even across midnight and pauses.
export class StudyClock {
  private current: (StudyContext & { id: string; startedAt: number }) | null = null;
  private last = 0;
  private activeUntil = 0;
  private dailyMs: Record<string, number> = {};
  constructor(private uuid = newStudyId) {}
  private advance(now: number) {
    let start = this.last, end = Math.min(now, this.activeUntil);
    // A suspended process confirms at most one minute, never the whole sleep gap.
    end = Math.min(end, start + 60000);
    while (start < end && this.current) {
      const date = new Date(start), day = localDay(date);
      const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
      const until = Math.min(end, midnight);
      this.dailyMs[day] = (this.dailyMs[day] ?? 0) + until - start;
      start = until;
    }
    this.last = now;
  }
  snapshot(now: number): StudySession | null {
    this.advance(now);
    if (!this.current) return null;
    const dailySeconds = Object.fromEntries(Object.entries(this.dailyMs).map(([day, ms]) => [day, Math.floor(ms / 1000)]));
    return { ...this.current, startedAt: new Date(this.current.startedAt).toISOString(), endedAt: new Date(now).toISOString(),
      dailySeconds, activeSeconds: Object.values(dailySeconds).reduce((a, b) => a + b, 0) };
  }
  set(context: StudyContext | null, active: boolean, now: number, until = Infinity): StudySession | null {
    const previous = this.snapshot(now);
    const same = context && this.current && context.language === this.current.language && context.module === this.current.module && context.mode === this.current.mode;
    if (!same) {
      this.current = context && active ? { ...context, id: this.uuid(), startedAt: now } : null;
      this.dailyMs = {};
    } else if (!this.current && context && active) this.current = { ...context, id: this.uuid(), startedAt: now };
    this.last = now;
    this.activeUntil = active && this.current ? until : 0;
    return !same ? previous : null;
  }
  finish(now: number): StudySession | null { return this.set(null, false, now); }
}

function append(store: StudyStore, item: StudySession | null): StudyStore {
  if (!item || item.activeSeconds === 0) return store;
  const previous = store.studyData.sessions.find(s => s.id === item.id);
  if (previous && JSON.stringify(previous) !== JSON.stringify(item)) throw new StudyError("conflict");
  return previous ? store : { ...store, studyData: { ...store.studyData, sessions: [...store.studyData.sessions, item] } };
}
export function recoverCheckpoint(store: StudyStore): StudyStore {
  return { ...append(store, store.activeSession), activeSession: null };
}
class LostStudyLease extends Error {}

export class StudyTracker {
  private clock = new StudyClock();
  private owner = false;
  private queue: Promise<unknown> = Promise.resolve();
  private context: StudyContext | null = null;
  private active = false;
  private blocked = false;
  private until = Infinity;
  private listeners = new Set<(status: string) => void>();
  private status = "";
  private lease: StudyLease | null = null;
  private failed = false;
  readSession(context: StudyContext): StudyReading {
    if (!this.canTrack()) return { seconds: 0, state: "unavailable" };
    if (!this.context || this.context.module !== context.module || this.context.language !== context.language || this.context.mode !== context.mode) return { seconds: 0, state: "waiting" };
    const now = Date.now();
    const current = this.clock.snapshot(now);
    return { seconds: current?.activeSeconds ?? 0,
      state: this.blocked ? "unavailable" : !current ? "waiting" : this.active && now < this.until ? "active" : now >= this.until ? "idle" : "unavailable" };
  }
  private loseLease() {
    this.owner = false;
    this.clock = new StudyClock();
    this.report("otherTab");
  }
  private canTrack() {
    if (!this.owner) return false;
    try {
      if (this.lease && !this.lease.owns()) { this.loseLease(); return false; }
    } catch {
      this.owner = false; this.failed = true; this.clock = new StudyClock(); this.report("storage"); return false;
    }
    return true;
  }
  subscribe(listener: (status: string) => void) { this.listeners.add(listener); listener(this.status); return () => { this.listeners.delete(listener); }; }
  private report(status: string) { this.status = status; this.listeners.forEach(listener => listener(status)); }
  private enqueue(change: (store: StudyStore) => StudyStore) {
    const lease = this.lease;
    this.queue = this.queue.then(() => {
      if (lease && !lease.owns()) { this.loseLease(); return; }
      return updateStudyStore(store => {
        if (lease && !lease.owns()) throw new LostStudyLease();
        return change(store);
      }).then(() => { if (!lease || lease.owns()) this.report(""); });
    }).catch(error => {
      if (error instanceof LostStudyLease) { this.loseLease(); return; }
      this.report(error instanceof StudyError ? error.code : "storage");
      // Stop accumulation after a failed write; retain the last persisted checkpoint.
      this.clock = new StudyClock(); this.owner = false; this.failed = true;
    });
    return this.queue;
  }
  set(context: StudyContext | null, active: boolean, until = Infinity, blocked = false) {
    const wasActive = this.active;
    this.context = context; this.active = active; this.until = until; this.blocked = blocked;
    if (!this.canTrack()) return;
    const finished = this.clock.set(context, active, Date.now(), until);
    const checkpoint = this.clock.snapshot(Date.now());
    if (finished || (wasActive && !active)) void this.enqueue(store => ({ ...append(store, finished), activeSession: checkpoint }));
  }
  checkpoint() {
    if (!this.canTrack()) return;
    const checkpoint = this.clock.snapshot(Date.now());
    if (checkpoint) void this.enqueue(store => ({ ...store, activeSession: checkpoint }));
  }
  async seal() {
    if (!this.canTrack()) {
      await this.queue;
      if (["storage", "invalid", "version", "conflict"].includes(this.status)) throw new StudyError(this.status as "storage" | "invalid" | "version" | "conflict");
      return;
    }
    const finished = this.clock.finish(Date.now());
    await this.enqueue(store => ({ ...append(store, finished), activeSession: null }));
    if (this.status) throw new StudyError("storage");
    if (this.owner) this.clock.set(this.context, this.active, Date.now(), this.until);
  }
  start(): () => void {
    let disposed = false, release: (() => void) | undefined;
    this.failed = false;
    const fallback = typeof navigator.locks?.request !== "function";
    const lease = fallback ? new StudyLease(localStorage, newStudyId()) : null;
    this.lease = lease;
    let claiming = false;
    const tryFallback = async () => {
      if (!lease || disposed || claiming || this.failed) return;
      claiming = true;
      try {
        if (this.owner && lease.renew()) return;
        if (this.owner) this.loseLease();
        if (!lease.claim()) { this.report("otherTab"); return; }
        // Allow simultaneous contenders to observe the last claim before any
        // checkpoint recovery or history write. This reduces, not eliminates,
        // races on browsers without an atomic cross-tab locking primitive.
        await new Promise(resolve => window.setTimeout(resolve, 150));
        if (disposed) return;
        if (!lease.owns()) { this.report("otherTab"); return; }
        await this.enqueue(recoverCheckpoint);
        if (disposed || this.failed || !lease.owns()) return;
        this.owner = true;
        this.clock.set(this.context, this.active, Date.now(), this.until);
        this.report("");
      } catch { this.failed = true; this.owner = false; this.clock = new StudyClock(); this.report("storage"); }
      finally { claiming = false; }
    };
    const abort = new AbortController();
    const acquire = async () => {
      if (fallback) { await tryFallback(); return; }
      this.report("otherTab");
      try {
        await navigator.locks.request("bej-study-tracker", { signal: abort.signal }, async () => {
          if (disposed) return;
          await this.enqueue(recoverCheckpoint);
          if (disposed || this.status) return;
          this.owner = true;
          this.clock.set(this.context, this.active, Date.now(), this.until);
          this.report("");
          await new Promise<void>(resolve => { release = resolve; });
          this.owner = false;
        });
      } catch { if (!disposed) this.report("storage"); }
    };
    void acquire();
    const leaseTimer = fallback ? window.setInterval(() => { void tryFallback(); }, 5000) : undefined;
    const timer = window.setInterval(() => this.checkpoint(), CHECKPOINT_MS);
    // The periodic checkpoint is the guaranteed crash recovery boundary. pagehide
    // requests a final seal, but never relies on async work finishing at unload.
    const hide = () => { void this.seal().catch(() => {}); };
    window.addEventListener("pagehide", hide);
    return () => {
      disposed = true; abort.abort(); window.clearInterval(timer);
      if (leaseTimer !== undefined) window.clearInterval(leaseTimer);
      window.removeEventListener("pagehide", hide);
      void this.seal().catch(() => {}).finally(() => { release?.(); lease?.release(); });
    };
  }
}
export const studyTracker = new StudyTracker();
export { STUDY_CHANGED };
