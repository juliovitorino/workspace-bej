import type { SpeakingGameForm } from "../config/speakingGameForms";

/**
 * JOGO DA FALA
 *
 * Tipos centrais do jogo.
 * Este arquivo descreve os estados e configurações usados pelas etapas
 * de configuração, preparação e jogo em andamento.
 */

export type SpeakingGameStep = 1 | 2 | 3 | 4;

export type SpeakingGameTimeMode = "manual" | "automatic";

export type SpeakingGameOrder = "sequential" | "random";

export type SpeakingGameStatus = "ready" | "running" | "paused";

export interface SpeakingGameSettings {
  timeMode: SpeakingGameTimeMode;
  seconds: number;
  order: SpeakingGameOrder;
  includeAdjective: boolean;
  includeNoun: boolean;
  includeRandomChunk: boolean;
}

export interface SpeakingGameRound {
  form: SpeakingGameForm;
  formIndex: number;
  remainingSeconds: number;
}

export const DEFAULT_SPEAKING_GAME_SETTINGS: SpeakingGameSettings = {
  timeMode: "manual",
  seconds: 60,
  order: "sequential",
  includeAdjective: false,
  includeNoun: false,
  includeRandomChunk: false
};

export const SPEAKING_GAME_MIN_SECONDS = 2;

export const SPEAKING_GAME_MAX_SECONDS = 120;
