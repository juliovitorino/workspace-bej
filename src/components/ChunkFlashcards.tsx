import { t, languageName as localizedLanguageName } from "../i18n";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MentalIntention } from "../types/hashmap";
import { isAuthorMode } from "../utils/authorMode";
import { LANGUAGES, type SourceLanguage, type StudentLanguage } from "../config/languages";
import { isMobileDevice } from "../utils/mobileDevice";
import { WalkingMode } from "./WalkingMode";
import { drawChunk, eligibleChunks, type ChunkLevel } from "../utils/chunkEligibility";
import { ChunkLevelSelect } from "./ChunkLevelSelect";

interface ChunkFlashcardsProps {
  studyChunk?: MentalIntention;
  intentions: MentalIntention[];
  language: StudentLanguage;
  sourceLanguage: SourceLanguage;
  onWalkingChange: (active: boolean) => void;
  onShowDetails: (intention: MentalIntention) => void;
  onBasicTraining: (intention: MentalIntention) => void;
  onAdvancedTraining: (intention: MentalIntention) => void;
}

function formatStudyTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

export function ChunkFlashcards({
  studyChunk,
  intentions,
  language,
  sourceLanguage,
  onWalkingChange,
  onShowDetails,
  onBasicTraining,
  onAdvancedTraining
}: ChunkFlashcardsProps) {
  const { t } = useTranslation();
  const authorMode = isAuthorMode();
  const [walking, setWalking] = useState(false);
  const [level, setLevel] = useState<ChunkLevel>("all");
  const [mobile, setMobile] = useState(isMobileDevice);
  useEffect(() => {
    const update = () => setMobile(isMobileDevice());
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  useEffect(() => {
    onWalkingChange(walking);
    return () => onWalkingChange(false);
  }, [walking, onWalkingChange]);

  // O autor escolhe explicitamente quais intenções são chunks completos.
  const chunks = useMemo(
    () => eligibleChunks(intentions, level),
    [intentions, level]
  );

  // Estado da rodada em memória: cada ID só pode ser sorteado uma vez.
  const [drawnIds, setDrawnIds] = useState<string[]>([]);
  const [round, setRound] = useState(1);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [copiedChunkId, setCopiedChunkId] = useState<string | null>(null);
  const [copiedIntentionId, setCopiedIntentionId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const copyFeedbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // O feedback desaparece sozinho e novas cópias reiniciam o prazo.
  function showCopyFeedback(type: "chunk" | "id", id: string) {
    if (copyFeedbackTimeout.current !== null) clearTimeout(copyFeedbackTimeout.current);
    setCopiedChunkId(type === "chunk" ? id : null);
    setCopiedIntentionId(type === "id" ? id : null);
    copyFeedbackTimeout.current = setTimeout(() => {
      setCopiedChunkId(null);
      setCopiedIntentionId(null);
      copyFeedbackTimeout.current = null;
    }, 1500);
  }

  useEffect(() => {
    return () => {
      if (copyFeedbackTimeout.current !== null) clearTimeout(copyFeedbackTimeout.current);
    };
  }, []);

  // Cronômetro: tempo de estudo efetivo, descontando todas as pausas.
  // Timestamps evitam perda de precisão quando a aba fica em segundo plano.
  const [studyStartedAt, setStudyStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isStudyTimeVisible, setIsStudyTimeVisible] = useState(false);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [totalPausedMs, setTotalPausedMs] = useState(0);

  useEffect(() => {
    if (studyStartedAt === null) return;

    const refreshElapsed = () => {
      // Quando pausado, usa o instante da pausa para congelar o contador.
      const end = pausedAt ?? Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((end - studyStartedAt - totalPausedMs) / 1000)));
    };

    refreshElapsed();
    if (pausedAt !== null) return; // Nenhum intervalo rodando durante a pausa.

    const intervalId = window.setInterval(refreshElapsed, 1000);
    return () => window.clearInterval(intervalId);
  }, [studyStartedAt, pausedAt, totalPausedMs]);

  function toggleStudyPause() {
    if (studyStartedAt === null) return;

    if (pausedAt === null) {
      const now = Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((now - studyStartedAt - totalPausedMs) / 1000)));
      setPausedAt(now);
    } else {
      // A pausa não entra na duração total, mesmo após várias horas.
      setTotalPausedMs((previous) => previous + (Date.now() - pausedAt));
      setPausedAt(null);
    }
  }

  useEffect(() => {
    setDrawnIds([]);
    setRound(1);
    setCurrentId(null);
    setAudioError(null);
    if (copyFeedbackTimeout.current !== null) clearTimeout(copyFeedbackTimeout.current);
    setCopiedChunkId(null);
    setCopiedIntentionId(null);
    setCopyError(null);
    setStudyStartedAt(null);
    setElapsedSeconds(0);
    setIsStudyTimeVisible(false);
    setPausedAt(null);
    setTotalPausedMs(0);
  }, [intentions]);

  const currentChunk = studyChunk ?? chunks.find((item) => item.id === currentId) ?? null;
  const total = chunks.length;
  const completed = total > 0 && drawnIds.length === total;
  const shownCount = drawnIds.length;
  const position = currentId === null ? 0 : drawnIds.indexOf(currentId) + 1;

  function nextChunk(pool: MentalIntention[] = chunks, restart = false) {
    if (pool.length === 0) {
      setDrawnIds([]);
      setRound(1);
      setCurrentId(null);
      return;
    }
    // Inicia no primeiro chunk; uma nova rodada não zera a sessão.
    if (studyStartedAt === null) setStudyStartedAt(Date.now());
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setAudioError(null);
    if (copyFeedbackTimeout.current !== null) clearTimeout(copyFeedbackTimeout.current);
    setCopiedChunkId(null);
    setCopiedIntentionId(null);
    setCopyError(null);

    const draw = drawChunk(pool, drawnIds, currentId, restart);
    if (!draw) return;
    if (draw.newRound) setRound(previous => restart ? 1 : previous + 1);
    setDrawnIds(draw.drawnIds);
    setCurrentId(draw.id);
  }

  function changeLevel(nextLevel: ChunkLevel) {
    if (nextLevel === level) return;
    window.speechSynthesis?.cancel();
    setLevel(nextLevel);
    setAudioError(null);
    setCopiedChunkId(null);
    setCopiedIntentionId(null);
    setCopyError(null);
    if (copyFeedbackTimeout.current !== null) clearTimeout(copyFeedbackTimeout.current);
    // Start a fresh round with the same draw mechanism, preserving session time.
    if (walking || currentId !== null) nextChunk(eligibleChunks(intentions, nextLevel), true);
    else { setDrawnIds([]); setCurrentId(null); }
  }

  // Reutiliza a mesma estratégia de cópia para o texto do chunk e seu ID.
  async function copyText(text: string): Promise<void> {
    let copied = false;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch {
        // Alguns navegadores bloqueiam a API; tenta o método alternativo.
      }
    }

    if (!copied) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      textarea.style.pointerEvents = "none";
      document.body.appendChild(textarea);
      try {
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, text.length);
        if (!document.execCommand("copy")) throw new Error(t("flashcards.copyFailed"));
      } finally {
        document.body.removeChild(textarea);
      }
    }
  }

  async function copyChunk() {
    if (!currentChunk) return;
    const text = (currentChunk.targetIntention ?? currentChunk.english).trim();
    if (!text) return;

    try {
      await copyText(text);
      showCopyFeedback("chunk", currentChunk.id);
      setCopyError(null);
    } catch {
      setCopiedChunkId(null);
      setCopyError(t("flashcards.couldNotCopyTheChunkInThisBrowser"));
    }
  }

  async function copyIntentionId() {
    // Protege também a ação, não apenas a visibilidade do botão.
    if (!isAuthorMode() || !currentChunk) return;
    try {
      await copyText(currentChunk.id);
      showCopyFeedback("id", currentChunk.id);
      setCopyError(null);
    } catch {
      setCopiedIntentionId(null);
      setCopyError(t("flashcards.couldNotCopyTheIntentionIdInThisBrowser"));
    }
  }

  function speak() {
    if (!currentChunk) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setAudioError(t("flashcards.yourBrowserDoesNotSupportSpeechPlayback"));
      return;
    }

    setAudioError(null);
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance((currentChunk.targetIntention ?? currentChunk.english).trim());
    utterance.lang = language;
    utterance.rate = 0.9;
    const voices = synth.getVoices();
    utterance.voice = voices.find((voice) => voice.lang.toLowerCase() === language.toLowerCase()) ??
      voices.find((voice) => voice.lang.toLowerCase().split("-")[0] === language.slice(0, 2)) ?? null;
    utterance.onerror = (event) => {
      if (event.error !== "canceled" && event.error !== "interrupted") {
        setAudioError(t("flashcards.couldNotPlayTheAudioInThisBrowser"));
      }
    };
    synth.speak(utterance);
  }

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const flashcard = <>
          <article className="chunk-flashcards-card" aria-live="polite">
            {currentChunk ? (
              <>
                <p className="chunk-flashcards-language">{localizedLanguageName(language)} · {language}</p>
                <div className="chunk-flashcards-english-row">
                  <h3>{currentChunk.targetIntention ?? currentChunk.english}</h3>
                  <div className="chunk-flashcards-english-actions">
                    <button
                      type="button"
                      className="chunk-flashcards-speaker"
                      onClick={speak}
                      aria-label={t("flashcards.listenToThePronunciationOfText", { text: (currentChunk.targetIntention ?? currentChunk.english) })}
                      title={t("flashcards.listenToPronunciationTargetlanguage", { targetLanguage: (LANGUAGES[language].name) })}
                    >
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M11 5 6 9H3v6h3l5 4V5Z" />
                        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                        <path d="M19 5a10 10 0 0 1 0 14" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="chunk-flashcards-details"
                      onClick={() => onShowDetails(currentChunk)}
                      aria-label={t("flashcards.viewDetailsAndExamplesOfText", { text: (currentChunk.targetIntention ?? currentChunk.english) })}
                      title={t("flashcards.viewDetailsAndMoreExamples")}
                    >
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 7v14" />
                        <path d="M3 18V5.5A2.5 2.5 0 0 1 5.5 3H8a4 4 0 0 1 4 2 4 4 0 0 1 4-2h2.5A2.5 2.5 0 0 1 21 5.5V18h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3Z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="chunk-flashcards-details"
                      onClick={() => void copyChunk()}
                      aria-label={copiedChunkId === currentChunk.id ? t("flashcards.chunkCopied") : t("flashcards.copyTextToTheClipboard", { text: (currentChunk.targetIntention ?? currentChunk.english) })}
                      title={copiedChunkId === currentChunk.id ? t("stories.copied") : t("flashcards.copyChunkInTheStudyLanguage")}
                    >
                      {copiedChunkId === currentChunk.id ? (
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="m5 12 4 4L19 6" />
                        </svg>
                      ) : (
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="8" y="8" width="12" height="12" rx="2" />
                          <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
                        </svg>
                      )}
                    </button>
                    {authorMode && (
                      <button
                        type="button"
                        className="chunk-flashcards-details"
                        onClick={() => void copyIntentionId()}
                        aria-label={copiedIntentionId === currentChunk.id ? t("common.idCopied") : t("common.copyIntentionIdForIntention", { intention: (currentChunk.intention) })}
                        title={copiedIntentionId === currentChunk.id ? t("common.idCopied") : t("flashcards.copyIntentionIdAuthorMode")}
                      >
                        <span aria-hidden="true" style={{ fontSize: "1.25rem", lineHeight: 1 }}>
                          {copiedIntentionId === currentChunk.id ? "✓" : "🔢"}
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="chunk-flashcards-details"
                      onClick={() => onBasicTraining(currentChunk)}
                      aria-label={t("flashcards.openBasicPracticeForText", { text: (currentChunk.targetIntention ?? currentChunk.english) })}
                      title={t("common.basicPractice")}
                    >
                      <span aria-hidden="true" style={{ fontSize: "1.5rem", lineHeight: 1 }}>🚶🏻‍➡️</span>
                    </button>
                    <button
                      type="button"
                      className="chunk-flashcards-details"
                      onClick={() => onAdvancedTraining(currentChunk)}
                      aria-label={t("flashcards.openAdvancedPracticeForText", { text: (currentChunk.targetIntention ?? currentChunk.english) })}
                      title={t("common.advancedPractice")}
                    >
                      <span aria-hidden="true" style={{ fontSize: "1.5rem", lineHeight: 1 }}>🏃</span>
                    </button>
                  </div>
                </div>
                <div className="chunk-flashcards-divider" />
                <p className="chunk-flashcards-language">{localizedLanguageName(sourceLanguage).toUpperCase()} · {sourceLanguage}</p>
                <p className="chunk-flashcards-portuguese">{currentChunk.intention}</p>
              </>
            ) : (
              <div className="chunk-flashcards-start">
                <h3>{t("flashcards.readyToPractice")}</h3>
                <p>{t("flashcards.clickStartToDrawTheFirstChunk")}</p>
              </div>
            )}
          </article>

          {audioError && <p className="chunk-flashcards-audio-error" role="alert">{audioError}</p>}
          {copyError && <p className="chunk-flashcards-audio-error" role="alert">{copyError}</p>}
          {(currentChunk !== null && (copiedChunkId === currentChunk.id || (authorMode && copiedIntentionId === currentChunk.id))) && (
            <p
              role="status"
              style={{
                position: "fixed", bottom: "1.25rem", right: "1.25rem",
                zIndex: 1000, margin: 0, padding: "0.65rem 1rem",
                borderRadius: "0.65rem", background: "#1e293b",
                color: "#ffffff", fontWeight: 600,
                boxShadow: "0 4px 14px rgba(0,0,0,0.22)"
              }}
            >
              {copiedChunkId === currentChunk?.id ? "✓ " + t("flashcards.englishChunkCopied") : "✓ " + t("flashcards.intentionIdCopied")}
            </p>
          )}
  </>;

  if (studyChunk) return flashcard;

  if (walking) {
    return <WalkingMode chunk={currentChunk} language={language} sourceLanguage={sourceLanguage}
      level={level} onLevelChange={changeLevel} position={position} total={total} round={round}
      canPrevious={position > 1}
      onPrevious={() => { if (position > 1) setCurrentId(drawnIds[position - 2]); }}
      onNext={() => {
        if (position < drawnIds.length) {
          setCurrentId(drawnIds[position]);
          return false;
        }
        nextChunk();
        return completed;
      }}
      onStop={() => setWalking(false)} />;
  }

  return (
    <section className="chunk-flashcards" aria-labelledby="chunk-flashcards-title">
      <div className="chunk-flashcards-heading">
        <div>
          <p className="eyebrow">{t("flashcards.completeExpressionPractice")}</p>
          <h2 id="chunk-flashcards-title">{t("common.chunkFlashcards")}</h2>
          <p>{t("flashcards.readListenAndRepeatEachExpressionAloud")}</p>
        </div>
        <div className="chunk-flashcards-heading-tools">
          <span className="chunk-flashcards-total">{t("flashcards.availableChunks", { count: total })}</span>
          {isStudyTimeVisible && (
            <span className="chunk-flashcards-study-time" aria-label={t("flashcards.studyTimeTime", { time: (formatStudyTime(elapsedSeconds)) })}>
              <span className="chunk-flashcards-study-time-label">{t("common.studyTime")}</span>
              <span className="chunk-flashcards-study-time-value">{formatStudyTime(elapsedSeconds)}</span>
            </span>
          )}
          <button
            type="button"
            className="chunk-flashcards-timer-toggle"
            onClick={() => setIsStudyTimeVisible((visible) => !visible)}
            aria-label={isStudyTimeVisible ? t("flashcards.hideStudyTime") : t("flashcards.showStudyTime")}
            aria-pressed={isStudyTimeVisible}
            title={isStudyTimeVisible ? t("flashcards.hideTimeKeepsCounting") : t("flashcards.showStudyTimer")}
          >
            {isStudyTimeVisible ? (
              // Olho fechado: próximo clique oculta o tempo.
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 3 21 21" />
                <path d="M10.6 5.2A10.6 10.6 0 0 1 12 5c4.5 0 8.3 2.9 10 7-0.6 1.5-1.5 2.8-2.6 3.8" />
                <path d="M6.1 6.1C4.2 7.3 2.8 9.3 2 12c1.7 4.1 5.5 7 10 7 1.5 0 2.9-0.3 4.2-0.9" />
                <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
              </svg>
            ) : (
              // Cronômetro: próximo clique exibe o tempo.
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="13" r="8" />
                <path d="M12 13V9m0 4 3 2M9 2h6m-3 0v3m6.4 1.6 1.4-1.4" />
              </svg>
            )}
          </button>
          <button
            type="button"
            className="chunk-flashcards-timer-toggle"
            onClick={toggleStudyPause}
            disabled={studyStartedAt === null}
            aria-label={pausedAt !== null ? t("flashcards.resumeStudyTime") : t("flashcards.pauseStudyTime")}
            aria-pressed={pausedAt !== null}
            title={studyStartedAt === null ? t("flashcards.startStudyingToEnablePause") : pausedAt !== null ? t("flashcards.resumeTimer") : t("flashcards.pauseTimer")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.4rem",
              padding: "0.5rem 0.7rem",
              minHeight: "2.6rem",
              cursor: studyStartedAt === null ? "not-allowed" : "pointer",
              opacity: studyStartedAt === null ? 0.5 : 1,
              fontWeight: 700,
              whiteSpace: "nowrap"
            }}
          >
            <span aria-hidden="true">{pausedAt !== null ? "▶" : "⏸"}</span>
          </button>
        </div>
      </div>

      <ChunkLevelSelect value={level} onChange={changeLevel} />
      <p className="chunk-intention-count" role="status" aria-label={t("common.chunkPositionInTheRound")}>{position}/{total}</p>

      {pausedAt !== null && (
        <div
          role="status"
          aria-live="polite"
          style={{
            margin: "0.75rem 0 1rem",
            padding: "1rem 1.25rem",
            borderRadius: "12px",
            backgroundColor: "#7c2d12",
            color: "#ffffff",
            border: "2px solid #fbbf24",
            textAlign: "center",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.18)"
          }}
        >
          <strong style={{ display: "block", fontSize: "1.2rem", letterSpacing: "0.02em" }}>
            
            {"⏸ "}{t("flashcards.studyPaused")}
          </strong>
          <span style={{ display: "block", marginTop: "0.3rem", fontWeight: 600 }}>
            {t("flashcards.timerPaused", { time: formatStudyTime(elapsedSeconds) })}
          </span>
        </div>
      )}

      {total === 0 ? (
        <div className="chunk-flashcards-empty" role="status">
          <h3>{level === "all" ? t("flashcards.noChunksEnabled") : t("common.noChunksAvailableForLevelLevel", { level: (level) })}</h3>
          {level === "all" && <p>
            
            {t("flashcards.markCompleteIntentionsWith")} <code>"allowLanguageChunkPractice": true</code>
            {" "}{t("flashcards.inTheMentalHashmapJsonToPracticeThemHere")}
          </p>}
        </div>
      ) : (
        <>
          <div className="chunk-flashcards-progress" aria-live="polite">
            <span>{t("flashcards.roundNumber", { round })}</span>
            <strong>{t("common.countOfTotal", { count: shownCount, total })}</strong>
          </div>
          <div
            className="chunk-flashcards-progress-track"
            role="progressbar"
            aria-label={t("flashcards.chunksPresentedInThisRound")}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={shownCount}
          >
            <div style={{ width: `${(shownCount / total) * 100}%` }} />
          </div>

          {flashcard}
          {completed && (
            <p className="chunk-flashcards-finished" role="status">
              {t("flashcards.roundPracticed", { count: total })}
            </p>
          )}
          <div className="chunk-flashcards-actions">
            {mobile && <button type="button" className="primary-button walking-entry" onClick={() => {
              if (!isMobileDevice()) return;
              if (!currentChunk) nextChunk();
              window.speechSynthesis?.cancel();
              setWalking(true);
            }}>{"🎧 "}{t("common.walkingMode")}</button>}
            <button type="button" className="primary-button" onClick={() => nextChunk()}>
              {currentChunk === null ? t("flashcards.start") : completed ? t("flashcards.newRound") : t("common.next") + " →"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
