import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { SPEAKING_GAME_FORMS } from "../config/speakingGameForms";
import { getRandomEnglishVerb } from "../services/englishVerbService";
import type { EnglishVerb } from "../types/englishVerb";
import {
  DEFAULT_SPEAKING_GAME_SETTINGS,
  type SpeakingGameSettings,
  type SpeakingGameStatus,
  type SpeakingGameStep
} from "../types/speakingGameTypes";
import {
  getNextSequentialFormIndex,
  getRandomFormIndex
} from "../utils/speakingGameEngine";
import { SpeakingGamePlayStep } from "./SpeakingGamePlayStep";
import { SpeakingGameReadyStep } from "./SpeakingGameReadyStep";
import { SpeakingGameSetupStep } from "./SpeakingGameSetupStep";

/**
 * JOGO DA FALA
 *
 * Componente controlador do jogo.
 *
 * Responsabilidades:
 * - controlar as três etapas;
 * - preservar as configurações;
 * - sortear verbos;
 * - avançar as formas em modo sequencial ou aleatório;
 * - controlar o contador do modo automático;
 * - pausar, continuar e parar o jogo.
 */
export function SpeakingGame() {
  const [step, setStep] = useState<SpeakingGameStep>(1);
  const [settings, setSettings] = useState<SpeakingGameSettings>(
    DEFAULT_SPEAKING_GAME_SETTINGS
  );
  const [status, setStatus] = useState<SpeakingGameStatus>("ready");
  const [currentVerb, setCurrentVerb] = useState<EnglishVerb | null>(null);
  const [currentFormIndex, setCurrentFormIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(settings.seconds);
  const [isLoadingRound, setIsLoadingRound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastStudySeconds, setLastStudySeconds] = useState<number | null>(null);

  const accumulatedStudyTimeMsRef = useRef(0);
  const activeStudyStartedAtRef = useRef<number | null>(null);

  const selectInitialFormIndex = useCallback((): number => {
    if (settings.order === "random") {
      return getRandomFormIndex();
    }

    return 0;
  }, [settings.order]);

  const selectNextFormIndex = useCallback(
    (previousIndex: number): number => {
      if (settings.order === "random") {
        return getRandomFormIndex(previousIndex);
      }

      return getNextSequentialFormIndex(previousIndex);
    },
    [settings.order]
  );

  const loadNextVerb = useCallback(
    async (previousVerbId?: string): Promise<EnglishVerb> => {
      return getRandomEnglishVerb(previousVerbId);
    },
    []
  );

  const startGame = useCallback(async () => {
    if (isLoadingRound) {
      return;
    }

    setIsLoadingRound(true);
    setError(null);

    try {
      const verb = await loadNextVerb();

      accumulatedStudyTimeMsRef.current = 0;
      activeStudyStartedAtRef.current = Date.now();
      setLastStudySeconds(null);

      setCurrentVerb(verb);
      setCurrentFormIndex(selectInitialFormIndex());
      setRemainingSeconds(settings.seconds);
      setStatus("running");
      setStep(3);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível iniciar o Jogo da Fala."
      );
    } finally {
      setIsLoadingRound(false);
    }
  }, [
    isLoadingRound,
    loadNextVerb,
    selectInitialFormIndex,
    settings.seconds
  ]);

  const nextRound = useCallback(async () => {
    if (!currentVerb || isLoadingRound) {
      return;
    }

    setIsLoadingRound(true);
    setError(null);

    try {
      const nextVerb = await loadNextVerb(currentVerb.id);

      setCurrentVerb(nextVerb);
      setCurrentFormIndex((previousIndex) =>
        selectNextFormIndex(previousIndex)
      );
      setRemainingSeconds(settings.seconds);
    } catch (caughtError) {
      if (activeStudyStartedAtRef.current !== null) {
        accumulatedStudyTimeMsRef.current +=
          Date.now() - activeStudyStartedAtRef.current;
        activeStudyStartedAtRef.current = null;
      }

      setStatus("paused");
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível carregar a próxima rodada."
      );
    } finally {
      setIsLoadingRound(false);
    }
  }, [
    currentVerb,
    isLoadingRound,
    loadNextVerb,
    selectNextFormIndex,
    settings.seconds
  ]);

  useEffect(() => {
    if (
      step !== 3 ||
      settings.timeMode !== "automatic" ||
      status !== "running" ||
      isLoadingRound
    ) {
      return;
    }

    const timerId = window.setTimeout(() => {
      if (remainingSeconds <= 1) {
        void nextRound();
        return;
      }

      setRemainingSeconds((seconds) => seconds - 1);
    }, 1000);

    return () => window.clearTimeout(timerId);
  }, [
    isLoadingRound,
    nextRound,
    remainingSeconds,
    settings.timeMode,
    status,
    step
  ]);

  function stopGame() {
    if (status === "running" && activeStudyStartedAtRef.current !== null) {
      accumulatedStudyTimeMsRef.current +=
        Date.now() - activeStudyStartedAtRef.current;
    }

    activeStudyStartedAtRef.current = null;

    setLastStudySeconds(
      Math.floor(accumulatedStudyTimeMsRef.current / 1000)
    );

    setStatus("ready");
    setCurrentVerb(null);
    setRemainingSeconds(settings.seconds);
    setError(null);
    setStep(2);
  }

  function pauseGame() {
    if (status !== "running") {
      return;
    }

    if (activeStudyStartedAtRef.current !== null) {
      accumulatedStudyTimeMsRef.current +=
        Date.now() - activeStudyStartedAtRef.current;
    }

    activeStudyStartedAtRef.current = null;
    setStatus("paused");
  }

  function resumeGame() {
    if (status !== "paused") {
      return;
    }

    activeStudyStartedAtRef.current = Date.now();
    setStatus("running");
  }

  function goToReadyStep() {
    setError(null);
    setStep(2);
  }

  function goToSetupStep() {
    setError(null);
    setStep(1);
  }

  return (
    <div style={styles.page}>
      {step === 1 && (
        <SpeakingGameSetupStep
          settings={settings}
          onSettingsChange={setSettings}
          onNext={goToReadyStep}
        />
      )}

      {step === 2 && (
        <>
          <SpeakingGameReadyStep
            settings={settings}
            lastStudySeconds={lastStudySeconds}
            onPrevious={goToSetupStep}
            onStart={() => void startGame()}
          />

          {isLoadingRound && (
            <p style={styles.message} role="status">
              Preparando o jogo...
            </p>
          )}
        </>
      )}

      {step === 3 && currentVerb && (
        <SpeakingGamePlayStep
          verb={currentVerb}
          form={SPEAKING_GAME_FORMS[currentFormIndex]}
          settings={settings}
          status={status}
          remainingSeconds={remainingSeconds}
          onPause={pauseGame}
          onResume={resumeGame}
          onStop={stopGame}
          onNext={() => void nextRound()}
        />
      )}

      {error && (
        <div style={styles.error} role="alert">
          <strong>Não foi possível continuar.</strong>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
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
    color: "#64748b"
  },
  error: {
    display: "grid",
    gap: "0.3rem",
    width: "min(100%, 34rem)",
    margin: "1rem auto 0",
    boxSizing: "border-box",
    padding: "0.9rem 1rem",
    border: "1px solid #fecaca",
    borderRadius: "12px",
    background: "#fff7f7",
    color: "#991b1b",
    fontSize: "0.92rem"
  }
};
