import storiesA1 from "../data/stories/stories-a1.json";
import storiesA2 from "../data/stories/stories-a2.json";
import storiesB1 from "../data/stories/stories-b1.json";
import storiesB2 from "../data/stories/stories-b2.json";
import storiesC1 from "../data/stories/stories-c1.json";
import storiesC2 from "../data/stories/stories-c2.json";

export interface LocalStoryParagraphIntention {
  intentionId: string;
  ptIntent: string;
  enIntent: string;
}

export interface LocalStoryParagraph {
  pt: string;
  en: string;
  intentions: LocalStoryParagraphIntention[];
}

export interface LocalStory {
  id?: string;
  titlePt: string;
  titleEn: string;
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

function randomStory(stories: LocalStory[]): LocalStory {
  const randomIndex = Math.floor(Math.random() * stories.length);
  return stories[randomIndex];
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
    `[LocalStoryService] Local story selected: ${story.id ?? "without-id"}`
  );

  return story;
}
