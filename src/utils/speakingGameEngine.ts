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

export function getNextSequentialFormIndex(currentIndex: number): number {
  const total: number = SPEAKING_GAME_FORMS.length;

  if (total === 0) {
    return 0;
  }

  return (currentIndex + 1) % total;
}

export function getRandomFormIndex(previousIndex?: number): number {
  const total: number = SPEAKING_GAME_FORMS.length;

  if (total <= 1) {
    return 0;
  }

  let nextIndex = Math.floor(Math.random() * total);

  while (nextIndex === previousIndex) {
    nextIndex = Math.floor(Math.random() * total);
  }

  return nextIndex;
}
