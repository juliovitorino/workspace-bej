import type { StudentLanguage } from "./languages";
import type { SpeakingVerb } from "../types/englishVerb";

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

export type SpeakingGameForm = string;

const keys = ["present", "ongoing", "past", "pastOngoing", "duration", "future", "habit", "recent", "regret", "possibility", "prior", "intended", "perfect", "ability", "hypothetical", "obligation", "advice"] as const;
export interface SpeakingFormDefinition { key: string; label: string; }
const spanish = ["Presente", "Acción en curso", "Pretérito indefinido", "Acción en curso en el pasado", "Duración hasta ahora", "Futuro próximo", "Hábito en el pasado", "Pasado reciente", "Obligación no cumplida", "Posibilidad en el pasado", "Anterioridad en el pasado", "Intención en el pasado", "Pretérito perfecto", "Capacidad", "Posibilidad hipotética", "Obligación", "Consejo"];
const french = ["Présent", "Action en cours", "Passé composé", "Imparfait", "Durée jusqu'au présent", "Futur proche", "Habitude passée", "Passé récent", "Regret", "Possibilité passée", "Plus-que-parfait", "Intention passée", "Expérience passée", "Capacité", "Possibilité hypothétique", "Obligation", "Conseil"];

export function getSpeakingGameForms(language: StudentLanguage): SpeakingFormDefinition[] {
  const labels = language === "en-US" ? SPEAKING_GAME_FORMS : language === "es-ES" ? spanish : french;
  return keys.map((key, index) => ({ key, label: labels[index] }));
}

const englishStative = new Set(["be", "have", "know", "want", "need", "mean", "like", "believe", "love", "hate", "hope", "wish"]);
export function supportsSpeakingForm(verb: SpeakingVerb, form: SpeakingFormDefinition): boolean {
  if ("trainingForms" in verb) return Boolean(verb.trainingForms[form.key]);
  return !(englishStative.has(verb.base) && ["ongoing", "pastOngoing", "duration", "prior"].includes(form.key));
}

export function getSpeakingChallenge(verb: SpeakingVerb, form: SpeakingFormDefinition): string {
  return "trainingForms" in verb ? verb.trainingForms[form.key] ?? "" : form.label;
}
