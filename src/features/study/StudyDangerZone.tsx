import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LANGUAGES, type StudentLanguage } from "../../config/languages";
import { languageName } from "../../i18n";
import { checkStudyReset, resetStudyData, readStudyResetImpact, STUDY_CHANGED, isStudyStorageKey, StudyError, type StudyResetScope } from "./studyStorage";

export function StudyDangerZone({ language, dashboardLanguage = language, onChanged }: { language: StudentLanguage; dashboardLanguage?: StudentLanguage | "all"; onChanged: () => void }) {
  const { t, i18n } = useTranslation();
  const [selected, setSelected] = useState(language);
  const [scope, setScope] = useState<StudyResetScope | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [impact, setImpact] = useState<ReturnType<typeof readStudyResetImpact> | null>(null);
  const gate = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const phrase = t(scope?.scope === "all" ? "studyDanger.phraseAll" : "studyDanger.phraseLanguage");
  const contextLanguage = dashboardLanguage === "all" ? t("study.allLanguages") : languageName(dashboardLanguage);
  const duration = (seconds: number) => [["durationHours", Math.floor(seconds / 3600)], ["durationMinutes", Math.floor(seconds % 3600 / 60)], ["durationSeconds", seconds % 60]]
    .filter(([, value]) => Number(value) > 0).map(([key, count]) => t(`study.${key}`, { count: Number(count) })).join(" ") || t("study.zeroDuration");
  useEffect(() => {
    if (!scope) return;
    const refresh = () => {
      try {
        const next = readStudyResetImpact(scope);
        if (next.fingerprint !== impact?.fingerprint) { setImpact(next); setConfirmation(""); setError(t("studyDanger.changed")); }
      } catch { setImpact(null); setConfirmation(""); setError(t("studyDanger.failed")); }
    };
    const storage = (event: StorageEvent) => { if (isStudyStorageKey(event.key)) refresh(); };
    window.addEventListener(STUDY_CHANGED, refresh); window.addEventListener("storage", storage); window.addEventListener("focus", refresh);
    return () => { window.removeEventListener(STUDY_CHANGED, refresh); window.removeEventListener("storage", storage); window.removeEventListener("focus", refresh); };
  }, [scope, impact?.fingerprint, t]);
  useEffect(() => {
    setConfirmation("");
    if (!scope) return;
    const trigger = document.activeElement;
    dialog.current?.showModal();
    dialog.current?.querySelector<HTMLButtonElement>(".secondary-button")?.focus();
    return () => { dialog.current?.close(); if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus(); };
  }, [scope, i18n.language]);
  const fail = (failure: unknown) => setError(t(failure instanceof StudyError && failure.code === "resetActive"
    ? "studyDanger.blocked" : failure instanceof StudyError && failure.code === "unsupported" ? "study.errors.unsupported" : "studyDanger.failed"));
  const begin = async (next: StudyResetScope) => {
    if (gate.current) return;
    gate.current = true; setBusy(true); setError(""); setSuccess(false);
    try { await checkStudyReset(next); setImpact(readStudyResetImpact(next)); setScope(next); }
    catch (failure) { fail(failure); }
    finally { gate.current = false; setBusy(false); }
  };
  const confirm = async () => {
    if (!scope || !impact || confirmation !== phrase || gate.current) return;
    gate.current = true; setBusy(true); setError("");
    try { await resetStudyData(scope, impact.fingerprint); setScope(null); setSuccess(true); }
    catch (failure) {
      setConfirmation("");
      if (failure instanceof StudyError && failure.code === "stale") {
        try { setImpact(readStudyResetImpact(scope)); } catch { setImpact(null); }
        setError(t("studyDanger.changed"));
      } else fail(failure);
    }
    finally { onChanged(); gate.current = false; setBusy(false); }
  };
  return <section className="study-danger" aria-labelledby="study-danger-title">
    <h4 id="study-danger-title"><span aria-hidden="true">⚠</span> {t("studyDanger.title")}</h4>
    <p>{t("studyDanger.intro")}</p>
    <div className="study-danger-operation"><div><h5>{t("studyDanger.languageTitle")}</h5><p>{t("studyDanger.languageDescription")}</p>
      <label>{t("study.language")}<select value={selected} disabled={busy || !!scope} onChange={event => setSelected(event.target.value as StudentLanguage)}>
        {(Object.keys(LANGUAGES) as StudentLanguage[]).map(code => <option key={code} value={code}>{languageName(code)}</option>)}
      </select></label></div><button type="button" className="study-danger-button" disabled={busy || !!scope} onClick={() => void begin({ scope: "language", language: selected })}>{t("studyDanger.resetLanguage", { language: languageName(selected) })}</button></div>
    <div className="study-danger-operation study-danger-all"><div><h5>{t("studyDanger.allTitle")}</h5><p>{t("studyDanger.allDescription")}</p></div>
      <button type="button" className="study-danger-button study-danger-solid" disabled={busy || !!scope} onClick={() => void begin({ scope: "all" })}>{t("studyDanger.resetAll")}</button></div>
    {!scope && error && <p role="alert">{error}</p>}
    {success && <p role="status">{t("studyDanger.success")}</p>}
    {scope && <dialog ref={dialog} className="study-danger-dialog" aria-labelledby="study-reset-title" aria-describedby="study-reset-description" aria-busy={busy}
      onCancel={event => { event.preventDefault(); if (!gate.current) { setScope(null); setError(""); } }}
      onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }}>
      <h3 id="study-reset-title">{t(scope.scope === "all" ? "studyDanger.globalTitle" : "studyDanger.languageConfirmTitle", { language: scope.scope === "language" ? languageName(scope.language) : "" })}</h3>
      <p id="study-reset-description">{t(scope.scope === "all" ? "studyDanger.confirmAll" : "studyDanger.confirmLanguage", { language: scope.scope === "language" ? languageName(scope.language) : "" })}</p>
      {scope.scope === "all" ? <><p>{t("studyDanger.contextLanguage", { language: contextLanguage })}</p><p className="study-danger-scope-warning"><strong>{t("studyDanger.globalWarning", { language: contextLanguage })}</strong></p></> : <p>{t("studyDanger.otherLanguagesPreserved")}</p>}
      <p>{t("studyDanger.preserved")}</p><p>{t("studyDanger.irreversible")}</p>
      {impact && <section className="study-danger-impact" aria-labelledby="study-reset-impact-title"><h4 id="study-reset-impact-title">{t("studyDanger.impactTitle")}</h4>
        <div className="study-danger-impact-table"><table><thead><tr><th scope="col">{t("study.language")}</th><th scope="col">{t("studyDanger.recordedTime")}</th><th scope="col">{t("studyDanger.sessions")}</th><th scope="col">{t("studyDanger.adjustments")}</th></tr></thead>
          <tbody>{impact.rows.map(row => <tr key={row.language}><th scope="row">{languageName(row.language)}</th><td>{duration(row.seconds)}</td><td>{row.sessions}</td><td>{row.adjustments}</td></tr>)}</tbody></table></div>
        <p>{t("studyDanger.impactTotal", { time: duration(impact.seconds), sessions: impact.sessions, adjustments: impact.adjustments })}</p>
      </section>}
      <label>{t("studyDanger.typePhrase", { phrase })}<input autoComplete="off" spellCheck={false} value={confirmation} disabled={busy} onChange={event => setConfirmation(event.target.value)} /></label>
      {error && <p role="alert">{error}</p>}
      <div className="study-actions"><button type="button" className="secondary-button" autoFocus disabled={busy} onClick={() => { setScope(null); setError(""); }}>{t("study.cancel")}</button>
        <button type="button" className="study-danger-button study-danger-solid" disabled={busy || !impact || confirmation !== phrase} onClick={() => void confirm()}>{t(busy ? "studyDanger.working" : scope.scope === "all" ? "studyDanger.confirmGlobal" : "studyDanger.confirm")}</button></div>
    </dialog>}
  </section>;
}
