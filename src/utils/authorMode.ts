/** Controle de interface para ferramentas de autoria (não é autenticação). */
const STORAGE_AUTHOR_KEY = "_mhx.prefs.x7k29";
const AUTHOR_TOKEN = "8f4c2e91-6a73-4d0b-9e52-c17a08f6b394";

export function isAuthorMode(): boolean {
  try {
    return typeof window !== "undefined" &&
      window.localStorage.getItem(STORAGE_AUTHOR_KEY) === AUTHOR_TOKEN;
  } catch {
    return false;
  }
}

/** Notifica componentes no mesmo documento (o evento storage não dispara na própria aba). */
export const AUTHOR_MODE_CHANGED = "bej:author-mode-changed";

export function toggleAuthorMode(): boolean {
  const enabled = !isAuthorMode();
  if (enabled) window.localStorage.setItem(STORAGE_AUTHOR_KEY, AUTHOR_TOKEN);
  else window.localStorage.removeItem(STORAGE_AUTHOR_KEY);
  window.dispatchEvent(new Event(AUTHOR_MODE_CHANGED));
  return enabled;
}
