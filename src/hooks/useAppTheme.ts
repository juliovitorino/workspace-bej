import { useEffect, useState } from "react";
import { applyTheme, getThemePreference, saveThemePreference, subscribeToSystemTheme,
  THEME_STORAGE_KEY, type ThemePreference } from "../theme";

export function useAppTheme() {
  const [theme, setTheme] = useState<ThemePreference>(getThemePreference);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "auto") return;
    return subscribeToSystemTheme(() => applyTheme("auto"));
  }, [theme]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) {
        setTheme(getThemePreference());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const changeTheme = (next: ThemePreference) => {
    saveThemePreference(next);
    setTheme(next);
  };
  return { theme, changeTheme };
}
