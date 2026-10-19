import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { languageName } from "../../i18n";
import {
  backupOf, MAX_BACKUP_BYTES, mergeStudyData, parseStudyBackup, readStudyStore,
  consolidateStudyBackup, restoreStudyBackup, totalSeconds, STUDY_CHANGED, isStudyStorageKey, StudyError, updateStudyStore,
  type StudyBackup, type StudyStore
} from "./studyStorage";
import { studyTracker } from "./studyTrackingService";
import "./study.css";

/** Shared file controls, with independent consolidation and replacement operations. */
export function StudyDataTransfer({ settings = false, mode = "consolidate", disabled = false, onBusyChange, standalone = false, onOpenConsolidation, onBack }: {
  settings?: boolean; mode?: "consolidate" | "restore"; disabled?: boolean; onBusyChange?: (busy: boolean) => void;
  standalone?: boolean; onOpenConsolidation?: () => void; onBack?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const replacing = mode === "restore";
  const [consolidationStep, setConsolidationStep] = useState<"intro" | "file">("intro");
  const [store, setStore] = useState<StudyStore | null>(null);
  const [pending, setPending] = useState<{ backup: StudyBackup; baseline: string } | null>(null);
  const [incomingGoals, setIncomingGoals] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const working = useRef(false);
  const mounted = useRef(true);
  const fail = (e: unknown) => { setError(t(`study.errors.${e instanceof StudyError ? e.code : "storage"}`)); setMessage(""); };
  useEffect(() => {
    mounted.current = true;
    const refresh = () => {
      try { setStore(readStudyStore()); } catch (e) { setStore(null); fail(e); }
    };
    const storage = (event: StorageEvent) => { if (isStudyStorageKey(event.key)) refresh(); };
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    refresh();
    window.addEventListener(STUDY_CHANGED, refresh);
    window.addEventListener("storage", storage);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      mounted.current = false;
      window.removeEventListener(STUDY_CHANGED, refresh);
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [i18n.language]);
  const preview = useMemo(() => !replacing && store && pending && mergeStudyData(store.studyData, pending.backup.studyData, incomingGoals), [store, pending, incomingGoals, replacing]);
  const stale = !!pending && (!store || JSON.stringify(store) !== pending.baseline || !!store.extraActivity);
  const blocked = busy || disabled || !store;
  const duration = (seconds: number) => {
    const parts = [["durationHours", Math.floor(seconds / 3600)], ["durationMinutes", Math.floor(seconds % 3600 / 60)], ["durationSeconds", Math.floor(seconds % 60)]] as const;
    return parts.filter(([, value]) => value > 0).map(([key, value]) => t(`study.${key}`, { count: value })).join(" ") || t("study.zeroDuration");
  };
  const number = (value: number) => value.toLocaleString(i18n.language, { maximumFractionDigits: 2 });
  async function action(work: () => Promise<void>) {
    if (working.current || disabled) return;
    working.current = true; setBusy(true); onBusyChange?.(true); setError(""); setMessage("");
    try { await work(); } catch (e) { if (mounted.current) fail(e); }
    finally { working.current = false; if (mounted.current) { setBusy(false); onBusyChange?.(false); } }
  }
  async function exportBackup() {
    await studyTracker.seal();
    const backup = backupOf(readStudyStore());
    const stamp = backup.exportedAt.replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
    const mobile = window.matchMedia("(pointer: coarse) and (max-width: 820px)").matches;
    const device = mobile ? "mobile" : "desktop";
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `bej-study-backup-${device}-${stamp}.json`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (mounted.current) setMessage(t("study.exported"));
  }
  function selectFile(file?: File) {
    if (!file || working.current || disabled) return;
    if (store?.extraActivity) { fail(new StudyError("extraActive")); return; }
    setPending(null); setConfirmed(false); setIncomingGoals(false);
    void action(async () => {
      if (file.size > MAX_BACKUP_BYTES) throw new StudyError("tooLarge");
      let text: string;
      try { text = await file.text(); } catch { throw new StudyError("invalid"); }
      if (!mounted.current) return;
      const backup = parseStudyBackup(text), current = readStudyStore();
      if (current.extraActivity) throw new StudyError("extraActive");
      setStore(current); setPending({ backup, baseline: JSON.stringify(current) });
    });
  }
  const icon = (upload: boolean) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12M4 15v5h16v-5" />
    <path d={upload ? "m7 8 5-5 5 5" : "m7 10 5 5 5-5"} />
  </svg>;
  return <div className="study-transfer">
    <h3>{t(standalone ? "studyTransfer.import" : settings ? "studyTransfer.title" : "study.myData")}</h3>
    {standalone && <div className="study-actions"><button type="button" className="secondary-button" disabled={busy} onClick={onBack}>{t("studyTransfer.back")}</button></div>}
    {standalone && consolidationStep === "intro" && <section className="study-preview" aria-labelledby="study-consolidation-intro">
      <h4 id="study-consolidation-intro">{t("studyTransfer.introTitle")}</h4>
      <p>{t("studyTransfer.introText")}</p>
      <p role="note">{t("studyTransfer.introWarning")}</p>
      <button type="button" className="primary-button" disabled={blocked || !!store?.extraActivity} onClick={() => setConsolidationStep("file")}>{t("studyTransfer.continue")}</button>
    </section>}
    {standalone && consolidationStep === "file" && <>
      <h4>{t("studyTransfer.fileStep")}</h4>
      <p>{t("studyTransfer.fileHelp")}</p>
    </>}
    {settings && <p>{t("studyTransfer.description")}</p>}
    {!standalone && <p>{t(replacing ? "studyRestore.note" : "study.backupNote")}</p>}
    {error && <p className="status-card error-card" role="alert">{error}</p>}
    {message && <p className="study-feedback" role="status">{message}</p>}
    {!store && <p role="status">{t("study.unavailable")}</p>}
    {(!standalone || consolidationStep === "file") && <div className="study-actions">
      {!standalone && <button type="button" className="primary-button" disabled={blocked} onClick={() => void action(exportBackup)}>
        {settings && icon(false)}{t(settings ? "studyTransfer.export" : "study.export")}
      </button>}
      {settings && onOpenConsolidation ? <button type="button" className="secondary-button" disabled={blocked || !!store?.extraActivity} onClick={onOpenConsolidation}>
        {icon(true)}{t("studyTransfer.import")}
      </button> : <button type="button" className="secondary-button" disabled={blocked || !!store?.extraActivity} onClick={() => fileInput.current?.click()}>
        {settings && icon(true)}{t(standalone ? "studyTransfer.chooseFile" : settings ? "studyTransfer.import" : "study.restore")}
      </button>}
      <input ref={fileInput} hidden type="file" accept=".json,application/json" aria-label={t(standalone ? "studyTransfer.chooseFile" : settings ? "studyTransfer.import" : "study.restore")}
        onChange={e => { selectFile(e.target.files?.[0]); e.target.value = ""; }} />
    </div>}
    {store?.extraActivity && <p role="status">{t("study.errors.extraActive")}</p>}
    {replacing && pending && store && <section className="study-preview" aria-label={t("studyRestore.preview")}>
      <h4>{t("studyRestore.preview")}</h4>
      <p role="alert">{t("studyRestore.warning")}</p>
      <dl>
        <div><dt>{t("study.currentHours")}</dt><dd>{duration(totalSeconds(store.studyData))}</dd></div>
        <div><dt>{t("study.backupSessions")}</dt><dd>{pending.backup.studyData.sessions.length}</dd></div>
        <div><dt>{t("studyRestore.adjustments")}</dt><dd>{pending.backup.studyData.manualAdjustments.length}</dd></div>
        <div><dt>{t("studyRestore.after")}</dt><dd>{duration(totalSeconds(pending.backup.studyData))}</dd></div>
      </dl>
      {stale && <p role="alert">{t("study.errors.stale")}</p>}
      <label className="study-check"><input type="checkbox" checked={confirmed} disabled={blocked || stale} onChange={e => setConfirmed(e.target.checked)} />{t("studyRestore.confirm")}</label>
      <div className="study-actions">
        <button type="button" className="study-danger-button" disabled={blocked || stale || !confirmed} onClick={() => void action(async () => {
          const next = await restoreStudyBackup(pending.backup, pending.baseline);
          if (mounted.current) { setStore(next); setPending(null); setConfirmed(false); setMessage(t("studyRestore.success")); }
        })}>{t("studyRestore.replace")}</button>
        <button type="button" className="secondary-button" disabled={blocked} onClick={() => { setPending(null); setConfirmed(false); }}>{t("study.cancel")}</button>
      </div>
    </section>}
    {(!standalone || consolidationStep === "file") && preview && pending && <section className="study-preview" aria-label={t("study.preview")}>
      <h4>{t("study.preview")}</h4>
      <dl>
        {([["backupSessions", pending.backup.studyData.sessions.length], ["newSessions", preview.newSessions], ["duplicates", preview.duplicates], ["conflicts", preview.conflicts.length], ["newAdjustments", preview.newAdjustments]] as const).map(([key, value]) => <div key={key}><dt>{t(`study.${key}`)}</dt><dd>{value}</dd></div>)}
        <div><dt>{t("study.currentHours")}</dt><dd>{duration(preview.currentSeconds)}</dd></div>
        <div><dt>{t("studyTransfer.additional")}</dt><dd>{duration(preview.afterSeconds - preview.currentSeconds)}</dd></div>
        <div><dt>{t("study.afterHours")}</dt><dd>{duration(preview.afterSeconds)}</dd></div>
      </dl>
      {!preview.newSessions && !preview.newAdjustments && !preview.conflicts.length && <p role="status">{t("studyTransfer.alreadyConsolidated")}</p>}
      {!!preview.conflicts.length && <><p role="alert">{t("study.errors.conflict")}</p><ul>{preview.conflicts.map(id => <li key={id}>{id}</li>)}</ul></>}
      {stale && <p role="alert">{t("study.errors.stale")}</p>}
      {!!preview.goalDifferences.length && <><p>{t("study.goalDifferences")}</p><ul>{preview.goalDifferences.map(g => <li key={g.kind + g.language}>{languageName(g.language)} · {t(g.kind === "goals" ? "study.targetHours" : "study.monthlyHours")}: {number(g.local)} → {number(g.incoming)}</li>)}</ul><label>{t("study.goalChoice")}<select value={incomingGoals ? "incoming" : "local"} disabled={blocked} onChange={e => { setIncomingGoals(e.target.value === "incoming"); setConfirmed(false); }}><option value="local">{t("study.keepLocal")}</option><option value="incoming">{t("study.useIncoming")}</option></select></label></>}
      <label className="study-check"><input type="checkbox" checked={confirmed} disabled={blocked || stale || !!preview.conflicts.length} onChange={e => setConfirmed(e.target.checked)} />{t("study.confirmMerge")}</label>
      <div className="study-actions"><button type="button" className="study-danger-button" disabled={blocked || !confirmed || stale || !!preview.conflicts.length} onClick={() => void action(async () => {
        const next = await updateStudyStore(current => consolidateStudyBackup(current, pending.backup, pending.baseline, incomingGoals));
        if (mounted.current) { setStore(next); setPending(null); setConfirmed(false); setMessage(t("study.restored")); }
      })}>{t("study.merge")}</button><button type="button" className="secondary-button" disabled={blocked} onClick={() => { setPending(null); setConfirmed(false); }}>{t("study.cancel")}</button></div>
    </section>}
  </div>;
}
