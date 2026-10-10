
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
  const escaped = escapeRegex(normalizeText(value))
    .replace(/\s+/g, "\\s+");

  return `\\b${escaped}\\b`;
}

export function validateIntention(
  sentence: string,
  intention: ValidatableIntention
): IntentionValidationResult {
  const text = normalizeText(sentence);

  if (!text) {
    return { status: "empty" };
  }

  const explicitPatterns =
    intention.validationPatterns?.filter(Boolean) ?? [];

  const exampleChunks = [
    ...new Set(
      (intention.examples ?? [])
        .map((example) => example.enIntent?.trim())
        .filter((value): value is string => Boolean(value))
    )
  ];

  const patterns =
    explicitPatterns.length > 0
      ? explicitPatterns
      : exampleChunks.map(buildLiteralPattern);

  if (patterns.length === 0) {
    return { status: "unavailable" };
  }

  let validPatterns = 0;

  for (const pattern of patterns) {
    try {
      const regex = new RegExp(pattern, "i");
      validPatterns += 1;

      if (regex.test(text)) {
        return {
          status: "found",
          matchedPattern: pattern
        };
      }
    } catch {
      console.warn("Padrão de intenção inválido:", pattern);
    }
  }

  return {
    status: validPatterns > 0 ? "missing" : "unavailable"
  };
}
