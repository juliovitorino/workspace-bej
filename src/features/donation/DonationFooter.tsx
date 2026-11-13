import { useTranslation } from "react-i18next";
import type { DonationConfig } from "./donationConfig";

interface DonationFooterProps {
  config: DonationConfig;
  onDonate: () => void;
}

export function DonationFooter({ config, onDonate }: DonationFooterProps) {
  const { t } = useTranslation();
  if (!config.enabled || !config.footer.visible) return null;

  return (
    <section className="donation-footer" aria-label={t("donation.title")}>
      <span className="donation-footer-heart" aria-hidden="true">♥</span>
      <div className="donation-footer-content">
        <strong>{config.content.footerMessage || t("donation.footerMessage")}</strong>
        <p>{t("donation.footerDescription")}</p>
      </div>
      <button type="button" className="donation-footer-button" onClick={onDonate}>
        {config.content.buttonLabel || t("donation.buttonLabel")}
      </button>
    </section>
  );
}
