export type ThemePreference = "light" | "dark" | "auto";
export const THEME_STORAGE_KEY = "bej-theme-preference";
const DARK_MEDIA = "(prefers-color-scheme: dark)";

export function getThemePreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "auto") return saved;
  } catch { /* Private browsing can disable storage. */ }
  return "auto";
}

export function applyTheme(preference: ThemePreference): void {
  const dark = preference === "dark" ||
    (preference === "auto" && window.matchMedia(DARK_MEDIA).matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

export function saveThemePreference(preference: ThemePreference): void {
  try { localStorage.setItem(THEME_STORAGE_KEY, preference); }
  catch { /* Theme still works during this session. */ }
  applyTheme(preference);
}

export function subscribeToSystemTheme(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_MEDIA);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
