import type { SmallTalkItem, SmallTalkLevel } from '../../types/smallTalk';

/** Cards criados no dispositivo. Nunca modifica os JSONs públicos automaticamente. */
export const SMALL_TALK_CUSTOM_ITEMS_KEY = 'bej:small-talk:custom-items:v1';
export interface CustomSmallTalkItem {
  topicId: string;
  item: SmallTalkItem;
  deleted: boolean;
  updatedAt: string;
}
export type CustomSmallTalkItems = Record<string, CustomSmallTalkItem>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
export function isCustomItems(value: unknown): value is CustomSmallTalkItems {
  return isRecord(value) && Object.entries(value).every(([id, raw]) => {
    if (!id || !isRecord(raw) || !isRecord(raw.item)) return false;
    const item = raw.item;
    return item.id === id && typeof raw.topicId === 'string' && !!raw.topicId &&
      typeof raw.deleted === 'boolean' && typeof raw.updatedAt === 'string' &&
      !Number.isNaN(Date.parse(raw.updatedAt)) && item.type === 'question-answer' &&
      typeof item.order === 'number' && Number.isFinite(item.order) &&
      typeof item.enabled === 'boolean' &&
      (item.level === null || ['a1', 'a2', 'b1', 'b2', 'c1'].includes(String(item.level))) &&
      isRecord(item.question) && typeof item.question.text === 'string' && !!item.question.text.trim() &&
      (item.question.audio === null || typeof item.question.audio === 'string') &&
      (item.answer === null || (isRecord(item.answer) && typeof item.answer.text === 'string' &&
        (item.answer.audio === null || typeof item.answer.audio === 'string'))) &&
      item.context === null && Array.isArray(item.followUps) && Array.isArray(item.tags) &&
      Array.isArray(item.linkedIntentionIds) && isRecord(item.source) &&
      typeof item.source.document === 'string' && typeof item.source.section === 'string' &&
      typeof item.source.paragraphIndex === 'number' && item.reviewStatus === 'pending';
  });
}
export function readCustomItems(storage: Storage = window.localStorage): CustomSmallTalkItems {
  const raw = storage.getItem(SMALL_TALK_CUSTOM_ITEMS_KEY);
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!isCustomItems(parsed)) throw new Error('Cards pessoais inválidos: nenhum dado foi alterado.');
  return parsed;
}
export function writeCustomItems(items: CustomSmallTalkItems, storage: Storage = window.localStorage): CustomSmallTalkItems {
  if (!isCustomItems(items)) throw new Error('Cards pessoais inválidos.');
  storage.setItem(SMALL_TALK_CUSTOM_ITEMS_KEY, JSON.stringify(items));
  return items;
}
/** UUID v4: funciona também em ambientes onde crypto.randomUUID não está disponível. */
function newCardId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    // Compatibilidade com navegadores HTTP antigos; a unicidade é checada ao salvar.
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
}
export function createCustomItem(topicId: string, question: string, answer: string, level: SmallTalkLevel | null, order: number,
  storage: Storage = window.localStorage): CustomSmallTalkItems {
  if (!topicId || !question.trim()) throw new Error('Informe uma pergunta e selecione um tópico.');
  const existing = readCustomItems(storage);
  let id = newCardId();
  while (existing[id]) id = newCardId();
  const item: SmallTalkItem = {
    id, type: 'question-answer', order, enabled: true, level,
    question: { text: question.trim(), audio: null },
    answer: answer.trim() ? { text: answer.trim(), audio: null } : null,
    context: null, followUps: [], linkedIntentionIds: [], tags: [],
    source: { document: 'BEJ Small Talk — inclusão pessoal', section: topicId, paragraphIndex: -1 },
    reviewStatus: 'pending'
  };
  return writeCustomItems({ ...existing, [id]: {
    topicId, item, deleted: false, updatedAt: new Date().toISOString()
  } }, storage);
}
export function setCustomItemDeleted(id: string, deleted: boolean, storage: Storage = window.localStorage): CustomSmallTalkItems {
  const current = readCustomItems(storage);
  if (!current[id]) throw new Error('Card pessoal não encontrado.');
  return writeCustomItems({ ...current, [id]: { ...current[id], deleted, updatedAt: new Date().toISOString() } }, storage);
}
export function mergeCustomItems(local: CustomSmallTalkItems, incoming: CustomSmallTalkItems): CustomSmallTalkItems {
  if (!isCustomItems(local) || !isCustomItems(incoming)) throw new Error('Backup de cards pessoais inválido.');
  const result = { ...local };
  for (const [id, value] of Object.entries(incoming)) {
    if (!result[id] || Date.parse(value.updatedAt) > Date.parse(result[id].updatedAt)) result[id] = value;
  }
  return result;
}
