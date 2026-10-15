/**
 * Mental Hashmap — contrato JSON 4.0 e modelo de compatibilidade do aplicativo.
 * Os arquivos JSON por idioma usam o contrato V4; o serviço de carregamento
 * converte esse formato para o modelo consumido pelas telas existentes.
 */

export type EnglishLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export interface HashmapIntegrity {
  algorithm: string;
  intentionIdsSha256: string;
  exampleKeysSha256: string;
}

export interface HashmapMetadata {
  name: string;
  version: string;
  updatedAt: string;
  language: string;
  sourceLanguage?: string;
  schemaVersion?: string;
  source?: string;
  sourceBuild?: string;
  totalIntentions?: number;
  integrity?: HashmapIntegrity;
}

/** Um exemplo, em um único idioma, como armazenado no JSON 4.0. */
export interface HashmapExampleV4 {
  id: string;
  exampleItem: string;
  intent: string;
  hqImage?: string;
}

/** Uma intenção, em um único idioma, como armazenada no JSON 4.0. */
export interface HashmapIntentionV4 {
  id: string;
  intention: string;
  pattern?: string;
  structure?: string;
  description?: string;
  category?: string;
  level?: EnglishLevel;
  allowLanguageChunkPractice?: boolean;
  searchTerms?: string[];
  validationPatterns?: string[];
  youtubeVideo?: string;
  youtubeShort?: string;
  examples?: HashmapExampleV4[];
  tags?: string[];
  related?: string[];
}

/** Formato bruto recebido de /sample-hashmap-<idioma>.json. */
export interface HashmapDataV4 {
  metadata: HashmapMetadata;
  mentalMap: HashmapIntentionV4[];
}

/**
 * Modelo temporário de compatibilidade para as telas existentes.
 * pt/en e ptIntent/enIntent são preenchidos pelo hashmapService
 * a partir dos arquivos pt-BR e do idioma estudado.
 */
export interface Example extends HashmapExampleV4 {
  pt: string;
  en: string;
  ptIntent?: string;
  enIntent?: string;
}

/**
 * Modelo utilizado pelo aplicativo após normalização do JSON 4.0.
 * english e englishLevel são aliases legados, não campos obrigatórios
 * nos arquivos JSON 4.0.
 */
export interface MentalIntention extends Omit<HashmapIntentionV4, "examples"> {
  english: string;
  targetIntention?: string;
  /** Campos da origem preservados para busca e filtros em qualquer par de idiomas. */
  sourcePattern?: string;
  sourceStructure?: string;
  sourceSearchTerms?: string[];
  sourceCategory?: string;
  /** A lista principal de tags pode conter tags de ambos os catálogos. */
  englishLevel?: EnglishLevel;
  examples?: Example[];
}

export interface HashmapData {
  metadata: HashmapMetadata;
  mentalMap: MentalIntention[];
}
