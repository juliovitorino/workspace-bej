import { useState } from "react";
import { useTranslation } from "react-i18next";
import { backupReminder } from "../../utils/backupReminder";
import { exportStudyBackup } from "./exportStudyBackup";
import { readStudyStore } from "./studyStorage";
import { applySync, authorizeDrive, combineSyncFiles, createSnapshot, deviceId, folderId, GOOGLE_CLIENT_ID, listSyncFiles, readSyncFile, saveFolder, uploadSnapshot, type SyncFile } from "./studyDriveSync";

type Preview = { baseline: string; local: SyncFile; merged: ReturnType<typeof combineSyncFiles>; token: string; folder: string; remoteCount: number };
export function StudyDriveSync() {
  const { t } = useTranslation();
  const [folderInput, setFolderInput] = useState(() => folderId());
  const [folder, setFolder] = useState(() => folderId());
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
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
    const files = await listSyncFiles(token, folder);
    const snapshot = await createSnapshot();
    await uploadSnapshot(token, folder, files, snapshot);
    backupReminder.exported();
    setMessage(t("driveSync.exported"));
  }
  async function inspectDrive() {
    const token = await authorizeDrive();
    const local = await createSnapshot();
    const baseline = JSON.stringify(readStudyStore());
    if (readStudyStore().extraActivity) throw new Error(t("study.errors.extraActive"));
    const files = await listSyncFiles(token, folder);
    const incoming = await Promise.all(files.map(f => readSyncFile(token, f)));
    if (JSON.stringify(readStudyStore()) !== baseline) throw new Error(t("study.errors.stale"));
    const merged = combineSyncFiles(local, incoming);
    setPreview({ baseline, local, merged, token, folder, remoteCount: incoming.length });
  }
  async function confirmSync() {
    if (!preview) return;
    if (preview.merged.conflicts.length) throw new Error(t("study.errors.conflict"));
    // Safety copy is initiated before any local write.
    await exportStudyBackup();
    await applySync(preview.merged, preview.baseline);
    // Publish consolidated state only after local merge succeeds.
    const files = await listSyncFiles(preview.token, preview.folder);
    await uploadSnapshot(preview.token, preview.folder, files, await createSnapshot());
    setMessage(t("driveSync.synced"));
  }
  return <section className="study-panel bej-drive-sync">
    <h3>{t("driveSync.title")}</h3>
    <p>{t("driveSync.description")}</p>
    {!GOOGLE_CLIENT_ID && <p className="study-note" role="note">{t("driveSync.notConfigured")}</p>}
    <label>{t("driveSync.folderLabel")}
      <input type="text" value={folderInput} disabled={busy} onChange={e => setFolderInput(e.target.value)} placeholder="https://drive.google.com/drive/folders/..." />
    </label>
    <div className="study-actions">
      <button className="secondary-button" type="button" disabled={busy} onClick={registerFolder}>{t("driveSync.saveFolder")}</button>
    </div>
    {folder && <p className="study-note">{t("driveSync.device")}: <code>{deviceId()}</code></p>}
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
    <p className="study-note">{t("driveSync.permissionNote")}</p>
  </section>;
}
