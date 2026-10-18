import type { MentalIntention } from "../types/hashmap";
import { normalizeText } from "./normalizeText";

/** Busca flexível, sem acentos e respeitando a ordem das palavras digitadas. */
function createSearchPattern(query: string): RegExp | null {
  const terms = normalizeText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return null;
  const escapedTerms = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(escapedTerms.join(".*"), "u");
}

function matchesSearch(value: string | undefined, pattern: RegExp | null): boolean {
  return !pattern || pattern.test(normalizeText(value ?? ""));
}

function matchesAny(values: (string | undefined)[], pattern: RegExp | null): boolean {
  return !pattern || values.some((value) => matchesSearch(value, pattern));
}

function sourceFields(item: MentalIntention): (string | undefined)[] {
  return [
    item.intention,
    item.sourcePattern,
    item.sourceStructure,
    ...(item.sourceSearchTerms ?? []),
    // Fonte canônica: inclui exemplos da origem mesmo quando ausentes no destino.
    ...(item.sourceExampleTexts ?? (item.examples ?? []).map((example) => example.pt))
  ];
}

function targetFields(item: MentalIntention): (string | undefined)[] {
  return [
    item.targetIntention ?? item.intention,
    item.structure,
    item.pattern,
    item.english,
    ...(item.searchTerms ?? []),
    // exampleItem é o texto normalizado do idioma estudado (JSON 4.0).
    ...(item.examples ?? []).map((example) => example.exampleItem || example.en)
  ];
}

function sortedBySource(items: MentalIntention[], sourceLanguage: string): MentalIntention[] {
  const collator = new Intl.Collator(sourceLanguage, { sensitivity: "base", numeric: true });
  return items.sort((a, b) => collator.compare(a.intention, b.intention));
}

/** Os dois campos de busca atuam no idioma indicado, com AND entre eles e os filtros. */
export function searchIntentions(
  intentions: MentalIntention[],
  mentalSearch: string,
  englishSearch: string,
  categorySearch: string,
  selectedTags: string[],
  englishLevelSearch: string,
  sourceLanguage = "pt-BR"
): MentalIntention[] {
  const sourcePattern = createSearchPattern(mentalSearch);
  const targetPattern = createSearchPattern(englishSearch);
  const normalizedCategory = normalizeText(categorySearch);
  const normalizedLevel = normalizeText(englishLevelSearch);
  const normalizedTags = selectedTags.map(normalizeText);

  return sortedBySource(intentions.filter((item) => {
    const sourceMatches = matchesAny(sourceFields(item), sourcePattern);
    const targetMatches = matchesAny(targetFields(item), targetPattern);
    const categoryMatches = !normalizedCategory ||
      [item.category, item.sourceCategory].some((value) =>
        normalizeText(value ?? "").includes(normalizedCategory)
      );
    const tagsMatch = normalizedTags.length === 0 ||
      normalizedTags.some((selectedTag) =>
        (item.tags ?? []).some((tag) => normalizeText(tag) === selectedTag)
      );
    const levelMatches = !normalizedLevel ||
      normalizeText(item.englishLevel ?? item.level ?? "") === normalizedLevel;

    return sourceMatches && targetMatches && categoryMatches && tagsMatch && levelMatches;
  }), sourceLanguage);
}

/** Busca global em ambos os idiomas; usada por outras funcionalidades. */
export function globalSearch(
  intentions: MentalIntention[],
  query: string,
  sourceLanguage = "pt-BR"
): MentalIntention[] {
  const pattern = createSearchPattern(query);
  return sortedBySource(intentions.filter((item) => matchesAny([
    ...sourceFields(item),
    ...targetFields(item),
    item.category,
    item.sourceCategory,
    item.englishLevel,
    ...(item.tags ?? [])
  ], pattern)), sourceLanguage);
}
