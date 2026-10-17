import { StudyError } from "./studyStorage";

export const STUDY_LEASE_KEY = "bej-study-tracking-lease";
export const LEASE_MS = 45000;
type LeaseStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

// Advisory fallback only: localStorage has no compare-and-swap operation.
// Check ownership before every tracking write and expire abandoned owners.
export class StudyLease {
  constructor(private storage: LeaseStorage, private token: string) {}
  private read(): { token: string; expiresAt: number } | null {
    let raw: string | null;
    try { raw = this.storage.getItem(STUDY_LEASE_KEY); } catch { throw new StudyError("storage"); }
    if (!raw) return null;
    try {
      const value = JSON.parse(raw);
      return value && typeof value.token === "string" && Number.isFinite(value.expiresAt) ? value : null;
    } catch { return null; }
  }
  owns(now = Date.now()): boolean {
    const lease = this.read();
    return lease?.token === this.token && lease.expiresAt > now;
  }
  claim(now = Date.now()): boolean {
    const previous = this.read();
    if (previous && previous.token !== this.token && previous.expiresAt > now) return false;
    return this.write(now);
  }
  renew(now = Date.now()): boolean { return this.owns(now) && this.write(now); }
  private write(now: number): boolean {
    try { this.storage.setItem(STUDY_LEASE_KEY, JSON.stringify({ token: this.token, expiresAt: now + LEASE_MS })); }
    catch { throw new StudyError("storage"); }
    return this.owns(now);
  }
  release() {
    if (this.read()?.token !== this.token) return;
    try { this.storage.removeItem(STUDY_LEASE_KEY); } catch { /* Expiry still permits recovery. */ }
  }
}
