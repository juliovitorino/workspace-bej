import { t } from "../i18n";
import { useTranslation } from "react-i18next";
import type { SourceLanguage, StudentLanguage } from "../config/languages";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { getSpeakingGameForms, getSpeakingChallenge, supportsSpeakingForm } from "../config/speakingGameForms";
import { getSpeakingVocabulary, type SpeakingVocabulary } from "../services/englishVerbService";
import type { SpeakingVerb } from "../types/englishVerb";
import { DEFAULT_SPEAKING_GAME_SETTINGS, type SpeakingGameSettings, type SpeakingGameStatus, type SpeakingGameStep } from "../types/speakingGameTypes";
import { getNextSequentialFormIndex, getRandomFormIndex } from "../utils/speakingGameEngine";
import { SpeakingGamePlayStep } from "./SpeakingGamePlayStep";
import { SpeakingGameReadyStep } from "./SpeakingGameReadyStep";
import { SpeakingGameSetupStep } from "./SpeakingGameSetupStep";
import { useTrainingStudy, type TrainingStudyReporter } from "../features/study/useTrainingStudy";

export function SpeakingGame({ language, sourceLanguage, onStudyState }: { language: StudentLanguage; sourceLanguage: SourceLanguage; onStudyState?: TrainingStudyReporter }) {
  const { t } = useTranslation();
  const [step, setStep] = useState<SpeakingGameStep>(1);
  const [settings, setSettings] = useState<SpeakingGameSettings>(DEFAULT_SPEAKING_GAME_SETTINGS);
  const [status, setStatus] = useState<SpeakingGameStatus>("ready");
  const [round, setRound] = useState<{ language: StudentLanguage; verb: SpeakingVerb; index: number } | null>(null);
  const [vocabulary, setVocabulary] = useState<SpeakingVocabulary | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(settings.seconds);
  const [isLoadingRound, setIsLoadingRound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastStudySeconds, setLastStudySeconds] = useState<number | null>(null);
  const accumulatedStudyTimeMsRef = useRef(0);
  const activeStudyStartedAtRef = useRef<number | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);
  const currentLanguage = useRef(language);
  currentLanguage.current = language;
  const forms = getSpeakingGameForms(language);
  const practicing = step === 3 && status === "running" && round?.language === language;
  const { recordActivity, studyPaused: _studyPaused, toggleStudyPause: _toggleStudyPause, ...studyEvents } =
    useTrainingStudy(language, practicing && !isLoadingRound, isLoadingRound, false, onStudyState);
  // Only a real start/resume renews activity; automatic rounds do not defeat idle expiry.
  useEffect(() => { if (practicing) recordActivity(); }, [practicing, language]);

  useEffect(() => {
    generation.current++;
    busy.current = false;
    setRound(null);
    setVocabulary(null);
    setStatus("ready");
    setStep(1);
    setIsLoadingRound(false);
    setError(null);
    setLastStudySeconds(null);
    accumulatedStudyTimeMsRef.current = 0;
    activeStudyStartedAtRef.current = null;
    return () => { generation.current++; busy.current = false; };
  }, [language]);

  function recordStudyTime() {
    if (activeStudyStartedAtRef.current !== null) {
      accumulatedStudyTimeMsRef.current += Date.now() - activeStudyStartedAtRef.current;
      activeStudyStartedAtRef.current = null;
    }
  }

  async function loadRound(kind: "start" | "next" | "verb") {
    if (busy.current || (kind !== "start" && (!round || round.language !== language)) ||
      (kind === "verb" && settings.timeMode !== "manual")) return;
    busy.current = true;
    const token = ++generation.current;
    const valid = () => generation.current === token && currentLanguage.current === language;
    setIsLoadingRound(true);
    setError(null);
    try {
      const data = await getSpeakingVocabulary(language);
      if (!valid()) return;
      const previousIndex = round?.index ?? 0;
      const index = kind === "verb" ? previousIndex : settings.order === "random"
        ? getRandomFormIndex(kind === "start" ? undefined : previousIndex, forms.length)
        : kind === "start" ? 0 : getNextSequentialFormIndex(previousIndex, forms.length);
      const compatible = data.verbs.filter(verb => supportsSpeakingForm(verb, forms[index]));
      if (!compatible.length) throw new Error(t("speaking.noVerbsSupportThisStructureInTheSelectedLanguage"));
      const alternatives = compatible.filter(verb => verb.id !== round?.verb.id);
      const pool = alternatives.length ? alternatives : compatible;
      const verb = pool[Math.floor(Math.random() * pool.length)];
      setVocabulary(data);
      setRound({ language, verb, index });
      if (kind !== "verb") setRemainingSeconds(settings.seconds);
      if (kind === "start") {
        accumulatedStudyTimeMsRef.current = 0;
        activeStudyStartedAtRef.current = Date.now();
        setLastStudySeconds(null);
        setStatus("running");
        setStep(3);
      }
    } catch (caughtError) {
      if (!valid()) return;
      if (kind !== "start") { recordStudyTime(); setStatus("paused"); }
      setError(caughtError instanceof Error ? caughtError.message : t("speaking.couldNotLoadVocabularyForTheSelectedLanguage"));
    } finally {
      if (valid()) { busy.current = false; setIsLoadingRound(false); }
    }
  }

  useEffect(() => {
    if (step !== 3 || settings.timeMode !== "automatic" || status !== "running" || isLoadingRound || round?.language !== language) return;
    const timerId = window.setTimeout(() => {
      if (remainingSeconds <= 1) void loadRound("next");
      else setRemainingSeconds(seconds => seconds - 1);
    }, 1000);
    return () => window.clearTimeout(timerId);
  }, [step, settings, status, isLoadingRound, round, language, remainingSeconds]);

  function stopGame() {
    generation.current++;
    busy.current = false;
    recordStudyTime();
    setLastStudySeconds(Math.floor(accumulatedStudyTimeMsRef.current / 1000));
    setStatus("ready");
    setRound(null);
    setRemainingSeconds(settings.seconds);
    setIsLoadingRound(false);
    setError(null);
    setStep(2);
  }
  function pauseGame() {
    if (status !== "running") return;
    recordStudyTime();
    setStatus("paused");
  }
  function resumeGame() {
    if (status !== "paused") return;
    activeStudyStartedAtRef.current = Date.now();
    setStatus("running");
  }
  return <div style={styles.page} {...(step === 3 ? studyEvents : {})}>
    {step === 1 && <SpeakingGameSetupStep settings={settings} onSettingsChange={setSettings} onNext={() => { setError(null); setStep(2); }} />}
    {step === 2 && <>
      <SpeakingGameReadyStep language={language} loading={isLoadingRound} settings={settings} lastStudySeconds={lastStudySeconds}
        onPrevious={() => { generation.current++; busy.current = false; setIsLoadingRound(false); setError(null); setStep(1); }} onStart={() => void loadRound("start")} />
      {isLoadingRound && <p style={styles.message} role="status">{t("speaking.preparingTheGame")}</p>}
    </>}
    {step === 3 && round?.language === language && vocabulary && <SpeakingGamePlayStep
      key={language} language={language} sourceLanguage={sourceLanguage} verb={round.verb} vocabulary={vocabulary}
      form={getSpeakingChallenge(round.verb, forms[round.index])} formLabel={forms[round.index].label}
      settings={settings} status={status} remainingSeconds={remainingSeconds} loading={isLoadingRound}
      onPause={pauseGame} onResume={resumeGame} onStop={stopGame}
      onNext={() => void loadRound("next")} onNewVerb={() => void loadRound("verb")} />}
    {error && <div style={styles.error} role="alert"><strong>{t("speaking.couldNotContinue")}</strong><span>{error}</span></div>}
  </div>;
}

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    boxSizing: "border-box",
    padding: "clamp(0.75rem, 3vw, 1.5rem)"
  },
  message: {
    width: "min(100%, 34rem)",
    margin: "1rem auto 0",
    textAlign: "center",
    fontSize: "0.95rem",
    color: "var(--muted)"
  },
  error: {
    display: "grid",
    gap: "0.3rem",
    width: "min(100%, 34rem)",
    margin: "1rem auto 0",
    boxSizing: "border-box",
    padding: "0.9rem 1rem",
    border: "1px solid var(--bad-border)",
    borderRadius: "12px",
    background: "var(--bad-soft)",
    color: "var(--bad)",
    fontSize: "0.92rem"
  }
};
