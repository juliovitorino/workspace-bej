import { useStudyReading } from "../features/study/useStudyReading";
import { t, languageName as localizedLanguageName } from "../i18n";
import { useTranslation } from "react-i18next";
import { ControlIcon } from "./ControlIcon";
import { useEffect, useMemo, useRef, useState } from "react";
import { LANGUAGES, type StudentLanguage } from "../config/languages";
import { getStoryTitle, getParagraphText, searchShadowingStories, type LocalStory } from "../services/localStoryService";
import { defaultShadowingSettings, formatPracticeTime, sentenceSegments, type ShadowingSettings } from "../utils/storyShadowing";
import { useStoryShadowing } from "../hooks/useStoryShadowing";
import { ChunkLevelSelect } from "./ChunkLevelSelect";
import { NeuralVoiceSelect } from "./NeuralVoiceSelect";
import type { ChunkLevel } from "../utils/chunkEligibility";

const techniqueNames = () => ({ listen: t("shadowing.listen"), repeat: t("shadowing.repeatAfterMe"), shadow: t("shadowing.shadowingSpeakAlongWithTheVoice"), combined: [t("shadowing.listen"), t("shadowing.repeatAfterMe"), "Shadowing"].join(" → ") });
function Settings({ value, onChange, sentenceAvailable }: { value: ShadowingSettings; onChange: (value: ShadowingSettings) => void; sentenceAvailable: boolean }) {
  const { t } = useTranslation();
  function update<K extends keyof ShadowingSettings>(key: K, next: ShadowingSettings[K]) { onChange({ ...value, [key]: next }); }
  return <div className="shadowing-settings">
    <label>{t("shadowing.scope")}<select value={value.scope} onChange={e => update("scope", e.target.value as ShadowingSettings["scope"])}><option value="story">{t("shadowing.fullStory")}</option><option value="paragraph">{t("shadowing.byParagraph")}</option></select></label>
    <label>{t("shadowing.control")}<select value={value.control} onChange={e => onChange({ ...value, control: e.target.value as ShadowingSettings["control"], automatic: e.target.value === "automatic" })}><option value="automatic">{t("common.automatic")}</option><option value="manual">{t("common.manual")}</option></select></label>
    <label>{t("shadowing.technique")}<select value={value.technique} onChange={e => update("technique", e.target.value as ShadowingSettings["technique"])}>{Object.entries(techniqueNames()).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
    <label>{t("shadowing.unit")}<select value={value.unit} onChange={e => update("unit", e.target.value as ShadowingSettings["unit"])}><option value="paragraph">{t("shadowing.fullParagraph")}</option><option value="sentence" disabled={!sentenceAvailable}>{t("shadowing.individualSentence")}{!sentenceAvailable ? t("shadowing.unavailable") : ""}</option></select></label>
    <label>{t("shadowing.speed")}<select value={value.rate} onChange={e => update("rate", Number(e.target.value))}>{[.8, .9, 1].map(v => <option key={v} value={v}>{v.toFixed(1)}×</option>)}</select></label>
    <label>{t("shadowing.repetitions")}<select value={value.repetitions} onChange={e => update("repetitions", Number(e.target.value))}>{Array.from({ length: 10 }, (_, i) => i + 1).map(v => <option key={v}>{v}</option>)}</select></label>
    <label>{t("shadowing.intervalBetweenPlaybacksSeconds")}<input type="number" min="0" max="60" value={value.interval} onChange={e => update("interval", Math.max(0, Math.min(60, Number(e.target.value) || 0)))} /></label>
    <label><input type="checkbox" checked={value.automatic} disabled={value.control === "manual"} onChange={e => update("automatic", e.target.checked)} />  {t("shadowing.automaticallyAdvanceBetweenParagraphs")}</label>
    <label><input type="checkbox" checked={value.translation} onChange={e => update("translation", e.target.checked)} />  {t("shadowing.showPtBrTranslation")}</label>
    <label><input type="checkbox" checked={value.keepAwake} onChange={e => update("keepAwake", e.target.checked)} />  {t("shadowing.keepScreenAwakeIfSupported")}</label>
    <p>{t("shadowing.listenPlaysOnceTheConfiguredRepetitionsApplyToRepeatAfter")}</p>
  </div>;
}

type StudyStateReporter = (active: boolean, mode?: "manual" | "walking") => void;
function Practice({ story, language, settings, selected, onSettings, onBack, onMenu, onRestart, onStudyState }: {
  story: LocalStory; language: StudentLanguage; settings: ShadowingSettings; selected: number;
  onSettings: (settings: ShadowingSettings) => void; onBack: () => void; onMenu: () => void; onRestart: () => void;
  onStudyState?: StudyStateReporter;
}) {
  const { t } = useTranslation();
  const session = useStoryShadowing(story, language, settings, selected);
  const trackedSeconds = useStudyReading("shadowing", language);
  const [configuring, setConfiguring] = useState(false);
  // Follow the existing practice clock, including guided response windows in
  // manual mode. Waiting for the next Play command never adds study time.
  const studying = session.playing && !session.complete && !configuring;
  useEffect(() => {
    onStudyState?.(studying, "manual");
    return () => onStudyState?.(false, "manual");
  }, [studying, onStudyState]);
  const summaryRef = useRef<HTMLElement>(null);
  function play() {
    session.play();
    summaryRef.current?.scrollIntoView({
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      block: "start",
    });
  }
  const paragraph = story.paragraphs[session.paragraph];
  return <>
    <div className="shadowing-heading"><h3>{getStoryTitle(story, language)}</h3><button type="button" onClick={() => { session.stop(); onBack(); }}>{t("shadowing.chooseAnotherStory")}</button></div>
    <section ref={summaryRef} className="shadowing-session" aria-label={t("shadowing.practiceSummary")}>
      <div className="shadowing-session-meta"><span>{localizedLanguageName(language)}</span><span className="shadowing-level">{story.englishLevel}</span></div>
      {language === "en-US" && <NeuralVoiceSelect />}
      <div className="shadowing-session-stats">
        <div className="shadowing-session-clock"><span className="shadowing-stat-label">{t("shadowing.practiceTime")}</span><time>{formatPracticeTime(trackedSeconds === null ? session.elapsed : trackedSeconds * 1000)}</time><span className="shadowing-stat-note">{t("shadowing.everyMinuteCounts")}</span></div>
        <div className="shadowing-session-progress">
          <span className="shadowing-stat-label">{settings.scope === "paragraph" ? t("shadowing.yourParagraph") : t("shadowing.yourStoryJourney")}</span>
          <p className="shadowing-paragraph-position">{t("shadowing.paragraphPosition", { current: String(session.paragraph + 1).padStart(2, "0"), total: String(story.paragraphs.length).padStart(2, "0") })}</p>
          <progress aria-label={t("shadowing.completedParagraphs")} value={session.completed} max={settings.scope === "paragraph" ? 1 : story.paragraphs.length} />
          <span className="shadowing-stat-note">{t("shadowing.completedParagraphs", { count: session.completed, total: settings.scope === "paragraph" ? 1 : story.paragraphs.length })}</span>
        </div>
      </div>
    </section>
    {session.complete ? <div role="status" className="status-card">
      <h3>{settings.scope === "paragraph" ? t("shadowing.paragraphCompleted") : session.completed === story.paragraphs.length ? t("shadowing.storyComplete") : t("shadowing.practiceComplete")}</h3>
      <p>{t("shadowing.completionSummary", { count: session.completed, technique: techniqueNames()[settings.technique] })}</p>
      <div className="shadowing-controls"><button type="button" onClick={onRestart}>{t("shadowing.practiceAgain")}</button><button type="button" onClick={onBack}>{t("shadowing.chooseAnotherStory")}</button><button type="button" onClick={onMenu}>{t("shadowing.backToMainMenu")}</button></div>
    </div> : <>
      <article className="shadowing-reading">
        <p lang={language}>{session.segments.map((part, index) => settings.unit === "sentence" && index === session.sentence ? <mark key={index}>{part}</mark> : <span key={index}>{part}</span>)}</p>
        {settings.translation && paragraph.pt && <p className="shadowing-translation" lang="pt-BR">{paragraph.pt}</p>}
      </article>
      <p role="status">{session.fullReading ? t("shadowing.readTheFullParagraphAloud") : techniqueNames()[session.step.technique]}  {t("shadowing.repetition")} {session.step.repetition}/{session.step.total} · <strong>{session.playing ? session.phase === "wait" ? t("shadowing.practicePause") : t("common.playing") : t("shadowing.waitingForPlay")}</strong></p>
      {settings.unit === "sentence" && <p>{t("shadowing.sentence")} {session.sentence + 1}/{session.segments.length}</p>}
      <div className="shadowing-controls shadowing-desktop-controls" role="group" aria-label={t("shadowing.playbackControls")}>
        <button type="button" aria-label={t("common.previous")} disabled={!session.canPrevious} onClick={() => session.navigate(-1)}>{"⏮ "}{t("common.previous")}</button>
        <button type="button" aria-label={t("shadowing.play")} disabled={session.playing || !session.hasVoice || configuring} onClick={play}>{"▶ "}{t("shadowing.play")}</button>
        <button type="button" aria-label={t("common.pause")} disabled={!session.playing} onClick={session.pause}>{"⏸ "}{t("common.pause")}</button>
        <button type="button" aria-label={t("common.next")} disabled={!session.canNext} onClick={() => session.navigate(1)}>{t("common.next")}{" ⏭"}</button>
        <button type="button" aria-label={t("shadowing.repeat")} disabled={!session.hasVoice || configuring} onClick={session.repeat}>{"↻ "}{t("shadowing.repeat")}</button>
        <button type="button" aria-label={t("common.stop")} onClick={session.stop}>{"■ "}{t("common.stop")}</button>
        <button type="button" aria-label={t("shadowing.settings")} aria-expanded={configuring} onClick={() => { session.pause(); setConfiguring(v => !v); }}>{t("shadowing.settings")}</button>
      </div>
      <div className="shadowing-mobile-controls" role="group" aria-label={t("shadowing.mobilePlaybackControls")}>
        <button type="button" aria-label={t("common.previous")} disabled={!session.canPrevious} onClick={() => session.navigate(-1)}><ControlIcon lucide name="previous" /></button>
        <button type="button" className="walking-toggle" aria-label={session.playing ? t("common.pause") : t("common.resume")} disabled={!session.playing && (!session.hasVoice || configuring)} onClick={session.playing ? session.pause : play}><ControlIcon lucide name={session.playing ? "pause" : "play"} /></button>
        <button type="button" aria-label={t("common.next")} disabled={!session.canNext} onClick={() => session.navigate(1)}><ControlIcon lucide name="next" /></button>
        <button type="button" aria-label={t("shadowing.repeat")} disabled={!session.hasVoice || configuring} onClick={session.repeat}><ControlIcon lucide name="repeat" /></button>
        <button type="button" aria-label={t("common.stop")} onClick={session.stop}><ControlIcon lucide name="stop" /></button>
        <button type="button" aria-label={t("shadowing.settings")} aria-expanded={configuring} onClick={() => { session.pause(); setConfiguring(v => !v); }}><ControlIcon lucide name="settings" /></button>
      </div>
    </>}
    {settings.unit === "sentence" && <button type="button" disabled={!session.hasVoice || configuring} onClick={session.readParagraph}>{t("shadowing.listenToTheFullParagraph")}</button>}
    {!session.hasVoice && <p role="alert">{t("shadowing.noVoiceForLanguage", { targetLanguage: localizedLanguageName(language) })}</p>}
    {session.error && <p role="alert">{session.error}</p>}
    {session.warning && <p role="status">{session.warning}</p>}
    {configuring && <Settings value={settings} sentenceAvailable={story.paragraphs.some(p => sentenceSegments(getParagraphText(p, language), language).length > 1)} onChange={value => {
      session.configure(value);
      // The selected scope applies to the current paragraph when changed during practice.
      onSettings(value);
    }} />}
    <p className="walking-note">{t("shadowing.resumingPausedSpeechRestartsTheCurrentPassageScheduledPausesResume")}</p>
  </>;
}

export function StoryShadowing({ language, onMenu, onStudyState }: { language: StudentLanguage; onMenu: () => void; onStudyState?: StudyStateReporter }) {
  const { t } = useTranslation();
  const [level, setLevel] = useState<ChunkLevel>("all");
  const [query, setQuery] = useState("");
  const [story, setStory] = useState<LocalStory | null>(null);
  const [selected, setSelected] = useState(0);
  const [practicing, setPracticing] = useState(false);
  const [sessionVersion, setSessionVersion] = useState(0);
  const [settings, setSettings] = useState(defaultShadowingSettings);
  const stories = useMemo(() => searchShadowingStories(language, level, query), [language, level, query]);
  function back() { setPracticing(false); setStory(null); }
  return <section className="shadowing" aria-labelledby="shadowing-title">
    <h2 id="shadowing-title">{"🎧 "}{t("common.shadowing")}</h2>
    {practicing && story ? <Practice key={sessionVersion} {...{ story, language, settings, selected, onMenu, onStudyState }} onRestart={() => setSessionVersion(v => v + 1)} onSettings={setSettings} onBack={back} /> : story ? <>
      <h3>{getStoryTitle(story, language)}</h3><p>{story.englishLevel} · {t("shadowing.paragraphsCount", { count: story.paragraphs.length })}</p>
      {language === "en-US" && <NeuralVoiceSelect />}
      <Settings value={settings} onChange={setSettings} sentenceAvailable={story.paragraphs.some(p => sentenceSegments(getParagraphText(p, language), language).length > 1)} />
      {settings.scope === "paragraph" && <label>{t("shadowing.selectParagraph")}<select value={selected} onChange={e => setSelected(Number(e.target.value))}>{story.paragraphs.map((_, i) => <option key={i} value={i}>{t("shadowing.paragraph")} {i + 1}</option>)}</select></label>}
      <p className="shadowing-preview" lang={language}>{getParagraphText(story.paragraphs[settings.scope === "paragraph" ? selected : 0], language)}</p>
      <div className="shadowing-controls"><button type="button" onClick={back}>{t("shadowing.backToSelection")}</button><button type="button" className="primary-button" onClick={() => { if (settings.scope === "story") setSelected(0); setPracticing(true); }}>{t("shadowing.startPractice")}</button></div>
    </> : <>
      <div className="shadowing-library-tools">
        <div className="shadowing-library-heading">
          <div><span className="shadowing-library-eyebrow">{t("shadowing.yourNextPractice")}</span><h3>{t("shadowing.chooseAStory")}</h3><p>{t("shadowing.findATopicThatSparksYourCuriosityAndPracticeAt")}</p></div>
          <p className="shadowing-library-count" role="status"><strong>{stories.length}</strong><span>{t("shadowing.availableStories", { count: stories.length })}</span></p>
        </div>
        <div className="shadowing-search" role="search" aria-label={t("shadowing.searchStoriesForShadowing")}>
          <ChunkLevelSelect value={level} onChange={setLevel} />
          <label>{t("common.searchStories")}<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t("shadowing.typePartOfTheTitleOrATopic")} /></label>
        </div>
      </div>
      {!stories.length && <p>{language !== "en-US" ? t("shadowing.noStoriesAreAvailableInThisLanguageYetSelectAnother") : t("shadowing.noStoriesMatchTheFiltersTryAnotherLevelOrTitle")}</p>}
      <div className="shadowing-stories">{stories.map((item, i) => <article key={i}>
        <h3 lang={language}>{getStoryTitle(item, language)}</h3><p>{item.englishLevel} · {t("shadowing.paragraphsCount", { count: item.paragraphs.length })}</p>
        {item.topic && <span className="pill">{item.topic}</span>}
        <p className="shadowing-preview" lang={language}>{getParagraphText(item.paragraphs[0], language)}</p>
        <button type="button" className="primary-button" onClick={() => { setStory(item); setSelected(0); setPracticing(true); }}>{t("shadowing.practice")}</button>
      </article>)}</div>
    </>}
  </section>;
}
