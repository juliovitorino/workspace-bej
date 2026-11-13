import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { DonationConfig } from "./donationConfig";

interface DonationPageProps {
  config: DonationConfig;
}

export function DonationPage({ config }: DonationPageProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<"pix" | "bitcoin" | null>(null);
  const [copyError, setCopyError] = useState(false);
  const pixAvailable = config.pix.enabled && Boolean(config.pix.key);
  const bitcoinAvailable = config.bitcoin.enabled && Boolean(config.bitcoin.address);

  async function copy(value: string, method: "pix" | "bitcoin") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(method);
      setCopyError(false);
    } catch {
      setCopied(null);
      setCopyError(true);
    }
  }

  return (
    <section className="donation-page" aria-labelledby="donation-title">
      <header className="donation-heading">
        <span className="donation-heart" aria-hidden="true">♥</span>
        <div>
          <h2 id="donation-title">{config.content.title || t("donation.pageTitle")}</h2>
          <p>{config.content.description || t("donation.description")}</p>
        </div>
      </header>

      <div className="donation-methods">
        {config.pix.enabled && (
          <section className="donation-method" aria-labelledby="donation-pix-title">
            <h3 id="donation-pix-title">{t("donation.pixTitle")}</h3>
            <p className="donation-field-label">{t("donation.pixKey")}</p>
            {pixAvailable
              ? <code className="donation-address">{config.pix.key}</code>
              : <p className="donation-unavailable">{t("donation.notConfigured")}</p>}
            {config.pix.holderName && <p>{t("donation.holderName")}: {config.pix.holderName}</p>}
            <button type="button" className="primary-button donation-copy" disabled={!pixAvailable}
              onClick={() => void copy(config.pix.key, "pix")}>
              <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>
              {t("donation.copyPix")}
            </button>
          </section>
        )}

        {config.bitcoin.enabled && (
          <section className="donation-method" aria-labelledby="donation-bitcoin-title">
            <h3 id="donation-bitcoin-title">{t("donation.bitcoinTitle")}</h3>
            <p className="donation-network">{t("donation.network")}</p>
            <p className="donation-field-label">{t("donation.bitcoinAddress")}</p>
            {bitcoinAvailable
              ? <code className="donation-address">{config.bitcoin.address}</code>
              : <p className="donation-unavailable">{t("donation.notConfigured")}</p>}
            <button type="button" className="primary-button donation-copy" disabled={!bitcoinAvailable}
              onClick={() => void copy(config.bitcoin.address, "bitcoin")}>
              <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>
              {t("donation.copyBitcoin")}
            </button>
          </section>
        )}
      </div>

      {!config.pix.enabled && !config.bitcoin.enabled && <p>{t("donation.noMethods")}</p>}
      {copied && !copyError && <p className="donation-feedback" role="status">{t(copied === "pix" ? "donation.copiedPix" : "donation.copiedBitcoin")}</p>}
      {copyError && <p className="donation-feedback donation-feedback-error" role="alert">{t("donation.copyError")}</p>}
    </section>
  );
}
