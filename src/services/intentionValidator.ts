import type { MentalIntention } from "../types/hashmap";

export type IntentionValidationStatus =
  | "empty"
  | "found"
  | "missing"
  | "unavailable";

export interface IntentionValidationResult {
  status: IntentionValidationStatus;
  matchedPattern?: string;
}

type ValidatableIntention = MentalIntention & {
  validationPatterns?: string[];
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function buildLiteralPattern(value: string): string {
  const escaped = escapeRegex(normalizeText(value)).replace(/\s+/g, "\\s+");
  return `\\b${escaped}\\b`;
}

/**
 * O campo `pattern` é descritivo, não uma expressão regular.
 * Somente as estruturas explicitamente reconhecidas abaixo são interpretadas.
 * Para as demais, continua valendo validationPatterns / examples[].enIntent.
 */
const BE = String.raw`(?:am|is|are|was|were|'m|'re|'s|isn't|aren't|wasn't|weren't)`;
const PRESENT_BE = String.raw`(?:am|is|are|'m|'re|'s|isn't|aren't)`;
const PAST_BE = String.raw`(?:was|were|wasn't|weren't)`;
const HAVE = String.raw`(?:have|has|'ve|'s|haven't|hasn't)`;
const MODAL = String.raw`(?:can|could|may|might|must|shall|should|will|would|can't|couldn't|shouldn't|won't|wouldn't|mustn't)`;
const NOT = String.raw`(?:\s+not)?`;

const NON_GERUNDS = new Set([
  "anything", "during", "evening", "everything", "king",
  "morning", "nothing", "ring", "something", "spring", "string", "thing"
]);

function isGerund(word: string): boolean {
  const normalized = word.toLowerCase();
  return normalized.length > 4 && normalized.endsWith("ing") && !NON_GERUNDS.has(normalized);
}

const NOT_BASE_VERBS = new Set([
  "a", "an", "the", "my", "your", "his", "her", "our", "their",
  "this", "that", "these", "those", "to", "of", "in", "on", "at",
  "for", "from", "with", "and", "or", "but", "not", "very",
  "more", "most", "some", "any", "all", "each", "every"
]);

/** Heurística: verifica forma provável, não substitui análise gramatical completa. */
function isLikelyBaseVerb(word: string): boolean {
  const value = word.toLowerCase();
  if (NOT_BASE_VERBS.has(value) || isGerund(value)) return false;
  // Formas regulares de passado normalmente não são infinitivos.
  if (value.endsWith("ed") && !/^(?:need|read|feed|seed|speed|bleed|breed)$/.test(value)) {
    return false;
  }
  // Evita terceira pessoa comum sem rejeitar 'pass', 'miss', 'focus' etc.
  if (value.endsWith("s") && !/(?:ss|us|is)$/.test(value)) return false;
  return /^[a-z]+(?:-[a-z]+)*$/.test(value);
}

const IRREGULAR_PARTICIPLES = new Set([
  "been", "become", "begun", "bent", "bitten", "blown", "bought", "broken",
  "brought", "built", "burnt", "caught", "chosen", "come", "cost", "cut",
  "dealt", "done", "drawn", "dreamt", "driven", "drunk", "eaten", "fallen",
  "fed", "felt", "fled", "flown", "forgotten", "forgiven", "fought", "found",
  "frozen", "given", "gone", "grown", "had", "heard", "held", "hidden",
  "hit", "hurt", "kept", "known", "laid", "led", "left", "lent", "let",
  "lain", "learnt", "lost", "made", "meant", "met", "paid", "put", "read", "ridden",
  "risen", "run", "said", "seen", "sent", "set", "shaken", "shown",
  "shut", "sung", "sat", "slept", "sold", "spoken", "spent", "stood",
  "stolen", "stuck", "swum", "taken", "taught", "told", "thought", "thrown",
  "understood", "woken", "won", "worn", "written"
]);

function isPastParticiple(word: string): boolean {
  const value = word.toLowerCase();
  return IRREGULAR_PARTICIPLES.has(value) || /^[a-z]+ed$/.test(value);
}

/** Encontra uma estrutura seguida de uma forma verbal específica. */
function hasVerbAfter(
  text: string,
  prefix: string,
  form: "base" | "ing" | "participle"
): boolean {
  const expression = new RegExp(`${prefix}\\s+([a-z]+(?:-[a-z]+)*)\\b`, "gi");
  for (const match of text.matchAll(expression)) {
    const word = match[1];
    if (
      (form === "base" && isLikelyBaseVerb(word)) ||
      (form === "ing" && isGerund(word)) ||
      (form === "participle" && isPastParticiple(word))
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Retorna null para patterns ainda não suportados.
 * Os patterns suportados são validados pela sequência e forma verbal,
 * não apenas pela presença de uma palavra-chave.
 */
function checkStructuralPattern(text: string, pattern?: string): boolean | null {
  const structure = normalizeText(pattern ?? "").toLowerCase();

  switch (structure) {
    case "be + verb-ing":
      return hasVerbAfter(text, String.raw`\b${BE}${NOT}`, "ing");
    case "have/has been + verb-ing":
      return hasVerbAfter(text, String.raw`\b${HAVE}${NOT}\s+been`, "ing");
    case "had been + verb-ing":
      return hasVerbAfter(text, String.raw`\bhad${NOT}\s+been`, "ing");
    case "be having to + verb":
      return hasVerbAfter(text, String.raw`\b${BE}${NOT}\s+having\s+to`, "base");
    case "end up + verb-ing":
      return hasVerbAfter(text, String.raw`\b(?:end|ends|ended|ending)\s+up`, "ing");
    case "kept + verb-ing":
      return hasVerbAfter(text, String.raw`\bkept`, "ing");
    case "modal + base verb":
      return hasVerbAfter(text, String.raw`\b${MODAL}${NOT}`, "base");
    case "be used to + noun / verb-ing": {
      // Aceita gerúndio ou expressão nominal; não é possível distinguir
      // automaticamente todo substantivo de um verbo sem análise lexical.
      const expression = new RegExp(
        String.raw`\b${BE}${NOT}\s+used\s+to\s+([a-z]+)(?:\s+([a-z]+))?\b`,
        "gi"
      );
      for (const match of text.matchAll(expression)) {
        const first = match[1].toLowerCase();
        if (isGerund(first)) return true;
        if (/^(?:a|an|the|my|your|his|her|our|their|this|that|these|those)$/.test(first)) {
          if (match[2]) return true;
          continue;
        }
        if (!NOT_BASE_VERBS.has(first)) return true;
      }
      return false;
    }
    case "used to + base verb": {
      // 'used to' (hábito) não pode ser confundido com 'be/get used to'.
      const expression = /\b(?:used\s+to|did(?:\s+not|n't)?\s+use\s+to)\s+([a-z]+)\b/gi;
      for (const match of text.matchAll(expression)) {
        if (!isLikelyBaseVerb(match[1])) continue;
        const before = text.slice(0, match.index).trimEnd();
        if (/\b(?:am|is|are|was|were|be|been|being|got|gotten|get|gets|getting)(?:\s+not)?$/i.test(before)) continue;
        if (/(?:'m|'re|'s)(?:\s+not)?$/i.test(before)) continue;
        return true;
      }
      return false;
    }
    case "have/has + past participle":
      return hasVerbAfter(text, String.raw`\b${HAVE}${NOT}`, "participle");
    case "had + past participle":
      return hasVerbAfter(text, String.raw`\bhad${NOT}`, "participle");
    case "should have + past participle":
      return hasVerbAfter(text, String.raw`\bshould${NOT}\s+have`, "participle");
    case "could/might have + past participle":
      return hasVerbAfter(text, String.raw`\b(?:could|might)${NOT}\s+have`, "participle");
    case "must have + past participle":
      return hasVerbAfter(text, String.raw`\bmust${NOT}\s+have`, "participle");
    case "be + being + past participle":
      return hasVerbAfter(text, String.raw`\b${BE}${NOT}\s+being`, "participle");
    case "be about to + base verb":
      return hasVerbAfter(text, String.raw`\b${BE}${NOT}\s+about\s+to`, "base");
    case "would rather + base verb":
      return hasVerbAfter(text, String.raw`\b(?:would|'d)\s+rather`, "base");
    case "be supposed to + verb":
      return hasVerbAfter(text, String.raw`\b${BE}${NOT}\s+supposed\s+to`, "base");
    case "had to + verb":
      return hasVerbAfter(text, String.raw`\bhad\s+to`, "base");
    case "have/has to + verb or need to + verb":
      return hasVerbAfter(text, String.raw`\b(?:have|has|'ve|'s)\s+to`, "base") ||
        hasVerbAfter(text, String.raw`\b(?:need|needs|needed)\s+to`, "base") ||
        hasVerbAfter(text, String.raw`\bgotta`, "base");
    case "get to + verb":
      return hasVerbAfter(text, String.raw`\b(?:get|gets|got)\s+to`, "base");
    case "need to + verb":
      return hasVerbAfter(text, String.raw`\b(?:need|needs|needed)\s+to`, "base");
    case "will + verb or be going to + verb":
      return hasVerbAfter(text, String.raw`\bwill${NOT}`, "base") ||
        hasVerbAfter(text, String.raw`\b${BE}${NOT}\s+going\s+to`, "base") ||
        hasVerbAfter(text, String.raw`\b${BE}${NOT}\s+gonna`, "base");
    case "was/were going to + verb":
      return hasVerbAfter(text, String.raw`\b${PAST_BE}${NOT}\s+going\s+to`, "base");
    case "be (present) or be + ing":
      return new RegExp(String.raw`\b${PRESENT_BE}(?:\s+not)?\s+[a-z]+\b`, "i").test(text);
    case "was/were or was/were + ing":
      return new RegExp(String.raw`\b${PAST_BE}(?:\s+not)?\s+[a-z]+\b`, "i").test(text);
    default:
      return null;
  }
}

export function validateIntention(
  sentence: string,
  intention: ValidatableIntention
): IntentionValidationResult {
  const text = normalizeText(sentence);
  if (!text) return { status: "empty" };

  const explicitPatterns = intention.validationPatterns?.filter(Boolean) ?? [];
  const structuralResult = checkStructuralPattern(text, intention.pattern);

  // Para estruturas conhecidas, a gramática tem prioridade. Se o JSON também
  // tiver regex explícitas, as duas verificações devem ser satisfeitas.
  if (structuralResult === false) return { status: "missing" };
  if (structuralResult === true && explicitPatterns.length === 0) {
    return { status: "found", matchedPattern: intention.pattern };
  }

  const exampleChunks = [
    ...new Set(
      (intention.examples ?? [])
        .map((example) => example.enIntent?.trim())
        .filter((value): value is string => Boolean(value))
    )
  ];
  const patterns = explicitPatterns.length > 0
    ? explicitPatterns
    : exampleChunks.map(buildLiteralPattern);

  if (patterns.length === 0) return { status: "unavailable" };

  let validPatterns = 0;
  for (const pattern of patterns) {
    try {
      const regex = new RegExp(pattern, "i");
      validPatterns += 1;
      if (regex.test(text)) return { status: "found", matchedPattern: pattern };
    } catch {
      console.warn("Padrão de intenção inválido:", pattern);
    }
  }

  return { status: validPatterns > 0 ? "missing" : "unavailable" };
}
