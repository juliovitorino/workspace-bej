import { t } from "../i18n";
import { useTranslation } from "react-i18next";
import { LANGUAGES, type SourceLanguage, type StudentLanguage } from "../config/languages";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { SpeakingGameForm } from "../config/speakingGameForms";
import type { SpeakingVerb, GameAdjective, GameNoun } from "../types/englishVerb";
import type { SpeakingVocabulary } from "../services/englishVerbService";
import type { MentalIntention } from "../types/hashmap";
import { loadHashmap } from "../services/hashmapService";
import type {
  SpeakingGameSettings,
  SpeakingGameStatus
} from "../types/speakingGameTypes";

interface VocabularyItem {
  id: string;
  meanings?: string[];
}

type AdjectiveItem = GameAdjective;
type NounItem = GameNoun;

function drawDifferentItem<T extends VocabularyItem>(
  items: T[],
  previous: T | null
): T | null {
  if (items.length === 0) return null;
  const alternatives = items.filter((item) => item.id !== previous?.id);
  const pool = alternatives.length > 0 ? alternatives : items;
  return pool[Math.floor(Math.random() * pool.length)];
}

function drawDifferentChunk(
  chunks: MentalIntention[],
  previous: MentalIntention | null
): MentalIntention | null {
  if (chunks.length === 0) return null;
  const alternatives = chunks.filter((item) => item.id !== previous?.id);
  const pool = alternatives.length > 0 ? alternatives : chunks;
  return pool[Math.floor(Math.random() * pool.length)];
}

interface SpeakingGamePlayStepProps {
  language: StudentLanguage;
  sourceLanguage: SourceLanguage;
  verb: SpeakingVerb;
  vocabulary: SpeakingVocabulary;
  loading?: boolean;
  formLabel: string;
  form: SpeakingGameForm;
  settings: SpeakingGameSettings;
  status: SpeakingGameStatus;
  remainingSeconds: number;
  automaticVerbOnly: boolean;
  onAutomaticVerbOnlyChange: (value: boolean) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onNext: () => void;
  onNewVerb?: () => void;
}

export function SpeakingGamePlayStep({
  language,
  sourceLanguage,
  verb,
  vocabulary,
  loading = false,
  formLabel,
  form,
  settings,
  status,
  remainingSeconds,
  automaticVerbOnly,
  onAutomaticVerbOnlyChange,
  onPause,
  onResume,
  onStop,
  onNext,
  onNewVerb
}: SpeakingGamePlayStepProps) {
  const { t } = useTranslation();
  const [showVerbForms, setShowVerbForms] = useState(true);
  const { adjectives, nouns } = vocabulary;
  const [selectedAdjective, setSelectedAdjective] = useState<AdjectiveItem | null>(null);
  const [selectedNoun, setSelectedNoun] = useState<NounItem | null>(null);
  const [chunks, setChunks] = useState<MentalIntention[]>([]);
  const [chunkError, setChunkError] = useState<string | null>(null);
  const [selectedChunk, setSelectedChunk] = useState<MentalIntention | null>(null);
  const previousRemainingSeconds = useRef(remainingSeconds);

  const isAutomatic = settings.timeMode === "automatic";
  const isPaused = status === "paused";
  const localized = "forms" in verb ? verb.forms : null;
  const formRows: Array<[string, string]> = localized ? [
    [t("common.present"), localized.present], [language === "fr-FR" ? "Passé composé" : "Pretérito indefinido", localized.past],
    ...(localized.pastFeminine ? [[t("speaking.pastFeminine"), localized.pastFeminine] as [string, string]] : []),
    [t("speaking.imperfect"), localized.imperfect], [t("common.participle"), localized.participle], [t("speaking.gerund"), localized.gerund],
  ] : "thirdPerson" in verb ? [
    [t("common.present"), `${verb.base} / ${verb.thirdPerson}`], [t("common.past"), verb.past],
    [t("common.participle"), verb.pastParticiple], [t("speaking.gerund"), verb.gerund],
  ] : [];

  // Reutiliza a mesma fonte do Mental Hashmap usada pelo App.
  // Só entram intenções explicitamente habilitadas como chunks completos.
  useEffect(() => {
    let active = true;
    setChunks([]);
    setSelectedChunk(null);
    setChunkError(null);

    async function loadChunks() {
      if (!settings.includeRandomChunk) return;
      try {
        const result = await loadHashmap(language, sourceLanguage);
        if (!active) return;
        setChunks(
          result.data.mentalMap.filter(
            (item) =>
              item.allowLanguageChunkPractice === true &&
              typeof item.english === "string" &&
              item.english.trim().length > 0 &&
              typeof item.intention === "string" &&
              item.intention.trim().length > 0
          )
        );
      } catch (error) {
        if (active) setChunkError(t("speaking.couldNotLoadChunksForThisLanguage"));
      }
    }

    void loadChunks();
    return () => { active = false; };
  }, [language, sourceLanguage, settings.includeRandomChunk]);

  // Novo chunk quando a forma verbal ou o verbo muda, e no carregamento inicial.
  useEffect(() => {
    if (!automaticVerbOnly) {
      setSelectedChunk((previous) => drawDifferentChunk(chunks, previous));
    }
  }, [verb.id, form, chunks, automaticVerbOnly]);

  // No modo automático, o contador volta a subir quando uma nova rodada começa.
  // Isso também cobre rodadas que reutilizam o mesmo verbo e a mesma forma.
  useEffect(() => {
    if (isAutomatic && !automaticVerbOnly && remainingSeconds > previousRemainingSeconds.current) {
      setSelectedChunk((previous) => drawDifferentChunk(chunks, previous));
    }
    previousRemainingSeconds.current = remainingSeconds;
  }, [isAutomatic, automaticVerbOnly, remainingSeconds, chunks]);

  useEffect(() => {
    if (!automaticVerbOnly) {
      setSelectedAdjective((previous) => settings.includeAdjective ? drawDifferentItem(adjectives, previous) : null);
      setSelectedNoun((previous) => settings.includeNoun ? drawDifferentItem(nouns, previous) : null);
    }
  }, [verb.id, adjectives, nouns, settings.includeAdjective, settings.includeNoun, automaticVerbOnly]);

  function scrollToVerbAfterUpdate() {
    window.requestAnimationFrame(() => {
      document.getElementById("speaking-game-verb")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  }

  function handleNext() {
    if (!automaticVerbOnly) setSelectedChunk((previous) => drawDifferentChunk(chunks, previous));
    onNext();
    scrollToVerbAfterUpdate();
  }

  function handleNewVerb() {
    setSelectedChunk((previous) => drawDifferentChunk(chunks, previous));
    onNewVerb?.();
    scrollToVerbAfterUpdate();
  }

  function openGoogleTranslate() {
    window.open(
      `https://translate.google.com/?hl=${sourceLanguage}&sl=${language.slice(0, 2)}&tl=${sourceLanguage.slice(0, 2)}&op=translate`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <section style={styles.card} aria-labelledby="speaking-game-verb">
      <header style={styles.header}>

        <h1 id="speaking-game-verb" lang={language} style={styles.verb}>
          {language === "en-US" && <span style={styles.toParticle}>TO</span>}{" "}
          {verb.base.toUpperCase()}
        </h1>

        <span style={styles.meanings}>
          {verb.meanings.join(" • ")}
        </span>
      </header>

      {(settings.includeAdjective || settings.includeNoun) && <div style={styles.vocabularyGrid} aria-label={t("common.selectedVocabulary")}>
        {settings.includeAdjective && <div style={styles.vocabularyCard}>
          <span style={styles.vocabularyLabel}>{t("common.adjective")}</span>
          <strong style={styles.vocabularyWord}>
            {selectedAdjective?.adjective ?? "—"}
            {selectedAdjective?.meanings?.length ? (
              <span style={styles.vocabularyMeaning}>
                {" ("}{selectedAdjective.meanings.join(" • ")}{")"}
              </span>
            ) : null}
          </strong>
          {selectedAdjective?.forms && <span style={styles.vocabularyMeaning}>
            {selectedAdjective.forms.masculine} / {selectedAdjective.forms.feminine}<br />
            {selectedAdjective.forms.masculinePlural} / {selectedAdjective.forms.femininePlural}
            {selectedAdjective.forms.masculineBeforeVowel && <><br />{t("speaking.beforeAVowel")} {selectedAdjective.forms.masculineBeforeVowel}</>}
          </span>}
        </div>}

        {settings.includeNoun && <div style={styles.vocabularyCard}>
          <span style={styles.vocabularyLabel}>{t("common.noun")}</span>
          <strong style={styles.vocabularyWord}>
            {selectedNoun ? `${selectedNoun.article ?? ""}${selectedNoun.article?.endsWith("'") ? "" : " "}${selectedNoun.noun}`.trim() : "—"}
            {selectedNoun?.meanings?.length ? (
              <span style={styles.vocabularyMeaning}>
                {" ("}{selectedNoun.meanings.join(" • ")}{")"}
              </span>
            ) : null}
          </strong>
          {selectedNoun?.gender && <span style={styles.vocabularyMeaning}>{selectedNoun.gender === "feminine" ? t("speaking.feminine") : t("speaking.masculine")}</span>}
          {selectedNoun?.gender && selectedNoun.plural && <span style={styles.vocabularyMeaning}>{selectedNoun.pluralArticle} {selectedNoun.plural}</span>}
          {selectedNoun?.feminine && <span style={styles.vocabularyMeaning}>{t("speaking.feminine")} {selectedNoun.feminine} / {selectedNoun.femininePlural}</span>}
        </div>}
      </div>}
      {settings.includeRandomChunk && chunkError && <p role="status">{chunkError}</p>}

      {settings.includeRandomChunk && selectedChunk && (
        <div style={styles.chunkCard} aria-label={t("speaking.randomChunkFromMentalHashmap")}>
          <span style={styles.vocabularyLabel}>{t("speaking.randomChunkIntention")}</span>
          <strong style={styles.chunkEnglish}>{selectedChunk.targetIntention ?? selectedChunk.english}</strong>
          <span style={styles.chunkPortuguese}>{selectedChunk.intention}</span>
        </div>
      )}

      <div style={styles.challenge}>
        <span style={styles.challengeLabel}>
          
          {t("speaking.sayASentenceAloudUsingThisForm")}
        </span>

        <strong style={styles.challengeForm}>{form}</strong>
        {language !== "en-US" && <span style={styles.challengeLabel}>{formLabel}</span>}
      </div>


      {!isAutomatic && (
        <button
          type="button"
          onClick={handleNext}
          disabled={loading}
          style={styles.primaryButton}
        >
          
          {t("common.next")}{" →"}
        </button>
      )}

      {!isAutomatic && onNewVerb && (
        <button
          type="button"
          onClick={handleNewVerb}
          disabled={loading}
          style={styles.newVerbButton}
          title={t("speaking.drawAnotherVerbUsingTheSameVerbForm")}
          aria-label={t("speaking.drawAnotherVerbUsingTheSameVerbForm")}
        >
          <span aria-hidden="true" style={styles.newVerbIcon}>+</span>
          <span>{t("speaking.newVerb")}</span>
        </button>
      )}

      {isAutomatic && (
        <div style={styles.timerArea} aria-live="polite">
          <span style={styles.timerLabel}>
            {isPaused ? t("common.paused") : t("speaking.nextRoundIn")}
          </span>

          <div style={styles.timerControls}>
            <strong style={styles.timer}>
              {remainingSeconds}s
            </strong>
            <button
              type="button"
              onClick={() => onAutomaticVerbOnlyChange(!automaticVerbOnly)}
              style={{ ...styles.timerNextButton, ...(automaticVerbOnly ? styles.lockButtonActive : {}) }}
              aria-label={automaticVerbOnly ? "Desbloquear sorteio completo" : "Bloquear sorteio: trocar somente o verbo"}
              title={automaticVerbOnly ? "Cadeado fechado: tocar para voltar ao sorteio completo" : "Cadeado aberto: tocar para trocar somente o verbo"}
              aria-pressed={automaticVerbOnly}
            >
              <svg aria-hidden="true" width="23" height="23" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {automaticVerbOnly
                  ? <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>
                  : <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.2-2.4"/></>}
              </svg>
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={isPaused || loading}
              style={{
                ...styles.timerNextButton,
                ...(isPaused ? styles.timerNextButtonDisabled : {})
              }}
              title={t("speaking.goToTheNextChallengeWithoutWaitingForTheCountdown")}
              aria-label={t("speaking.nextChallenge")}
            >
              <svg
                aria-hidden="true"
                width="23"
                height="23"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 12h15" />
                <path d="m13 6 6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowVerbForms((current) => !current)}
        style={styles.visibilityButton}
        aria-expanded={showVerbForms}
      >
        {showVerbForms ? "👁 " + t("speaking.hideVerbForms") : "👁 " + t("speaking.showVerbForms")}
      </button>

      {showVerbForms && (
        <div style={styles.verbForms}>
          {formRows.map(([label, value]) => <div style={styles.formRow} key={label}>
            <span style={styles.formLabel}>{label}</span><strong style={styles.formValue}>{value}</strong>
          </div>)}
        </div>
      )}

      {(!isAutomatic || isPaused) && (
        <button
          type="button"
          onClick={openGoogleTranslate}
          style={styles.googleTranslateButton}
          title={t("speaking.openGoogleTranslateTargetlanguageToSourcelanguage", { targetLanguage: (LANGUAGES[language].name), sourceLanguage: (LANGUAGES[sourceLanguage].name) })}
          aria-label={t("speaking.openGoogleTranslateTargetlanguageToSourcelanguage", { targetLanguage: (LANGUAGES[language].name), sourceLanguage: (LANGUAGES[sourceLanguage].name) })}
        >
          <span aria-hidden="true">{LANGUAGES[language].flag} {LANGUAGES[sourceLanguage].flag}</span>
          <span>{t("speaking.openGoogleTranslate")}</span>
        </button>
      )}



      <footer style={styles.controls}>
        <button
          type="button"
          onClick={isPaused ? onResume : onPause}
          style={styles.secondaryButton}
        >
          {isPaused ? "▶ " + t("common.resume") : "⏸ " + t("common.pause")}
        </button>

        <button
          type="button"
          onClick={onStop}
          style={styles.stopButton}
        >
          
          {"■ "}{t("common.stop")}
        </button>

      </footer>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    width: "min(100%, 34rem)",
    margin: "0 auto",
    boxSizing: "border-box",
    padding: "clamp(1rem, 4vw, 1.75rem)",
    border: "1px solid var(--border-strong)",
    borderRadius: "18px",
    background: "var(--surface)",
    boxShadow: "0 8px 28px rgba(15, 23, 42, 0.08)"
  },
  header: {
    display: "grid",
    justifyItems: "center",
    marginBottom: "1.25rem",
    textAlign: "center"
  },
  gameLabel: {
    marginBottom: "0.55rem",
    fontSize: "0.8rem",
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--muted)"
  },
  verb: {
    margin: 0,
    fontSize: "clamp(2.4rem, 12vw, 4rem)",
    lineHeight: 1,
    letterSpacing: "0.02em",
    color: "var(--text)",
    overflowWrap: "anywhere"
  },
  toParticle: {
    fontSize: "0.52em",
    fontWeight: 700,
    letterSpacing: "0",
    textTransform: "none",
    color: "var(--muted)",
    verticalAlign: "0.18em"
  },
  meanings: {
    marginTop: "0.55rem",
    fontSize: "0.92rem",
    fontWeight: 500,
    lineHeight: 1.35,
    color: "var(--muted)",
    textTransform: "lowercase"
  },
  verbType: {
    marginTop: "0.55rem",
    padding: "0.3rem 0.65rem",
    borderRadius: "999px",
    background: "var(--surface-soft)",
    fontSize: "0.85rem",
    fontWeight: 700,
    color: "var(--text-secondary)"
  },
  newVerbButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.45rem",
    width: "100%",
    minHeight: "2.8rem",
    marginBottom: "0.65rem",
    padding: "0.65rem 0.8rem",
    border: "1px solid var(--accent-border)",
    borderRadius: "10px",
    background: "var(--accent-soft)",
    color: "var(--accent-hover)",
    fontSize: "0.92rem",
    fontWeight: 800,
    cursor: "pointer"
  },
  newVerbIcon: {
    fontSize: "1.25rem",
    lineHeight: 1
  },
  visibilityButton: {
    width: "100%",
    minHeight: "2.8rem",
    marginBottom: "1rem",
    padding: "0.65rem 0.8rem",
    border: "1px solid var(--border-strong)",
    borderRadius: "10px",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontSize: "0.92rem",
    fontWeight: 700,
    cursor: "pointer"
  },
  verbForms: {
    display: "grid",
    gap: "0.6rem",
    marginBottom: "1.5rem",
    padding: "1rem",
    border: "1px solid var(--border)",
    borderRadius: "14px",
    background: "var(--surface-soft)"
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "minmax(5.5rem, 0.8fr) minmax(0, 1.2fr)",
    alignItems: "baseline",
    gap: "0.75rem"
  },
  formLabel: {
    fontSize: "0.9rem",
    color: "var(--muted)"
  },
  formValue: {
    minWidth: 0,
    fontSize: "0.98rem",
    color: "var(--text)",
    overflowWrap: "anywhere"
  },
  vocabularyGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 12rem), 1fr))",
    gap: "0.7rem",
    marginBottom: "1rem"
  },
  vocabularyCard: {
    display: "grid",
    justifyItems: "center",
    alignContent: "start",
    gap: "0.35rem",
    padding: "0.85rem",
    border: "1px solid var(--accent-soft)",
    borderRadius: "12px",
    background: "var(--surface-soft)",
    textAlign: "center"
  },
  vocabularyLabel: {
    fontSize: "0.78rem",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "var(--muted)"
  },
  vocabularyWord: {
    fontSize: "1.35rem",
    color: "var(--accent-hover)",
    overflowWrap: "anywhere"
  },
  vocabularyMeaning: {
    fontSize: "0.88rem",
    fontWeight: 500,
    color: "var(--text-secondary)",
    overflowWrap: "anywhere"
  },
  chunkCard: {
    display: "grid",
    justifyItems: "center",
    gap: "0.5rem",
    padding: "1rem",
    marginBottom: "1rem",
    border: "1px solid var(--accent-border)",
    borderRadius: "12px",
    background: "var(--accent-soft)",
    textAlign: "center"
  },
  chunkEnglish: {
    fontSize: "clamp(1.2rem, 5vw, 1.6rem)",
    lineHeight: 1.3,
    color: "var(--accent-hover)",
    overflowWrap: "anywhere"
  },
  chunkPortuguese: {
    fontSize: "0.9rem",
    color: "var(--text-secondary)",
    overflowWrap: "anywhere"
  },
  challenge: {
    display: "grid",
    justifyItems: "center",
    gap: "0.75rem",
    margin: "1.5rem 0",
    padding: "1.4rem 1rem",
    border: "2px solid var(--accent-border)",
    borderRadius: "16px",
    background: "var(--accent-soft)",
    textAlign: "center"
  },
  challengeLabel: {
    fontSize: "0.95rem",
    fontWeight: 700,
    color: "var(--text-secondary)"
  },
  challengeForm: {
    fontSize: "clamp(1.35rem, 6vw, 1.9rem)",
    lineHeight: 1.25,
    color: "var(--accent-hover)",
    overflowWrap: "anywhere"
  },
  googleTranslateButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.55rem",
    width: "100%",
    minHeight: "3.1rem",
    margin: "0 0 1.5rem",
    padding: "0.8rem 1rem",
    border: "1px solid var(--border-strong)",
    borderRadius: "12px",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontSize: "0.98rem",
    fontWeight: 800,
    cursor: "pointer"
  },
  timerArea: {
    display: "grid",
    justifyItems: "center",
    gap: "0.2rem",
    margin: "1.25rem 0"
  },
  timerLabel: {
    fontSize: "0.9rem",
    color: "var(--muted)"
  },
  timerControls: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.85rem"
  },
  lockButtonActive: {
    borderColor: "var(--accent, #2678c8)",
    color: "var(--accent, #2678c8)",
    background: "var(--surface)"
  },
  timerNextButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "5.8rem",
    height: "2.9rem",
    padding: 0,
    border: "1px solid var(--accent-border)",
    borderRadius: "12px",
    background: "var(--accent-soft)",
    color: "var(--accent-hover)",
    cursor: "pointer",
    touchAction: "manipulation"
  },
  timerNextButtonDisabled: {
    opacity: 0.45,
    cursor: "not-allowed"
  },
  timer: {
    fontSize: "2rem",
    lineHeight: 1.1,
    color: "var(--text)"
  },
  controls: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.65rem",
    paddingTop: "1rem",
    borderTop: "1px solid var(--border)"
  },
  primaryButton: {
    width: "100%",
    minHeight: "3.1rem",
    margin: "0 0 0.65rem",
    padding: "0.8rem 1rem",
    border: 0,
    borderRadius: "12px",
    background: "var(--accent)",
    color: "var(--on-accent)",
    fontSize: "0.98rem",
    fontWeight: 800,
    cursor: "pointer"
  },
  secondaryButton: {
    flex: "1 1 8rem",
    minHeight: "3.1rem",
    padding: "0.8rem 1rem",
    border: "1px solid var(--border-strong)",
    borderRadius: "12px",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    fontSize: "0.98rem",
    fontWeight: 700,
    cursor: "pointer"
  },
  stopButton: {
    flex: "1 1 7rem",
    minHeight: "3.1rem",
    padding: "0.8rem 1rem",
    border: "1px solid var(--bad-border)",
    borderRadius: "12px",
    background: "var(--bad-soft)",
    color: "var(--bad)",
    fontSize: "0.98rem",
    fontWeight: 800,
    cursor: "pointer"
  }
};
