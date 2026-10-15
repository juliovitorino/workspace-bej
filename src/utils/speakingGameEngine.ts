import { SPEAKING_GAME_FORMS } from "../config/speakingGameForms";
import {
  SPEAKING_GAME_MAX_SECONDS,
  SPEAKING_GAME_MIN_SECONDS
} from "../types/speakingGameTypes";

/**
 * JOGO DA FALA
 *
 * Funções puras usadas pela engine do jogo.
 * Não há dependência de React neste arquivo.
 */

export function clampSpeakingGameSeconds(seconds: number): number {
  return Math.min(
    SPEAKING_GAME_MAX_SECONDS,
    Math.max(SPEAKING_GAME_MIN_SECONDS, seconds)
  );
}

export function getNextSequentialFormIndex(currentIndex: number, total: number = SPEAKING_GAME_FORMS.length): number {

  if (total === 0) {
    return 0;
  }

  return (currentIndex + 1) % total;
}

export function getRandomFormIndex(previousIndex?: number, total: number = SPEAKING_GAME_FORMS.length): number {

  if (total <= 1) {
    return 0;
  }

  // Draw from the other positions directly; no retry loop for a fixed RNG.
  if (previousIndex === undefined || previousIndex < 0 || previousIndex >= total) return Math.floor(Math.random() * total);
  const next = Math.floor(Math.random() * (total - 1));
  return next >= previousIndex ? next + 1 : next;
}
