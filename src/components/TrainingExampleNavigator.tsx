import { useTranslation } from "react-i18next";

interface TrainingExampleNavigatorProps {
  index: number;
  total: number;
  onNext: () => void;
}

/** Shared example header for Basic and Advanced training. */
export function TrainingExampleNavigator({ index, total, onNext }: TrainingExampleNavigatorProps) {
  const { t } = useTranslation();

  return (
    <div className="training-example-navigation">
      <h3>{t("common.example")}</h3>
      {total > 1 && (
        <div className="training-example-navigation-actions">
          <span className="training-example-position" aria-live="polite" aria-atomic="true">
            {t("common.countOfTotal", { count: index + 1, total })}
          </span>
          <button
            type="button"
            className="training-example-next"
            onClick={onNext}
            aria-label={t("common.nextExample")}
            title={t("common.nextExample")}
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
