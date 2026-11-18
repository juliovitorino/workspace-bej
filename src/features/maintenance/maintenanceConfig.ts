import type { SourceLanguage } from "../../config/languages";

export interface MaintenanceConfig {
  visible: boolean;
  lockapp: boolean;
  messages: Record<SourceLanguage, string>;
}

export const HIDDEN_MAINTENANCE_CONFIG: MaintenanceConfig = {
  visible: false,
  lockapp: false,
  messages: { "pt-BR": "", "en-US": "", "es-ES": "", "fr-FR": "" },
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asMessage(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Invalid or unavailable configuration never enables the banner by accident. */
export function parseMaintenanceConfig(value: unknown): MaintenanceConfig {
  const maintenance = asRecord(asRecord(value).maintenance);
  const messages = asRecord(maintenance.messages);
  return {
    visible: maintenance.visible === true,
    lockapp: maintenance.lockapp === true,
    messages: {
      "pt-BR": asMessage(messages["pt-BR"]),
      "en-US": asMessage(messages["en-US"]),
      "es-ES": asMessage(messages["es-ES"]),
      "fr-FR": asMessage(messages["fr-FR"]),
    },
  };
}

/** The full-page lock is enabled only when BOTH maintenance flags are true. */
export function isMaintenanceLocked(config: MaintenanceConfig): boolean {
  return config.visible && config.lockapp;
}

/** Prefer the UI/source language; fall back to Portuguese for incomplete configs. */
export function maintenanceMessage(config: MaintenanceConfig, language: SourceLanguage): string {
  return config.messages[language] || config.messages["pt-BR"] || "";
}

export async function loadMaintenanceConfig(signal?: AbortSignal): Promise<MaintenanceConfig> {
  const response = await fetch(`${import.meta.env.BASE_URL}config/maintenance.json`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Could not load maintenance configuration");
  return parseMaintenanceConfig(await response.json());
}
