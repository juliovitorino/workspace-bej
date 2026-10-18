import { StudyError } from "./studyStorage";
import { getStudyLocks } from "./studyLocks";

export const STUDY_LEASE_KEY = "bej-study-v2:control:";
// Controls remain held during background throttling. Both Web Locks and the
// HTTP coordinator arbitrate acquisition; localStorage is never used as a mutex.
export class StudyLease {
  private held = false;
  private pending: Promise<boolean> | null = null;
  private releaseLock: (() => void) | null = null;
  private disposed = false;
  constructor(readonly resource: string) {}
  owns(): boolean { return this.held && !this.disposed; }
  claim(): Promise<boolean> {
    if (this.disposed) return Promise.resolve(false);
    if (this.owns()) return Promise.resolve(true);
    if (this.pending) return this.pending;
    const locks = getStudyLocks();
    if (!locks) return Promise.reject(new StudyError("unsupported"));
    this.pending = new Promise<boolean>((resolve, reject) => {
      void locks.request(STUDY_LEASE_KEY + this.resource, { ifAvailable: true }, async lock => {
        if (!lock || this.disposed) { resolve(false); return; }
        this.held = true;
        await new Promise<void>(release => { this.releaseLock = release; resolve(true); });
        this.held = false;
      }).catch(() => reject(new StudyError("storage")));
    }).finally(() => { this.pending = null; });
    return this.pending;
  }
  release() {
    this.disposed = true;
    this.held = false;
    this.releaseLock?.();
  }
}
