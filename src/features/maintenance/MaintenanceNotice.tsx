import type { SourceLanguage } from "../../config/languages";
import { maintenanceMessage, type MaintenanceConfig } from "./maintenanceConfig";

interface MaintenanceNoticeProps {
  config: MaintenanceConfig;
  language: SourceLanguage;
}

export function MaintenanceNotice({ config, language }: MaintenanceNoticeProps) {
  const message = maintenanceMessage(config, language);
  if (!config.visible || !message) return null;

  return (
    <section className="maintenance-notice" role="status" aria-live="polite">
      <svg className="maintenance-notice-icon" aria-hidden="true" focusable="false"
        width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3 2 21h20L12 3Z" />
        <path d="M12 9v5" />
        <circle cx="12" cy="17.5" r="1" fill="currentColor" stroke="none" />
      </svg>
      <p lang={language}>{message}</p>
    </section>
  );
}
