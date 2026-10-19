import type { MentalIntention } from "../types/hashmap";
import type { StudentLanguage } from "../config/languages";
import type { FavoriteChunk } from "./favoriteChunks";
import { eligibleChunks, type ChunkLevel } from "./chunkEligibility";
import { favoriteStudyItems, type FavoriteStudyItem } from "./favoriteStudyItems";

export type WalkingContentType = "chunk" | "example" | "both";

// Only the walking pool is expanded: manual Chunk Flashcards keeps its existing catalog.
export function walkingStudyItems(
  intentions: MentalIntention[], favorites: FavoriteChunk[], language: StudentLanguage,
  mode: "all" | "favorites", level: ChunkLevel, contentType: WalkingContentType
): FavoriteStudyItem[] {
  if (mode === "favorites") {
    return favoriteStudyItems(intentions, favorites, language, level).filter(item =>
      contentType === "both" || (contentType === "example" ? item.favoriteType === "example" : item.favoriteType !== "example")
    );
  }

  const origins = eligibleChunks(intentions, level);
  const chunks: FavoriteStudyItem[] = contentType === "example" ? [] :
    origins.map(origin => ({ ...origin, favoriteId: origin.id, origin }));
  if (contentType === "chunk") return chunks;

  // Examples are independent study cards: they do not require their parent
  // intention to be marked allowLanguageChunkPractice.
  const exampleOrigins = intentions.filter(origin =>
    level === "all" || origin.englishLevel?.trim().toUpperCase() === level
  );
  const examples: FavoriteStudyItem[] = exampleOrigins.flatMap(origin =>
    (origin.examples ?? []).filter(example => example.id && example.exampleItem?.trim()).map(example => {
      const text = example.exampleItem.trim();
      return {
        ...origin,
        id: `example:${origin.id}:${example.id}`,
        favoriteId: example.id,
        favoriteType: "example" as const,
        origin,
        english: text,
        targetIntention: text,
        intention: example.pt?.trim() || origin.intention,
        sourceAudioText: example.pt?.trim() || undefined,
        examples: [example]
      };
    })
  );
  return [...chunks, ...examples];
}
