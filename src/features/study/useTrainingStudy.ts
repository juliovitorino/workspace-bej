import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { IDLE_MS } from "./studyTrackingService";

export type TrainingStudyReporter = (active: boolean, mode?: "manual" | "walking", activeUntil?: number) => void;

// Reading corrections is activity for the same grace window used by Hashmap.
// Network-only waits pause the existing session, without discarding its ID.
export class TrainingActivity {
  private interactions = 0;
  private until = 0;
  private pending = false;
  private pendingAt = 0;
  private media = false;
  interact(now: number) { this.interactions++; this.until = now + IDLE_MS; }
  update(pending: boolean, media: boolean, now: number) {
    if (pending && !this.pending) this.pendingAt = this.interactions;
    if (this.media && !media) this.until = now + IDLE_MS;
    this.pending = pending; this.media = media;
  }
  signal(now: number, ready: boolean) {
    const activeUntil = this.media ? Infinity : this.until;
    const active = ready && (this.media || this.interactions > 0) && now < activeUntil &&
      (!this.pending || this.media || this.interactions > this.pendingAt);
    return { active, activeUntil };
  }
}

export function useTrainingStudy(identity: string, ready: boolean, pending: boolean, media: boolean, report?: TrainingStudyReporter) {
  const activity = useRef({ identity, policy: new TrainingActivity() });
  if (activity.current.identity !== identity) activity.current = { identity, policy: new TrainingActivity() };
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const now = Date.now();
    activity.current.policy.update(pending, media, now);
    const signal = activity.current.policy.signal(now, ready);
    report?.(signal.active, "manual", signal.activeUntil);
  }, [identity, ready, pending, media, revision, report]);
  useEffect(() => () => report?.(false, "manual", 0), [identity, report]);
  const recordActivity = () => {
    if (!ready || activity.current.identity !== identity) return;
    activity.current.policy.interact(Date.now());
    setRevision(value => value + 1);
  };
  const interact = (event: SyntheticEvent) => { if (event.isTrusted) recordActivity(); };
  // Let the field's handlers save its controlled value before tracking schedules
  // another render. Input capture can restore the old value before onChange.
  return { recordActivity, onPointerDown: interact, onKeyDown: interact, onInput: interact, onScrollCapture: interact };
}
