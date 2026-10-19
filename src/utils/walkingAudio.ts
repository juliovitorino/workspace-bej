import { speakStudyAudio, cancelStudyAudio } from "../features/study/studyAudio";
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

// Um único controlador para a fala e as pausas entre repetições.
// A geração invalida callbacks atrasados de áudios cancelados.
export class WalkingAudio {
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private watchdog: ReturnType<typeof setTimeout> | undefined;
  private utterance: SpeechSynthesisUtterance | null = null;

  cancel() {
    this.generation++;
    clearTimeout(this.timer);
    clearTimeout(this.watchdog);
    this.timer = undefined;
    this.watchdog = undefined;
    this.utterance = null;
    cancelStudyAudio();
  }

  wait(ms: number, done: () => void) {
    this.cancel();
    const generation = this.generation;
    this.timer = setTimeout(() => { if (generation === this.generation) done(); }, ms);
  }

  play(text: string, language: StudentLanguage, rate: number, pauseMs: number,
    onSpoken: () => void, onDone: () => void, onError: () => void, strictVoice = false, onStart?: () => void) {
    this.cancel();
    const generation = this.generation;
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      onError();
      return;
    }
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    let settled = false;
    let started = false;
    let startedAt = 0;
    this.utterance = utterance; // Impede GC prematuro da fala em alguns navegadores.
    utterance.lang = language;
    utterance.rate = rate;
    const voices = synth.getVoices();
    utterance.voice = voices.find(v => v.lang.toLowerCase() === language.toLowerCase()) ??
      voices.find(v => v.lang.toLowerCase().startsWith(language.slice(0, 2))) ?? null;
    if (strictVoice && !utterance.voice) { onError(); return; }

    const finish = () => {
      if (generation !== this.generation || settled) return;
      settled = true;
      clearTimeout(this.watchdog);
      this.watchdog = undefined;
      this.utterance = null;
      onSpoken();
      if (generation !== this.generation) return;
      this.timer = setTimeout(() => {
        if (generation === this.generation) onDone();
      }, pauseMs);
    };
    const fail = () => {
      if (generation !== this.generation || settled) return;
      settled = true;
      this.cancel();
      onError();
    };

    // Alguns navegadores móveis não emitem onend. A recuperação só considera
    // uma fala iniciada; enquanto speechSynthesis.speaking for true, espera.
    // Não avança silenciosamente se a voz sequer começou a reproduzir.
    const watchdog = () => {
      if (generation !== this.generation || settled) return;
      if (!started) {
        console.warn("[BEJ Walking] O sintetizador não iniciou a fala.");
        fail();
        return;
      }
      const elapsed = Date.now() - startedAt;
      if (synth.speaking && elapsed < 45000) {
        this.watchdog = setTimeout(watchdog, 1000);
        return;
      }
      if (synth.speaking) {
        console.warn("[BEJ Walking] Sintetizador travado; interrompendo fala.");
        synth.cancel();
      } else {
        console.warn("[BEJ Walking] Fala concluída sem evento onend; avançando.");
      }
      finish();
    };

    utterance.onstart = () => {
      if (generation !== this.generation || settled) return;
      started = true;
      startedAt = Date.now();
      clearTimeout(this.watchdog);
      // Prazo inicial conservador; o watchdog nunca interrompe fala ativa
      // antes de 45 segundos.
      const estimatedMs = Math.max(5000, Math.ceil(text.length * 100 / Math.max(rate, 0.5)));
      this.watchdog = setTimeout(watchdog, estimatedMs);
      onStart?.();
    };
    utterance.onend = finish;
    utterance.onerror = fail;
    try {
      this.watchdog = setTimeout(watchdog, 12000);
      speakStudyAudio(utterance);
      synth.resume();
    } catch {
      fail();
    }
  }
}
