import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SourceLanguage, StudentLanguage } from "../../config/languages";
import { LANGUAGES } from "../../config/languages";
import { useTrainingStudy, type TrainingStudyReporter } from "../study/useTrainingStudy";
import { loadWouldYouRather, normalizeWyrSearch, type WyrData, type WyrQuestion, type WyrTopic } from "./wouldYouRatherService";
import { readWyrStored, saveWyrChoices, saveWyrFavorites, readWyrAnswers, saveWyrAnswers, wyrAnswerKey, readWyrFontSize, saveWyrFontSize, type WyrChoice, type WyrCustomAnswers, type WyrFontSize } from "./wouldYouRatherStorage";
import "./wouldYouRather.css";

type Screen = "catalog" | "practice" | "summary";
type PracticeSet = { title: string; questions: WyrQuestion[]; topic: WyrTopic | null };
const CATEGORY_NAMES: Record<string, string> = {
  "everyday-life": "Everyday Life", lifestyle: "Lifestyle", "travel-adventure": "Travel & Adventure",
  entertainment: "Entertainment", technology: "Technology", "work-money": "Work & Money",
  relationships: "Relationships", "personal-growth": "Personal Growth", "fun-imagination": "Fun & Imagination", "deep-conversations": "Deep Conversations"
};

function Icon({ kind }: { kind: "copy" | "translate" | "audio" | "edit" }) {
  if (kind === "audio") return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 9a5 5 0 0 1 0 6M18 6a9 9 0 0 1 0 12"/></svg>;
  if (kind === "edit") return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 5 4 4M4 20l4.5-1 11-11a2.83 2.83 0 0 0-4-4l-11 11L4 20Z"/></svg>;

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
  fontSize?: WyrFontSize; onFontSize?: (size: WyrFontSize) => void;
  onSaveAnswer?: (value: string | null) => void; originalAnswer?: string;
}
function TextCard(props: TextCardProps) {
  const { label, text, effectiveLocale, targetLocale, onNotice, reveal, onReveal, selected, onSelect,
    copyLabel, translateLabel, showLabel, hideLabel, copySuccess, copyError, fontSize = "medium",
    onFontSize, onSaveAnswer, originalAnswer } = props;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const isAnswer = onReveal !== undefined;
  const lang = effectiveLocale.slice(0, 2);
  const labels = lang === "pt" ?
    { small: "Fonte pequena", medium: "Fonte média", large: "Fonte grande", audio: "Ouvir resposta", edit: "Editar resposta", save: "Salvar", cancel: "Cancelar", restore: "Restaurar original", draft: "Minha resposta" } :
    lang === "es" ? { small: "Letra pequeña", medium: "Letra mediana", large: "Letra grande", audio: "Escuchar respuesta", edit: "Editar respuesta", save: "Guardar", cancel: "Cancelar", restore: "Restaurar original", draft: "Mi respuesta" } :
    lang === "fr" ? { small: "Petite police", medium: "Police moyenne", large: "Grande police", audio: "Écouter la réponse", edit: "Modifier la réponse", save: "Enregistrer", cancel: "Annuler", restore: "Restaurer l’original", draft: "Ma réponse" } :
    { small: "Small font", medium: "Medium font", large: "Large font", audio: "Listen to answer", edit: "Edit answer", save: "Save", cancel: "Cancel", restore: "Restore original", draft: "My answer" };
  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(text);
      onNotice(copySuccess);
    } catch { onNotice(copyError); }
  }
  function translate() {
    const sl = effectiveLocale.slice(0, 2), tl = targetLocale.slice(0, 2);
    window.open("https://translate.google.com/?sl=" + encodeURIComponent(sl) + "&tl=" + encodeURIComponent(tl) +
      "&text=" + encodeURIComponent(text) + "&op=translate", "_blank", "noopener,noreferrer");
  }
  function speak() {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      onNotice("Speech synthesis is not available on this device."); return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = effectiveLocale; utterance.rate = 0.92;
    window.speechSynthesis.speak(utterance);
  }
  return (
    <div className={"wyr-card" + (onSelect ? " wyr-card--option" : "") + (selected ? " wyr-card--selected" : "")}>
      <div className="wyr-card-head">
        <span className="wyr-card-label">{label}</span>
        <div className="wyr-card-actions">
          <button type="button" className="wyr-icon-button" aria-label={copyLabel} title={copyLabel} onClick={event => { event.stopPropagation(); void copy(); }}><Icon kind="copy" /></button>
          <button type="button" className="wyr-icon-button" aria-label={translateLabel} title={translateLabel} onClick={event => { event.stopPropagation(); translate(); }}><Icon kind="translate" /></button>
        </div>
      </div>
      {isAnswer ? <div>
        {reveal && <>
          <p className={"wyr-card-text wyr-answer-text wyr-answer-text--" + fontSize}>{text}</p>
          <div className="wyr-answer-controls" aria-label={label}>
            <div className="wyr-font-controls" role="group" aria-label="Font size">
              {(["small", "medium", "large"] as const).map(size =>
                <button type="button" key={size} className={"wyr-answer-control wyr-font-" + size + (fontSize === size ? " wyr-control-active" : "")}
                  title={labels[size]} aria-label={labels[size]} aria-pressed={fontSize === size} onClick={() => onFontSize?.(size)}>A</button>)}
            </div>
            <button type="button" className="wyr-answer-control" title={labels.audio} aria-label={labels.audio} onClick={speak}><Icon kind="audio" /></button>
            <button type="button" className="wyr-answer-control" title={labels.edit} aria-label={labels.edit} onClick={() => { setDraft(text); setEditing(value => !value); }}><Icon kind="edit" /></button>
          </div>
          {editing && <div className="wyr-answer-editor">
            <label>{labels.draft}<textarea rows={5} maxLength={10000} value={draft} onChange={event => setDraft(event.target.value)} /></label>
            <div className="wyr-editor-actions">
              <button type="button" className="wyr-button" disabled={!draft.trim()} onClick={() => { onSaveAnswer?.(draft.trim()); setEditing(false); }}>{labels.save}</button>
              <button type="button" className="wyr-button wyr-button--ghost" onClick={() => setEditing(false)}>{labels.cancel}</button>
              <button type="button" className="wyr-button wyr-button--ghost" disabled={text === originalAnswer}
                onClick={() => { onSaveAnswer?.(null); setDraft(originalAnswer ?? ""); setEditing(false); }}>{labels.restore}</button>
            </div>
          </div>}
        </>}
        <button type="button" className="wyr-reveal" aria-expanded={!!reveal} onClick={onReveal}>{reveal ? hideLabel : showLabel}</button>
      </div> : onSelect ?
        <button type="button" className="wyr-option-select" aria-pressed={!!selected} onClick={onSelect}>
          <span className="wyr-radio" aria-hidden="true">{selected ? "✓" : ""}</span><span>{text}</span>
        </button> : <p className="wyr-card-text wyr-question-text">{text}</p>}
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
  const [customAnswers, setCustomAnswers] = useState<WyrCustomAnswers>(readWyrAnswers);
  const [fontSize, setFontSize] = useState<WyrFontSize>(readWyrFontSize);
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
  function setAnswerFont(size: WyrFontSize) { setFontSize(size); if (!saveWyrFontSize(size)) setStorageError(true); }
  function saveAnswer(choice: WyrChoice, text: string | null) {
    if (!current || !loaded) return;
    recordActivity();
    const key = wyrAnswerKey(loaded.locale, current.id, choice);
    const updated = { ...customAnswers, [key]: { text, updatedAt: new Date().toISOString() } };
    if (!saveWyrAnswers(updated)) { setStorageError(true); return; }
    setCustomAnswers(updated);
  }

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
  function printTopic(topic: WyrTopic) {
    if (!loaded) return;
    // Browser print preview may allow PDF export on mobile and desktop.
    const popup = window.open("", "_blank");
    if (!popup) {
      setNotice("Permita pop-ups para imprimir este tópico.");
      return;
    }
    const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
    const locale = loaded.locale;
    const questionHtml = [...topic.questions].sort((a, b) => a.order - b.order).map((q, i) => {
      const answerA = customAnswers[wyrAnswerKey(locale, q.id, "A")]?.text ?? q.options.A.answer;
      const answerB = customAnswers[wyrAnswerKey(locale, q.id, "B")]?.text ?? q.options.B.answer;
      return '<section class="question"><h2>' + String(i + 1).padStart(2, "0") + '. ' + escapeHtml(q.question) + '</h2>' +
        '<div class="option"><b>A.</b> ' + escapeHtml(q.options.A.text) + '</div>' +
        '<p class="answer"><b>Answer A:</b> ' + escapeHtml(answerA) + '</p>' +
        '<div class="option"><b>B.</b> ' + escapeHtml(q.options.B.text) + '</div>' +
        '<p class="answer"><b>Answer B:</b> ' + escapeHtml(answerB) + '</p></section>';
    }).join("");
    const title = String(topic.order).padStart(2, "0") + ". " + topic.title;
    const html = '<!doctype html><html lang="' + escapeHtml(locale) + '"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1"><title>BEJ - ' + escapeHtml(title) + '</title>' +
      '<style>@page{size:A4;margin:15mm 16mm}*{box-sizing:border-box}body{font:11pt/1.45 Arial,sans-serif;color:#111;background:#fff;margin:0}' +
      'header{border-bottom:2px solid #173861;padding-bottom:9px;margin-bottom:16px}header small{font-size:9pt;font-weight:bold;letter-spacing:1px;color:#365b88}' +
      'h1{font-size:20pt;margin:5px 0}header p{font-size:10pt;margin:0;color:#444}.question{break-inside:avoid;page-break-inside:avoid;margin:0 0 17px;padding:0 0 12px;border-bottom:1px solid #ddd}' +
      'h2{font-size:12pt;margin:0 0 8px}.option{margin:5px 0}.answer{margin:3px 0 9px 18px;color:#333;font-size:10.5pt}' +
      '@media screen{body{max-width:210mm;margin:20px auto;padding:15mm;box-shadow:0 2px 20px #ccc}}@media print{body{margin:0}}</style></head><body>' +
      '<header><small>BRAZILIAN ENGLISH JOURNEY</small><h1>Would You Rather? — ' + escapeHtml(title) + '</h1>' +
      '<p>Speaking &amp; Small Talk · ' + topic.questions.length + ' questions · ' + escapeHtml(topic.level) + '</p></header>' +
      questionHtml + '</body></html>';
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();
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
      onSelect={extra?.select} selected={extra?.selected} reveal={extra?.reveal} onReveal={extra?.toggle}
      fontSize={fontSize} onFontSize={setAnswerFont}
      originalAnswer={key === "answerA" ? current?.options.A.answer : key === "answerB" ? current?.options.B.answer : undefined}
      onSaveAnswer={key === "answerA" ? value => saveAnswer("A", value) : key === "answerB" ? value => saveAnswer("B", value) : undefined} />
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
            return <div key={topic.id} className="wyr-topic">
              <div className="wyr-topic-heading">
                <button type="button" className="wyr-topic-open" onClick={() => openTopic(topic)}
                  aria-label={String(topic.order).padStart(2, "0") + ". " + topic.title}>
                  <span className="wyr-topic-title">{String(topic.order).padStart(2, "0")}. {topic.title}</span>
                </button>
                <button type="button" className="wyr-topic-print" onClick={() => printTopic(topic)}
                  aria-label={"Imprimir " + topic.title} title={"Imprimir " + topic.title}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v5a2 2 0 0 1-2 2h-2"/>
                    <path d="M6 14h12v7H6zM18 11h.01"/>
                  </svg>
                </button>
              </div>
              <button type="button" className="wyr-topic-open wyr-topic-open--details" onClick={() => openTopic(topic)}>
                <span className="wyr-topic-meta">{total} {tr("questions")} · {topic.level} · {completed}/{total} {tr("completed")}</span>
                <span className="wyr-progress"><span style={{ width: `${100 * completed / total}%` }} /></span>
              </button>
            </div>;
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
        {choices[current.id] === "A" && card(tr("answerA"), customAnswers[wyrAnswerKey(loaded.locale, current.id, "A")]?.text ?? current.options.A.answer, "answerA", { reveal: revealed.A, toggle: () => { recordActivity(); setRevealed(p => ({ ...p, A: !p.A })); } })}
        {choices[current.id] === "B" && card(tr("answerB"), customAnswers[wyrAnswerKey(loaded.locale, current.id, "B")]?.text ?? current.options.B.answer, "answerB", { reveal: revealed.B, toggle: () => { recordActivity(); setRevealed(p => ({ ...p, B: !p.B })); } })}
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
