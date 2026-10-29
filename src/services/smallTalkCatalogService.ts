import type {
  SmallTalkIndex,
  SmallTalkItem,
  SmallTalkLocale,
  SmallTalkTopic
} from '../types/smallTalk';

/** Apenas catálogo público. Nunca busca nem persiste respostas pessoais. */
const DATA_ROOT = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/small-talk`;
const SUPPORTED_LOCALES = new Set<SmallTalkLocale>(['pt-BR', 'en-US', 'es-ES', 'fr-FR']);

export class SmallTalkCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SmallTalkCatalogError';
  }
}

async function readJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new SmallTalkCatalogError(`Small Talk: falha HTTP ${response.status} ao carregar catálogo.`);
  return response.json() as Promise<unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertIndex(value: unknown): asserts value is SmallTalkIndex {
  if (!isRecord(value) || value.schemaVersion !== '1.0.0' || value.module !== 'small-talk' ||
      !Array.isArray(value.topics) || !Array.isArray(value.availableLocales) ||
      !value.topics.every(t => isRecord(t) && typeof t.id === 'string' && typeof t.order === 'number' && typeof t.enabled === 'boolean')) {
    throw new SmallTalkCatalogError('Small Talk: índice JSON inválido ou incompatível.');
  }
}

function assertTopic(value: unknown, topicId: string, locale: SmallTalkLocale): asserts value is SmallTalkTopic {
  if (!isRecord(value) || value.schemaVersion !== '1.0.0' || value.module !== 'small-talk' ||
      value.topicId !== topicId || value.locale !== locale || !Array.isArray(value.items) ||
      !value.items.every(item => isRecord(item) && typeof item.id === 'string' &&
        typeof item.order === 'number' && typeof item.enabled === 'boolean' &&
        isRecord(item.question) && typeof item.question.text === 'string' &&
        (item.answer === undefined || item.answer === null ||
          (isRecord(item.answer) && typeof item.answer.text === 'string' &&
            (item.answer.audio === null || typeof item.answer.audio === 'string'))))) {
    throw new SmallTalkCatalogError(`Small Talk: dados inválidos no tópico ${topicId}.`);
  }
}

export async function loadSmallTalkIndex(signal?: AbortSignal): Promise<SmallTalkIndex> {
  const data = await readJson(`${DATA_ROOT}/index.json`, signal);
  assertIndex(data);
  return data;
}

export async function loadSmallTalkTopic(
  topicId: string,
  locale: SmallTalkLocale = 'en-US',
  signal?: AbortSignal
): Promise<SmallTalkTopic> {
  if (!SUPPORTED_LOCALES.has(locale)) throw new SmallTalkCatalogError('Small Talk: idioma não suportado.');
  const index = await loadSmallTalkIndex(signal);
  if (!index.availableLocales.includes(locale)) {
    throw new SmallTalkCatalogError(`Small Talk: ${locale} ainda não foi localizado. Disponível: ${index.availableLocales.join(', ')}.`);
  }
  if (!index.topics.some(topic => topic.id === topicId && topic.enabled)) {
    throw new SmallTalkCatalogError('Small Talk: tópico inexistente ou desabilitado.');
  }
  // IDs vêm exclusivamente do índice, mas ainda escapamos o segmento de URL.
  const data = await readJson(`${DATA_ROOT}/${locale}/topics/${encodeURIComponent(topicId)}.json`, signal);
  assertTopic(data, topicId, locale);
  return data;
}

export async function loadSmallTalkItems(
  topicIds: string[],
  locale: SmallTalkLocale = 'en-US',
  signal?: AbortSignal
): Promise<SmallTalkItem[]> {
  const topics = await Promise.all(topicIds.map(id => loadSmallTalkTopic(id, locale, signal)));
  return topics.flatMap(topic => topic.items.filter(item => item.enabled));
}
