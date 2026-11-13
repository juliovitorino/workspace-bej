/**
 * Static Pix BR Code (EMV) payload, without amount: the payer chooses the value.
 * Generated locally; no payment details are sent to external services.
 */
function field(id: string, value: string): string {
  const size = new TextEncoder().encode(value).length;
  if (size > 99) throw new Error("Pix field exceeds 99 bytes");
  return id + String(size).padStart(2, "0") + value;
}

function ascii(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
}

function crc16Ccitt(value: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(value)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function createPixPayload(key: string, holderName: string, city: string): string | null {
  const cleanKey = key.trim();
  const name = ascii(holderName);
  const place = ascii(city);

  // Masked names are for display only and cannot identify a Pix recipient in a BR Code.
  if (!cleanKey || cleanKey.length > 77 || /[\s*]/.test(cleanKey)) return null;
  if (!name || name.length > 25 || !/^[A-Z0-9 .'-]+$/.test(name)) return null;
  if (!place || place.length > 15 || !/^[A-Z0-9 .'-]+$/.test(place)) return null;

  const merchantAccount = field("00", "br.gov.bcb.pix") + field("01", cleanKey);
  const payload =
    field("00", "01") +
    field("26", merchantAccount) +
    field("52", "0000") +
    field("53", "986") +
    field("58", "BR") +
    field("59", name) +
    field("60", place) +
    field("62", field("05", "***")) +
    "6304";

  return payload + crc16Ccitt(payload);
}

export function createBitcoinUri(address: string): string | null {
  const value = address.trim();
  // Legacy P2PKH/P2SH and SegWit mainnet receiving addresses.
  const legacy = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(value);
  const segwit = /^(bc1q[ac-hj-np-z02-9]{11,71}|bc1p[ac-hj-np-z02-9]{11,71})$/.test(value);
  return legacy || segwit ? `bitcoin:${value}` : null;
}

/**
 * Picks a receiving address, excluding the currently displayed one whenever
 * there is more than one option. The QR code and copied address share this choice.
 */
export function pickNextBitcoinAddress(
  addresses: string[],
  current: string | null,
  random: () => number = Math.random,
): string | null {
  const unique = [...new Set(addresses)];
  const alternatives = unique.filter((address) => address !== current);
  const pool = alternatives.length ? alternatives : unique;
  if (!pool.length) return null;
  const index = Math.max(0, Math.min(pool.length - 1, Math.floor(random() * pool.length)));
  return pool[index];
}
