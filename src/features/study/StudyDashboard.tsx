import { StudyDataTransfer } from "./StudyDataTransfer";
import { StudyDriveSync } from "./StudyDriveSync";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { LANGUAGES, type StudentLanguage } from "../../config/languages";
import { languageName } from "../../i18n";
import { newStudyId, readStudyStore, readStudyCheckpoints, studyDataWithCheckpoints,
  STUDY_CHANGED, isStudyStorageKey, STUDY_MODULES, EXTRA_CATEGORIES, OTHER_STUDY_SUBCATEGORIES, StudyError, updateStudyStore, validDay,
  type ManualAdjustment, type StudyData, type StudyStore } from "./studyStorage";
import { localDay } from "./studyTrackingService";
import { studyEntries, studyStats, type StudyFilters } from "./studyStats";
import "./study.css";
import { StudyPeriodMenu } from "./StudyPeriodMenu";
import { StudyWeeklyOverview } from "./StudyWeeklyOverview";
import { StudyMonthlyOverview } from "./StudyMonthlyOverview";
import { StudyGoalGauges } from "./StudyGoalGauges";
import { StudyAverageOverview } from "./StudyAverageOverview";
import { StudyStorageOverview } from "./StudyStorageOverview";

const languages = Object.keys(LANGUAGES) as StudentLanguage[];
const HISTORY_PAGE_SIZE = 20;
const moduleKeys: Record<string, string> = { hashmap: "Hashmap", "memory-flashcards": "memory.title", "chunk-flashcards": "common.chunkFlashcards", "chunk-favorites": "favorites.title", shadowing: "common.shadowing", "basic-training": "study.basicTraining", "advanced-training": "study.advancedTraining", "review-training": "study.reviewTraining", "speaking-game": "common.speakingGame", interpretation: "common.interpretation", "extra-activities": "extras.title", previous: "study.previousHours" };
export function StudyDashboard({ language, initialSection }: { language: StudentLanguage; initialSection?: "settings" | "history" }) {
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [calendarAnchor, setCalendarAnchor] = useState<HTMLElement | null>(null);
  const closeCalendar = useMemo(() => () => setCalendarAnchor(null), []);
  const [historyVisible, setHistoryVisible] = useState(initialSection === "history");
  const [filtersVisible, setFiltersVisible] = useState(false);
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 820px)");
    const resize = () => { setFiltersVisible(false); setExpanded(false); };
    mobile.addEventListener("change", resize);
    return () => mobile.removeEventListener("change", resize);
  }, []);
  const [goalExplanationVisible, setGoalExplanationVisible] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(initialSection === "settings");
  const [scrollTarget, setScrollTarget] = useState("");
  useEffect(() => {
    if (!scrollTarget) return;
    document.getElementById(scrollTarget)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    document.getElementById(scrollTarget)?.focus({ preventScroll: true });
    setScrollTarget("");
  }, [scrollTarget]);
  const [store, setStore] = useState<StudyStore | null>(null);
  const initialSectionOpened = useRef(false);
  useEffect(() => {
    if (!store || !initialSection || initialSectionOpened.current) return;
    initialSectionOpened.current = true;
    setScrollTarget(initialSection === "settings" ? "study-data" : "study-title");
  }, [store, initialSection]);
  const [checkpoints, setCheckpoints] = useState<ReturnType<typeof readStudyCheckpoints>>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState<StudyFilters>({ language, module: "all", mode: "all", period: "today", from: localDay(new Date()), to: localDay(new Date()) });
  const [goalLanguage, setGoalLanguage] = useState(language);
  const [goalHours, setGoalHours] = useState("");
  const [monthlyHours, setMonthlyHours] = useState("");
  const [adjustLanguage, setAdjustLanguage] = useState(language);
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("0");
  const [date, setDate] = useState(localDay(new Date()));
  const [description, setDescription] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [historyPage, setHistoryPage] = useState(1);
  const fail = (e: unknown) => { setError(t(`study.errors.${e instanceof StudyError ? e.code : "storage"}`)); setMessage(""); };
  useEffect(() => {
    const refresh = () => {
      try {
        setStore(readStudyStore()); setCheckpoints(readStudyCheckpoints()); setError("");
      } catch (e) { setStore(null); setCheckpoints([]); fail(e); }
    };
    const storage = (event: StorageEvent) => { if (isStudyStorageKey(event.key)) refresh(); };
    refresh();
    window.addEventListener(STUDY_CHANGED, refresh); window.addEventListener("storage", storage);
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", visible);
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => {
      window.removeEventListener(STUDY_CHANGED, refresh); window.removeEventListener("storage", storage);
      window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", visible);
      window.clearInterval(timer);
    };
  }, [i18n.language]);
  useEffect(() => {
    setGoalHours(String(store?.studyData.goals[goalLanguage] ?? ""));
    setMonthlyHours(String(store?.studyData.monthlyGoals[goalLanguage] ?? ""));
  }, [goalLanguage, store]);
  useEffect(() => { setHistoryPage(1); }, [filters]);
  const validRange = filters.period !== "custom" || (validDay(filters.from) && validDay(filters.to) && filters.from <= filters.to);
  const displayData = useMemo(() => store && studyDataWithCheckpoints(store.studyData, checkpoints), [store, checkpoints]);
  const stats = useMemo(() => displayData && studyStats(displayData, validRange ? filters : { ...filters, period: "today" }, now), [displayData, filters, validRange, now]);
  const history = useMemo(() => store
    ? [...studyStats(store.studyData, validRange ? filters : { ...filters, period: "today" }, now).entries].sort((a, b) => b.date.localeCompare(a.date))
    : [], [store, filters, validRange, now]);
  const historyPages = Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE));
  const currentHistoryPage = Math.min(historyPage, historyPages);
  const historyRows = history.slice((currentHistoryPage - 1) * HISTORY_PAGE_SIZE, currentHistoryPage * HISTORY_PAGE_SIZE);
  useEffect(() => { setHistoryPage(page => Math.min(page, historyPages)); }, [historyPages]);
  const duration = (seconds: number) => {
    const parts = [["durationHours", Math.floor(seconds / 3600)], ["durationMinutes", Math.floor(seconds % 3600 / 60)], ["durationSeconds", Math.floor(seconds % 60)]] as const;
    return parts.filter(([, value]) => value > 0).map(([key, value]) => t(`study.${key}`, { count: value })).join(" ") || t("study.zeroDuration");
  };
  const number = (value: number) => value.toLocaleString(i18n.language, { maximumFractionDigits: 2 });
  const moduleLabel = (key: string) => key === "hashmap" ? "Mental Hashmap" : t(moduleKeys[key]);
  const applicableModules = STUDY_MODULES.filter(key => filters.origin === "internal" ? key !== "extra-activities"
    : filters.origin === "external" || (filters.extraCategory && filters.extraCategory !== "all") ? key === "extra-activities" : true);
  const moduleValues = Object.fromEntries((filters.module === "all" ? applicableModules : [filters.module])
    .map(key => [key, stats?.byModule[key] ?? 0]));
  // Keep prior-hour adjustments visible when no module filter excludes them.
  if (filters.module === "all" && stats?.byModule.previous) moduleValues.previous = stats.byModule.previous;
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
  const chart = (title: string, values: Record<string, number>, label: (key: string) => string = key => key, total?: number, modules = false, sectionId?: string) => {
    const entries = Object.entries(values).sort(modules
      ? ([a, secondsA], [b, secondsB]) => secondsB - secondsA || label(a).localeCompare(label(b), i18n.language)
      : ([a], [b]) => a.localeCompare(b));
    const max = Math.max(1, ...entries.map(([, seconds]) => seconds));
    const scale = Math.max(1, total ?? max);
    return <section id={sectionId} tabIndex={sectionId ? -1 : undefined} className="study-panel bej-chart-card"><h3>{title}</h3>{!entries.length ? <p>{t("study.empty")}</p> : <ul className={modules ? "study-chart study-chart-modules" : "study-chart"}>{entries.map(([key, seconds]) => <li key={key}>
      <div><span>{label(key)}</span><strong>{duration(seconds)}{total !== undefined && ` · ${number(seconds / scale * 100)}%`}</strong></div><div className="study-bar" aria-hidden="true"><span style={{ width: `${seconds / scale * 100}%` }} /></div>
    </li>)}</ul>}</section>;
  };
  const informationIcon = <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7" r="1" fill="currentColor" stroke="none"/></svg>;
  const dashboardControls = (floating = false) => <>
        {!floating && <button type="button" className="secondary-button study-dashboard-filter-button" aria-label={t(filtersVisible ? "navigation.hideFilters" : "navigation.showFilters")} title={t(filtersVisible ? "navigation.hideFilters" : "navigation.showFilters")} aria-expanded={filtersVisible} aria-controls="study-filters" onClick={() => { closeCalendar(); setFiltersVisible(!filtersVisible); }}><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M7 12h10m-7 5h4"/></svg><span>{t("study.filters")}</span></button>}
        <button type="button" className={floating ? "study-floating-calendar" : "secondary-button study-icon-button"} aria-label={t("study.calendar")} title={t("study.calendar")} aria-expanded={!!calendarAnchor} aria-controls="study-period-menu"
          onClick={event => { const button = event.currentTarget; setCalendarAnchor(current => current === button ? null : button); }}><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18m-12 4h2m2 0h2m2 0h2m-8 3h2m2 0h2"/></svg></button>
        <button type="button" className={floating ? "study-floating-history" : "secondary-button study-icon-button"} aria-label={t("study.historyTitle")} title={t("study.historyTitle")} onClick={() => { closeCalendar(); setExpanded(false); setHistoryVisible(true); setScrollTarget("study-title"); }}><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 11a9 9 0 1 1 2 7M3 4v7h7m2-5v6l4 2" /></svg></button>
        <button type="button" className={floating ? "study-floating-settings" : "secondary-button study-icon-button"} aria-label={t("study.settings")} title={t("study.settings")} aria-expanded={settingsVisible} aria-controls="study-settings" onClick={() => { closeCalendar(); setExpanded(false); setSettingsVisible(!settingsVisible); setScrollTarget(settingsVisible ? "study-results" : "study-settings"); }}><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 3-1 3-3 1-2 4 2 2v4l4 2 3-1 3 1 4-2v-4l2-2-2-4-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/></svg></button>
        <button type="button" className={floating ? "study-floating-info" : "secondary-button study-icon-button"} aria-label={t(detailsVisible ? "study.hideDetails" : "study.showDetails")} title={t(detailsVisible ? "study.hideDetails" : "study.showDetails")} aria-expanded={detailsVisible} aria-controls="study-details" onClick={() => { closeCalendar(); setExpanded(false); setDetailsVisible(!detailsVisible); if (floating && !detailsVisible) setScrollTarget("study-details"); }}>{informationIcon}</button>
  </>;
  return <section className="study-dashboard" aria-labelledby="study-title">
    <header className="study-header"><div><h2 id="study-title" tabIndex={-1}>{t(historyVisible ? "study.historyTitle" : "study.title")}</h2><p>{t("study.intro")}</p></div><div className="study-actions">
      {historyVisible ? <button type="button" className="secondary-button" onClick={() => { setHistoryVisible(false); setScrollTarget("study-title"); }}>{t("study.backDashboard")}</button> : <>
      {dashboardControls()}
    </>}
    </div></header>
    {error && <p className="status-card error-card" role="alert">{error}</p>}
    {message && <p className="study-feedback" role="status">{message}</p>}
    {!store || !stats ? <p>{t("study.unavailable")}</p> : <>
      <div id="study-filters" tabIndex={-1} hidden={!historyVisible && !filtersVisible}><fieldset className="study-panel study-filters" disabled={busy}><legend>{t("study.filters")}</legend>
        <label>{t("study.language")}<select value={filters.language} onChange={e => setFilters({ ...filters, language: e.target.value as StudyFilters["language"] })}><option value="all">{t("study.allLanguages")}</option>{languages.map(code => <option key={code} value={code}>{languageName(code)}</option>)}</select></label>
        <label>{t("study.module")}<select value={filters.module} onChange={e => setFilters({ ...filters, module: e.target.value as StudyFilters["module"] })}><option value="all">{t("study.allModules")}</option>{STUDY_MODULES.map(key => <option key={key} value={key}>{moduleLabel(key)}</option>)}</select></label>
        <label>{t("study.mode")}<select value={filters.mode} onChange={e => setFilters({ ...filters, mode: e.target.value as StudyFilters["mode"] })}>{["all", "manual", "walking"].map(key => <option key={key} value={key}>{t(`study.modes.${key}`)}</option>)}</select></label>
        <label>{t("study.period")}<select value={filters.period} onChange={e => setFilters({ ...filters, period: e.target.value as StudyFilters["period"] })}>{["today", "yesterday", "7", "30", "month", "90", "all", "custom"].map(key => <option key={key} value={key}>{t(`study.periods.${key}`)}</option>)}</select></label>
        <label>{t("extras.origin")}<select value={filters.origin ?? "all"} onChange={e => setFilters({ ...filters, origin: e.target.value as StudyFilters["origin"] })}>{["all", "internal", "external"].map(key => <option key={key} value={key}>{t(`extras.origins.${key}`)}</option>)}</select></label>
        {filters.origin !== "internal" && <label>{t("extras.category")}<select value={filters.extraCategory ?? "all"} onChange={e => setFilters({ ...filters, extraCategory: e.target.value as StudyFilters["extraCategory"], extraSubcategory: "all" })}><option value="all">{t("extras.allCategories")}</option>{EXTRA_CATEGORIES.map(key => <option key={key} value={key}>{t(`extras.categories.${key}`)}</option>)}</select></label>}
        {filters.origin !== "internal" && filters.extraCategory === "other" && <label>{t("extras.subcategory")}<select value={filters.extraSubcategory ?? "all"} onChange={e => setFilters({ ...filters, extraSubcategory: e.target.value as StudyFilters["extraSubcategory"] })}><option value="all">{t("extras.allSubcategories")}</option>{OTHER_STUDY_SUBCATEGORIES.map(key => <option key={key} value={key}>{t(`extras.subcategories.${key}`)}</option>)}</select></label>}
        {filters.period === "custom" && <><label>{t("study.from")}<input type="date" value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })} /></label><label>{t("study.to")}<input type="date" value={filters.to} onChange={e => setFilters({ ...filters, to: e.target.value })} /></label></>}
      </fieldset>
      </div>
      {!validRange && <p role="alert">{t("study.errors.invalid")}</p>}
      <div id="study-results" className="study-content" tabIndex={-1} hidden={historyVisible}>
      <StudyWeeklyOverview data={displayData!} now={now} />
      <StudyMonthlyOverview data={displayData!} now={now} language={filters.language} />
      <StudyGoalGauges data={displayData!} goals={store.studyData.goals} monthlyGoals={store.studyData.monthlyGoals} language={filters.language} now={now}
        explanationVisible={goalExplanationVisible} onToggleExplanation={() => setGoalExplanationVisible(current => !current)} />
      <StudyAverageOverview data={displayData!} now={now} language={filters.language} />
      <div className="bej-visual-chart-grid">
        {chart(`${t("study.byModule")} · ${t(`study.periods.${filters.period}`)}`, moduleValues, moduleLabel, stats.total, true, "study-time-by-module")}
        {chart(`${t("study.byLanguage")} · ${t(`study.periods.${filters.period}`)}`, stats.byLanguage, code => languageName(code as StudentLanguage), stats.total)}
      </div>
      {chart(t("extras.byCategory"), Object.fromEntries(EXTRA_CATEGORIES.map(key => [key, stats.byExtraCategory[key] ?? 0])), key => t(`extras.categories.${key}`), stats.external, true)}
      {chart(t("extras.byOtherSubcategory"), Object.fromEntries(OTHER_STUDY_SUBCATEGORIES.map(key => [key, stats.byOtherSubcategory[key] ?? 0])), key => t(`extras.subcategories.${key}`), stats.byExtraCategory.other ?? 0, true)}
      <div id="study-details" tabIndex={-1} className="study-content" hidden={!detailsVisible}>
      <div className="study-metrics">{([ ["accumulated", stats.total], ["today", stats.today], ["week", stats.week], ["month", stats.month], ["dailyAverage", stats.average] ] as const).map(([key, seconds]) => <div className="study-panel" key={key}><span>{t(`study.${key}`)}</span><strong>{duration(seconds)}</strong></div>)}
        {([ ["internalTime", stats.internal], ["externalTime", stats.external], ["consolidated", stats.total] ] as const).map(([key, seconds]) => <div className="study-panel" key={key}><span>{t(`extras.${key}`)}</span><strong>{duration(seconds)}</strong></div>)}
        {([ ["studyDays", stats.studyDays], ["streak", stats.streak], ["longest", stats.longest] ] as const).map(([key, count]) => <div className="study-panel" key={key}><span>{t(`study.${key}`)}</span><strong>{number(count)}</strong></div>)}
      </div><p className="study-note">{t("study.streakNote")}</p>

      {chart(t("study.timeline"), stats.timeline)}
      </div>
      <div id="study-settings" tabIndex={-1} hidden={!settingsVisible} className="study-charts"><form className="study-panel" onSubmit={saveGoals}><fieldset disabled={busy}><legend>{t("study.goals")}</legend>
        <label>{t("study.language")}<select value={goalLanguage} onChange={e => setGoalLanguage(e.target.value as StudentLanguage)}>{languages.map(code => <option key={code} value={code}>{languageName(code)}</option>)}</select></label>
        <label>{t("study.targetHours")}<input type="number" min="0.01" max="10000000" step="0.01" required value={goalHours} onChange={e => setGoalHours(e.target.value)} /></label>
        <label>{t("study.monthlyHours")}<input type="number" min="0.01" max="10000000" step="0.01" value={monthlyHours} onChange={e => setMonthlyHours(e.target.value)} /></label>
        <button type="submit" className="primary-button">{t("study.save")}</button>
      </fieldset></form>
      <form id="study-adjustment" tabIndex={-1} className="study-panel" onSubmit={saveAdjustment}><fieldset disabled={busy}><legend>{t(editing ? "study.editAdjustment" : "study.previousHours")}</legend>
        <label>{t("study.language")}<select value={adjustLanguage} onChange={e => setAdjustLanguage(e.target.value as StudentLanguage)}>{languages.map(code => <option key={code} value={code}>{languageName(code)}</option>)}</select></label>
        <label>{t("study.hours")}<input type="number" min="0" max="10000000" step="1" required value={hours} onChange={e => setHours(e.target.value)} /></label>
        <label>{t("study.minutes")}<input type="number" min="0" max="59" step="1" required value={minutes} onChange={e => setMinutes(e.target.value)} /></label>
        <label>{t("study.date")}<input type="date" required max={localDay(now)} value={date} onChange={e => setDate(e.target.value)} /></label>
        <label>{t("study.description")}<input maxLength={1000} value={description} onChange={e => setDescription(e.target.value)} /></label>
        <div className="study-actions"><button type="submit" className="primary-button">{t("study.save")}</button>{editing && <button type="button" className="secondary-button" onClick={resetAdjustment}>{t("study.cancel")}</button>}</div>
      </fieldset></form></div>
      </div>
      <section hidden={!historyVisible} className="study-panel"><h3>{t("study.history")}</h3>{!history.length ? <p>{t("study.empty")}</p> : <ul id="study-history-list" className="study-history">{historyRows.map(e => <li key={`${e.module}:${e.id}:${e.date}`}>
        <div><time dateTime={e.date}>{new Date(e.date + "T12:00:00").toLocaleDateString(i18n.language)}</time><strong>{languageName(e.language)}</strong><span>{moduleLabel(e.module)} · {t(`study.modes.${e.mode}`)}</span>{e.category && <span>{t(`extras.categories.${e.category}`)}{e.category === "other" && ` · ${t(`extras.subcategories.${e.subcategory ?? "misc"}`)}`}</span>}<strong>{duration(e.seconds)}</strong>{e.description && <span>{e.description}</span>}{e.note && <span>{e.note}</span>}</div>
        {e.module === "previous" && <div className="study-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => { setHistoryVisible(false); setSettingsVisible(true); setScrollTarget("study-adjustment"); setEditing(e.id); setAdjustLanguage(e.language); setHours(String(Math.floor(e.seconds / 3600))); setMinutes(String(Math.floor(e.seconds % 3600 / 60))); setDate(e.date); setDescription(e.description ?? ""); }}>{t("study.edit")}</button>
          <button type="button" className="secondary-button" disabled={busy} onClick={() => { if (window.confirm(t("study.confirmDelete"))) void action(async () => { await changeData(data => ({ ...data, manualAdjustments: data.manualAdjustments.filter(a => a.id !== e.id) })); if (editing === e.id) resetAdjustment(); setMessage(t("study.saved")); }); }}>{t("study.delete")}</button></div>}
      </li>)}</ul>}{history.length > 0 && <nav className="study-actions study-history-pagination" aria-label={t("study.historyPages")}>
        <button type="button" className="secondary-button" aria-controls="study-history-list" disabled={currentHistoryPage === 1} onClick={() => setHistoryPage(currentHistoryPage - 1)}>{t("common.previous")}</button>
        <span role="status">{t("study.historyPage", { page: currentHistoryPage, total: historyPages, count: history.length })}</span>
        <button type="button" className="secondary-button" aria-controls="study-history-list" disabled={currentHistoryPage === historyPages} onClick={() => setHistoryPage(currentHistoryPage + 1)}>{t("common.next")}</button>
      </nav>}</section>
      {!historyVisible && <StudyStorageOverview />}
      {!historyVisible && <StudyDriveSync />}
      <section id="study-data" tabIndex={-1} hidden={historyVisible} className="study-panel">
      <StudyDataTransfer mode="restore" disabled={busy} onBusyChange={setBusy} />
      </section>
      {calendarAnchor && <StudyPeriodMenu anchor={calendarAnchor} period={filters.period} onClose={closeCalendar} onSelect={period => { setFilters(current => ({ ...current, period })); closeCalendar(); setHistoryVisible(false); setScrollTarget("study-time-by-module"); }} />}
      <p hidden={historyVisible} className="study-note">{t("study.limitations")}</p>
      <p hidden={historyVisible} className="study-note">{t("study.compatibilityNote")}</p>
        {!historyVisible && document.getElementById("app-floating-controls") && createPortal(<div className="study-mobile-controls"><div id="study-mobile-actions" className="study-mobile-actions" hidden={!expanded}>{dashboardControls(true)}<button type="button" className="hashmap-filter-toggle" aria-label={t(filtersVisible ? "navigation.hideFilters" : "navigation.showFilters")} title={t(filtersVisible ? "navigation.hideFilters" : "navigation.showFilters")} aria-expanded={filtersVisible} aria-controls="study-filters" onClick={() => { closeCalendar(); setExpanded(false); setFiltersVisible(!filtersVisible); setScrollTarget(filtersVisible ? "study-results" : "study-filters"); }}><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg></button></div><button type="button" aria-label={t("study.moreOptions")} title={t("study.moreOptions")} aria-expanded={expanded} aria-controls="study-mobile-actions" onClick={() => { closeCalendar(); setExpanded(!expanded); }}><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg></button></div>, document.getElementById("app-floating-controls")!)}
    </>}
  </section>;
}
