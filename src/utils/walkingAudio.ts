import { speakStudyAudio, cancelStudyAudio } from "../features/study/studyAudio";
import { studyTracker } from "../features/study/studyTrackingService";
import type { StudentLanguage } from "../config/languages";
import type { HashmapExampleV4 } from "../types/hashmap";
import type { NeuralVoice } from "../features/study/neuralExampleAudio";

/** Localiza o MP3 do exemplo. Para Cedar, o nome é <id>-cedar.mp3. */
export function resolveWalkingMp3Url(
  example: Pick<HashmapExampleV4, "id" | "mp3" | "exampleItem"> | undefined,
  voice: NeuralVoice
): string | undefined {
  if (!example?.exampleItem.trim()) return undefined;
  const registered = example.mp3?.[voice];
  if (typeof registered === "string" &&
      /^\/audio\/en-US\/(cedar|marin)\/[a-zA-Z0-9_-]+\.mp3$/.test(registered) &&
      registered.includes(`/en-US/${voice}/`)) return registered;

  // Todos os exemplos en-US têm o arquivo Cedar por ID no repositório.
  // Não supor arquivos Marin sem referência explícita no JSON.
  if (voice !== "cedar" || !/^[a-zA-Z0-9_-]+$/.test(example.id)) return undefined;
  return `/audio/en-US/cedar/${example.id}-cedar.mp3`;
}

const prompts: Record<StudentLanguage, string[]> = {
  "pt-BR": ["Repita comigo", "De novo", "Mais uma vez", "Última vez"],
  "en-US": ["Repeat with me", "Again", "One more time", "Last time"],
  "fr-FR": ["Répétez avec moi", "Encore une fois", "Une fois de plus", "Une dernière fois"],
  "es-ES": ["Repite conmigo", "Otra vez", "Una vez más", "Una última vez"]
};

export function repetitionText(text: string, language: StudentLanguage, index: number, count: number): string {
  if (index === 0) return text;
  const prompt = index === count - 1 ? prompts[language][3] : prompts[language][Math.min(index - 1, 2)];
  return `${prompt}. ${text}`;
}

/** Controls a single walking audio sequence, without interfering with the next chunk. */
export class WalkingAudio {
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private media: HTMLAudioElement | null = null;
  private mediaToken: string | null = null;

  cancel() {
    this.generation++;
    clearTimeout(this.timer);
    this.timer = undefined;
    if (this.media) {
      this.media.onplaying = this.media.onended = this.media.onerror = null;
      this.media.pause();
      this.media.removeAttribute("src");
      this.media = null;
    }
    if (this.mediaToken) {
      studyTracker.media(this.mediaToken, false);
      this.mediaToken = null;
    }
    cancelStudyAudio();
  }

  wait(ms: number, done: () => void) {
    this.cancel();
    const request = this.generation;
    this.timer = setTimeout(() => {
      if (request === this.generation) done();
    }, ms);
  }

  /** The prompt is spoken separately; the local MP3 contains the original chunk only. */
  playChunk(text: string, language: StudentLanguage, rate: number, pauseMs: number,
    mp3Url: string | undefined, index: number, count: number,
    onSpoken: () => void, onDone: () => void, onError: () => void, onStart?: () => void,
    promptLanguage: StudentLanguage = language) {
    const validMp3 = language === "en-US" && typeof mp3Url === "string" &&
      /^\/audio\/en-US\/(cedar|marin)\/[a-zA-Z0-9_-]+\.mp3$/.test(mp3Url);
    if (!validMp3) {
      this.play(repetitionText(text, language, index, count), language, rate,
        pauseMs, onSpoken, onDone, onError, false, onStart);
      return;
    }

    this.cancel();
    const request = this.generation;
    const active = () => request === this.generation;
    let started = false;
    const startedOnce = () => {
      if (active() && !started) {
        started = true;
        onStart?.();
      }
    };
    const playFile = () => {
      if (!active()) return;
      let media: HTMLAudioElement;
      try {
        media = new Audio(mp3Url);
      } catch {
        fallback();
        return;
      }
      this.media = media;
      media.playbackRate = rate;
      const token = `walking-mp3-${request}-${Date.now()}`;
      this.mediaToken = token;
      media.onplaying = () => {
        if (!active()) return;
        studyTracker.media(token, true);
        startedOnce();
      };
      media.onended = () => {
        if (!active()) return;
        if (this.mediaToken === token) {
          studyTracker.media(token, false);
          this.mediaToken = null;
        }
        this.media = null;
        onSpoken();
        if (!active()) return;
        this.timer = setTimeout(() => { if (active()) onDone(); }, pauseMs);
      };
      media.onerror = fallback;
      void media.play().catch(fallback);
    };
    const fallback = () => {
      if (!active()) return;
      // Invalid/missing MP3 must not break automatic advancement.
      this.play(repetitionText(text, language, index, count), language, rate,
        pauseMs, onSpoken, onDone, onError, false, startedOnce);
    };

    // O MP3 neural continua responsável exclusivamente pela frase do exemplo.
    // Os comandos da sequência são falados separadamente, antes do MP3.
    if (index === 0) {
      playFile();
      return;
    }

    const words = prompts[promptLanguage];
    const prompt = index === count - 1 ? words[3] : words[Math.min(index - 1, 2)];
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      playFile();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(prompt);
    utterance.lang = promptLanguage;
    utterance.rate = rate;
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find(v => v.lang.toLowerCase() === promptLanguage.toLowerCase()) ??
      voices.find(v => v.lang.toLowerCase().startsWith(promptLanguage.slice(0, 2).toLowerCase())) ?? null;
    let finishedPrompt = false;
    const continueWithMp3 = () => {
      if (!active() || finishedPrompt) return;
      finishedPrompt = true;
      playFile();
    };
    utterance.onend = continueWithMp3;
    utterance.onerror = continueWithMp3;
    try {
      // Cancela qualquer áudio anterior antes de iniciar o comando, não durante o MP3.
      speakStudyAudio(utterance);
    } catch {
      continueWithMp3();
    }
  }

  play(text: string, language: StudentLanguage, rate: number, pauseMs: number,
    onSpoken: () => void, onDone: () => void, onError: () => void,
    strictVoice = false, onStart?: () => void) {
    this.cancel();
    const request = this.generation;
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      onError();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.rate = rate;
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find(v => v.lang.toLowerCase() === language.toLowerCase()) ??
      voices.find(v => v.lang.toLowerCase().startsWith(language.slice(0, 2))) ?? null;
    if (strictVoice && !utterance.voice) { onError(); return; }
    let settled = false;
    utterance.onstart = () => {
      if (request === this.generation) onStart?.();
    };
    utterance.onend = () => {
      if (request !== this.generation || settled) return;
      settled = true;
      onSpoken();
      if (request !== this.generation) return;
      this.timer = setTimeout(() => {
        if (request === this.generation) onDone();
      }, pauseMs);
    };
    utterance.onerror = () => {
      if (request !== this.generation || settled) return;
      settled = true;
      onError();
    };
    try { speakStudyAudio(utterance, true); }
    catch { if (!settled && request === this.generation) { settled = true; onError(); } }
  }
}
