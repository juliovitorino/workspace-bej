import { useEffect, useState } from "react";
import type { StudentLanguage } from "../../config/languages";
import { EXTRA_CATEGORIES, STUDY_MODULES, type StudyData } from "./studyStorage";
import { EXTRA_MODULE_PREFIX } from "./studyModuleChart";
import { moduleLastActivity } from "./studyModuleRecency";

export const STUDY_NOTIFICATION_KEY = "bej.study.notificationSettings.v1";
export const STUDY_NOTIFICATIONS_CHANGED = "bej-study-notifications-changed";
export const NOTIFICATION_MODULES = [
  ...STUDY_MODULES.filter(module => module !== "extra-activities"),
  ...EXTRA_CATEGORIES.map(category => `${EXTRA_MODULE_PREFIX}${category}`),
] as const;
export type NotificationModule = typeof NOTIFICATION_MODULES[number];
export type NotificationThreshold = 1 | 7 | 30;
export interface StudyNotificationSettings {
  enabled: boolean;
  thresholdDays: NotificationThreshold;
  modules: Record<string, boolean>;
}
export interface StudyInactivityAlert { module: NotificationModule; lastAt: number; elapsedMs: number; }

export function defaultStudyNotificationSettings(): StudyNotificationSettings {
  return { enabled: false, thresholdDays: 7, modules: Object.fromEntries(NOTIFICATION_MODULES.map(key => [key, false])) };
}
export function parseStudyNotificationSettings(raw: string | null): StudyNotificationSettings {
  const defaults = defaultStudyNotificationSettings();
  if (!raw) return defaults;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
    const config = value as Record<string, unknown>;
    if (config.version !== 1 || typeof config.enabled !== "boolean" || ![1, 7, 30].includes(config.thresholdDays as number) ||
      !config.modules || typeof config.modules !== "object" || Array.isArray(config.modules)) return defaults;
    const modules = config.modules as Record<string, unknown>;
    return {
      enabled: config.enabled,
      thresholdDays: config.thresholdDays as NotificationThreshold,
      modules: Object.fromEntries(NOTIFICATION_MODULES.map(key => [key, modules[key] === true])),
    };
  } catch { return defaults; }
}
export function readStudyNotificationSettings(): StudyNotificationSettings {
  try { return parseStudyNotificationSettings(window.localStorage.getItem(STUDY_NOTIFICATION_KEY)); }
  catch { return defaultStudyNotificationSettings(); }
}
export function writeStudyNotificationSettings(settings: StudyNotificationSettings): void {
  window.localStorage.setItem(STUDY_NOTIFICATION_KEY, JSON.stringify({
    version: 1, enabled: settings.enabled, thresholdDays: settings.thresholdDays,
    modules: Object.fromEntries(NOTIFICATION_MODULES.map(key => [key, settings.modules[key] === true])),
  }));
  window.dispatchEvent(new Event(STUDY_NOTIFICATIONS_CHANGED));
}

/** The same in-app settings are refreshed across tabs; no browser push or backend is used. */
export function useStudyNotificationSettings() {
  const [settings, setSettings] = useState(readStudyNotificationSettings);
  const [saveError, setSaveError] = useState(false);
  useEffect(() => {
    const refresh = () => setSettings(readStudyNotificationSettings());
    const storage = (event: StorageEvent) => {
      if (event.key === STUDY_NOTIFICATION_KEY || event.key === null) refresh();
    };
    window.addEventListener(STUDY_NOTIFICATIONS_CHANGED, refresh);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener(STUDY_NOTIFICATIONS_CHANGED, refresh);
      window.removeEventListener("storage", storage);
    };
  }, []);
  const update = (change: (current: StudyNotificationSettings) => StudyNotificationSettings) => {
    const next = change(readStudyNotificationSettings());
    try { writeStudyNotificationSettings(next); setSaveError(false); setSettings(next); }
    catch { setSaveError(true); }
  };
  return { settings, update, saveError };
}

/** Only recorded sessions count; modules never used do not trigger an inactivity warning. */
export function studyInactivityAlerts(
  data: StudyData,
  settings: StudyNotificationSettings,
  nowMs: number,
  language: StudentLanguage,
): StudyInactivityAlert[] {
  if (!settings.enabled || !Number.isFinite(nowMs)) return [];
  const last = moduleLastActivity(data, { language, mode: "all" });
  const limitMs = settings.thresholdDays * 86400000;
  return NOTIFICATION_MODULES
    .filter(module => settings.modules[module] === true)
    .flatMap(module => {
      const lastAt = last[module];
      if (lastAt === undefined || !Number.isFinite(lastAt)) return [];
      const elapsedMs = nowMs - lastAt;
      return elapsedMs > limitMs ? [{ module, lastAt, elapsedMs }] : [];
    })
    .sort((a, b) => b.elapsedMs - a.elapsedMs || a.module.localeCompare(b.module));
}

export function studyNotificationModuleLabel(module: string, t: (key: string) => string): string {
  if (module.startsWith(EXTRA_MODULE_PREFIX)) return t(`extras.categories.${module.slice(EXTRA_MODULE_PREFIX.length)}`);
  if (module === "hashmap") return "Mental Hashmap";
  if (module === "small-talk") return "Small Talk";
  const names: Record<string, string> = {
    "memory-flashcards": "memory.title", "chunk-flashcards": "common.chunkFlashcards",
    "chunk-favorites": "favorites.title", shadowing: "common.shadowing",
    "basic-training": "study.basicTraining", "advanced-training": "study.advancedTraining",
    "review-training": "study.reviewTraining", "speaking-game": "common.speakingGame",
    "would-you-rather": "wyr.moduleTitle", interpretation: "common.interpretation",
  };
  return t(names[module] ?? module);
}
