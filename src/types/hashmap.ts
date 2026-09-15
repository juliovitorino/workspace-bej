export interface HashmapMetadata {
  name: string;
  version: string;
  updatedAt: string;
  language: string;
}

export interface Example {
  pt: string;
  en: string;
  ptIntent?: string;
  enIntent?: string;
}

export interface MentalIntention {
  id: string;
  intention: string;
  english: string;
  pattern?: string;
  description?: string;
  category?: string;
  englishLevel?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  searchTerms?: string[];
  examples?: Example[];
  tags?: string[];
  related?: string[];
}

export interface HashmapData {
  metadata: HashmapMetadata;
  mentalMap: MentalIntention[];
}
