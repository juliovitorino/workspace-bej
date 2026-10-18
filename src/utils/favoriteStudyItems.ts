import type { MentalIntention } from "../types/hashmap";
import type { StudentLanguage } from "../config/languages";
import type { FavoriteChunk } from "./favoriteChunks";
import { eligibleChunks, type ChunkLevel } from "./chunkEligibility";
export interface FavoriteStudyItem extends MentalIntention {
  favoriteId: string;
  favoriteType?: "example";
  origin: MentalIntention;
}
// Session keys never replace IDs in the catalog or persisted favorites.
export function favoriteStudyItems(intentions: MentalIntention[], favorites: FavoriteChunk[], language: StudentLanguage, level: ChunkLevel): FavoriteStudyItem[] {
  const eligible = new Set(eligibleChunks(intentions, level).map(item => item.id));
  const examples = new Map(intentions.flatMap(origin => (origin.examples ?? []).map(example => [example.id, { origin, example }] as const)));
  return favorites.flatMap<FavoriteStudyItem>(favorite => {
    if (favorite.language !== language) return [];
    const id = `intention:${favorite.id}`;
    if (favorite.type === "example") {
      const match = examples.get(favorite.id);
      if (!match) return [];
      const { origin, example } = match;
      const text = (example.exampleItem || example.en).trim();
      if (!text || (level !== "all" && origin.englishLevel !== level)) return [];
      return [{ ...origin, id: `example:${origin.id}:${example.id}`, favoriteId: favorite.id, favoriteType: "example", origin,
        sourceAudioText: example.pt, intention: example.pt, english: text, targetIntention: text, examples: [example] }];
    }
    const origin = intentions.find(item => item.id === favorite.id);
    return origin && eligible.has(origin.id) ? [{ ...origin, id, favoriteId: favorite.id, origin }] : [];
  });
}
