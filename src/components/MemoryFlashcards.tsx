import { useEffect, useMemo, useRef, useState } from "react";
import { LANGUAGES, type SourceLanguage, type StudentLanguage } from "../config/languages";
import type { MentalIntention } from "../types/hashmap";
import { CEFR_LEVELS, eligibleChunks, type ChunkLevel } from "../utils/chunkEligibility";
import { ChunkFlashcards } from "./ChunkFlashcards";

interface Props {
  intentions: MentalIntention[];
  language: StudentLanguage;
  sourceLanguage: SourceLanguage;
  onShowDetails: (item: MentalIntention) => void;
  onBasicTraining: (item: MentalIntention) => void;
  onAdvancedTraining: (item: MentalIntention) => void;
}

const levelNames = ["Iniciante", "Básico", "Intermediário", "Intermediário avançado", "Avançado", "Proficiente"];
const ignoreWalking = () => {};

export function shuffleChunks(chunks: MentalIntention[]): MentalIntention[] {
  const shuffled = [...chunks];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function formatMemoryTime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map(value => String(value).padStart(2, "0")).join(":");
}

export function MemoryFlashcards(props: Props) {
  const { intentions, language, sourceLanguage } = props;
  const [level, setLevel] = useState<ChunkLevel>("all");
  const eligible = useMemo(() => eligibleChunks(intentions, level).filter(item =>
    Boolean(item.targetIntention?.trim()) && (item.examples?.length ?? 0) > 0
  ), [intentions, level]);
  // Only a language change remounts the clock; level changes reset the deck below.
  return <MemoryRound key={`${sourceLanguage}-${language}`} {...props} eligible={eligible}
    level={level} onLevelChange={setLevel} />;
}

function MemoryRound({ eligible, level, onLevelChange, ...props }: Props & {
  eligible: MentalIntention[]; level: ChunkLevel; onLevelChange: (level: ChunkLevel) => void;
}) {
  const { language, sourceLanguage } = props;
  const [deck, setDeck] = useState(() => shuffleChunks(eligible));
  const [position, setPosition] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [studied, setStudied] = useState<Set<string>>(() => new Set());
  const [elapsed, setElapsed] = useState(0);
  const clock = useRef<{ startedAt: number | null; accumulated: number }>({ startedAt: null, accumulated: 0 });
  const [running, setRunning] = useState(false);
  const current = deck[position];
  const total = deck.length;
  const complete = total > 0 && studied.size === total;
  const progress = total ? studied.size / total * 100 : 0;

  useEffect(() => {
    if (!running) return;
    const tick = () => setElapsed(clock.current.accumulated + Date.now() - (clock.current.startedAt ?? Date.now()));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    setDeck(shuffleChunks(eligible));
    setPosition(0);
    setRevealed(false);
    setStudied(new Set());
    window.speechSynthesis?.cancel();
  }, [eligible]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  function flip() {
    if (!current) return;
    if (!revealed && !studied.has(current.id)) {
      const next = new Set(studied).add(current.id);
      setStudied(next);
      if (clock.current.startedAt === null) {
        clock.current.startedAt = Date.now();
        setRunning(true);
      }
      if (next.size === total) {
        clock.current.accumulated += Date.now() - clock.current.startedAt;
        clock.current.startedAt = null;
        setElapsed(clock.current.accumulated);
        setRunning(false);
      }
    }
    window.speechSynthesis?.cancel();
    setRevealed(value => !value);
  }

  function restart() {
    setDeck(shuffleChunks(eligible));
    setPosition(0);
    setStudied(new Set());
    setRevealed(false);
    clock.current = { startedAt: null, accumulated: 0 };
    setElapsed(0);
    setRunning(false);
    window.speechSynthesis?.cancel();
  }

  return <section className="memory-flashcards" aria-labelledby="memory-title">
    <header className="memory-heading"><h2 id="memory-title">🧠 Memory Flashcards</h2><span className="memory-badge">Memória</span></header>
    <label className="memory-level">Nível de estudo
      <select value={level} onChange={event => onLevelChange(event.target.value as ChunkLevel)}>
        <option value="all">Todos os níveis</option>
        {CEFR_LEVELS.map((value, index) => <option key={value} value={value}>{value} — {levelNames[index]}</option>)}
      </select>
    </label>
    <div className="memory-stats">
      <div><strong>{studied.size} / {total}</strong><span>Estudados</span></div>
      <div><strong>{progress.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</strong><span>Progresso</span></div>
      <div><strong>{formatMemoryTime(elapsed)}</strong><span>Tempo de estudo</span></div>
    </div>
    <div className="memory-progress" role="progressbar" aria-label="Chunks estudados" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
      <div style={{ width: `${progress}%` }} />
    </div>
    <div className="memory-progress-labels"><span>{studied.size} chunks estudados</span><span>{total - studied.size} restantes</span></div>
    <div className="memory-languages"><span>{LANGUAGES[sourceLanguage].flag} {LANGUAGES[sourceLanguage].name} → {LANGUAGES[language].flag} {LANGUAGES[language].name}</span>
      {current?.englishLevel && <span className="memory-badge">{current.englishLevel}</span>}
    </div>
    <div className="memory-card" data-side={revealed ? "back" : "front"} aria-live="polite">
      {!current ? <p>Nenhum chunk disponível para este nível e par de idiomas.</p> : revealed ?
        <ChunkFlashcards key={current.id} intentions={eligible} studyChunk={current} language={language} sourceLanguage={sourceLanguage}
          onWalkingChange={ignoreWalking} onShowDetails={props.onShowDetails}
          onBasicTraining={props.onBasicTraining} onAdvancedTraining={props.onAdvancedTraining} /> : <>
          <p className="memory-card-label">{LANGUAGES[sourceLanguage].flag} IDIOMA DE ORIGEM</p>
          <h3 lang={sourceLanguage}>{current.intention}</h3>
          <p>Tente lembrar como dizer isso em {LANGUAGES[language].name.toLowerCase()}.</p>
          <small>Resposta oculta</small>
        </>}
    </div>
    <div className="memory-actions">
      <button type="button" className="primary-button" disabled={!current} onClick={flip}>{revealed ? "↶ Ver frente" : "Virar flashcard"}</button>
      <button type="button" className="secondary-button" disabled={!current || (!complete && !studied.has(current.id))}
        onClick={() => {
          if (complete) { restart(); return; }
          window.speechSynthesis?.cancel();
          setPosition(value => value + 1);
          setRevealed(false);
        }}>{complete ? "Iniciar nova rodada" : "⇄ Sortear próximo chunk"}</button>
    </div>
    <p className="memory-status" role="status">{complete ? "Rodada concluída!" : current && studied.has(current.id) ? "Chunk registrado. Você pode avançar." : "Revele o verso para registrar seu estudo."}</p>
  </section>;
}
