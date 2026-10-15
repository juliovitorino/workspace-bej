export type Technique = "listen" | "repeat" | "shadow";
export interface ShadowingSettings {
  scope: "story" | "paragraph";
  control: "automatic" | "manual";
  technique: Technique | "combined";
  unit: "paragraph" | "sentence";
  rate: number;
  repetitions: number;
  interval: number;
  automatic: boolean;
  translation: boolean;
  keepAwake: boolean;
}
export const defaultShadowingSettings: ShadowingSettings = {
  scope: "story", control: "automatic", technique: "combined", unit: "paragraph",
  rate: .9, repetitions: 2, interval: 3, automatic: true, translation: true, keepAwake: true
};
export function sentenceSegments(text: string, language: string): string[] {
  const Segmenter = (Intl as typeof Intl & { Segmenter?: new (locale: string, options: { granularity: string }) => {
    segment(value: string): Iterable<{ segment: string }>
  } }).Segmenter;
  if (!Segmenter) return [text];
  try {
    const parts = Array.from(new Segmenter(language, { granularity: "sentence" }).segment(text), s => s.segment);
    return parts.length && parts.join("") === text ? parts : [text];
  } catch { return [text]; }
}
export function practiceSteps(settings: ShadowingSettings): { technique: Technique; repetition: number; total: number }[] {
  const techniques: Technique[] = settings.technique === "combined" ? ["listen", "repeat", "shadow"] : [settings.technique];
  return techniques.flatMap(technique => {
    const total = technique === "listen" ? 1 : settings.repetitions;
    return Array.from({ length: total }, (_, i) => ({ technique, repetition: i + 1, total }));
  });
}
export function responsePause(text: string, rate: number): number {
  return Math.max(3000, text.trim().split(/\s+/u).length / (2.3 * rate) * 1000 + 2000);
}
export function formatPracticeTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map(value => String(value).padStart(2, "0")).join(":");
}
