/**
 * JOGO DA FALA
 *
 * Formas usadas durante o treino de produção oral.
 *
 * Para adicionar ou remover estruturas do jogo, altere somente este array.
 * A ordem dos elementos também define a ordem do treino quando o modo
 * "sequencial" estiver selecionado.
 */
export const SPEAKING_GAME_FORMS = [
  "I +verb",
  "I am +verb-ing",
  "I +verb-past",
  "I was +verb-ing",
  "I have been +verb-ing",
  "I am going to +verb",
  "I used to +verb",
  "I have just +verb-participle",
  "I should have +verb-participle",
  "I could have +verb-participle",
  "I had been +verb-ing",
  "I was going to +verb",
  "I've +verb-participle",
  "I can +verb",
  "I could +verb",
  "I must +verb",
  "I should +verb"
] as const;

export type SpeakingGameForm = (typeof SPEAKING_GAME_FORMS)[number];
