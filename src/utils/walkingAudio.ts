import type { StudentLanguage } from "../config/languages";

const prompts: Record<StudentLanguage, string[]> = {
  "pt-BR": ["Repita comigo", "De novo", "Mais uma vez", "Última vez"],
  "en-US": ["Repeat with me", "Again", "One more time", "Last time"],
  "fr-FR": ["Répétez avec moi", "Encore une fois", "Une fois de plus", "Une dernière fois"],
  "es-ES": ["Repite conmigo", "Otra vez", "Una vez más", "Una última vez"]
};

export function repetitionText(text: string, language: StudentLanguage, index: number, count: number): string {
  if (index === 0) return text;
  const words = prompts[language];
  const prompt = index === count - 1 ? words[3] : words[Math.min(index - 1, 2)];
  return `${prompt}. ${text}`;
}

// One owner for speech and delays. Invalidate before cancel(), because browsers
// can synchronously dispatch events from the canceled utterance.
export class WalkingAudio {
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private utterance: SpeechSynthesisUtterance | null = null;

  cancel() {
    this.generation++;
    clearTimeout(this.timer);
    this.utterance = null;
    window.speechSynthesis?.cancel();
  }

  wait(ms: number, done: () => void) {
    this.cancel();
    const generation = this.generation;
    this.timer = setTimeout(() => { if (generation === this.generation) done(); }, ms);
  }

  play(text: string, language: StudentLanguage, rate: number, pauseMs: number,
    onSpoken: () => void, onDone: () => void, onError: () => void, strictVoice = false) {
    this.cancel();
    const generation = this.generation;
    if (!("speechSynthesis" in window)) { onError(); return; }
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    let settled = false;
    this.utterance = utterance;
    utterance.lang = language;
    utterance.rate = rate;
    const voices = synth.getVoices();
    utterance.voice = voices.find(v => v.lang.toLowerCase() === language.toLowerCase()) ??
      voices.find(v => v.lang.toLowerCase().startsWith(language.slice(0, 2))) ?? null;
    if (strictVoice && !utterance.voice) { onError(); return; }
    utterance.onend = () => {
      if (generation !== this.generation || settled) return;
      settled = true;
      this.utterance = null;
      onSpoken();
      if (generation !== this.generation) return;
      this.timer = setTimeout(() => {
        if (generation === this.generation) onDone();
      }, pauseMs);
    };
    utterance.onerror = () => {
      if (generation === this.generation && !settled) { settled = true; this.cancel(); onError(); }
    };
    try { synth.speak(this.utterance); } catch { this.cancel(); onError(); }
  }
}
