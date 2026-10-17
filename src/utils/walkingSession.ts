export interface WalkingSummary {
  completed: number;
  total: number;
  phrases: number;
  seconds: number;
}

// Completion callbacks may be delivered more than once by a speech engine.
export class WalkingSession {
  private tokens = new Set<number>();
  private chunks = new Set<string>();
  private phrases = 0;

  record(token: number, chunkId: string, lastRepetition: boolean) {
    if (this.tokens.has(token)) return;
    this.tokens.add(token);
    this.phrases++;
    if (lastRepetition) this.chunks.add(chunkId);
  }

  summary(total: number, seconds: number): WalkingSummary {
    return { completed: this.chunks.size, total, phrases: this.phrases, seconds };
  }
}
