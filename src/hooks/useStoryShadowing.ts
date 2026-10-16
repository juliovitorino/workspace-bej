import { t } from "../i18n";
import { useEffect, useRef, useState } from "react";
import type { StudentLanguage } from "../config/languages";
import { getParagraphText, type LocalStory } from "../services/localStoryService";
import { WalkingAudio } from "../utils/walkingAudio";
import { practiceSteps, responsePause, sentenceSegments, type ShadowingSettings } from "../utils/storyShadowing";

const repeatPrompts: Record<StudentLanguage, string> = {
  "pt-BR": "Repita depois de mim", "en-US": "Repeat after me", "fr-FR": "Répétez après moi", "es-ES": "Repite después de mí"
};
export function useStoryShadowing(story: LocalStory, language: StudentLanguage, settings: ShadowingSettings, selected: number) {
  const audio = useRef(new WalkingAudio());
  const [playing, setPlaying] = useState(false);
  const [paragraph, setParagraph] = useState(selected);
  const [sentence, setSentence] = useState(0);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<"prompt" | "speech" | "wait" | "ready">("prompt");
  const [complete, setComplete] = useState(false);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [warning, setWarning] = useState("");
  const [revision, setRevision] = useState(0);
  const clock = useRef({ accumulated: 0, since: null as number | null });
  const delay = useRef({ remaining: 0, since: null as number | null });
  const [fullReading, setFullReading] = useState(false);
  const readingReturn = useRef(false);
  const steps = practiceSteps(settings);
  const current = steps[step] ?? steps[0];
  const text = getParagraphText(story.paragraphs[paragraph], language);
  const segments = settings.unit === "sentence" ? sentenceSegments(text, language) : [text];
  const spokenText = fullReading ? text : segments[sentence] ?? text;
  const hasVoice = voices.some(v => v.lang.toLowerCase().split("-")[0] === language.slice(0, 2));

  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const update = () => setVoices(synth.getVoices());
    update(); synth.addEventListener("voiceschanged", update);
    return () => synth.removeEventListener("voiceschanged", update);
  }, []);

  function stopAudio() {
    audio.current.cancel();
    if (delay.current.since !== null) {
      delay.current.remaining = Math.max(0, delay.current.remaining - (performance.now() - delay.current.since));
      delay.current.since = null;
    }
  }
  function pause() { stopAudio(); setPlaying(false); }
  function resetUnit() {
    stopAudio(); delay.current = { remaining: 0, since: null };
    setStep(0); setPhase("prompt"); setComplete(false); setFullReading(false); setError(""); setRevision(v => v + 1);
  }
  function navigate(direction: number) {
    resetUnit();
    const nextSentence = sentence + direction;
    if (nextSentence >= 0 && nextSentence < segments.length) setSentence(nextSentence);
    else if (settings.scope === "story") {
      const next = Math.max(0, Math.min(story.paragraphs.length - 1, paragraph + direction));
      setParagraph(next);
      setSentence(direction < 0 && settings.unit === "sentence" ? sentenceSegments(getParagraphText(story.paragraphs[next], language), language).length - 1 : 0);
    }
  }
  function play() {
    if (!hasVoice) { setError(t("shadowing.noCompatibleVoiceAvailableEnableAVoiceForThisLanguage")); return; }
    if (complete) return;
    if (phase === "ready") {
      if (step + 1 < steps.length) setStep(step + 1);
      setPhase("prompt");
    }
    setError(""); setPlaying(true);
  }
  function finishUnit() {
    if (!fullReading && sentence + 1 < segments.length) {
      setSentence(v => v + 1); setStep(0); setPhase("prompt");
      if (settings.control === "manual") setPlaying(false);
      return;
    }
    setCompleted(previous => new Set(previous).add(paragraph));
    if (settings.scope === "story" && paragraph + 1 < story.paragraphs.length) {
      if (settings.control === "automatic" && settings.automatic) {
        setParagraph(v => v + 1); setSentence(0); setStep(0); setPhase("prompt"); setFullReading(false);
      } else { setPhase("ready"); setPlaying(false); }
    } else { setComplete(true); setPlaying(false); }
  }

  useEffect(() => {
    if (!playing || complete) return;
    const fail = () => { setError(t("shadowing.couldNotPlayTheVoiceCheckYourInstalledVoicesAnd")); setPlaying(false); };
    if (phase === "ready") { setPlaying(false); return; }
    if (phase === "prompt") {
      if (current.technique === "repeat" && !fullReading) {
        audio.current.play(repeatPrompts[language], language, settings.rate, 0, () => {}, () => setPhase("speech"), fail, true);
      } else setPhase("speech");
    } else if (phase === "speech") {
      audio.current.play(spokenText, language, settings.rate, 0, () => {}, () => {
        delay.current = { remaining: (current.technique === "repeat" && !fullReading ? responsePause(spokenText, settings.rate) : 0) + settings.interval * 1000, since: null };
        setPhase("wait");
      }, fail, true);
    } else {
      delay.current.since = performance.now();
      audio.current.wait(delay.current.remaining, () => {
        delay.current = { remaining: 0, since: null };
        if (fullReading) { setFullReading(false); setPlaying(false); setComplete(readingReturn.current); setPhase("ready"); return; }
        if (step + 1 < steps.length) {
          if (settings.control === "manual" && settings.technique !== "combined") { setPhase("ready"); setPlaying(false); }
          else { setStep(v => v + 1); setPhase("prompt"); }
        } else finishUnit();
      });
    }
    return stopAudio;
  }, [playing, complete, phase, paragraph, sentence, step, revision, fullReading, language, settings]);

  useEffect(() => {
    const now = performance.now();
    if (playing && clock.current.since === null) clock.current.since = now;
    if (!playing && clock.current.since !== null) {
      clock.current.accumulated += now - clock.current.since; clock.current.since = null;
    }
    const update = () => setElapsed(clock.current.accumulated + (clock.current.since === null ? 0 : performance.now() - clock.current.since));
    update();
    if (!playing) return;
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    let disposed = false;
    let lock: WakeLockSentinel | null = null;
    let requesting = false;
    async function acquire() {
      if (disposed || requesting || lock || !playing || !settings.keepAwake || document.visibilityState !== "visible") return;
      if (!("wakeLock" in navigator)) { setWarning(t("common.thisBrowserCannotKeepTheScreenAwake")); return; }
      requesting = true;
      try {
        const acquired = await navigator.wakeLock.request("screen");
        if (disposed) { await acquired.release(); return; }
        lock = acquired; setWarning("");
        acquired.addEventListener("release", () => {
          if (lock === acquired) lock = null;
          if (!disposed) setWarning(t("shadowing.screenWakeLockWasReleasedKeepThePageVisibleTo"));
        });
      } catch { if (!disposed) setWarning(t("common.couldNotKeepTheScreenAwake")); }
      finally { requesting = false; }
    }
    void acquire(); document.addEventListener("visibilitychange", acquire);
    return () => { disposed = true; document.removeEventListener("visibilitychange", acquire); void lock?.release().catch(() => {}); };
  }, [playing, settings.keepAwake]);
  useEffect(() => () => audio.current.cancel(), []);

  return { playing, paragraph, sentence, segments, step: current, phase, complete,
    completed: settings.scope === "paragraph" ? Number(completed.has(paragraph)) : completed.size,
    elapsed, error, warning, hasVoice, fullReading,
    canPrevious: sentence > 0 || (settings.scope === "story" && paragraph > 0),
    canNext: sentence + 1 < segments.length || (settings.scope === "story" && paragraph + 1 < story.paragraphs.length),
    play, pause, navigate,
    repeat() { resetUnit(); if (hasVoice) setPlaying(true); },
    stop() { pause(); resetUnit(); },
    configure(next?: ShadowingSettings) {
      pause(); resetUnit(); setSentence(0);
      if (next && next.scope !== settings.scope) {
        setCompleted(new Set());
        if (next.scope === "story") setParagraph(0);
      }
    },
    readParagraph() { readingReturn.current = complete; resetUnit(); setFullReading(true); setPhase("speech"); if (hasVoice) setPlaying(true); }
  };
}
