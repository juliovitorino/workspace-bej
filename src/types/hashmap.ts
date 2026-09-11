export interface HashmapMetadata {
  name: string;
  version: string;
  updatedAt: string;
  language: string;
}

export interface Example {
  pt: string;
  en: string;
}

export interface MentalIntention {
  id: string;
  intention: string;
  english: string;
  pattern?: string;
  description?: string;
  category?: string;
  searchTerms?: string[];
  examples?: Example[];
  tags?: string[];
  related?: string[];
}

export interface HashmapData {
  metadata: HashmapMetadata;
  mentalMap: MentalIntention[];
}
