import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LANGUAGES, type StudentLanguage } from "../../config/languages";
import { languageName } from "../../i18n";
import { EXTRA_CATEGORIES, StudyError, type ExtraCategory, type StudyStore } from "./studyStorage";
import { studyTracker } from "./studyTrackingService";
import { extraEstimate } from "./extraActivityTime";
import { changeExtraActivity, startExtraActivity } from "./extraActivityService";
import type { useExtraActivity } from "./useExtraActivity";
import "./study.css";

function clock(seconds: number) {
  return [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].map(n => String(n).padStart(2, "0")).join(":");
}
export function ExtraActivities({ language, state }: { language: StudentLanguage; state: ReturnType<typeof useExtraActivity> }) {
  const { t } = useTranslation();
  const { draft, available, error: storageError } = state;
  const [selectedLanguage, setLanguage] = useState(language);
  const [category, setCategory] = useState<ExtraCategory>("conversation");
  const [note, setNote] = useState("");
  const [now, setNow] = useState(Date.now);
  const [confirmed, setConfirmed] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ended, setEnded] = useState(false);
  const [lastSeconds, setLastSeconds] = useState(0);
  const recovering = !!draft && (!!draft.recoveryAt || draft.owner !== studyTracker.extraOwner);
  const maximum = draft ? Math.floor(extraEstimate(draft, Math.max(now, Date.parse(draft.updatedAt))).accumulatedMs / 1000) : 0;
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    window.addEventListener("focus", refresh); window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh); window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  useEffect(() => { if (recovering) setConfirmed(String(maximum)); }, [draft?.id, draft?.recoveryAt, recovering]);
  async function act(work: () => Promise<StudyStore>, finishedSeconds?: number) {
    setBusy(true); setError("");
    try {
      const saved = await work(); setNow(Date.now());
      if (finishedSeconds !== undefined) {
        setEnded(true);
        setLastSeconds(saved.studyData.sessions.find(session => session.id === draft?.id)?.activeSeconds ?? finishedSeconds);
      }
    }
    catch (e) { setError(e instanceof StudyError ? e.code : "storage"); }
    finally { setBusy(false); }
  }
  const discard = () => {
    if (!draft || (maximum > 0 && !window.confirm(t("extras.confirmDiscard")))) return;
    void act(() => changeExtraActivity(draft.id, "discard"), 0);
  };
  const status = recovering ? "recovery" : draft?.state ?? (ended ? "ended" : "ready");
  const confirmationValid = /^\d+$/.test(confirmed) && Number(confirmed) > 0 && Number(confirmed) <= maximum;
  return <section className="study-dashboard extra-activities" aria-labelledby="extras-title">
    <header><h2 id="extras-title">{t("extras.title")}</h2><p>{t("extras.intro")}</p></header>
    {(error || storageError) && <p className="status-card error-card" role="alert">{t(`study.errors.${error || storageError}`)}</p>}
    {!available && <p className="warning-banner" role="status">{t("study.warning.otherTab")}</p>}
    <section className="study-panel">
      <fieldset disabled={busy || !!draft}>
        <legend>{t("extras.configuration")}</legend>
        <label>{t("study.language")}<select value={draft?.language ?? selectedLanguage} onChange={e => setLanguage(e.target.value as StudentLanguage)}>
          {(Object.keys(LANGUAGES) as StudentLanguage[]).map(code => <option key={code} value={code}>{languageName(code)}</option>)}
        </select></label>
        <label>{t("extras.category")}<select value={draft?.category ?? category} onChange={e => setCategory(e.target.value as ExtraCategory)}>
          {EXTRA_CATEGORIES.map(key => <option key={key} value={key}>{t(`extras.categories.${key}`)}</option>)}
        </select></label>
        <label>{t("extras.note")}<textarea maxLength={1000} rows={3} value={draft?.note ?? (draft ? "" : note)} onChange={e => setNote(e.target.value)} /></label>
      </fieldset>
      <p role="status">{t(`extras.states.${status}`)}</p>
      <time className="extra-activity-clock" aria-label={t("common.studyTime")}>{clock(draft ? maximum : lastSeconds)}</time>
      {draft && <p>{t("extras.startedAt", { date: new Date(draft.startedAt).toLocaleString() })}</p>}
      {recovering && draft ? <div className="study-preview">
        <p>{t("extras.recoveryHelp")}</p>
        <dl><div><dt>{t("extras.accumulated")}</dt><dd>{clock(Math.floor(draft.accumulatedMs / 1000))}</dd></div>
          <div><dt>{t("extras.additional")}</dt><dd>{clock(Math.max(0, maximum - Math.floor(draft.accumulatedMs / 1000)))}</dd></div>
          <div><dt>{t("extras.suggested")}</dt><dd>{clock(maximum)}</dd></div></dl>
        <label>{t("extras.confirmedSeconds")}<input type="number" min="1" max={maximum} step="1" value={confirmed} disabled={busy || !available || !draft.recoveryAt} onChange={e => setConfirmed(e.target.value)} /></label>
        <p>{t("extras.confirmedPreview", { time: clock(confirmationValid ? Number(confirmed) : 0) })}</p>
        <div className="study-actions"><button type="button" className="primary-button" disabled={busy || !available || !draft.recoveryAt || !confirmationValid} onClick={() => void act(() => changeExtraActivity(draft.id, "confirm", Number(confirmed)), Number(confirmed))}>{t("extras.confirmSave")}</button>
          <button type="button" className="secondary-button" disabled={busy || !available} onClick={discard}>{t("extras.discard")}</button></div>
      </div> : <div className="study-actions">
        {!draft ? <button type="button" className="primary-button" disabled={busy || !available || !!storageError} onClick={() => void act(() => startExtraActivity(selectedLanguage, category, note))}>{t("extras.start")}</button> : <>
          <button type="button" className="secondary-button" disabled={busy || !available} onClick={() => void act(() => changeExtraActivity(draft.id, draft.state === "running" ? "pause" : "resume"))}>{t(draft.state === "running" ? "common.pause" : "common.resume")}</button>
          <button type="button" className="primary-button" disabled={busy || !available || maximum === 0} onClick={() => void act(() => changeExtraActivity(draft.id, "stop"), maximum)}>{t("extras.stopSave")}</button>
          <button type="button" className="secondary-button" disabled={busy || !available} onClick={discard}>{t("extras.discard")}</button>
        </>}
      </div>}
    </section>
    <p className="study-note">{t("extras.backgroundHelp")}</p>
  </section>;
}
