/**
 * Estrutura dos verbos usados pelo JOGO DA FALA.
 *
 * Este modelo corresponde ao arquivo english-verbs-common.json.
 */

export type EnglishVerbType = "regular" | "irregular";

export interface EnglishVerbExample {
  en: string;
  pt: string;
}

export interface EnglishVerb {
  id: string;
  base: string;
  type: EnglishVerbType;
  past: string;
  pastParticiple: string;
  thirdPerson: string;
  gerund: string;
  meanings: string[];
  level: string;
  frequency: string;
  examples: EnglishVerbExample[];
  tags: string[];
}

export interface EnglishVerbsMetadata {
  name: string;
  version: string;
  updatedAt: string;
  language: string;
  description: string;
  totalVerbs: number;
}

export interface EnglishVerbsData {
  metadata: EnglishVerbsMetadata;
  verbs: EnglishVerb[];
}
