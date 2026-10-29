import type { SmallTalkWalkingSettings } from '../../types/smallTalk';
export const SMALL_TALK_PREFERENCES_KEY = 'bej:small-talk:preferences:v1';
export const SMALL_TALK_PROGRESS_KEY = 'bej:small-talk:progress:v1';
export const SMALL_TALK_FAVORITES_KEY = 'bej:small-talk:favorites:v1';
export const SMALL_TALK_WALKING_SETTINGS_KEY = 'bej:small-talk:walking-settings:v1';
export const SMALL_TALK_WALKING_PROGRESS_KEY = 'bej:small-talk:walking-progress:v1';

export const DEFAULT_WALKING_SETTINGS: SmallTalkWalkingSettings = {
  schemaVersion: '1.0.0', module: 'small-talk', mode: 'walking', repeatCount: 5,
  playDefaultAnswer: false, defaultAnswerSource: 'original',
  pauseAfterQuestionSeconds: 10, pauseBetweenRepetitionsSeconds: 1,
  repetitionUnit: 'full-answer', voice: 'cedar', shuffle: false,
  keepScreenAwake: true, selectedLevels: ['a1', 'a2', 'b1', 'b2', 'c1'],
  selectedTopicIds: [], favoritesOnly: false
};

export function readLocalJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch { return fallback; }
}
export function saveLocalJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}
export function readWalkingSettings(): SmallTalkWalkingSettings {
  const saved = readLocalJson<Partial<SmallTalkWalkingSettings>>(SMALL_TALK_WALKING_SETTINGS_KEY, {});
  return {
    ...DEFAULT_WALKING_SETTINGS,
    ...saved,
    repeatCount: Number.isInteger(saved.repeatCount) ? Math.max(1, Math.min(10, saved.repeatCount!)) : 5,
    pauseAfterQuestionSeconds: Number.isFinite(saved.pauseAfterQuestionSeconds) ? Math.max(1, Math.min(90, saved.pauseAfterQuestionSeconds!)) : 10,
    pauseBetweenRepetitionsSeconds: Number.isFinite(saved.pauseBetweenRepetitionsSeconds) ? Math.max(0, Math.min(10, saved.pauseBetweenRepetitionsSeconds!)) : 1,
    defaultAnswerSource: 'original',
    playDefaultAnswer: saved.playDefaultAnswer === true,
    repetitionUnit: 'full-answer',
    selectedLevels: Array.isArray(saved.selectedLevels) ? saved.selectedLevels : DEFAULT_WALKING_SETTINGS.selectedLevels,
    selectedTopicIds: Array.isArray(saved.selectedTopicIds) ? saved.selectedTopicIds : [],
    favoritesOnly: saved.favoritesOnly === true,
    shuffle: saved.shuffle === true,
    keepScreenAwake: saved.keepScreenAwake !== false,
    voice: saved.voice === 'marin' ? 'marin' : 'cedar'
  };
}
