import { useTranslation } from "react-i18next";
import { moduleRecencyParts } from "./studyModuleRecency";
import type { StudyInactivityAlert } from "./studyNotifications";
import { studyNotificationModuleLabel } from "./studyNotifications";
import "./studyNotifications.css";

interface Props {
  alerts: StudyInactivityAlert[];
  enabled: boolean;
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  now: Date;
}
export function StudyNotificationBell({ count, open, onClick }: { count: number; open: boolean; onClick: () => void }) {
  const { t } = useTranslation();
  return <button type="button" className="secondary-button study-notification-bell" onClick={onClick}
    aria-label={t("studyNotifications.bellLabel", { count })} title={t("studyNotifications.title")}
    aria-expanded={open} aria-controls="study-notification-center">
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </svg>
    {count > 0 && <span className="study-notification-count" aria-hidden="true">{count > 99 ? "99+" : count}</span>}
  </button>;
}
export function StudyNotificationCenter({ alerts, enabled, open, onClose, onOpenSettings, now }: Props) {
  const { t } = useTranslation();
  if (!open) return null;
  return <section id="study-notification-center" className="study-panel study-notification-center" aria-labelledby="study-notification-center-title">
    <div className="study-notification-center-heading">
      <h3 id="study-notification-center-title">{t("studyNotifications.centerTitle")}</h3>
      <button type="button" className="secondary-button" onClick={onClose} aria-label={t("studyNotifications.close")}>×</button>
    </div>
    {!enabled ? <p>{t("studyNotifications.disabled")}</p> : alerts.length === 0
      ? <p>{t("studyNotifications.empty")}</p>
      : <ul className="study-notification-alert-list">
        {alerts.map(alert => {
          const parts = moduleRecencyParts(alert.lastAt, now.getTime());
          const time = parts ? `${parts.count}${t(`study.moduleRecencyUnits.${parts.unit}${parts.count === 1 ? "One" : "Other"}`)}` : "";
          return <li key={alert.module}>
            <span className="study-notification-alert-symbol" aria-hidden="true">!</span>
            <div>
              <strong>{studyNotificationModuleLabel(alert.module, t)}</strong>
              <p>{t("studyNotifications.alertMessage", { time })}</p>
            </div>
          </li>;
        })}
      </ul>}
    <button type="button" className="secondary-button" onClick={onOpenSettings}>{t("studyNotifications.configure")}</button>
  </section>;
}
