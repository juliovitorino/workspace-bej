import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { exportStudyBackup } from "../features/study/exportStudyBackup";
import { StudyError } from "../features/study/studyStorage";

export function BackupReminderDialog({ onContinue, onDismiss }: { onContinue: () => void; onDismiss: () => void }) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const working = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);
  async function exportBackup() {
    if (working.current) return;
    working.current = true; setBusy(true); setError("");
    try { await exportStudyBackup(); onContinue(); }
    catch (e) { setError(t(`study.errors.${e instanceof StudyError ? e.code : "storage"}`)); }
    finally { working.current = false; setBusy(false); }
  }
  return <dialog ref={dialogRef} className="app-settings-dialog backup-reminder-dialog"
    aria-labelledby="backup-reminder-title" aria-describedby="backup-reminder-description" aria-modal="true"
    onCancel={event => { event.preventDefault(); if (!working.current) onDismiss(); }}>
    <h2 id="backup-reminder-title">{t("backupReminder.title")}</h2>
    <p id="backup-reminder-description">{t("backupReminder.message")}</p>
    {error && <p role="alert" className="status-card error-card">{error}</p>}
    <div className="backup-reminder-actions">
      <button type="button" className="primary-button" disabled={busy} onClick={() => void exportBackup()}>{t("backupReminder.export")}</button>
      <button type="button" className="secondary-button" autoFocus disabled={busy} onClick={onDismiss}>{t("backupReminder.later")}</button>
    </div>
  </dialog>;
}
