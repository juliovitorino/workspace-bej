/** Preferência compartilhada entre módulos no mesmo navegador. Não contém credenciais. */
export type AIProvider = 'chatgpt' | 'gemini';
export const AI_PROVIDER_STORAGE_KEY = 'bej:ai:preferred-provider:v1';
export const AI_PROVIDER_CHANGED_EVENT = 'bej:ai:preferred-provider-changed';
export const DEFAULT_AI_PROVIDER: AIProvider = 'chatgpt';

export function getAIProvider(): AIProvider {
  try {
    const stored = window.localStorage.getItem(AI_PROVIDER_STORAGE_KEY);
    return stored === 'gemini' || stored === 'chatgpt' ? stored : DEFAULT_AI_PROVIDER;
  } catch { return DEFAULT_AI_PROVIDER; }
}

export function setAIProvider(provider: AIProvider): void {
  window.localStorage.setItem(AI_PROVIDER_STORAGE_KEY, provider);
  window.dispatchEvent(new Event(AI_PROVIDER_CHANGED_EVENT));
}

export function aiAssetPath(provider: AIProvider): string {
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}/images/ia/${provider}.svg`;
}
