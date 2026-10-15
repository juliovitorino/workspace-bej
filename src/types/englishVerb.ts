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

/** Localized catalogs store verified forms, rather than English conjugation slots. */
export interface LocalizedVerb {
  id: string;
  base: string;
  meanings: string[];
  level: string;
  frequency: string;
  tags: string[];
  forms: {
    infinitive: string;
    present: string;
    past: string;
    imperfect: string;
    participle: string;
    gerund: string;
    perfect: string;
    pluperfect: string;
    perfectInfinitive: string;
    pastFeminine?: string;
    pluperfectFeminine?: string;
  };
  stative?: boolean;
  trainingForms: Partial<Record<string, string>>;
  impersonal?: boolean;
}

export type SpeakingVerb = EnglishVerb | LocalizedVerb;

export interface GameAdjective {
  id: string;
  adjective: string;
  meanings: string[];
  forms?: { masculine: string; feminine: string; masculinePlural: string; femininePlural: string; masculineBeforeVowel?: string };
}

export interface GameNoun {
  id: string;
  noun: string;
  meanings: string[];
  plural?: string;
  gender?: "masculine" | "feminine" | "invariant";
  article?: string;
  pluralArticle?: string;
  countability?: string;
  feminine?: string;
  femininePlural?: string;
}
