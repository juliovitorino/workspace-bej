import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { LANGUAGES, type StudentLanguage } from "../../config/languages";
import { languageName } from "../../i18n";
import { backupOf, MAX_BACKUP_BYTES, mergeStudyData, newStudyId, parseStudyBackup, readStudyStore, restoreStudyBackup,
  STUDY_CHANGED, STUDY_KEY, STUDY_MODULES, StudyError, updateStudyStore, validDay,
  type ManualAdjustment, type StudyBackup, type StudyData, type StudyStore } from "./studyStorage";
import { localDay, studyTracker } from "./studyTrackingService";
import { studyEntries, studyStats, type StudyFilters } from "./studyStats";
import "./study.css";

const languages = Object.keys(LANGUAGES) as StudentLanguage[];
const moduleKeys: Record<string, string> = { hashmap: "Hashmap", "memory-flashcards": "memory.title", "chunk-flashcards": "common.chunkFlashcards", "chunk-favorites": "favorites.title", shadowing: "common.shadowing", "basic-training": "study.basicTraining", "advanced-training": "study.advancedTraining", previous: "study.previousHours" };
export function StudyDashboard({ language }: { language: StudentLanguage }) {
  const { t, i18n } = useTranslation();
  const [store, setStore] = useState<StudyStore | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState<StudyFilters>({ language, module: "all", mode: "all", period: "all", from: localDay(new Date()), to: localDay(new Date()) });
  const [goalLanguage, setGoalLanguage] = useState(language);
  const [goalHours, setGoalHours] = useState("");
  const [monthlyHours, setMonthlyHours] = useState("");
  const [adjustLanguage, setAdjustLanguage] = useState(language);
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("0");
  const [date, setDate] = useState(localDay(new Date()));
  const [description, setDescription] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, setPending] = useState<{ backup: StudyBackup; baseline: string } | null>(null);
  const [incomingGoals, setIncomingGoals] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [now, setNow] = useState(() => new Date());
  const [historyLimit, setHistoryLimit] = useState(50);
  const fail = (e: unknown) => { setError(t(`study.errors.${e instanceof StudyError ? e.code : "storage"}`)); setMessage(""); };
  useEffect(() => {
    const refresh = () => {
      try { setStore(readStudyStore()); setError(""); } catch (e) { setStore(null); fail(e); }
    };
    const storage = (event: StorageEvent) => { if (event.key === STUDY_KEY || event.key === null) refresh(); };
    refresh();
    window.addEventListener(STUDY_CHANGED, refresh); window.addEventListener("storage", storage);
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => { window.removeEventListener(STUDY_CHANGED, refresh); window.removeEventListener("storage", storage); window.clearInterval(timer); };
  }, [i18n.language]);
  useEffect(() => {
    setGoalHours(String(store?.studyData.goals[goalLanguage] ?? ""));
    setMonthlyHours(String(store?.studyData.monthlyGoals[goalLanguage] ?? ""));
  }, [goalLanguage, store]);
  useEffect(() => { setHistoryLimit(50); }, [filters]);
  const validRange = filters.period !== "custom" || (validDay(filters.from) && validDay(filters.to) && filters.from <= filters.to);
  const stats = useMemo(() => store && studyStats(store.studyData, validRange ? filters : { ...filters, period: "today" }, now), [store, filters, validRange, now]);
  const preview = useMemo(() => store && pending && mergeStudyData(store.studyData, pending.backup.studyData, incomingGoals), [store, pending, incomingGoals]);
  const stale = !!pending && JSON.stringify(store) !== pending.baseline;
  const duration = (seconds: number) => t("study.duration", { hours: Math.floor(seconds / 3600), minutes: Math.floor(seconds % 3600 / 60), seconds: Math.floor(seconds % 60) });
  const number = (value: number) => value.toLocaleString(i18n.language, { maximumFractionDigits: 2 });
  const moduleLabel = (key: string) => key === "hashmap" ? "Mental Hashmap" : t(moduleKeys[key]);
  async function action(work: () => Promise<void>) {
    setBusy(true); setError(""); setMessage("");
    try { await work(); } catch (e) { fail(e); } finally { setBusy(false); }
  }
  async function changeData(change: (data: StudyData) => StudyData) {
    const next = await updateStudyStore(current => ({ ...current, studyData: change(current.studyData) }));
    setStore(next);
  }
  function saveGoals(event: FormEvent) {
    event.preventDefault();
    void action(async () => {
      const target = Number(goalHours), monthly = monthlyHours === "" ? undefined : Number(monthlyHours);
      if (!Number.isFinite(target) || target <= 0 || (monthly !== undefined && (!Number.isFinite(monthly) || monthly <= 0))) throw new StudyError("invalid");
      await changeData(data => {
        const monthlyGoals = { ...data.monthlyGoals };
        if (monthly === undefined) delete monthlyGoals[goalLanguage]; else monthlyGoals[goalLanguage] = monthly;
        return { ...data, goals: { ...data.goals, [goalLanguage]: target }, monthlyGoals };
      });
      setMessage(t("study.saved"));
    });
  }
  function resetAdjustment() { setEditing(null); setHours("0"); setMinutes("0"); setDescription(""); }
  function saveAdjustment(event: FormEvent) {
    event.preventDefault();
    if (editing && !window.confirm(t("study.confirmEdit"))) return;
    void action(async () => {
      const h = Number(hours), m = Number(minutes);
      if (!Number.isSafeInteger(h) || h < 0 || !Number.isInteger(m) || m < 0 || m > 59 || !validDay(date) || date > localDay(new Date()) || h * 3600 + m * 60 <= 0) throw new StudyError("invalid");
      const item: ManualAdjustment = { id: editing ?? newStudyId(), language: adjustLanguage, seconds: h * 3600 + m * 60, date, description: description.trim() };
      await changeData(data => {
        if (editing && !data.manualAdjustments.some(a => a.id === editing)) throw new StudyError("stale");
        if (data.manualAdjustments.some(a => a.id !== editing && a.language === item.language && a.seconds === item.seconds && a.date === item.date && a.description === item.description)) throw new StudyError("duplicate");
        return { ...data, manualAdjustments: editing ? data.manualAdjustments.map(a => a.id === editing ? item : a) : [...data.manualAdjustments, item] };
      });
      resetAdjustment(); setMessage(t("study.saved"));
    });
  }
  async function exportBackup() {
    await studyTracker.seal();
    const backup = backupOf(readStudyStore());
    const stamp = backup.exportedAt.replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `bej-study-backup-${stamp}.json`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(t("study.exported"));
  }
  function selectFile(file?: File) {
    if (!file) return;
    setPending(null); setConfirmed(false); setIncomingGoals(false);
    void action(async () => {
      if (file.size > MAX_BACKUP_BYTES) throw new StudyError("tooLarge");
      let text: string;
      try { text = await file.text(); } catch { throw new StudyError("invalid"); }
      const backup = parseStudyBackup(text), current = readStudyStore();
      setStore(current); setPending({ backup, baseline: JSON.stringify(current) });
    });
  }
  const chart = (title: string, values: Record<string, number>, label: (key: string) => string = key => key, total?: number) => {
    const entries = Object.entries(values).sort(([a], [b]) => a.localeCompare(b)), max = Math.max(1, ...entries.map(([, seconds]) => seconds));
    const scale = Math.max(1, total ?? max);
    return <section className="study-panel"><h3>{title}</h3>{!entries.length ? <p>{t("study.empty")}</p> : <ul className="study-chart">{entries.map(([key, seconds]) => <li key={key}>
      <div><span>{label(key)}</span><strong>{duration(seconds)}{total !== undefined && ` · ${number(seconds / scale * 100)}%`}</strong></div><div className="study-bar" aria-hidden="true"><span style={{ width: `${seconds / scale * 100}%` }} /></div>
    </li>)}</ul>}</section>;
  };
  return <section className="study-dashboard" aria-labelledby="study-title">
    <header><h2 id="study-title">{t("study.title")}</h2><p>{t("study.intro")}</p></header>
    {error && <p className="status-card error-card" role="alert">{error}</p>}
    {message && <p className="study-feedback" role="status">{message}</p>}
    {!store || !stats ? <p>{t("study.unavailable")}</p> : <>
      <fieldset className="study-panel study-filters" disabled={busy}><legend>{t("study.filters")}</legend>
        <label>{t("study.language")}<select value={filters.language} onChange={e => setFilters({ ...filters, language: e.target.value as StudyFilters["language"] })}><option value="all">{t("study.allLanguages")}</option>{languages.map(code => <option key={code} value={code}>{languageName(code)}</option>)}</select></label>
        <label>{t("study.module")}<select value={filters.module} onChange={e => setFilters({ ...filters, module: e.target.value as StudyFilters["module"] })}><option value="all">{t("study.allModules")}</option>{STUDY_MODULES.map(key => <option key={key} value={key}>{moduleLabel(key)}</option>)}</select></label>
        <label>{t("study.mode")}<select value={filters.mode} onChange={e => setFilters({ ...filters, mode: e.target.value as StudyFilters["mode"] })}>{["all", "manual", "walking"].map(key => <option key={key} value={key}>{t(`study.modes.${key}`)}</option>)}</select></label>
        <label>{t("study.period")}<select value={filters.period} onChange={e => setFilters({ ...filters, period: e.target.value as StudyFilters["period"] })}>{["today", "7", "30", "month", "90", "all", "custom"].map(key => <option key={key} value={key}>{t(`study.periods.${key}`)}</option>)}</select></label>
        {filters.period === "custom" && <><label>{t("study.from")}<input type="date" value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })} /></label><label>{t("study.to")}<input type="date" value={filters.to} onChange={e => setFilters({ ...filters, to: e.target.value })} /></label></>}
      </fieldset>
      {!validRange && <p role="alert">{t("study.errors.invalid")}</p>}
      <div className="study-metrics">{([ ["accumulated", stats.total], ["today", stats.today], ["week", stats.week], ["month", stats.month], ["dailyAverage", stats.average] ] as const).map(([key, seconds]) => <div className="study-panel" key={key}><span>{t(`study.${key}`)}</span><strong>{duration(seconds)}</strong></div>)}
        {([ ["studyDays", stats.studyDays], ["streak", stats.streak], ["longest", stats.longest] ] as const).map(([key, count]) => <div className="study-panel" key={key}><span>{t(`study.${key}`)}</span><strong>{number(count)}</strong></div>)}
      </div><p className="study-note">{t("study.streakNote")}</p>
      <section className="study-panel"><h3>{t("study.journey")}</h3><p>{t("study.historicalNote")}</p>
        {languages.filter(code => filters.language === "all" || filters.language === code).map(code => {
          const entries = studyEntries(store.studyData).filter(e => e.language === code && (filters.module === "all" || filters.module === e.module) && (filters.mode === "all" || filters.mode === e.mode)), total = entries.reduce((n, e) => n + e.seconds, 0);
          const target = store.studyData.goals[code], monthly = store.studyData.monthlyGoals[code];
          const percent = target ? total / (target * 3600) * 100 : 0;
          const monthTotal = stats.entries.filter(e => e.language === code && e.date.slice(0, 7) === localDay(now).slice(0, 7)).reduce((n, e) => n + e.seconds, 0);
          return <div className="study-goal" key={code}><h4>{languageName(code)}</h4><p>{duration(total)} / {target ? t("study.hoursValue", { hours: number(target) }) : t("study.noGoal")}</p>
            {target && <><progress aria-label={t("study.progressFor", { language: languageName(code) })} value={Math.min(percent, 100)} max={100} /><p>{t("study.progress", { percent: number(percent), remaining: duration(Math.max(0, target * 3600 - total)) })}</p>{percent >= 100 && <strong>{t("study.reached")}</strong>}</>}
            {monthly && <p>{t("study.monthlyProgress", { actual: duration(monthTotal), target: number(monthly) })}</p>}
          </div>;
        })}
      </section>
      <div className="study-charts">{chart(t("study.byModule"), stats.byModule, moduleLabel, stats.total)}{chart(t("study.byLanguage"), stats.byLanguage, code => languageName(code as StudentLanguage))}{chart(t("study.timeline"), stats.timeline)}</div>
      <div className="study-charts"><form className="study-panel" onSubmit={saveGoals}><fieldset disabled={busy}><legend>{t("study.goals")}</legend>
        <label>{t("study.language")}<select value={goalLanguage} onChange={e => setGoalLanguage(e.target.value as StudentLanguage)}>{languages.map(code => <option key={code} value={code}>{languageName(code)}</option>)}</select></label>
        <label>{t("study.targetHours")}<input type="number" min="0.01" max="10000000" step="0.01" required value={goalHours} onChange={e => setGoalHours(e.target.value)} /></label>
        <label>{t("study.monthlyHours")}<input type="number" min="0.01" max="10000000" step="0.01" value={monthlyHours} onChange={e => setMonthlyHours(e.target.value)} /></label>
        <button type="submit" className="primary-button">{t("study.save")}</button>
      </fieldset></form>
      <form className="study-panel" onSubmit={saveAdjustment}><fieldset disabled={busy}><legend>{t(editing ? "study.editAdjustment" : "study.previousHours")}</legend>
        <label>{t("study.language")}<select value={adjustLanguage} onChange={e => setAdjustLanguage(e.target.value as StudentLanguage)}>{languages.map(code => <option key={code} value={code}>{languageName(code)}</option>)}</select></label>
        <label>{t("study.hours")}<input type="number" min="0" max="10000000" step="1" required value={hours} onChange={e => setHours(e.target.value)} /></label>
        <label>{t("study.minutes")}<input type="number" min="0" max="59" step="1" required value={minutes} onChange={e => setMinutes(e.target.value)} /></label>
        <label>{t("study.date")}<input type="date" required max={localDay(now)} value={date} onChange={e => setDate(e.target.value)} /></label>
        <label>{t("study.description")}<input maxLength={1000} value={description} onChange={e => setDescription(e.target.value)} /></label>
        <div className="study-actions"><button type="submit" className="primary-button">{t("study.save")}</button>{editing && <button type="button" className="secondary-button" onClick={resetAdjustment}>{t("study.cancel")}</button>}</div>
      </fieldset></form></div>
      <section className="study-panel"><h3>{t("study.history")}</h3>{!stats.entries.length ? <p>{t("study.empty")}</p> : <ul className="study-history">{[...stats.entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, historyLimit).map(e => <li key={`${e.module}:${e.id}:${e.date}`}>
        <div><time dateTime={e.date}>{new Date(e.date + "T12:00:00").toLocaleDateString(i18n.language)}</time><strong>{languageName(e.language)}</strong><span>{moduleLabel(e.module)} · {t(`study.modes.${e.mode}`)}</span><strong>{duration(e.seconds)}</strong>{e.description && <span>{e.description}</span>}</div>
        {e.module === "previous" && <div className="study-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => { setEditing(e.id); setAdjustLanguage(e.language); setHours(String(Math.floor(e.seconds / 3600))); setMinutes(String(Math.floor(e.seconds % 3600 / 60))); setDate(e.date); setDescription(e.description ?? ""); }}>{t("study.edit")}</button>
          <button type="button" className="secondary-button" disabled={busy} onClick={() => { if (window.confirm(t("study.confirmDelete"))) void action(async () => { await changeData(data => ({ ...data, manualAdjustments: data.manualAdjustments.filter(a => a.id !== e.id) })); if (editing === e.id) resetAdjustment(); setMessage(t("study.saved")); }); }}>{t("study.delete")}</button></div>}
      </li>)}</ul>}{stats.entries.length > historyLimit && <button type="button" className="secondary-button" onClick={() => setHistoryLimit(n => n + 50)}>{t("study.showMore")}</button>}</section>
      <section className="study-panel"><h3>{t("study.myData")}</h3><p>{t("study.backupNote")}</p><div className="study-actions">
        <button type="button" className="primary-button" disabled={busy} onClick={() => void action(exportBackup)}>{t("study.export")}</button>
        <button type="button" className="secondary-button" disabled={busy} onClick={() => fileInput.current?.click()}>{t("study.restore")}</button>
        <input ref={fileInput} hidden type="file" accept=".json,application/json" aria-label={t("study.restore")} onChange={e => { selectFile(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      {preview && pending && <section className="study-preview" aria-labelledby="study-preview-title"><h4 id="study-preview-title">{t("study.preview")}</h4>
        <dl>{([ ["backupSessions", pending.backup.studyData.sessions.length], ["newSessions", preview.newSessions], ["duplicates", preview.duplicates], ["conflicts", preview.conflicts.length], ["newAdjustments", preview.newAdjustments] ] as const).map(([key, value]) => <div key={key}><dt>{t(`study.${key}`)}</dt><dd>{value}</dd></div>)}<div><dt>{t("study.currentHours")}</dt><dd>{duration(preview.currentSeconds)}</dd></div><div><dt>{t("study.afterHours")}</dt><dd>{duration(preview.afterSeconds)}</dd></div></dl>
        {!!preview.conflicts.length && <p role="alert">{t("study.errors.conflict")}</p>}
        {stale && <p role="alert">{t("study.errors.stale")}</p>}
        {!!preview.goalDifferences.length && <><p>{t("study.goalDifferences")}</p><ul>{preview.goalDifferences.map(g => <li key={g.kind + g.language}>{languageName(g.language)} · {t(g.kind === "goals" ? "study.targetHours" : "study.monthlyHours")}: {number(g.local)} → {number(g.incoming)}</li>)}</ul><label>{t("study.goalChoice")}<select value={incomingGoals ? "incoming" : "local"} disabled={busy} onChange={e => { setIncomingGoals(e.target.value === "incoming"); setConfirmed(false); }}><option value="local">{t("study.keepLocal")}</option><option value="incoming">{t("study.useIncoming")}</option></select></label></>}
        <label className="study-check"><input type="checkbox" checked={confirmed} disabled={busy || stale || !!preview.conflicts.length} onChange={e => setConfirmed(e.target.checked)} />{t("study.confirmMerge")}</label>
        <div className="study-actions"><button type="button" className="primary-button" disabled={busy || !confirmed || stale || !!preview.conflicts.length} onClick={() => void action(async () => {
          const next = await updateStudyStore(current => restoreStudyBackup(current, pending.backup, pending.baseline, incomingGoals));
          setStore(next); setPending(null); setConfirmed(false); setMessage(t("study.restored"));
        })}>{t("study.merge")}</button><button type="button" className="secondary-button" disabled={busy} onClick={() => { setPending(null); setConfirmed(false); }}>{t("study.cancel")}</button></div>
      </section>}
      </section>
      <p className="study-note">{t("study.limitations")}</p>
      <p className="study-note">{t("study.compatibilityNote")}</p>
    </>}
  </section>;
}
