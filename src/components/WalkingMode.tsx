import { useEffect, useRef, useState } from "react";
import type { MentalIntention } from "../types/hashmap";
import type { StudentLanguage } from "../config/languages";
import { isMobileDevice } from "../utils/mobileDevice";
import { repetitionText, WalkingAudio } from "../utils/walkingAudio";

interface Props {
  chunk: MentalIntention;
  language: StudentLanguage;
  canPrevious: boolean;
  onPrevious: () => void;
  onNext: () => boolean;
  onStop: () => void;
}

export function WalkingMode({ chunk, language, canPrevious, onPrevious, onNext, onStop }: Props) {
  const [paused, setPaused] = useState(false);
  const [repetitions, setRepetitions] = useState(5);
  const [pause, setPause] = useState(3);
  const [rate, setRate] = useState(0.9);
  const [automatic, setAutomatic] = useState(true);
  const [keepAwake, setKeepAwake] = useState(true);
  const [round, setRound] = useState(1);
  const [index, setIndex] = useState(0);
  const [spoken, setSpoken] = useState(0);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [wakeWarning, setWakeWarning] = useState("");
  const [seconds, setSeconds] = useState(0);
  const elapsed = useRef(0);
  const activeSince = useRef<number | null>(performance.now());
  const audio = useRef(new WalkingAudio());
  const phase = useRef<"speech" | "pause">("speech");
  const callbacks = useRef({ onNext, onPrevious, onStop });
  callbacks.current = { onNext, onPrevious, onStop };

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
    else if (callbacks.current.onNext()) setRound(v => v + 1);
  }
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    if (!isMobileDevice()) {
      audio.current.cancel();
      callbacks.current.onStop();
      return;
    }
    if (paused) return;
    if (index >= repetitions) {
      if (automatic) navigateRef.current();
      return;
    }
    const done = () => {
      phase.current = "speech";
      setIndex(v => v + 1);
    };
    if (phase.current === "pause") audio.current.wait(pause * 1000, done);
    else audio.current.play(repetitionText(chunk.english.trim(), language, index, repetitions),
      language, rate, pause * 1000,
      () => { phase.current = "pause"; setSpoken(index + 1); }, done,
      () => { setError("Não foi possível reproduzir o áudio. Toque em Continuar para tentar novamente."); setPaused(true); });
    return () => audio.current.cancel();
  }, [chunk.id, language, paused, index, repetitions, pause, rate, automatic, revision]);

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
        setWakeWarning("Este navegador não permite manter a tela ativa."); return;
      }
      requesting = true;
      try {
        const acquired = await navigator.wakeLock.request("screen");
        if (disposed) { await acquired.release(); return; }
        lock = acquired;
        setWakeWarning("");
        acquired.addEventListener("release", () => {
          if (lock === acquired) lock = null;
          if (!disposed) setWakeWarning("A tela pode apagar. Mantenha a página aberta para continuar.");
        });
      } catch { if (!disposed) setWakeWarning("Não foi possível manter a tela ativa."); }
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
    <h2 id="walking-title">🎧 Modo Caminhada</h2>
    <p>Tempo de estudo <strong>{time}</strong> · Rodada {round}</p>
    <article className="chunk-flashcards-card">
      <p>{language}</p><h3 lang={language}>{chunk.english}</h3>
      <p lang="pt-BR">{chunk.intention}</p>
    </article>
    <p role="status">{paused ? "Pausado" : index >= repetitions ? "Aguardando próximo chunk" : "Ouça e repita"} · {spoken}/{repetitions}</p>
    <progress aria-label="Repetições concluídas" value={spoken} max={repetitions} />
    {error && <p role="alert">{error}</p>}
    <div className="walking-controls">
      <button type="button" disabled={!canPrevious} onClick={() => navigate(true)}>← Chunk anterior</button>
      <button type="button" onClick={() => { audio.current.cancel(); setError(""); setPaused(v => !v); }}>{paused ? "Continuar" : "Pausar"}</button>
      <button type="button" onClick={() => navigate()}>Próximo chunk →</button>
      <button type="button" className="primary-button" onClick={() => { audio.current.cancel(); onStop(); }}>Parar</button>
    </div>
    <details><summary>Configurações de reprodução</summary>
      <div className="walking-settings">
        <label>Repetições por chunk <select value={repetitions} onChange={e => { resetPlayback(); setRepetitions(Number(e.target.value)); }}>
          {Array.from({ length: 8 }, (_, i) => i + 3).map(v => <option key={v}>{v}</option>)}
        </select></label>
        <label>Pausa entre reproduções <select value={pause} onChange={e => setPause(Number(e.target.value))}>
          {Array.from({ length: 7 }, (_, i) => i + 2).map(v => <option key={v} value={v}>{v} segundos</option>)}
        </select></label>
        <label>Velocidade da voz <select value={rate} onChange={e => setRate(Number(e.target.value))}>
          {[0.8, 0.9, 1].map(v => <option key={v} value={v}>{v.toFixed(1)}×</option>)}
        </select></label>
        <label><input type="checkbox" checked={automatic} onChange={e => setAutomatic(e.target.checked)} /> Avanço automático</label>
        <label><input type="checkbox" checked={keepAwake} onChange={e => setKeepAwake(e.target.checked)} /> Manter tela ativa</label>
      </div>
    </details>
    {wakeWarning && <p role="status">{wakeWarning}</p>}
    <p className="walking-note">Mantenha esta página aberta e o celular desbloqueado. O navegador pode suspender o áudio em segundo plano. Para trocar o idioma, encerre a caminhada.</p>
  </section>;
}
