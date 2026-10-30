import storiesA1 from "../data/stories/stories-a1.json";
import storiesA2 from "../data/stories/stories-a2.json";
import storiesB1 from "../data/stories/stories-b1.json";
import storiesB2 from "../data/stories/stories-b2.json";
import storiesC1 from "../data/stories/stories-c1.json";
import storiesC2 from "../data/stories/stories-c2.json";
import type { StudentLanguage } from "../config/languages";

export interface LocalStoryParagraphIntention {
  intentionId: string;
  ptIntent: string;
  enIntent: string;
  esIntent?: string;
  frIntent?: string;
}

export interface LocalStoryParagraph {
  id?: string;
  mp3?: { "en-US"?: { cedar?: string; marin?: string } };
  pt: string;
  en: string;
  es?: string;
  fr?: string;
  intentions: LocalStoryParagraphIntention[];
}

export interface LocalStory {
  englishLevel?: string;
  topic?: string;
  id?: string;
  titlePt: string;
  titleEn: string;
  titleEs?: string;
  titleFr?: string;
  hqImage?: string;
  hqImagePtBr?: string;
  hqImageEnUs?: string;
  hqImageFrFr?: string;
  hqImageEsEs?: string;
  paragraphs: LocalStoryParagraph[];
  intentionsUsed: string[];
}

interface LocalStoryLibrary {
  stories: LocalStory[];
}

const libraries: Record<string, LocalStoryLibrary> = {
  A1: storiesA1 as LocalStoryLibrary,
  A2: storiesA2 as LocalStoryLibrary,
  B1: storiesB1 as LocalStoryLibrary,
  B2: storiesB2 as LocalStoryLibrary,
  C1: storiesC1 as LocalStoryLibrary,
  C2: storiesC2 as LocalStoryLibrary,
};

/**
 * Returns only the comic image for the selected origin language (Source).
 * Legacy `hqImage` is an alias for pt-BR, never a fallback for other languages.
 */
export function getStoryHqImage(
  story: Pick<LocalStory, "hqImage" | "hqImagePtBr" | "hqImageEnUs" | "hqImageFrFr" | "hqImageEsEs">,
  language: StudentLanguage
): string | undefined {
  const image = (() => {
    switch (language) {
      case "pt-BR":
        return story.hqImagePtBr?.trim() || story.hqImage?.trim();
      case "en-US":
        return story.hqImageEnUs?.trim();
      case "fr-FR":
        return story.hqImageFrFr?.trim();
      case "es-ES":
        return story.hqImageEsEs?.trim();
    }
  })();
  return image || undefined;
}

const storyLanguageFields = {
  "pt-BR": { title: "titlePt", paragraph: "pt", intention: "ptIntent" },
  "en-US": { title: "titleEn", paragraph: "en", intention: "enIntent" },
  "es-ES": { title: "titleEs", paragraph: "es", intention: "esIntent" },
  "fr-FR": { title: "titleFr", paragraph: "fr", intention: "frIntent" },
} as const;

export function getStoryTitle(story: LocalStory, language: StudentLanguage): string {
  return story[storyLanguageFields[language].title] ?? "";
}

export function getParagraphText(paragraph: LocalStoryParagraph, language: StudentLanguage): string {
  return paragraph[storyLanguageFields[language].paragraph] ?? "";
}

export function getIntentionText(intention: LocalStoryParagraphIntention, language: StudentLanguage): string {
  return intention[storyLanguageFields[language].intention] ?? "";
}

export function isStoryAvailable(story: LocalStory, language: StudentLanguage): boolean {
  return Boolean(getStoryTitle(story, language).trim()) && story.paragraphs.length > 0 &&
    story.paragraphs.every(paragraph => Boolean(getParagraphText(paragraph, language).trim()) &&
      paragraph.intentions.every(intention => Boolean(getIntentionText(intention, language).trim())));
}

/** Search only stories with complete content in the selected study language. */
export function searchShadowingStories(language: StudentLanguage, level = "all", query = ""): LocalStory[] {
  const normalized = normalizeSearchText(query);
  return Object.values(libraries).flatMap(library => library.stories).filter(story =>
    (level === "all" || story.englishLevel === level) && isStoryAvailable(story, language) &&
    [getStoryTitle(story, language), story.titlePt, story.topic ?? ""].some(value => normalizeSearchText(value).includes(normalized))
  );
}

function randomStory(stories: LocalStory[]): LocalStory {
  const randomIndex = Math.floor(Math.random() * stories.length);
  return stories[randomIndex];
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

/**
 * Pesquisa histórias da biblioteca local por nível e título.
 *
 * - Se o título estiver vazio, retorna todas as histórias do nível.
 * - Pesquisa no título do idioma de estudo e em titlePt.
 * - A pesquisa ignora maiúsculas/minúsculas e acentos.
 */
export function searchLocalStories(
  englishLevel: string,
  title: string = "",
  language: StudentLanguage = "en-US"
): LocalStory[] {
  const library = libraries[englishLevel.toUpperCase()];

  if (!library || library.stories.length === 0) {
    return [];
  }

  const normalizedTitle = normalizeSearchText(title);

  const availableStories = library.stories.filter(story => isStoryAvailable(story, language));
  const matches =
    normalizedTitle.length === 0
      ? [...availableStories]
      : availableStories.filter((story) => {
          const titlePt = normalizeSearchText(story.titlePt);
          const targetTitle = normalizeSearchText(getStoryTitle(story, language));

          return (
            titlePt.includes(normalizedTitle) ||
            targetTitle.includes(normalizedTitle)
          );
        });

  return matches.sort((storyA, storyB) =>
    storyA.titlePt.localeCompare(storyB.titlePt, "pt-BR", {
      sensitivity: "base",
    })
  );
}

export function getRandomLocalStory(
  englishLevel: string,
  selectedIntentionIds: string[] = []
): LocalStory | null {
  const library = libraries[englishLevel.toUpperCase()];

  if (!library || library.stories.length === 0) {
    console.warn(
      `[LocalStoryService] No local stories found for level ${englishLevel}`
    );

    return null;
  }

  let pool = library.stories;

  if (selectedIntentionIds.length > 0) {
    const selectedIds = new Set(selectedIntentionIds);

    const compatibleStories = library.stories.filter((story) =>
      story.intentionsUsed.some((id) => selectedIds.has(id))
    );

    if (compatibleStories.length > 0) {
      pool = compatibleStories;

      console.info(
        `[LocalStoryService] Found ${compatibleStories.length} compatible local story/stories for the selected intentions.`
      );
    } else {
      console.info(
        "[LocalStoryService] No story matched the selected intentions. Using the complete level library."
      );
    }
  }

  const story = randomStory(pool);

  console.info(
    `[LocalStoryService] Local story selected: ${story.titlePt}`
  );

  return story;
}
