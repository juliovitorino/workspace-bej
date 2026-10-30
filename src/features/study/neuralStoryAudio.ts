import type { StudentLanguage } from "../../config/languages";
import type { LocalStoryParagraph } from "../../services/localStoryService";
import type { NeuralVoice } from "./neuralExampleAudio";

/** Only explicit, local MP3 references from a paragraph's JSON are playable. */
export function getStoryNeuralUrl(
  paragraph: LocalStoryParagraph,
  language: StudentLanguage,
  voice: NeuralVoice,
  unit: "paragraph" | "sentence"
): string | null {
  if (language !== "en-US" || unit !== "paragraph" || !paragraph.id) return null;
  const url = paragraph.mp3?.["en-US"]?.[voice];
  if (typeof url !== "string") return null;
  const uuid = paragraph.id.toLowerCase();
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(uuid)) return null;
  return url === `/audio/stories/en-US/${voice}/${uuid}.mp3` ? url : null;
}
