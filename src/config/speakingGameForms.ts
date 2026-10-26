import type { StudentLanguage } from "./languages";
import type { SpeakingVerb } from "../types/englishVerb";

/**
 * JOGO DA FALA — cada intenção tem uma chave estável e um rótulo por idioma.
 * A ordem deste catálogo continua determinando a ordem do modo sequencial.
 * O sujeito é escolhido por rodada, sem duplicar as 17 estruturas.
 */
type FormLabels = Record<StudentLanguage, string>;

export const SPEAKING_GAME_FORMS: ReadonlyArray<{ key: string; labels: FormLabels }> = [
  { key: "present", labels: { "pt-BR": "Presente", "en-US": "I +verb", "es-ES": "Presente", "fr-FR": "Présent" } },
  { key: "ongoing", labels: { "pt-BR": "Ação em andamento", "en-US": "I am +verb-ing", "es-ES": "Acción en curso", "fr-FR": "Action en cours" } },
  { key: "past", labels: { "pt-BR": "Passado", "en-US": "I +verb-past", "es-ES": "Pretérito indefinido", "fr-FR": "Passé composé" } },
  { key: "pastOngoing", labels: { "pt-BR": "Ação em andamento no passado", "en-US": "I was +verb-ing", "es-ES": "Acción en curso en el pasado", "fr-FR": "Imparfait" } },
  { key: "duration", labels: { "pt-BR": "Duração até agora", "en-US": "I have been +verb-ing", "es-ES": "Duración hasta ahora", "fr-FR": "Durée jusqu'au présent" } },
  { key: "future", labels: { "pt-BR": "Futuro próximo", "en-US": "I am going to +verb", "es-ES": "Futuro próximo", "fr-FR": "Futur proche" } },
  { key: "habit", labels: { "pt-BR": "Hábito no passado", "en-US": "I used to +verb", "es-ES": "Hábito en el pasado", "fr-FR": "Habitude passée" } },
  { key: "recent", labels: { "pt-BR": "Passado recente", "en-US": "I have just +verb-participle", "es-ES": "Pasado reciente", "fr-FR": "Passé récent" } },
  { key: "regret", labels: { "pt-BR": "Arrependimento", "en-US": "I should have +verb-participle", "es-ES": "Obligación no cumplida", "fr-FR": "Regret" } },
  { key: "possibility", labels: { "pt-BR": "Possibilidade no passado", "en-US": "I could have +verb-participle", "es-ES": "Posibilidad en el pasado", "fr-FR": "Possibilité passée" } },
  { key: "prior", labels: { "pt-BR": "Anterioridade no passado", "en-US": "I had been +verb-ing", "es-ES": "Anterioridad en el pasado", "fr-FR": "Plus-que-parfait" } },
  { key: "intended", labels: { "pt-BR": "Intenção no passado", "en-US": "I was going to +verb", "es-ES": "Intención en el pasado", "fr-FR": "Intention passée" } },
  { key: "perfect", labels: { "pt-BR": "Experiência / passado composto", "en-US": "I've +verb-participle", "es-ES": "Pretérito perfecto", "fr-FR": "Expérience passée" } },
  { key: "ability", labels: { "pt-BR": "Capacidade", "en-US": "I can +verb", "es-ES": "Capacidad", "fr-FR": "Capacité" } },
  { key: "hypothetical", labels: { "pt-BR": "Possibilidade hipotética", "en-US": "I could +verb", "es-ES": "Posibilidad hipotética", "fr-FR": "Possibilité hypothétique" } },
  { key: "obligation", labels: { "pt-BR": "Obrigação", "en-US": "I must +verb", "es-ES": "Obligación", "fr-FR": "Obligation" } },
  { key: "advice", labels: { "pt-BR": "Conselho", "en-US": "I should +verb", "es-ES": "Consejo", "fr-FR": "Conseil" } },
];

export type SpeakingGameForm = string;
export interface SpeakingFormDefinition { key: string; label: string; }

export function getSpeakingGameForms(language: StudentLanguage): SpeakingFormDefinition[] {
  return SPEAKING_GAME_FORMS.map(form => ({ key: form.key, label: form.labels[language] }));
}

export type SpeakingSubjectId = "first" | "second" | "thirdMale" | "thirdFemale" | "neutral" | "plural";
export interface SpeakingSubject { id: SpeakingSubjectId; label: string; }

const subjects: Record<StudentLanguage, SpeakingSubject[]> = {
  "en-US": [
    { id: "first", label: "I" }, { id: "second", label: "You" },
    { id: "thirdMale", label: "He" }, { id: "thirdFemale", label: "She" },
    { id: "neutral", label: "It" }, { id: "plural", label: "They" },
  ],
  "pt-BR": [
    { id: "first", label: "Eu" }, { id: "second", label: "Você" },
    { id: "thirdMale", label: "Ele" }, { id: "thirdFemale", label: "Ela" },
    { id: "plural", label: "Eles/Elas" },
  ],
  "es-ES": [
    { id: "first", label: "Yo" }, { id: "second", label: "Tú" },
    { id: "thirdMale", label: "Él" }, { id: "thirdFemale", label: "Ella" },
    { id: "plural", label: "Ellos/Ellas" },
  ],
  "fr-FR": [
    { id: "first", label: "Je" }, { id: "second", label: "Tu" },
    { id: "thirdMale", label: "Il" }, { id: "thirdFemale", label: "Elle" },
    { id: "plural", label: "Ils/Elles" },
  ],
};

// "It" só aparece para verbos com usos naturais envolvendo coisas/eventos.
const neutralVerbs = new Set([
  "be", "have", "work", "happen", "rain", "snow", "break", "stop", "start", "change",
  "move", "fall", "grow", "exist", "seem", "appear", "look", "sound", "feel",
  "smell", "taste", "cost", "take", "matter", "last", "fit", "run", "open",
  "close", "begin", "end", "fail", "improve", "increase", "decrease", "need",
]);

export function getSpeakingSubjects(language: StudentLanguage, verb: SpeakingVerb): SpeakingSubject[] {
  if ("impersonal" in verb && verb.impersonal) {
    // Os catálogos de verbos impessoais já fornecem uma forma pronta em trainingForms.
    return [subjects[language][0]];
  }
  return subjects[language].filter(subject =>
    subject.id !== "neutral" || (language === "en-US" && neutralVerbs.has(verb.base.toLowerCase()))
  );
}

export function drawSpeakingSubject(language: StudentLanguage, verb: SpeakingVerb, previous?: SpeakingSubjectId): SpeakingSubject {
  const available = getSpeakingSubjects(language, verb);
  const alternatives = available.filter(subject => subject.id !== previous);
  const pool = alternatives.length ? alternatives : available;
  return pool[Math.floor(Math.random() * pool.length)];
}

const englishStative = new Set(["be", "have", "know", "want", "need", "mean", "like", "believe", "love", "hate", "hope", "wish"]);
export function supportsSpeakingForm(verb: SpeakingVerb, form: SpeakingFormDefinition): boolean {
  if ("trainingForms" in verb) return Boolean(verb.trainingForms[form.key]);
  return !(englishStative.has(verb.base) && ["ongoing", "pastOngoing", "duration", "prior"].includes(form.key));
}

function englishChallenge(key: string, subject: SpeakingSubject): string {
  const s = subject.label;
  const singular = ["thirdMale", "thirdFemale", "neutral"].includes(subject.id);
  const be = subject.id === "first" ? "am" : singular ? "is" : "are";
  const was = subject.id === "first" || singular ? "was" : "were";
  const have = singular ? "has" : "have";
  switch (key) {
    case "present": return `${s} ${singular ? "+verb (3rd person)" : "+verb"}`;
    case "ongoing": return `${s} ${be} +verb-ing`;
    case "past": return `${s} +verb-past`;
    case "pastOngoing": return `${s} ${was} +verb-ing`;
    case "duration": return `${s} ${have} been +verb-ing`;
    case "future": return `${s} ${be} going to +verb`;
    case "habit": return `${s} used to +verb`;
    case "recent": return `${s} ${have} just +verb-participle`;
    case "regret": return `${s} should have +verb-participle`;
    case "possibility": return `${s} could have +verb-participle`;
    case "prior": return `${s} had been +verb-ing`;
    case "intended": return `${s} ${was} going to +verb`;
    case "perfect": return `${s} ${have} +verb-participle`;
    case "ability": return `${s} can +verb`;
    case "hypothetical": return `${s} could +verb`;
    case "obligation": return `${s} must +verb`;
    case "advice": return `${s} should +verb`;
    default: return `${s} +verb`;
  }
}

/**
 * Os trainingForms de es-ES/fr-FR são frases prontas na primeira pessoa.
 * Para outros sujeitos, mostra uma instrução (sujeito + intenção + infinitivo),
 * nunca uma conjugação fabricada. A resposta é produzida pelo estudante.
 */
export function getSpeakingChallenge(
  verb: SpeakingVerb,
  form: SpeakingFormDefinition,
  language: StudentLanguage,
  subject: SpeakingSubject,
): string {
  if (language === "en-US" && !("trainingForms" in verb)) return englishChallenge(form.key, subject);
  if ("trainingForms" in verb && subject.id === "first") return verb.trainingForms[form.key] ?? "";
  if ("trainingForms" in verb && "impersonal" in verb && verb.impersonal) return verb.trainingForms[form.key] ?? "";
  return `${subject.label} · ${form.label} · ${verb.base}`;
}
