import type { MentalIntention } from "../types/hashmap";
import { normalizeText } from "./normalizeText";

/**
 * Busca os termos na ordem digitada, permitindo qualquer texto entre eles.
 * Ex.: "tão quanto" encontra "Tão + adjetivo + quanto".
 * Os termos são escapados para que caracteres especiais sejam tratados
 * como texto literal, e não como comandos de expressão regular.
 */
function createSearchPattern(query: string): RegExp | null {
  const terms = normalizeText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return null;

  const escapedTerms = terms.map((term) =>
    term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );

  return new RegExp(escapedTerms.join(".*"), "u");
}

function matchesSearch(value: string, pattern: RegExp | null): boolean {
  return !pattern || pattern.test(normalizeText(value));
}

function matchesAnySearchableField(
  item: MentalIntention,
  pattern: RegExp | null
): boolean {
  if (!pattern) return true;

  const searchable = [
    item.intention,
    item.english,
    item.pattern ?? "",
    item.category ?? "",
    item.englishLevel ?? "",
    ...(item.searchTerms ?? []),
    ...(item.tags ?? [])
  ];

  return searchable.some((value) => matchesSearch(value, pattern));
}

export function searchIntentions(
  intentions: MentalIntention[],
  mentalSearch: string,
  englishSearch: string,
  categorySearch: string,
  selectedTags: string[],
  englishLevelSearch: string
): MentalIntention[] {
  const mentalPattern = createSearchPattern(mentalSearch);
  const englishPattern = createSearchPattern(englishSearch);
  const normalizedCategory = normalizeText(categorySearch);
  const normalizedEnglishLevel = normalizeText(englishLevelSearch);

  return intentions
    .filter((item) => {
      const mentalMatches =
        matchesSearch(item.intention, mentalPattern) ||
        (item.searchTerms ?? []).some((term) =>
          matchesSearch(term, mentalPattern)
        );

      const englishMatches =
        matchesSearch(item.english, englishPattern) ||
        matchesSearch(item.pattern ?? "", englishPattern) ||
        (item.searchTerms ?? []).some((term) =>
          matchesSearch(term, englishPattern)
        );

      const categoryMatches =
        !normalizedCategory ||
        normalizeText(item.category ?? "").includes(normalizedCategory);

      const tagsMatch =
        selectedTags.length === 0 ||
        selectedTags.some((selectedTag) =>
          (item.tags ?? []).some(
            (tag) => normalizeText(tag) === normalizeText(selectedTag)
          )
        );

      const englishLevelMatches =
        !normalizedEnglishLevel ||
        normalizeText(item.englishLevel ?? "") === normalizedEnglishLevel;

      return (
        mentalMatches &&
        englishMatches &&
        categoryMatches &&
        tagsMatch &&
        englishLevelMatches
      );
    })
    .sort((a, b) =>
      normalizeText(a.intention).localeCompare(normalizeText(b.intention))
    );
}

export function globalSearch(
  intentions: MentalIntention[],
  query: string
): MentalIntention[] {
  const pattern = createSearchPattern(query);
  return intentions
    .filter((item) => matchesAnySearchableField(item, pattern))
    .sort((a, b) =>
      normalizeText(a.intention).localeCompare(normalizeText(b.intention))
    );
}
