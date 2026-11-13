export interface DonationConfig {
  enabled: boolean;
  footer: { visible: boolean };
  pix: { enabled: boolean; key: string; holderName: string; city: string; qrCodeEnabled: boolean };
  bitcoin: { enabled: boolean; network: "bitcoin"; address: string; qrCodeEnabled: boolean };
  content: { title: string; description: string; footerMessage: string; buttonLabel: string };
}

export const DISABLED_DONATION_CONFIG: DonationConfig = {
  enabled: false,
  footer: { visible: false },
  pix: { enabled: false, key: "", holderName: "", city: "", qrCodeEnabled: false },
  bitcoin: { enabled: false, network: "bitcoin", address: "", qrCodeEnabled: false },
  content: { title: "", description: "", footerMessage: "", buttonLabel: "" },
};

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseDonationConfig(value: unknown): DonationConfig {
  const donation = record(record(value).donation);
  const footer = record(donation.footer);
  const pix = record(donation.pix);
  const bitcoin = record(donation.bitcoin);
  const content = record(donation.content);

  return {
    enabled: donation.enabled === true,
    footer: { visible: footer.visible === true },
    pix: {
      enabled: pix.enabled === true,
      key: stringValue(pix.key),
      holderName: stringValue(pix.holderName),
      city: stringValue(pix.city),
      qrCodeEnabled: pix.qrCodeEnabled === true,
    },
    bitcoin: {
      enabled: bitcoin.enabled === true && (bitcoin.network === undefined || bitcoin.network === "bitcoin"),
      network: "bitcoin",
      address: stringValue(bitcoin.address),
      qrCodeEnabled: bitcoin.qrCodeEnabled === true,
    },
    content: {
      title: stringValue(content.title),
      description: stringValue(content.description),
      footerMessage: stringValue(content.footerMessage),
      buttonLabel: stringValue(content.buttonLabel),
    },
  };
}

export async function loadDonationConfig(signal?: AbortSignal): Promise<DonationConfig> {
  const response = await fetch(`${import.meta.env.BASE_URL}config/donation.json`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Could not load donation configuration");
  return parseDonationConfig(await response.json());
}
