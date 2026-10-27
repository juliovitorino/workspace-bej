import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SourceLanguage, StudentLanguage } from "../../config/languages";
import { LANGUAGES } from "../../config/languages";
import { useTrainingStudy, type TrainingStudyReporter } from "../study/useTrainingStudy";
import { loadWouldYouRather, normalizeWyrSearch, type WyrData, type WyrQuestion, type WyrTopic } from "./wouldYouRatherService";
import { readWyrStored, saveWyrChoices, saveWyrFavorites, type WyrChoice } from "./wouldYouRatherStorage";
import "./wouldYouRather.css";

type Screen = "catalog" | "practice" | "summary";
type PracticeSet = { title: string; questions: WyrQuestion[]; topic: WyrTopic | null };
const CATEGORY_NAMES: Record<string, string> = {
  "everyday-life": "Everyday Life", lifestyle: "Lifestyle", "travel-adventure": "Travel & Adventure",
  entertainment: "Entertainment", technology: "Technology", "work-money": "Work & Money",
  relationships: "Relationships", "personal-growth": "Personal Growth", "fun-imagination": "Fun & Imagination", "deep-conversations": "Deep Conversations"
};

function Icon({ kind }: { kind: "copy" | "translate" }) {
  return kind === "copy" ? (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>
  ) : (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h12M10 3v2m4 0c-.5 6-3 10-8 13M6 9c1 3 4 6 8 8M13 21l5-11 5 11m-8-4h6"/></svg>
  );
}

interface TextCardProps {
  label: string; text: string; effectiveLocale: StudentLanguage; targetLocale: StudentLanguage;
  onNotice: (message: string) => void; reveal?: boolean; onReveal?: () => void;
  selected?: boolean; onSelect?: () => void; copyLabel: string; translateLabel: string;
  showLabel: string; hideLabel: string; copySuccess: string; copyError: string;
}
function TextCard({ label, text, effectiveLocale, targetLocale, onNotice, reveal, onReveal, selected, onSelect, copyLabel, translateLabel, showLabel, hideLabel, copySuccess, copyError }: TextCardProps) {
  const isAnswer = onReveal !== undefined;
  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(text);
      onNotice(copySuccess);
    } catch { onNotice(copyError); }
  }
  function translate() {
    const sl = effectiveLocale.slice(0, 2);
    const tl = targetLocale.slice(0, 2);
    const url = `https://translate.google.com/?sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&text=${encodeURIComponent(text)}&op=translate`;
    window.open(url, "_blank", "noopener,noreferrer");
  }
  return (
    <div className={`wyr-card${onSelect ? " wyr-card--option" : ""}${selected ? " wyr-card--selected" : ""}`}>
      <div className="wyr-card-head">
        <span className="wyr-card-label">{label}</span>
        <div className="wyr-card-actions">
          <button type="button" className="wyr-icon-button" aria-label={copyLabel} title={copyLabel} onClick={event => { event.stopPropagation(); void copy(); }}><Icon kind="copy" /></button>
          <button type="button" className="wyr-icon-button" aria-label={translateLabel} title={translateLabel} onClick={event => { event.stopPropagation(); translate(); }}><Icon kind="translate" /></button>
        </div>
      </div>
      {isAnswer ? (
        <div>
          {reveal && <p className="wyr-card-text">{text}</p>}
          <button type="button" className="wyr-reveal" aria-expanded={!!reveal} onClick={onReveal}>{reveal ? hideLabel : showLabel}</button>
        </div>
      ) : onSelect ? (
        <button type="button" className="wyr-option-select" aria-pressed={!!selected} onClick={onSelect}>
          <span className="wyr-radio" aria-hidden="true">{selected ? "✓" : ""}</span><span>{text}</span>
        </button>
      ) : <p className="wyr-card-text wyr-question-text">{text}</p>}
    </div>
  );
}

export function WouldYouRather({ language, sourceLanguage, onStudyState }: { language: StudentLanguage; sourceLanguage: SourceLanguage; onStudyState?: TrainingStudyReporter }) {
  const { t } = useTranslation();
  const tr = (key: string, opts?: Record<string, string | number>) => t(`wyr.${key}`, opts);
  const [loaded, setLoaded] = useState<{ data: WyrData; locale: StudentLanguage; fallback: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [screen, setScreen] = useState<Screen>("catalog");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [levelFilter, setLevelFilter] = useState("all");
  const [stored] = useState(readWyrStored);
  const [favorites, setFavorites] = useState<string[]>(stored.favorites);
  const [choices, setChoices] = useState<Record<string, WyrChoice>>(stored.choices);
  const [storageError, setStorageError] = useState(stored.storageError);
  const [practiceSet, setPracticeSet] = useState<PracticeSet | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState({ A: false, B: false });
  const [notice, setNotice] = useState("");
  const [lastRandom, setLastRandom] = useState<string | null>(null);
  const { recordActivity } = useTrainingStudy(language, screen === "practice" && !!loaded && !loading, loading, false, onStudyState);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setLoaded(null); setScreen("catalog");
    void loadWouldYouRather(language, controller.signal).then(result => {
      if (!controller.signal.aborted) { setLoaded(result); setLoading(false); }
    }).catch(err => {
      if (!controller.signal.aborted) { setError(err instanceof Error ? err.message : tr("loadError")); setLoading(false); }
    });
    return () => controller.abort();
  }, [language, retry]);

  const allTopics = useMemo(() => [...(loaded?.data.topics ?? [])].sort((a, b) => a.order - b.order), [loaded]);
  const filteredTopics = useMemo(() => allTopics.filter(topic => {
    if (categoryFilter !== "all" && topic.category !== categoryFilter) return false;
    if (levelFilter !== "all" && topic.level !== levelFilter) return false;
    const term = normalizeWyrSearch(search);
    if (term && !normalizeWyrSearch(`${topic.title} ${topic.questions.map(q => `${q.question} ${q.options.A.text} ${q.options.B.text}`).join(" ")}`).includes(term)) return false;
    return !favoritesOnly || topic.questions.some(q => favorites.includes(q.id));
  }), [allTopics, categoryFilter, levelFilter, search, favoritesOnly, favorites]);
  const eligible = useMemo(() => filteredTopics.flatMap(topic => topic.questions.filter(q => !favoritesOnly || favorites.includes(q.id))), [filteredTopics, favoritesOnly, favorites]);
  const groups = useMemo(() => {
    const map = new Map<string, WyrTopic[]>();
    filteredTopics.forEach(topic => map.set(topic.category, [...(map.get(topic.category) ?? []), topic]));
    return [...map.entries()];
  }, [filteredTopics]);
  const totalQuestions = allTopics.reduce((sum, topic) => sum + topic.questions.length, 0);
  const current = practiceSet?.questions[index];
  const topic = practiceSet?.topic;
  const targetLocale = sourceLanguage === (loaded?.locale ?? "en-US") ? (language === sourceLanguage ? "pt-BR" : language) : sourceLanguage;
  const completedCount = (questions: WyrQuestion[]) => questions.filter(q => choices[q.id]).length;

  function startSet(set: PracticeSet, startIndex = 0) {
    if (!set.questions.length) return;
    setPracticeSet(set); setIndex(startIndex); setRevealed({ A: false, B: false }); setNotice(""); setScreen("practice");
  }
  function choose(choice: WyrChoice) {
    if (!current) return;
    recordActivity();
    // Ao trocar a alternativa, ocultar a resposta anterior.
    setRevealed({ A: false, B: false });
    const next = { ...choices, [current.id]: choice };
    setChoices(next);
    if (!saveWyrChoices(next)) setStorageError(true);
  }
  function toggleFavorite() {
    if (!current) return;
    recordActivity();
    const next = favorites.includes(current.id) ? favorites.filter(id => id !== current.id) : [...favorites, current.id];
    setFavorites(next);
    if (!saveWyrFavorites(next)) setStorageError(true);
  }
  function go(next: number) {
    if (!practiceSet) return;
    recordActivity();
    if (next >= practiceSet.questions.length) { setScreen("summary"); return; }
    if (next < 0) return;
    setIndex(next); setRevealed({ A: false, B: false }); setNotice("");
  }
  function random() {
    if (!eligible.length) return;
    const pool = eligible.length > 1 ? eligible.filter(q => q.id !== lastRandom) : eligible;
    const question = pool[Math.floor(Math.random() * pool.length)];
    setLastRandom(question.id);
    startSet({ title: tr("random"), questions: [question], topic: allTopics.find(topic => topic.questions.some(q => q.id === question.id)) ?? null });
  }
  function openTopic(topic: WyrTopic) {
    const questions = [...topic.questions].filter(q => !favoritesOnly || favorites.includes(q.id)).sort((a, b) => a.order - b.order);
    startSet({ title: topic.title, questions, topic });
  }
  function openFavorites() {
    const questions = allTopics.flatMap(topic => topic.questions.filter(q => favorites.includes(q.id)));
    startSet({ title: tr("favorites"), questions, topic: null });
  }
  function goNextTopic() {
    if (!topic) { setScreen("catalog"); return; }
    const next = allTopics.find(t => t.order > topic.order);
    if (next) openTopic(next); else setScreen("catalog");
  }
  const card = (label: string, text: string, key: "question" | "optionA" | "optionB" | "answerA" | "answerB", extra?: { select?: () => void; selected?: boolean; reveal?: boolean; toggle?: () => void }) => (
    <TextCard key={key} label={label} text={text} effectiveLocale={loaded?.locale ?? "en-US"} targetLocale={targetLocale}
      onNotice={setNotice} copyLabel={tr(`copy.${key}`)} translateLabel={tr(`translate.${key}`)} copySuccess={tr("copied")} copyError={tr("copyError")}
      showLabel={tr(key === "answerA" ? "showA" : "showB")} hideLabel={tr(key === "answerA" ? "hideA" : "hideB")}
      onSelect={extra?.select} selected={extra?.selected} reveal={extra?.reveal} onReveal={extra?.toggle} />
  );

  return <section className="wyr-root" aria-label="Would You Rather Game">
    <header className="wyr-heading"><div><h1>Would You Rather?</h1><p>Speaking &amp; Small Talk</p></div>
      {screen !== "catalog" && <button type="button" className="wyr-button wyr-button--ghost" onClick={() => { setScreen("catalog"); setNotice(""); }}>{tr("backToTopics")}</button>}
    </header>
    {loading && <p role="status" className="wyr-message">{tr("loading")}</p>}
    {!loading && error && <div className="wyr-message" role="alert"><p>{tr("loadError")}: {error}</p><button type="button" className="wyr-button" onClick={() => setRetry(n => n + 1)}>{tr("retry")}</button></div>}
    {!loading && loaded && <>
      {loaded.fallback && <p className="wyr-notice" role="status">{tr("fallback")}</p>}
      {storageError && <p className="wyr-notice" role="alert">{tr("storageWarning")}</p>}
      {screen === "catalog" && <>
        <div className="wyr-stats"><div><strong>{allTopics.length}</strong><span>{tr("topics")}</span></div><div><strong>{totalQuestions}</strong><span>{tr("questions")}</span></div><div><strong>{totalQuestions * 2}</strong><span>{tr("answers")}</span></div></div>
        <div className="wyr-filters">
          <label>{tr("search")}<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={tr("searchPlaceholder")} /></label>
          <label>{tr("category")}<select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option value="all">{tr("all")}</option>{[...new Set(allTopics.map(t => t.category))].map(cat => <option value={cat} key={cat}>{CATEGORY_NAMES[cat] ?? cat}</option>)}</select></label>
          <label>{tr("level")}<select value={levelFilter} onChange={e => setLevelFilter(e.target.value)}><option value="all">{tr("all")}</option>{[...new Set(allTopics.map(t => t.level))].map(level => <option value={level} key={level}>{level}</option>)}</select></label>
        </div>
        <div className="wyr-catalog-actions">
          <label className="wyr-check"><input type="checkbox" checked={favoritesOnly} onChange={e => setFavoritesOnly(e.target.checked)}/>{tr("onlyFavorites")}</label>
          <button type="button" className="wyr-button" onClick={random} disabled={!eligible.length}>🎲 {tr("random")}</button>
          <button type="button" className="wyr-button wyr-button--ghost" onClick={openFavorites} disabled={!favorites.length}>★ {tr("favorites")} ({favorites.length})</button>
        </div>
        {groups.length === 0 && <p className="wyr-message">{tr("empty")}</p>}
        {groups.map(([category, topics]) => <details key={category} className="wyr-category" open>
          <summary>{CATEGORY_NAMES[category] ?? category} <span>{topics.length} {tr("topics")}</span></summary>
          <div className="wyr-topic-grid">{topics.map(topic => {
            const total = topic.questions.length;
            const completed = completedCount(topic.questions);
            return <button key={topic.id} type="button" className="wyr-topic" onClick={() => openTopic(topic)}>
              <span className="wyr-topic-title">{String(topic.order).padStart(2, "0")}. {topic.title}</span>
              <span className="wyr-topic-meta">{total} {tr("questions")} · {topic.level} · {completed}/{total} {tr("completed")}</span>
              <span className="wyr-progress"><span style={{ width: `${100 * completed / total}%` }} /></span>
            </button>;
          })}</div>
        </details>)}
      </>}
      {screen === "practice" && current && practiceSet && <div className="wyr-practice">
        <div className="wyr-practice-meta"><span>{LANGUAGES[sourceLanguage].flag} → {LANGUAGES[loaded.locale].flag} · {practiceSet.title} · {current.level}</span><span>{index + 1}/{practiceSet.questions.length}</span></div>
        <div className="wyr-practice-progress"><span style={{ width: `${100 * (index + 1) / practiceSet.questions.length}%` }} /></div>
        <div className="wyr-practice-tools"><span>{tr("speakHint")}</span><button type="button" className="wyr-star" aria-pressed={favorites.includes(current.id)} aria-label={favorites.includes(current.id) ? tr("removeFavorite") : tr("addFavorite")} title={tr("favorites")} onClick={toggleFavorite}>{favorites.includes(current.id) ? "★" : "☆"}</button></div>
        {card(tr("question"), current.question, "question")}
        {card(tr("optionA"), current.options.A.text, "optionA", { select: () => choose("A"), selected: choices[current.id] === "A" })}
        {card(tr("optionB"), current.options.B.text, "optionB", { select: () => choose("B"), selected: choices[current.id] === "B" })}
        {choices[current.id] === "A" && card(tr("answerA"), current.options.A.answer, "answerA", { reveal: revealed.A, toggle: () => { recordActivity(); setRevealed(p => ({ ...p, A: !p.A })); } })}
        {choices[current.id] === "B" && card(tr("answerB"), current.options.B.answer, "answerB", { reveal: revealed.B, toggle: () => { recordActivity(); setRevealed(p => ({ ...p, B: !p.B })); } })}
        {notice && <p role="status" className="wyr-notice">{notice}</p>}
        <div className="wyr-navigation"><button type="button" className="wyr-button wyr-button--ghost" onClick={() => go(index - 1)} disabled={index === 0}>‹ {tr("previous")}</button><button type="button" className="wyr-button" onClick={() => go(index + 1)}>{index + 1 === practiceSet.questions.length ? tr("finish") : tr("next")} ›</button></div>
      </div>}
      {screen === "summary" && practiceSet && <div className="wyr-summary">
        <div className="wyr-summary-check" aria-hidden="true">✓</div><h2>{tr("finished")}</h2><p>{practiceSet.title}</p>
        <div className="wyr-stats"><div><strong>{completedCount(practiceSet.questions)}/{practiceSet.questions.length}</strong><span>{tr("completed")}</span></div><div><strong>{practiceSet.questions.filter(q => favorites.includes(q.id)).length}</strong><span>{tr("favorites")}</span></div></div>
        <div className="wyr-summary-actions"><button type="button" className="wyr-button" onClick={() => startSet(practiceSet)}>{tr("review")}</button><button type="button" className="wyr-button wyr-button--ghost" onClick={() => setScreen("catalog")}>{tr("backToTopics")}</button>{topic && <button type="button" className="wyr-button wyr-button--ghost" onClick={goNextTopic}>{tr("nextTopic")}</button>}</div>
      </div>}
    </>}
  </section>;
}
