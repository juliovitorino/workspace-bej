import { t, languageName as localizedLanguageName } from "../i18n";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useRef, useState } from "react";
import { LANGUAGES, type SourceLanguage, type StudentLanguage } from "../config/languages";
import type { MentalIntention } from "../types/hashmap";
import { CEFR_LEVELS, eligibleChunks, type ChunkLevel } from "../utils/chunkEligibility";
import { ChunkFlashcards } from "./ChunkFlashcards";
import { PersonalFlashcardEditor } from "../features/personal-flashcards/PersonalFlashcardEditor";
import { PersonalBackupMenu } from "../features/personal-flashcards/PersonalBackupMenu";
import { PERSONAL_CARDS_CHANGED, countPersonalFlashcards } from "../features/personal-flashcards/personalFlashcardStorage";
import type { FavoriteChunk } from "../utils/favoriteChunks";
import { FavoriteChunkButton } from "./FavoriteChunkButton";

interface Props {
  favorites?: FavoriteChunk[];
  onToggleFavorite?: (id: string, type?: "example") => void;
  intentions: MentalIntention[];
  language: StudentLanguage;
  sourceLanguage: SourceLanguage;
  onShowDetails: (item: MentalIntention) => void;
  onBasicTraining: (item: MentalIntention) => void;
  onAdvancedTraining: (item: MentalIntention) => void;
}

const levelNames = () => [t("memory.beginner"), t("memory.elementary"), t("memory.intermediate"), t("memory.upperIntermediate"), t("memory.advanced"), t("memory.proficient")];
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
  const { t } = useTranslation();
  const { intentions, language, sourceLanguage } = props;
  const [level, setLevel] = useState<ChunkLevel>("all");
  const [showPersonalEditor, setShowPersonalEditor] = useState(false);
  const eligible = useMemo(() => eligibleChunks(intentions, level).filter(item =>
    Boolean(item.targetIntention?.trim()) && (item.examples?.length ?? 0) > 0
  ), [intentions, level]);
  // Only a language change remounts the clock; level changes reset the deck below.
  return <>
    <MemoryRound key={`${sourceLanguage}-${language}`} {...props} eligible={eligible}
      level={level} onLevelChange={setLevel} onCreatePersonal={() => setShowPersonalEditor(true)} />
    {showPersonalEditor && <PersonalFlashcardEditor sourceLanguage={sourceLanguage} targetLanguage={language}
      onClose={() => setShowPersonalEditor(false)} onSaved={() => setShowPersonalEditor(false)} />}
  </>;
}

function MemoryRound({ eligible, level, onLevelChange, ...props }: Props & {
  eligible: MentalIntention[]; level: ChunkLevel; onLevelChange: (level: ChunkLevel) => void;
  onCreatePersonal: () => void;
}) {
  const { t } = useTranslation();
  const { language, sourceLanguage } = props;
  const [deck, setDeck] = useState(() => shuffleChunks(eligible));
  const [position, setPosition] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [studied, setStudied] = useState<Set<string>>(() => new Set());
  const [elapsed, setElapsed] = useState(0);
  const clock = useRef<{ startedAt: number | null; accumulated: number }>({ startedAt: null, accumulated: 0 });
  const [running, setRunning] = useState(false);
  const [personalCount, setPersonalCount] = useState<number | null>(null);
  const [backupMessage, setBackupMessage] = useState("");
  const [backupError, setBackupError] = useState("");

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void countPersonalFlashcards().then(count => {
        if (active) setPersonalCount(count);
      }).catch(() => {
        if (active) setPersonalCount(null);
      });
    };
    refresh();
    window.addEventListener(PERSONAL_CARDS_CHANGED, refresh);
    return () => {
      active = false;
      window.removeEventListener(PERSONAL_CARDS_CHANGED, refresh);
    };
  }, []);
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
    <header className="memory-heading">
      <h2 id="memory-title">{"🧠 "}{t("memory.title")}</h2>
      <div className="memory-heading-controls">
        <span className="memory-badge">{t("memory.memory")}</span>
        <button type="button" className="memory-personal-add" onClick={props.onCreatePersonal}
          title={t("personal.create")} aria-label={t("personal.create")}>+</button>
        {personalCount === 0 && <PersonalBackupMenu restoreOnly
          onStatus={message => { setBackupMessage(message); setBackupError(""); }}
          onError={message => { setBackupError(message); setBackupMessage(""); }} />}
      </div>
    </header>
    {backupMessage && <p role="status" className="personal-backup-feedback">{backupMessage}</p>}
    {backupError && <p role="alert" className="personal-error">{backupError}</p>}
    <label className="memory-level">{t("memory.studyLevel")}
      <select value={level} onChange={event => onLevelChange(event.target.value as ChunkLevel)}>
        <option value="all">{t("common.allLevels")}</option>
        {CEFR_LEVELS.map((value, index) => <option key={value} value={value}>{value} — {levelNames()[index]}</option>)}
      </select>
    </label>
    <div className="memory-stats">
      <div><strong>{studied.size} / {total}</strong><span>{t("memory.studied")}</span></div>
      <div><strong>{progress.toLocaleString(sourceLanguage, { maximumFractionDigits: 1 })}%</strong><span>{t("memory.progress")}</span></div>
      <div><strong>{formatMemoryTime(elapsed)}</strong><span>{t("common.studyTime")}</span></div>
    </div>
    <div className="memory-progress" role="progressbar" aria-label={t("memory.chunksStudied")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
      <div style={{ width: `${progress}%` }} />
    </div>
    <div className="memory-progress-labels"><span>{t("memory.studiedChunks", { count: studied.size })}</span><span>{t("memory.remainingChunks", { count: total - studied.size })}</span></div>
    <div className="memory-languages"><span>{LANGUAGES[sourceLanguage].flag} {localizedLanguageName(sourceLanguage)} → {LANGUAGES[language].flag} {localizedLanguageName(language)}</span>
      {current?.englishLevel && <span className="memory-badge">{current.englishLevel}</span>}
    </div>
    <div className="memory-card" data-side={revealed ? "back" : "front"} aria-live="polite">
      {!current ? <p>{t("memory.noChunksAvailableForThisLevelAndLanguagePair")}</p> : revealed ?
        <ChunkFlashcards key={current.id} intentions={eligible} studyChunk={current} language={language} sourceLanguage={sourceLanguage}
          favorites={props.favorites} onToggleFavorite={props.onToggleFavorite}
          onWalkingChange={ignoreWalking} onShowDetails={props.onShowDetails}
          onBasicTraining={props.onBasicTraining} onAdvancedTraining={props.onAdvancedTraining} /> : <>
          <div className="chunk-flashcards-card-header">
            <p className="memory-card-label">{LANGUAGES[sourceLanguage].flag}  {t("common.sourceLanguage")}</p>
            {props.onToggleFavorite && <FavoriteChunkButton
              active={props.favorites?.some(favorite => favorite.type === undefined && favorite.id === current.id && favorite.language === language) ?? false}
              onToggle={() => props.onToggleFavorite?.(current.id)} />}
          </div>
          <h3 lang={sourceLanguage}>{current.intention}</h3>
          <p>{t("memory.recallHint", { targetLanguage: localizedLanguageName(language) })}</p>
          <small>{t("memory.answerHidden")}</small>
        </>}
    </div>
    <div className="memory-actions">
      <button type="button" className="primary-button" disabled={!current} onClick={flip}>{revealed ? "↶ " + t("memory.viewFront") : t("memory.flipFlashcard")}</button>
      <button type="button" className="secondary-button" disabled={!current || (!complete && !studied.has(current.id))}
        onClick={() => {
          if (complete) { restart(); return; }
          window.speechSynthesis?.cancel();
          setPosition(value => value + 1);
          setRevealed(false);
        }}>{complete ? t("memory.startANewRound") : "⇄ " + t("memory.drawNextChunk")}</button>
    </div>
    <p className="memory-status" role="status">{complete ? t("memory.roundComplete") : current && studied.has(current.id) ? t("memory.chunkRecordedYouCanMoveOn") : t("memory.revealTheBackToRecordYourStudy")}</p>
  </section>;
}
