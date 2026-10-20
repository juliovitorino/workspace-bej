export const LAST_BACKUP_KEY = "bej-backup-reminder:last-export-at";
export const LAST_DISMISSED_KEY = "bej-backup-reminder:last-dismissed-day";
export const MONITORING_STARTED_KEY = "bej-backup-reminder:monitoring-started-at";
const WEEK = 7 * 24 * 60 * 60 * 1000;
export const BACKUP_REMINDER_CHANGED = "bej-backup-reminder-changed";
export function localBackupDay(now: Date) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
/** Memory fallback keeps navigation available when browser storage is unavailable. */
export function createBackupReminder(storage: () => Pick<Storage, "getItem" | "setItem">) {
  const memory = new Map<string, string>();
  const read = (key: string) => { try { return storage().getItem(key) ?? memory.get(key) ?? null; } catch { return memory.get(key) ?? null; } };
  const write = (key: string, value: string) => { memory.set(key, value); try { storage().setItem(key, value); } catch { /* Reminder preferences are optional. */ } };
  const validTime = (value: string | null, now: Date) => {
    const time = value && /^\d{4}-\d{2}-\d{2}T/.test(value) ? Date.parse(value) : NaN;
    return Number.isFinite(time) && time <= now.getTime() ? time : null;
  };
  return {
    due(now = new Date()) {
      let start = validTime(read(MONITORING_STARTED_KEY), now);
      if (start === null) { start = now.getTime(); write(MONITORING_STARTED_KEY, now.toISOString()); }
      const exported = validTime(read(LAST_BACKUP_KEY), now);
      return now.getTime() - (exported ?? start) > WEEK && read(LAST_DISMISSED_KEY) !== localBackupDay(now);
    },
    dismiss(now = new Date()) { write(LAST_DISMISSED_KEY, localBackupDay(now)); },
    exported(now = new Date()) {
      write(LAST_BACKUP_KEY, now.toISOString());
      if (typeof window !== "undefined") window.dispatchEvent(new Event(BACKUP_REMINDER_CHANGED));
    }
  };
}
export const backupReminder = createBackupReminder(() => localStorage);
