import { useEffect, useRef, useState } from "react";
import type { StudentLanguage } from "../../config/languages";
import type { WyrChoice } from "./wouldYouRatherStorage";
import { speakStudyAudio } from "../study/studyAudio";

type WalkingItem = { id: string; question: string; choice: WyrChoice; option: { text: string; answer: string }; answer: string };
type Phase = "ready" | "question" | "thinking" | "answer" | "between" | "paused" | "complete" | "error";
interface Props {
  items: WalkingItem[];
  locale: StudentLanguage;
  onExit: () => void;
  onStudyState?: (active: boolean, mode: "manual" | "walking") => void;
}

function speak(text: string, locale: string, onDone: () => void, onError: () => void): () => void {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    onError(); return () => undefined;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = locale;
  utterance.rate = 0.95;
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find(v => v.lang.toLowerCase() === locale.toLowerCase()) ??
    voices.find(v => v.lang.toLowerCase().startsWith(locale.slice(0, 2).toLowerCase()));
  if (voice) utterance.voice = voice;
  utterance.onend = onDone;
  utterance.onerror = onError;
  speakStudyAudio(utterance);
  return () => { utterance.onend = null; utterance.onerror = null; window.speechSynthesis.cancel(); };
}

export function WyrWalking({ items, locale, onExit, onStudyState }: Props) {
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [index, setIndex] = useState(0);
  const [repetition, setRepetition] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [repeatCount, setRepeatCount] = useState(3);
  const [thinkingSeconds, setThinkingSeconds] = useState(8);
  const [betweenSeconds, setBetweenSeconds] = useState(2);
  const [playAnswer, setPlayAnswer] = useState(true);
  const [keepAwake, setKeepAwake] = useState(true);
  const [phase, setPhase] = useState<Phase>("ready");
  const [error, setError] = useState("");
  const generation = useRef(0);
  const cancelAudio = useRef<() => void>(() => undefined);
  const wakeLock = useRef<{ release(): Promise<void> } | null>(null);
  const current = items[index];

  function stopAudio() {
    generation.current++;
    cancelAudio.current();
    cancelAudio.current = () => undefined;
    window.speechSynthesis?.cancel();
  }

  useEffect(() => {
    return () => {
      generation.current++;
      cancelAudio.current();
      window.speechSynthesis?.cancel();
      void wakeLock.current?.release().catch(() => undefined);
      onStudyState?.(false, "walking");
    };
  }, []);

  useEffect(() => {
    onStudyState?.(started && !paused && phase !== "complete" && phase !== "error", "walking");
  }, [started, paused, phase, onStudyState]);

  useEffect(() => {
    if (!keepAwake || !started || paused || phase === "complete" || phase === "error") return;
    let cancelled = false;
    const nav = navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> } };
    void nav.wakeLock?.request("screen").then(lock => {
      if (cancelled) void lock.release();
      else wakeLock.current = lock;
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      void wakeLock.current?.release().catch(() => undefined);
      wakeLock.current = null;
    };
  }, [keepAwake, started, paused, phase]);

  useEffect(() => {
    if (!started || paused || !current || phase === "complete" || phase === "error") return;
    let cancelled = false;
    const session = ++generation.current;
    const live = () => !cancelled && session === generation.current;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const wait = (seconds: number, next: () => void) => {
      timer = setTimeout(() => { if (live()) next(); }, seconds * 1000);
    };
    const next = () => {
      if (!live()) return;
      if (repetition + 1 < repeatCount) setRepetition(value => value + 1);
      else {
        setCompleted(value => value + 1);
        setRepetition(0);
        if (index + 1 < items.length) setIndex(value => value + 1);
        else setPhase("complete");
      }
    };
    const finishCycle = () => { setPhase("between"); wait(betweenSeconds, next); };
    const answer = () => {
      if (!live()) return;
      if (!playAnswer || !current.answer.trim()) { finishCycle(); return; }
      setPhase("answer");
      cancelAudio.current = speak(current.answer, locale, finishCycle, () => {
        if (live()) { setError("Não foi possível reproduzir a resposta."); setPhase("error"); }
      });
    };
    setPhase("question");
    cancelAudio.current = speak(current.question, locale, () => {
      if (live()) { setPhase("thinking"); wait(thinkingSeconds, answer); }
    }, () => {
      if (live()) { setError("Falha na síntese de voz do navegador."); setPhase("error"); }
    });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      cancelAudio.current();
      cancelAudio.current = () => undefined;
    };
  }, [started, paused, index, repetition, repeatCount, thinkingSeconds, betweenSeconds, playAnswer, locale, items]);

  function restart() {
    stopAudio();
    setStarted(false); setPaused(false); setIndex(0); setRepetition(0);
    setCompleted(0); setPhase("ready"); setError("");
  }
  function skip() {
    stopAudio();
    setRepetition(0);
    setCompleted(value => value + 1);
    if (index + 1 >= items.length) setPhase("complete");
    else setIndex(value => value + 1);
  }
  function togglePause() {
    stopAudio();
    setPaused(value => !value);
    setPhase("paused");
  }

  return <section className="wyr-walk" aria-label="Would You Rather — modo caminhada">
    <h2>🚶 Would You Rather — Modo Caminhada</h2>
    <p>Responda em voz alta durante a pausa. Sua voz não é gravada.</p>
    <p><strong>{completed}/{items.length}</strong> perguntas · Repetição <strong>{Math.min(repetition + 1, repeatCount)}/{repeatCount}</strong></p>
    <h3>{current?.question ?? "Treino concluído!"}</h3>
    {current && <p>Alternativa selecionada: <strong>{current.choice}</strong> — {current.option.text}</p>}
    <p role="status">{phase === "question" ? "🔊 Pergunta" : phase === "thinking" ? "🎤 Sua vez de responder" : phase === "answer" ? "🔊 Resposta selecionada" : phase === "between" ? "Próxima repetição" : phase === "paused" ? "Pausado" : phase === "complete" ? "Sessão concluída!" : phase === "error" ? "Erro de áudio" : "Pronto para começar"}</p>
    {error && <p role="alert">{error}</p>}
    {!started && <fieldset className="wyr-walk-settings">
      <legend>Configurações</legend>
      <label>Repetições por pergunta <select value={repeatCount} onChange={e => setRepeatCount(Number(e.target.value))}>{[1, 2, 3, 5].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label>Pausa para responder <select value={thinkingSeconds} onChange={e => setThinkingSeconds(Number(e.target.value))}>{[5, 8, 10, 15, 20, 30].map(value => <option key={value} value={value}>{value} s</option>)}</select></label>
      <label>Intervalo entre repetições <select value={betweenSeconds} onChange={e => setBetweenSeconds(Number(e.target.value))}>{[0, 1, 2, 3, 5].map(value => <option key={value} value={value}>{value} s</option>)}</select></label>
      <label><input type="checkbox" checked={playAnswer} onChange={e => setPlayAnswer(e.target.checked)} /> Ouvir resposta selecionada (inclui personalizações)</label>
      <label><input type="checkbox" checked={keepAwake} onChange={e => setKeepAwake(e.target.checked)} /> Manter tela ligada, quando disponível</label>
    </fieldset>}
    {!started && phase !== "complete" && <button className="wyr-button" type="button" disabled={!items.length} onClick={() => { setStarted(true); setPhase("question"); }}>▶ Iniciar caminhada</button>}
    {started && phase !== "complete" && <div className="wyr-walk-actions">
      <button type="button" className="wyr-button wyr-button--ghost" onClick={togglePause}>{paused ? "▶ Continuar" : "⏸ Pausar"}</button>
      <button type="button" className="wyr-button wyr-button--ghost" onClick={skip}>⏭ Pular pergunta</button>
      <button type="button" className="wyr-button wyr-button--ghost" onClick={restart}>↺ Recomeçar</button>
    </div>}
    {phase === "complete" && <p>Você praticou {completed} perguntas nesta sessão.</p>}
    {phase === "complete" && <button type="button" className="wyr-button" onClick={restart}>↺ Nova caminhada</button>}
    <p className="wyr-walk-help">Áudio por síntese de voz do navegador. A reprodução automática depende das permissões do dispositivo.</p>
    <button className="wyr-button wyr-button--ghost" type="button" onClick={() => { stopAudio(); onExit(); }}>Voltar ao WRG</button>
  </section>;
}
