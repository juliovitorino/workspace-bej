import { StudyCollapseToggle } from "./StudyCollapseToggle";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { backupReminder } from "../../utils/backupReminder";
import { exportStudyBackup } from "./exportStudyBackup";
import { readStudyStore, STUDY_CHANGED } from "./studyStorage";
import { languageName } from "../../i18n";
import { applySync, authorizeDrive, clearPendingDrivePublication, combineSyncFiles, createSnapshot, deviceId, folderId, GOOGLE_CLIENT_ID, listSyncFiles, markPendingDrivePublication, pendingDrivePublication, publishCurrentSnapshot, readSyncFile, saveFolder, studySyncDiagnostics, syncBaseline, type SyncBaseline, type SyncFile } from "./studyDriveSync";

type Preview = { baseline: SyncBaseline; local: SyncFile; merged: ReturnType<typeof combineSyncFiles>; token: string; folder: string; remoteCount: number };
function formatSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  return hours + "h " + minutes + "min " + (seconds % 60) + "s";
}
export function StudyDriveSync({ allSectionsExpanded }: { allSectionsExpanded?: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  useEffect(() => { if (allSectionsExpanded !== undefined) setOpen(allSectionsExpanded); }, [allSectionsExpanded]);
  const [folderInput, setFolderInput] = useState(() => folderId());
  const [folder, setFolder] = useState(() => folderId());
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(() => pendingDrivePublication());
  const [diagnostics, setDiagnostics] = useState(() => studySyncDiagnostics());
  useEffect(() => {
    const refresh = () => setDiagnostics(studySyncDiagnostics());
    window.addEventListener(STUDY_CHANGED, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(STUDY_CHANGED, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  async function action(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(""); setMessage(""); setPreview(null);
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  function registerFolder() {
    try { const id = saveFolder(folderInput); setFolder(id); setPreview(null); setError(""); setMessage(t("driveSync.folderSaved")); }
    catch { setError(t("driveSync.invalidFolder")); }
  }
  async function exportDrive() {
    const token = await authorizeDrive();
    await publishCurrentSnapshot(token, folder);
    clearPendingDrivePublication(folder);
    setPending(pendingDrivePublication());
    backupReminder.exported();
    setMessage(t("driveSync.exported"));
  }
  async function inspectDrive() {
    const token = await authorizeDrive();
    const local = await createSnapshot();
    const baseline = syncBaseline();
    if (readStudyStore().extraActivity) throw new Error(t("study.errors.extraActive"));
    if (JSON.stringify(local.study.studyData) !== JSON.stringify(readStudyStore().studyData) ||
        JSON.stringify(local.favorites) !== baseline.favorites ||
        JSON.stringify(local.wyrAnswers ?? {}) !== baseline.wyrAnswers) throw new Error(t("study.errors.stale"));
    const files = await listSyncFiles(token, folder);
    const incoming = await Promise.all(files.map(f => readSyncFile(token, f)));
    if (JSON.stringify(syncBaseline()) !== JSON.stringify(baseline)) throw new Error(t("study.errors.stale"));
    const merged = combineSyncFiles(local, incoming);
    setPreview({ baseline, local, merged, token, folder, remoteCount: incoming.length });
  }
  async function confirmSync() {
    if (!preview) return;
    if (preview.merged.conflicts.length) throw new Error(t("study.errors.conflict"));
    // Safety copy is initiated before any local write.
    await exportStudyBackup();
    await applySync(preview.merged, preview.baseline);
    // The local merge is committed. A network failure is a publication failure,
    // not a rolled-back synchronization.
    const publication = markPendingDrivePublication(preview.folder);
    setPending(publication);
    try {
      await publishCurrentSnapshot(preview.token, preview.folder);
      clearPendingDrivePublication(preview.folder);
      setPending(null);
      setMessage(t("driveSync.synced"));
    } catch (cause) {
      setMessage(t("driveSync.localSavedPending"));
      throw cause;
    }
  }
  async function retryPublication() {
    if (!pending || pending.folder !== folder) return;
    const token = await authorizeDrive(); // Do not reuse an expired OAuth token.
    await publishCurrentSnapshot(token, pending.folder);
    clearPendingDrivePublication(pending.folder);
    setPending(null);
    setMessage(t("driveSync.published"));
  }
  return <section className="study-panel bej-drive-sync">
    <StudyCollapseToggle expanded={open} onToggle={() => setOpen(v => !v)} title={t("driveSync.title")} />
    {open && <>
    <p>{t("driveSync.description")}</p>
    {!GOOGLE_CLIENT_ID && <p className="study-note" role="note">{t("driveSync.notConfigured")}</p>}
    <label>{t("driveSync.folderLabel")}
      <input type="text" value={folderInput} disabled={busy} onChange={e => setFolderInput(e.target.value)} placeholder="https://drive.google.com/drive/folders/..." />
    </label>
    <div className="study-actions">
      <button className="secondary-button" type="button" disabled={busy} onClick={registerFolder}>{t("driveSync.saveFolder")}</button>
    </div>
    {folder && <p className="study-note">{t("driveSync.device")}: <code>{deviceId()}</code></p>}
    {pending?.folder === folder && <div className="status-card" role="status">
      <p>{t("driveSync.localSavedPending")}</p>
      <div className="study-actions">
        <button className="primary-button" type="button" disabled={busy || !GOOGLE_CLIENT_ID}
          onClick={() => void action(retryPublication)}>{t("driveSync.retryPublish")}</button>
      </div>
    </div>}
    {folder && <div className="study-actions">
      <button className="secondary-button" type="button" disabled={busy || !GOOGLE_CLIENT_ID} onClick={() => void action(exportDrive)}>{t("driveSync.export")}</button>
      <button className="primary-button" type="button" disabled={busy || !GOOGLE_CLIENT_ID} onClick={() => void action(inspectDrive)}>{t("driveSync.sync")}</button>
    </div>}
    {busy && <p role="status">{t("driveSync.wait")}</p>}
    {error && <p className="status-card error-card" role="alert">{error}</p>}
    {message && <p className="study-feedback" role="status">{message}</p>}
    {preview && <div className="study-preview">
      <h4>{t("driveSync.preview")}</h4>
      <dl>
        <div><dt>{t("driveSync.files")}</dt><dd>{preview.remoteCount}</dd></div>
        <div><dt>{t("study.newSessions")}</dt><dd>{preview.merged.newSessions}</dd></div>
        <div><dt>{t("study.newAdjustments")}</dt><dd>{preview.merged.newAdjustments}</dd></div>
        <div><dt>{t("driveSync.favorites")}</dt><dd>{preview.merged.favorites.length}</dd></div>
        <div><dt>{t("study.conflicts")}</dt><dd>{preview.merged.conflicts.length}</dd></div>
      </dl>
      {!!preview.merged.conflicts.length && <p role="alert">{t("driveSync.conflictNote")}</p>}
      <p className="study-note">{t("driveSync.mergeNote")}</p>
      <div className="study-actions">
        <button className="primary-button" type="button" disabled={busy || !!preview.merged.conflicts.length} onClick={() => void action(confirmSync)}>{t("driveSync.confirm")}</button>
        <button className="secondary-button" type="button" disabled={busy} onClick={() => setPreview(null)}>{t("study.cancel")}</button>
      </div>
    </div>}
    <details className="study-note">
      <summary>{t("driveSync.diagnosticTitle")}</summary>
      <p>{t("driveSync.diagnosticNote")}</p>
      {diagnostics.rows.map(row => <div key={row.language}>
        <strong>{languageName(row.language)}</strong>
        <dl>
          <div><dt>{t("driveSync.completedTime")}</dt><dd>{formatSeconds(row.completedSeconds)}</dd></div>
          <div><dt>{t("driveSync.checkpointTime")}</dt><dd>{formatSeconds(row.checkpointSeconds)}</dd></div>
          <div><dt>{t("driveSync.visibleTime")}</dt><dd>{formatSeconds(row.completedSeconds + row.checkpointSeconds)}</dd></div>
        </dl>
        {row.checkpoints.length > 0 && <ul>{row.checkpoints.map(item =>
          <li key={item.id}>{item.module} — {formatSeconds(item.activeSeconds)} (<code>{item.id}</code>)</li>
        )}</ul>}
      </div>)}
    </details>
    <p className="study-note">{t("driveSync.permissionNote")}</p>
    </>}
  </section>;
}
