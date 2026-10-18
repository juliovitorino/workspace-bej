import { newStudyId, readExtraActivity, STUDY_CHANGED, isStudyStorageKey, StudyError, updateStudyStore, type StudyMode, type StudyModule, type StudySession, type StudyStore } from "./studyStorage";
import { advanceExtra, recoverExtra } from "./extraActivityTime";
import type { StudentLanguage } from "../../config/languages";
import { StudyLease } from "./studyLease";
import { readResetGenerations } from "./studyStorage";

export interface StudyContext { language: StudentLanguage; module: StudyModule; mode: StudyMode }
export interface StudyReading { seconds: number; state: "waiting" | "active" | "idle" | "unavailable" }
export const IDLE_MS = 3 * 60 * 1000;
export const CONTROL_RETRY_MS = 15000;
export function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// One interval accumulator for every module. Pausing keeps the stable session ID.
// Daily buckets preserve the actual local day even across midnight and pauses.
export class StudyClock {
  private current: (StudyContext & { id: string; startedAt: number }) | null = null;
  private last = 0;
  private enabled = false;
  private media = false;
  private dailyMs: Record<string, number> = {};
  constructor(private uuid = newStudyId) {}
  private interval(now: number, buckets: Record<string, number>) {
    if (!this.current || (!this.enabled && !this.media)) return;
    let start = this.last;
    const end = Math.max(start, (this.media || this.current.mode === "walking") ? now : Math.min(now, start + IDLE_MS));
    while (start < end) {
      const date = new Date(start), day = localDay(date);
      const until = Math.min(end, new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime());
      buckets[day] = (buckets[day] ?? 0) + until - start; start = until;
    }
  }
  snapshot(now: number, preview = true): StudySession | null {
    if (!this.current) return null;
    const buckets = { ...this.dailyMs };
    if (preview) this.interval(now, buckets);
    const dailySeconds = Object.fromEntries(Object.entries(buckets).map(([day, ms]) => [day, Math.floor(ms / 1000)]));
    return { ...this.current, startedAt: new Date(this.current.startedAt).toISOString(), endedAt: new Date(Math.max(now, this.current.startedAt)).toISOString(),
      dailySeconds, activeSeconds: Object.values(dailySeconds).reduce((a, b) => a + b, 0) };
  }
  commit(now: number): StudySession | null {
    const effective = Math.max(now, this.last);
    this.interval(effective, this.dailyMs); this.last = effective;
    return this.snapshot(effective, false);
  }
  isIdle(now: number) { return this.current?.mode !== "walking" && !this.media && this.enabled && now - this.last >= IDLE_MS; }
  setMedia(playing: boolean, now: number, resuming = false) {
    if (playing === this.media) return;
    if (playing && resuming) this.last = Math.max(now, this.last);
    else this.commit(now);
    this.media = playing;
  }
  set(context: StudyContext | null, active: boolean, now: number, _until = Infinity): StudySession | null {
    const same = context && this.current && context.language === this.current.language && context.module === this.current.module && context.mode === this.current.mode;
    if (same) {
      if (active !== this.enabled) { this.commit(now); this.enabled = active; }
      return null;
    }
    const previous = this.commit(now);
    this.current = context && active ? { ...context, id: this.uuid(), startedAt: now } : null;
    this.dailyMs = {}; this.last = now; this.enabled = !!this.current && active; this.media = false;
    return previous;
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
function tabStudyOwner() {
  try {
    const key = "bej-study-v2:tab-owner", previous = sessionStorage.getItem(key);
    if (previous) return previous;
    const id = newStudyId(); sessionStorage.setItem(key, id); return id;
  } catch { return newStudyId(); }
}
export class StudyTracker {
  readonly extraOwner = tabStudyOwner();
  private mediaTokens = new Set<string>();
  private lastInteractionWrite = -Infinity;
  private clock = new StudyClock();
  private clockLanguage: StudentLanguage | null = null;
  private clockGeneration = "";
  private context: StudyContext | null = null;
  private active = false;
  private until = Infinity;
  private blocked = false;
  private started = false;
  private failed = false;
  private lease: StudyLease | null = null;
  private extraLease: StudyLease | null = null;
  private extraView = false;
  private queue: Promise<unknown> = Promise.resolve();
  private transition: Promise<void> = Promise.resolve();
  private acquiring = false;
  private closing: Promise<unknown> = Promise.resolve();
  private desiredModule: StudyModule | null = null;
  private listeners = new Set<(status: string) => void>();
  private status = "";
  subscribe(listener: (status: string) => void) { this.listeners.add(listener); listener(this.status); return () => { this.listeners.delete(listener); }; }
  private report(status: string) { this.status = status; this.listeners.forEach(listener => listener(status)); }
  hasControl() { return !this.failed && this.lease?.resource === this.desiredModule && !!this.lease?.owns(); }
  isViewing(module: StudyModule, language: StudentLanguage) { return this.context?.module === module && this.context.language === language; }
  requireControl() { if (!this.hasControl()) throw new StudyError(this.failed ? "storage" : "otherTab"); }
  hasExtraControl() { return !this.failed && !!this.extraLease?.owns(); }
  requireExtraControl() { if (!this.hasExtraControl()) throw new StudyError(this.failed ? "storage" : "otherTab"); }
  readSession(context: StudyContext): StudyReading {
    if (!this.hasControl()) return { seconds: 0, state: "unavailable" };
    if (!this.context || this.context.module !== context.module || this.context.language !== context.language || this.context.mode !== context.mode) return { seconds: 0, state: "waiting" };
    const now = Date.now(), current = this.clock.snapshot(now);
    return { seconds: current?.activeSeconds ?? 0, state: this.blocked ? "unavailable" : !current ? "waiting" : !this.clock.isIdle(now) && (this.active || this.mediaTokens.size > 0) ? "active" : this.clock.isIdle(now) ? "idle" : "unavailable" };
  }
  private enqueue(change: (store: StudyStore) => StudyStore, lease = this.lease) {
    if (!lease) return Promise.resolve();
    const generations = readResetGenerations();
    this.queue = this.queue.then(() => updateStudyStore(store => {
      if (!lease.owns()) throw new StudyError("otherTab");
      return change(store);
    }, lease.resource as StudyModule, generations)).catch(error => {
      if (error?.code === "stale") { this.syncClock(); return; }
      if (error?.code === "otherTab") {
        if (this.lease === lease) { this.lease = null; this.clock = new StudyClock(); }
        if (this.extraLease === lease) this.extraLease = null;
        lease.release();
        if (this.started) this.report("otherTab");
        return;
      }
      this.failed = true; this.clock = new StudyClock(); this.mediaTokens.clear();
      this.report(error instanceof StudyError ? error.code : "storage");
      lease.release();
    });
    return this.queue;
  }
  private syncClock() {
    if (!this.hasControl()) return;
    const generations = readResetGenerations();
    if (this.clockLanguage && this.clockGeneration !== (generations[this.clockLanguage] ?? "")) {
      this.clock = new StudyClock(); this.mediaTokens.clear();
    }
    const finished = this.clock.set(this.context, this.active, Date.now(), this.until);
    this.clockLanguage = this.context?.language ?? null;
    this.clockGeneration = this.clockLanguage ? generations[this.clockLanguage] ?? "" : "";
    if (finished) void this.enqueue(store => ({ ...append(store, finished), activeSession: null }));
  }
  setExtraView(value: boolean) {
    if (value !== this.extraView) this.checkpointExtra();
    this.extraView = value;
    if (!value && this.extraLease?.owns() && !readExtraActivity()) {
      this.extraLease.release(); this.extraLease = null;
    }
    if (this.started && value) void this.acquireExtraControl().catch(error => this.report(error instanceof StudyError ? error.code : "storage"));
  }
  async acquireExtraControl() {
    if (this.failed) throw new StudyError("storage");
    await this.closing;
    if (!this.started) throw new StudyError("otherTab");
    const lease = this.extraLease ??= new StudyLease("extra-activities");
    if (!await lease.claim()) { this.report("otherTab"); throw new StudyError("otherTab"); }
    if (!this.started || this.extraLease !== lease) {
      lease.release(); throw new StudyError("otherTab");
    }
    await updateStudyStore(store => {
      if (!lease.owns()) throw new StudyError("otherTab");
      return recoverExtra(store, this.extraOwner, Date.now());
    }, "extra-activities");
    this.report("");
  }
  set(context: StudyContext | null, active: boolean, until = Infinity, blocked = false) {
    const wasActive = this.active;
    this.context = context; this.active = active; this.until = until; this.blocked = blocked;
    const module = context?.module ?? null;
    if (module !== this.desiredModule) {
      if (this.status === "otherTab") this.report("");
      this.desiredModule = module;
      this.transition = this.transition.then(async () => {
        if (this.lease && this.lease.resource !== this.desiredModule) {
          const old = this.lease, finished = this.clock.finish(Date.now());
          this.mediaTokens.clear();
          if (old.owns()) await this.enqueue(store => ({ ...append(store, finished), activeSession: null }), old);
          old.release(); this.lease = null;
        }
        await this.acquireModule();
      }).catch(error => {
        this.failed = !(error instanceof StudyError && error.code === "otherTab");
        this.report(error instanceof StudyError ? error.code : "storage");
      });
    } else {
      this.syncClock();
      if (wasActive && !active && this.hasControl()) {
        const checkpoint = this.clock.snapshot(Date.now());
        void this.enqueue(store => ({ ...store, activeSession: checkpoint }));
      }
    }
  }
  private async acquireModule() {
    await this.closing;
    if (!this.started || this.failed || !this.desiredModule) return;
    const module = this.desiredModule;
    const lease = this.lease ??= new StudyLease(module);
    if (lease.resource !== module) return;
    if (this.acquiring) return;
    if (lease.owns()) { this.syncClock(); if (this.status === "otherTab") this.report(""); return; }
    this.acquiring = true;
    try {
      if (!await lease.claim()) { this.report("otherTab"); return; }
      if (!this.started || module !== this.desiredModule || this.lease !== lease) {
        lease.release(); if (this.lease === lease) this.lease = null; return;
      }
      await this.enqueue(recoverCheckpoint, lease);
      if (this.failed || !lease.owns()) return;
      this.syncClock(); this.checkpoint(); this.report("");
    } finally { this.acquiring = false; }
  }
  interact(now = Date.now()) {
    if (this.hasControl()) {
      this.syncClock(); this.clock.commit(now);
      if (now - this.lastInteractionWrite >= 250) {
        this.lastInteractionWrite = now; this.checkpoint();
      }
      this.notifyReading();
    }
    this.interactExtra(now);
  }
  interactExtra(now = Date.now()) {
    if (this.hasExtraControl() && now - this.lastExtraWrite >= 250) {
      this.lastExtraWrite = now; this.checkpointExtra();
    }
  }
  private lastExtraWrite = -Infinity;
  private notifyReading() { this.listeners.forEach(listener => listener(this.status)); }
  media(token: string, playing: boolean, resuming = false) {
    if (!this.hasControl()) return;
    if (!playing && !this.mediaTokens.has(token)) return;
    if (playing && this.context) this.clock.set(this.context, true, Date.now());
    if (playing) this.mediaTokens.add(token); else this.mediaTokens.delete(token);
    this.clock.setMedia(this.mediaTokens.size > 0, Date.now(), resuming);
    if (!playing) this.clock.set(this.context, this.active, Date.now());
    this.checkpoint(); this.notifyReading();
  }
  checkpoint() {
    if (this.hasControl()) {
      this.syncClock();
      const checkpoint = this.clock.commit(Date.now());
      if (checkpoint) void this.enqueue(store => ({ ...store, activeSession: checkpoint }));
    }
    this.checkpointExtra();
  }
  private checkpointExtra() {
    if (this.hasExtraControl()) {
      const now = Date.now(), lease = this.extraLease!;
      void this.enqueue(store => {
        const draft = store.extraActivity;
        return draft?.owner === this.extraOwner && !draft.recoveryAt && draft.state === "running" && now >= Date.parse(draft.updatedAt)
          ? { ...store, extraActivity: advanceExtra(draft, now) } : store;
      }, lease);
    }
  }
  async seal() {
    await this.transition;
    if (this.hasControl()) {
      const finished = this.clock.finish(Date.now());
      await this.enqueue(store => ({ ...append(store, finished), activeSession: null }));
      this.syncClock();
    }
    await this.queue;
    if (this.failed) throw new StudyError("storage");
  }
  start(): () => void {
    this.started = true; this.failed = false;
    const refresh = () => { try { this.syncClock(); } catch { this.failed = true; this.report("storage"); } };
    const externalStorage = (event: StorageEvent) => { if (isStudyStorageKey(event.key)) refresh(); };
    window.addEventListener(STUDY_CHANGED, refresh);
    window.addEventListener("storage", externalStorage);
    const retry = () => {
      void this.acquireModule().catch(error => this.report(error instanceof StudyError ? error.code : "storage"));
      if (this.extraView && !this.hasExtraControl()) void this.acquireExtraControl().catch(error => this.report(error instanceof StudyError ? error.code : "storage"));
    };
    retry();
    const timer = window.setInterval(retry, CONTROL_RETRY_MS);
    // Do not stop the external clock at pagehide. Its persisted timestamp covers
    // suspension; another controller must explicitly confirm crash recovery.
    const closeControls = () => {
      const lease = this.lease, extraLease = this.extraLease;
      const finished = this.clock.finish(Date.now());
      this.lease = null; this.extraLease = null;
      if (lease?.owns()) void this.enqueue(store => ({ ...append(store, finished), activeSession: null }), lease);
      this.closing = this.queue.finally(() => { lease?.release(); extraLease?.release(); });
    };
    const hide = () => { this.checkpoint(); this.started = false; closeControls(); };
    const show = () => { this.started = true; retry(); this.checkpoint(); this.notifyReading(); };
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    return () => {
      this.started = false;
      window.clearInterval(timer);
      window.removeEventListener(STUDY_CHANGED, refresh);
      window.removeEventListener("storage", externalStorage);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
      closeControls();
    };
  }
}
export const studyTracker = new StudyTracker();
export { STUDY_CHANGED };
