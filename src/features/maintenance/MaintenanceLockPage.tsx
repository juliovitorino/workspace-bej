import type { SourceLanguage } from "../../config/languages";
import { maintenanceMessage, type MaintenanceConfig } from "./maintenanceConfig";

const titles: Record<SourceLanguage, string> = {
  "pt-BR": "Estamos em manutenção",
  "en-US": "We're undergoing maintenance",
  "es-ES": "Estamos en mantenimiento",
  "fr-FR": "Nous sommes en maintenance",
};

interface MaintenanceLockPageProps {
  config: MaintenanceConfig;
  language: SourceLanguage;
}

/** Standalone page: no sidebar, navigation, study modules or other app controls. */
export function MaintenanceLockPage({ config, language }: MaintenanceLockPageProps) {
  return (
    <main className="maintenance-lock-page">
      <section className="maintenance-lock-card" aria-labelledby="maintenance-lock-title">
        <div className="maintenance-lock-symbol" aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3 2 21h20L12 3Z" />
            <path d="M12 9v5" />
            <circle cx="12" cy="17.5" r="1" fill="currentColor" stroke="none" />
          </svg>
        </div>
        <p className="maintenance-lock-brand">Brazilian English Journey</p>
        <h1 id="maintenance-lock-title" lang={language}>{titles[language]}</h1>
        <p className="maintenance-lock-message" lang={language}>
          {maintenanceMessage(config, language)}
        </p>
      </section>
    </main>
  );
}
