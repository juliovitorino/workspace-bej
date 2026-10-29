/** Small Talk BEJ v1.0.0 — tipagem fiel ao catálogo importado e ao estado pessoal. */
export type SmallTalkLocale = 'pt-BR' | 'en-US' | 'es-ES' | 'fr-FR';
export type SmallTalkLevel = 'a1' | 'a2' | 'b1' | 'b2' | 'c1';
export type SmallTalkItemType = 'question-answer' | 'discussion-prompt' | 'conversation-expression';
export type SmallTalkReviewStatus = 'pending' | 'approved' | 'rejected';
export type SmallTalkVoice = 'cedar' | 'marin';

export interface SmallTalkTopicIndexEntry {
  id: string;
  order: number;
  enabled: boolean;
  sourceTitle: string;
}
export interface SmallTalkIndex {
  schemaVersion: '1.0.0';
  module: 'small-talk';
  canonicalLocale: SmallTalkLocale;
  availableLocales: SmallTalkLocale[];
  pendingLocales: SmallTalkLocale[];
  topics: SmallTalkTopicIndexEntry[];
  importStatus: string;
}
export interface SmallTalkAudioText { text: string; audio: string | null; }
export interface SmallTalkFollowUp extends SmallTalkAudioText { id: string; }
export interface SmallTalkItem {
  id: string;
  type: SmallTalkItemType;
  order: number;
  enabled: boolean;
  /** null enquanto a classificação CEFR não foi aprovada. */
  level: SmallTalkLevel | null;
  question: SmallTalkAudioText | null;
  context: SmallTalkAudioText | null;
  followUps: SmallTalkFollowUp[];
  linkedIntentionIds: string[];
  tags: string[];
  source: { document: string; section: string; paragraphIndex: number };
  reviewStatus: SmallTalkReviewStatus;
}
export interface SmallTalkTopic {
  schemaVersion: '1.0.0';
  module: 'small-talk';
  locale: SmallTalkLocale;
  topicId: string;
  title: string;
  description: string | null;
  items: SmallTalkItem[];
}

/** Dados pessoais: jamais importar em public/, src/ ou fazer bundle. */
export interface SmallTalkSegment {
  id: string;
  text: string;
  sourceParagraphIndex?: number;
}
export interface SmallTalkOriginalAnswer {
  id: string;
  source: string;
  segments: SmallTalkSegment[];
}
export interface SmallTalkAnswerRevision {
  id: string;
  basedOnAnswerId: string;
  status: 'draft' | 'approved' | 'rejected';
  source?: string;
  createdAt?: string;
  segments: SmallTalkSegment[];
  reviewNotes?: string;
}
export interface SmallTalkPersonalAnswer {
  itemId: string;
  locale: SmallTalkLocale;
  original: SmallTalkOriginalAnswer | null;
  revisions: SmallTalkAnswerRevision[];
  activeAnswerId: string | null;
  sourceLeadIn?: SmallTalkSegment[];
  sourceAnnotations?: SmallTalkSegment[];
  importReviewStatus: SmallTalkReviewStatus;
}
export interface SmallTalkPersonalAnswers {
  schemaVersion: '1.0.0';
  module: 'small-talk';
  dataType: 'personal-answers';
  locale: SmallTalkLocale;
  answersByItemId: Record<string, SmallTalkPersonalAnswer>;
}
export interface SmallTalkWalkingSettings {
  schemaVersion: '1.0.0';
  module: 'small-talk';
  mode: 'walking';
  repeatCount: number;
  /** false = resposta espontânea; true = original do DOCX, nunca revisão. */
  playDefaultAnswer: boolean;
  defaultAnswerSource: 'original';
  pauseAfterQuestionSeconds: number;
  pauseBetweenRepetitionsSeconds: number;
  repetitionUnit: 'full-answer' | 'segment';
  voice: SmallTalkVoice;
  shuffle: boolean;
  keepScreenAwake: boolean;
  selectedLevels: SmallTalkLevel[];
  selectedTopicIds: string[];
  favoritesOnly: boolean;
}
