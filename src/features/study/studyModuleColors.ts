import type { ExtraCategory, StudyModule } from "./studyStorage";

/** Stable colors shared by the module totals and the Days Streak weekly projection. */
export const STUDY_MODULE_COLORS: Partial<Record<StudyModule, string>> = {
  hashmap: "#a568ed",
  "memory-flashcards": "#438cf5",
  "chunk-flashcards": "#25bf8d",
  "chunk-favorites": "#f59e42",
  shadowing: "#e9679a",
  "basic-training": "#3dadd1",
  "advanced-training": "#9b75ef",
  "review-training": "#dbb43d",
  "speaking-game": "#34b27d",
  "would-you-rather": "#e27b77",
  interpretation: "#5a89e6",
  "small-talk": "#d98b46",
};

export const STUDY_MODULE_ICONS: Partial<Record<StudyModule, string>> = {
  hashmap: "🧠",
  "memory-flashcards": "🃏",
  "chunk-flashcards": "💬",
  "chunk-favorites": "⭐",
  shadowing: "🎙️",
  "basic-training": "✍️",
  "advanced-training": "🎯",
  "review-training": "🔁",
  "speaking-game": "🗣️",
  "would-you-rather": "⚖️",
  interpretation: "🔎",
  "small-talk": "🤝",
};

/** Extra-activity category bars in the consolidated "Time by module" chart. */
export const STUDY_EXTRA_CATEGORY_COLORS: Record<ExtraCategory, string> = {
  conversation: "#4384f0",
  writing: "#f8b736",
  "private-class": "#a568ed",
  reading: "#2fa879",
  "active-listening": "#e9679a",
  other: "#f59e42",
};
