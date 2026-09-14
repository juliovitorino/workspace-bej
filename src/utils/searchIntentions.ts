import type { MentalIntention } from "../types/hashmap";
import { normalizeText } from "./normalizeText";

function matchesAnySearchableField(item: MentalIntention, query: string): boolean {
  if (!query) return true;

  const searchable = [
    item.intention,
    item.english,
    item.pattern ?? "",
    item.category ?? "",
    item.englishLevel ?? "",
    ...(item.searchTerms ?? []),
    ...(item.tags ?? [])
  ];

  return searchable.some((value) =>
    normalizeText(value).includes(query)
  );
}

export function searchIntentions(
  intentions: MentalIntention[],
  mentalSearch: string,
  englishSearch: string,
  categorySearch: string,
  selectedTags: string[],
  englishLevelSearch: string
): MentalIntention[] {
  const normalizedMental = normalizeText(mentalSearch);
  const normalizedEnglish = normalizeText(englishSearch);
  const normalizedCategory = normalizeText(categorySearch);
  const normalizedEnglishLevel = normalizeText(englishLevelSearch);

  return intentions
    .filter((item) => {
      const mentalMatches =
        !normalizedMental ||
        normalizeText(item.intention).includes(normalizedMental) ||
        (item.searchTerms ?? []).some((term) =>
          normalizeText(term).includes(normalizedMental)
        );

      const englishMatches =
        !normalizedEnglish ||
        normalizeText(item.english).includes(normalizedEnglish) ||
        normalizeText(item.pattern ?? "").includes(normalizedEnglish) ||
        (item.searchTerms ?? []).some((term) =>
          normalizeText(term).includes(normalizedEnglish)
        );

      const categoryMatches =
        !normalizedCategory ||
        normalizeText(item.category ?? "").includes(normalizedCategory);

      const tagsMatch =
        selectedTags.length === 0 ||
        selectedTags.every((selectedTag) =>
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
  const normalizedQuery = normalizeText(query);
  return intentions
    .filter((item) => matchesAnySearchableField(item, normalizedQuery))
    .sort((a, b) =>
      normalizeText(a.intention).localeCompare(normalizeText(b.intention))
    );
}
