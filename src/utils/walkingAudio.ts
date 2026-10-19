import { speakStudyAudio, cancelStudyAudio } from "../features/study/studyAudio";
import { studyTracker } from "../features/study/studyTrackingService";
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

// Shared owner of speech, local MP3 playback and repetition delays.
export class WalkingAudio {
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private utterance: SpeechSynthesisUtterance | null = null;
  private media: HTMLAudioElement | null = null;
  private mediaToken: string | null = null;

  cancel() {
    this.generation++;
    clearTimeout(this.timer);
    this.utterance = null;
    if (this.media) {
      this.media.onplaying = this.media.onended = this.media.onerror = null;
      this.media.pause();
      this.media.removeAttribute("src");
      this.media = null;
    }
    if (this.mediaToken) { studyTracker.media(this.mediaToken, false); this.mediaToken = null; }
    cancelStudyAudio();
  }

  wait(ms: number, done: () => void) {
    this.cancel();
    const generation = this.generation;
    this.timer = setTimeout(() => { if (generation === this.generation) done(); }, ms);
  }

  /** MP3 for the chunk only; prompts remain independent browser utterances. */
  playChunk(text: string, language: StudentLanguage, rate: number, pauseMs: number,
    mp3Url: string | undefined, index: number, count: number,
    onSpoken: () => void, onDone: () => void, onError: () => void, onStart?: () => void) {
    if (!mp3Url || language !== "en-US" ||
        !/^\/audio\/en-US\/(cedar|marin)\/[a-zA-Z0-9_-]+\.mp3$/.test(mp3Url)) {
      this.play(repetitionText(text, language, index, count), language, rate, pauseMs,
        onSpoken, onDone, onError, false, onStart);
      return;
    }
    this.cancel();
    const generation = this.generation;
    let started = false;
    const start = () => { if (!started && generation === this.generation) { started = true; onStart?.(); } };
    const finish = () => {
      if (generation !== this.generation) return;
      if (this.mediaToken) { studyTracker.media(this.mediaToken, false); this.mediaToken = null; }
      this.media = null;
      onSpoken();
      if (generation !== this.generation) return;
      this.timer = setTimeout(() => { if (generation === this.generation) onDone(); }, pauseMs);
    };
    const playFile = () => {
      if (generation !== this.generation) return;
      const media = new Audio(mp3Url);
      this.media = media;
      media.playbackRate = rate;
      const token = `walking-mp3-${generation}-${Date.now()}`;
      this.mediaToken = token;
      let failed = false;
      const fallback = () => {
        if (generation !== this.generation || failed) return;
        failed = true;
        // Missing/broken MP3 must never stop the walking session.
        this.play(text, language, rate, pauseMs, onSpoken, onDone, onError, false, start);
      };
      media.onplaying = () => {
        if (generation !== this.generation) return;
        studyTracker.media(token, true);
        start();
      };
      media.onended = finish;
      media.onerror = fallback;
      void media.play().catch(fallback);
    };
    if (index === 0) { playFile(); return; }
    const prompt = index === count - 1 ? prompts[language][3] : prompts[language][Math.min(index - 1, 2)];
    if (!("speechSynthesis" in window)) { playFile(); return; }
    const utterance = new SpeechSynthesisUtterance(prompt);
    utterance.lang = language;
    utterance.rate = rate;
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find(v => v.lang.toLowerCase() === language.toLowerCase()) ??
      voices.find(v => v.lang.toLowerCase().startsWith(language.slice(0, 2))) ?? null;
    this.utterance = utterance;
    utterance.onstart = start;
    utterance.onend = () => { if (generation === this.generation) { this.utterance = null; playFile(); } };
    utterance.onerror = () => { if (generation === this.generation) { this.utterance = null; playFile(); } };
    try { speakStudyAudio(utterance); } catch { if (generation === this.generation) playFile(); }
  }

  play(text: string, language: StudentLanguage, rate: number, pauseMs: number,
    onSpoken: () => void, onDone: () => void, onError: () => void, strictVoice = false, onStart?: () => void) {
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
    utterance.onstart = () => { if (generation === this.generation) onStart?.(); };
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
    try { speakStudyAudio(this.utterance); } catch { this.cancel(); onError(); }
  }
}
