import { useTranslation } from "react-i18next";
import { NOTIFICATION_MODULES, studyNotificationModuleLabel, useStudyNotificationSettings, type NotificationThreshold } from "./studyNotifications";
import "./studyNotifications.css";

export function StudyNotificationSettings() {
  const { t } = useTranslation();
  const { settings, update, saveError } = useStudyNotificationSettings();
  return <section className="study-notification-settings" aria-labelledby="study-notification-settings-title">
    <h4 id="study-notification-settings-title">{t("studyNotifications.title")}</h4>
    <p>{t("studyNotifications.description")}</p>
    <label className="study-notification-setting-row">
      <span><strong>{t("studyNotifications.master")}</strong><small>{t("studyNotifications.masterHelp")}</small></span>
      <input type="checkbox" role="switch" className="study-notification-switch" checked={settings.enabled}
        onChange={event => update(current => ({ ...current, enabled: event.target.checked }))} />
    </label>
    <fieldset className="study-notification-fieldset" disabled={!settings.enabled}>
      <legend>{t("studyNotifications.threshold")}</legend>
      <div className="study-notification-thresholds">
        {([1, 7, 30] as NotificationThreshold[]).map(days =>
          <label key={days} className="study-notification-threshold">
            <input type="radio" name="study-notification-threshold" checked={settings.thresholdDays === days}
              onChange={() => update(current => ({ ...current, thresholdDays: days }))} />
            <span>{t(`studyNotifications.periods.${days}`)}</span>
          </label>)}
      </div>
      <h5>{t("studyNotifications.modules")}</h5>
      <div className="study-notification-modules">
        {NOTIFICATION_MODULES.map(module => <label key={module} className="study-notification-setting-row">
          <span>{studyNotificationModuleLabel(module, t)}</span>
          <input type="checkbox" role="switch" className="study-notification-switch"
            checked={settings.modules[module] === true}
            onChange={event => update(current => ({ ...current, modules: { ...current.modules, [module]: event.target.checked } }))} />
        </label>)}
      </div>
    </fieldset>
    <p className="study-notification-note">{t("studyNotifications.localOnly")}</p>
    {saveError && <p role="alert" className="study-notification-error">{t("studyNotifications.saveError")}</p>}
  </section>;
}
