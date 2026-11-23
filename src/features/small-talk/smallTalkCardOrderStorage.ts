/** Per-topic card order shared by all devices through the existing Drive sync. */
export const SMALL_TALK_CARD_ORDER_KEY = 'bej:small-talk:card-order:v1';
export type CardOrderRecord = { ids: string[]; updatedAt: string };
export type CardOrders = Record<string, CardOrderRecord>;
const LEGACY_DATE = '1970-01-01T00:00:00.000Z';

export function validateCardOrders(input: unknown): CardOrders {
  if (input === undefined || input === null) return {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Ordem dos cards inválida.');
  const result: CardOrders = {};
  for (const [topic, raw] of Object.entries(input)) {
    if (!topic || !raw) throw new Error('Tópico de ordenação inválido.');
    // Older devices stored topicId -> string[] without timestamps.
    const legacy = Array.isArray(raw);
    const record = raw as Partial<CardOrderRecord>;
    const ids = legacy ? raw : record.ids;
    const updatedAt = legacy ? LEGACY_DATE : record.updatedAt;
    if (!Array.isArray(ids) || !ids.every(id => typeof id === 'string' && id.length > 0) ||
        new Set(ids).size !== ids.length || typeof updatedAt !== 'string' ||
        !Number.isFinite(Date.parse(updatedAt))) throw new Error('Ordem dos cards inválida.');
    result[topic] = { ids: [...ids], updatedAt };
  }
  return result;
}

export function readCardOrders(storage: Storage = localStorage): CardOrders {
  try {
    const raw = storage.getItem(SMALL_TALK_CARD_ORDER_KEY);
    return raw ? validateCardOrders(JSON.parse(raw)) : {};
  } catch { return {}; }
}

export function saveCardOrders(orders: CardOrders, storage: Storage = localStorage): void {
  storage.setItem(SMALL_TALK_CARD_ORDER_KEY, JSON.stringify(validateCardOrders(orders)));
}

export function updateCardOrder(orders: CardOrders, topic: string, ids: string[]): CardOrders {
  return { ...orders, [topic]: { ids, updatedAt: new Date().toISOString() } };
}

/** Last edit wins; equal timestamps (including legacy data) have a deterministic tie-break. */
export function mergeCardOrders(left: CardOrders, right: CardOrders): CardOrders {
  const a = validateCardOrders(left), b = validateCardOrders(right);
  const merged = { ...a };
  for (const [topic, record] of Object.entries(b)) {
    const previous = merged[topic];
    if (!previous || Date.parse(record.updatedAt) > Date.parse(previous.updatedAt) ||
        (record.updatedAt === previous.updatedAt && JSON.stringify(record.ids) > JSON.stringify(previous.ids))) {
      merged[topic] = record;
    }
  }
  return merged;
}
