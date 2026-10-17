import { t } from "../i18n";
import { useTranslation } from "react-i18next";
import { ControlIcon } from "./ControlIcon";
import { useEffect, useRef, useState } from "react";
import type { MentalIntention } from "../types/hashmap";
import type { SourceLanguage, StudentLanguage } from "../config/languages";
import { isMobileDevice } from "../utils/mobileDevice";
import { repetitionText, WalkingAudio } from "../utils/walkingAudio";
import type { ChunkLevel } from "../utils/chunkEligibility";
import { ChunkLevelSelect } from "./ChunkLevelSelect";
import { WalkingSession, type WalkingSummary } from "../utils/walkingSession";
import { WalkingSessionSummary } from "./WalkingSessionSummary";
import { FavoriteChunkButton } from "./FavoriteChunkButton";

interface Props {
  stopWhenEmpty?: boolean;
  currentEligible?: boolean;
  favorite?: boolean;
  onToggleFavorite?: () => void;
  chunk: MentalIntention | null;
  language: StudentLanguage;
  sourceLanguage: SourceLanguage;
  level: ChunkLevel;
  onLevelChange: (level: ChunkLevel) => void;
  position: number;
  total: number;
  round: number;
  canPrevious: boolean;
  onPrevious: () => void;
  onNext: () => boolean;
  onStop: (summary?: WalkingSummary) => void;
}

export function WalkingMode({ chunk, language, sourceLanguage, level, onLevelChange, position, total, round, canPrevious, onPrevious, onNext, onStop, stopWhenEmpty = false, currentEligible = true, favorite = false, onToggleFavorite }: Props) {
  const { t } = useTranslation();
  const [paused, setPaused] = useState(false);
  const [repetitions, setRepetitions] = useState(5);
  const [pause, setPause] = useState(3);
  const [rate, setRate] = useState(0.9);
  const [automatic, setAutomatic] = useState(true);
  const [keepAwake, setKeepAwake] = useState(true);
  const [index, setIndex] = useState(0);
  const [spoken, setSpoken] = useState(0);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [wakeWarning, setWakeWarning] = useState("");
  const [seconds, setSeconds] = useState(0);
  const elapsed = useRef(0);
  const activeSince = useRef<number | null>(performance.now());
  const audio = useRef(new WalkingAudio());
  const session = useRef(new WalkingSession());
  const playbackToken = useRef(0);
  const phase = useRef<"speech" | "pause">("speech");
  const finishWhenEmpty = useRef(false);
  finishWhenEmpty.current = stopWhenEmpty && total === 0;
  const advanceAfterSpeech = useRef(false);
  advanceAfterSpeech.current = !currentEligible;
  const callbacks = useRef({ onNext, onPrevious, onStop: stopSession });
  callbacks.current = { onNext, onPrevious, onStop: stopSession };

  function stopSession() {
    audio.current.cancel();
    const duration = elapsed.current + (activeSince.current === null ? 0 : performance.now() - activeSince.current);
    onStop(session.current.summary(total, Math.floor(duration / 1000)));
  }

  useEffect(() => {
    if (finishWhenEmpty.current && (paused || phase.current === "pause" || !chunk || index >= repetitions)) {
      callbacks.current.onStop();
    }
  }, [stopWhenEmpty, total, paused, chunk?.id, index, repetitions]);

  function resetPlayback() {
    audio.current.cancel();
    phase.current = "speech";
    setIndex(0);
    setSpoken(0);
    setError("");
    setRevision(v => v + 1);
  }

  function navigate(previous = false) {
    resetPlayback();
    if (previous) callbacks.current.onPrevious();
    else callbacks.current.onNext();
  }
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    if (!currentEligible && total > 0 && (paused || phase.current === "pause" || !chunk || index >= repetitions)) {
      navigateRef.current();
    }
  }, [currentEligible, total, paused, chunk?.id, index, repetitions]);

  useEffect(() => {
    if (!isMobileDevice()) {
      audio.current.cancel();
      callbacks.current.onStop();
      return;
    }
    if (paused || !chunk) return;
    if (index >= repetitions) {
      if (automatic) navigateRef.current();
      return;
    }
    const done = () => {
      phase.current = "speech";
      setIndex(v => v + 1);
    };
    const token = ++playbackToken.current;
    if (phase.current === "pause") audio.current.wait(pause * 1000, done);
    else audio.current.play(repetitionText((chunk.targetIntention ?? chunk.english).trim(), language, index, repetitions),
      language, rate, pause * 1000,
      () => {
        session.current.record(token, chunk.id, index + 1 >= repetitions);
        phase.current = "pause";
        setSpoken(index + 1);
        if (finishWhenEmpty.current) callbacks.current.onStop();
        else if (advanceAfterSpeech.current) navigateRef.current();
      }, done,
      () => { setError(t("walking.couldNotPlayTheAudioTapResumeToTryAgain")); setPaused(true); });
    return () => audio.current.cancel();
  }, [chunk?.id, language, level, paused, index, repetitions, pause, rate, automatic, revision]);

  useEffect(() => {
    const now = performance.now();
    if (paused && activeSince.current !== null) {
      elapsed.current += now - activeSince.current;
      activeSince.current = null;
    } else if (!paused && activeSince.current === null) activeSince.current = now;
    const update = () => setSeconds(Math.floor((elapsed.current +
      (activeSince.current === null ? 0 : performance.now() - activeSince.current)) / 1000));
    update();
    if (paused) return;
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [paused]);

  useEffect(() => {
    let disposed = false;
    let lock: WakeLockSentinel | null = null;
    let requesting = false;
    const acquire = async () => {
      if (disposed || requesting || lock || !keepAwake || paused || document.visibilityState !== "visible") return;
      if (!("wakeLock" in navigator)) {
        setWakeWarning(t("common.thisBrowserCannotKeepTheScreenAwake")); return;
      }
      requesting = true;
      try {
        const acquired = await navigator.wakeLock.request("screen");
        if (disposed) { await acquired.release(); return; }
        lock = acquired;
        setWakeWarning("");
        acquired.addEventListener("release", () => {
          if (lock === acquired) lock = null;
          if (!disposed) setWakeWarning(t("walking.theScreenMayTurnOffKeepThePageOpenTo"));
        });
      } catch { if (!disposed) setWakeWarning(t("common.couldNotKeepTheScreenAwake")); }
      finally { requesting = false; }
    };
    setWakeWarning("");
    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release().catch(() => {});
    };
  }, [keepAwake, paused]);

  useEffect(() => {
    const check = () => { if (!isMobileDevice()) callbacks.current.onStop(); };
    check();
    window.addEventListener("resize", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      audio.current.cancel();
      window.removeEventListener("resize", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  const time = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map(v => String(v).padStart(2, "0")).join(":");
  return <section className="walking-mode" aria-labelledby="walking-title">
    <h2 id="walking-title">{"🎧 "}{t("common.walkingMode")}</h2>
    <p>{t("common.studyTime")} <strong>{time}</strong> · {t("flashcards.roundNumber", { round })}</p>
    <p role="status" aria-label={t("common.chunkPositionInTheRound")}>{position}/{total}</p>
    {chunk ? <article className="chunk-flashcards-card">
      <div className="chunk-flashcards-card-header">
        <p>{language}</p>
        {onToggleFavorite && <FavoriteChunkButton active={favorite} onToggle={onToggleFavorite} />}
      </div>
      <h3 lang={language}>{chunk.targetIntention ?? chunk.english}</h3>
      <p lang={sourceLanguage}>{chunk.intention}</p>
    </article> : <p role="status">{level === "all" ? t("walking.noChunksAvailable") : t("common.noChunksAvailableForLevelLevel", { level: (level) })}  {t("walking.chooseAnotherLevelInSettings")}</p>}
    <p role="status">{paused ? t("common.paused") : !chunk ? t("walking.waitingForLevelSelection") : index >= repetitions ? t("walking.waitingForTheNextChunk") : t("walking.listenAndRepeat")}  {t("shadowing.repetitions")} {spoken}/{repetitions}</p>
    <progress aria-label={t("walking.repetitionsCompleted")} value={spoken} max={repetitions} />
    {paused && <WalkingSessionSummary summary={session.current.summary(total, seconds)} />}
    {error && <p role="alert">{error}</p>}
    <div className="walking-controls">
      <button type="button" aria-label={t("walking.previousChunk")} title={t("walking.previousChunk")} disabled={!canPrevious || !chunk} onClick={() => navigate(true)}><ControlIcon name="previous" /></button>
      <button type="button" className="walking-toggle" aria-label={paused ? t("common.resume") : t("common.pause")} title={paused ? t("common.resume") : t("common.pause")} onClick={() => { audio.current.cancel(); setError(""); setPaused(v => !v); }}><ControlIcon name={paused ? "play" : "pause"} /></button>
      <button type="button" aria-label={t("walking.nextChunk")} title={t("walking.nextChunk")} disabled={!chunk} onClick={() => navigate()}><ControlIcon name="next" /></button>
      <button type="button" aria-label={t("common.stop")} title={t("common.stop")} onClick={stopSession}><ControlIcon name="stop" /></button>
    </div>
    <details className="walking-configuration"><summary aria-label={t("walking.playbackSettings")} title={t("walking.playbackSettings")}><ControlIcon name="settings" /></summary>
      <div className="walking-settings">
        <ChunkLevelSelect value={level} onChange={nextLevel => {
          if (nextLevel === level) return;
          resetPlayback();
          onLevelChange(nextLevel);
        }} />
        <label>{t("walking.repetitionsPerChunk")} <select value={repetitions} onChange={e => { resetPlayback(); setRepetitions(Number(e.target.value)); }}>
          {Array.from({ length: 8 }, (_, i) => i + 3).map(v => <option key={v}>{v}</option>)}
        </select></label>
        <label>{t("walking.pauseBetweenPlaybacks")} <select value={pause} onChange={e => setPause(Number(e.target.value))}>
          {Array.from({ length: 7 }, (_, i) => i + 2).map(v => <option key={v} value={v}>{v}  {t("walking.seconds")}</option>)}
        </select></label>
        <label>{t("walking.voiceSpeed")} <select value={rate} onChange={e => setRate(Number(e.target.value))}>
          {[0.8, 0.9, 1].map(v => <option key={v} value={v}>{v.toFixed(1)}×</option>)}
        </select></label>
        <label><input type="checkbox" checked={automatic} onChange={e => setAutomatic(e.target.checked)} />  {t("walking.autoAdvance")}</label>
        <label><input type="checkbox" checked={keepAwake} onChange={e => setKeepAwake(e.target.checked)} />  {t("walking.keepScreenAwake")}</label>
      </div>
    </details>
    {wakeWarning && <p role="status">{wakeWarning}</p>}
    <p className="walking-note">{t("walking.keepThisPageOpenAndYourPhoneUnlockedYourBrowser")}</p>
  </section>;
}
