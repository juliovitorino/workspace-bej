import { speakStudyAudio, cancelStudyAudio } from "../features/study/studyAudio";
import type { StudentLanguage } from "../config/languages";
import type { HashmapExampleV4 } from "../types/hashmap";
import { studyTracker } from "../features/study/studyTrackingService";

const prompts: Record<StudentLanguage, string[]> = {
  "pt-BR": ["Repita comigo", "De novo", "Mais uma vez", "Última vez"],
  "en-US": ["Repeat with me", "Again", "One more time", "Last time"],
  "fr-FR": ["Répétez avec moi", "Encore une fois", "Une fois de plus", "Une dernière fois"],
  "es-ES": ["Repite conmigo", "Otra vez", "Una vez más", "Una última vez"]
};

// Tempo para o iOS liberar a atenuação do áudio após o TTS do prompt.
const PROMPT_TO_CEDAR_DELAY_MS = 1300;

export function repetitionPrompt(language: StudentLanguage, index: number, count: number): string | null {
  if (index === 0) return null;
  const words = prompts[language];
  return index === count - 1 ? words[3] : words[Math.min(index - 1, 2)];
}

export function repetitionText(text: string, language: StudentLanguage, index: number, count: number): string {
  const prompt = repetitionPrompt(language, index, count);
  return prompt ? `${prompt}. ${text}` : text;
}

// One owner for speech and delays. Invalidate before cancel(), because browsers
// can synchronously dispatch events from the canceled utterance.
export class WalkingAudio {
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private utterance: SpeechSynthesisUtterance | null = null;
  private media: HTMLAudioElement | null = null;
  private mediaToken: string | null = null;
  private watchdog: ReturnType<typeof setTimeout> | undefined;

  cancel() {
    this.generation++;
    clearTimeout(this.timer);
    clearTimeout(this.watchdog);
    this.utterance = null;
    if (this.media) {
      this.media.onplaying = this.media.onended = this.media.onerror = null;
      this.media.pause();
      // Reutilizar o mesmo HTMLAudioElement é importante no celular:
      // um elemento novo em cada repetição pode perder a autorização de play.
      // O src é preservado e será reposicionado no início do próximo exemplo.
    }
    if (this.mediaToken) {
      studyTracker.media(this.mediaToken, false);
      this.mediaToken = null;
    }
    cancelStudyAudio();
  }

  wait(ms: number, done: () => void) {
    this.cancel();
    const generation = this.generation;
    this.timer = setTimeout(() => { if (generation === this.generation) done(); }, ms);
  }

  /**
   * Reproduz o prompt com TTS e a frase com o MP3 Cedar registrado no JSON.
   * Um único HTMLAudioElement é reutilizado para toda a caminhada.
   * Não trocar silenciosamente um Cedar válido por voz sintética quando
   * a reprodução falhar: isso mascararia erros de autoplay/rede no celular.
   */
  playExample(example: HashmapExampleV4, language: StudentLanguage, prompt: string | null,
    rate: number, pauseMs: number,
    onSpoken: () => void, onDone: () => void, onError: () => void, onStart?: () => void) {
    this.cancel();
    let generation = this.generation;
    let started = false;
    const markStart = () => {
      if (generation !== this.generation || started) return;
      started = true;
      onStart?.();
    };
    const startExample = () => {
      if (generation !== this.generation) return;
      const url = example.mp3?.cedar;
      if (language !== "en-US" || typeof url !== "string" ||
          !/^\/audio\/en-US\/cedar\/[a-zA-Z0-9_-]+\.mp3$/.test(url)) {
        // Só usar TTS se o catálogo realmente não possuir um Cedar válido.
        this.play(example.exampleItem, language, rate, pauseMs, onSpoken, onDone, onError, false, markStart);
        generation = this.generation;
        return;
      }

      const player = this.media ?? new Audio();
      this.media = player;
      player.preload = "auto";
      const mediaToken = `walking-cedar-${generation}`;
      this.mediaToken = mediaToken;
      let finished = false;
      const cleanup = () => {
        clearTimeout(this.watchdog);
        player.onplaying = player.onended = player.onerror = null;
        if (this.mediaToken === mediaToken) {
          studyTracker.media(mediaToken, false);
          this.mediaToken = null;
        }
      };
      const finish = () => {
        if (finished || generation !== this.generation) return;
        finished = true;
        cleanup();
        onSpoken();
        if (generation !== this.generation) return;
        this.timer = setTimeout(() => {
          if (generation === this.generation) onDone();
        }, pauseMs);
      };
      const fail = () => {
        if (finished || generation !== this.generation) return;
        finished = true;
        cleanup();
        player.pause();
        onError();
      };

      // Preservar o mesmo elemento, trocando a URL somente ao mudar de exemplo.
      if (player.getAttribute("src") !== url) player.src = url;
      try { player.currentTime = 0; } catch { /* metadata ainda indisponível */ }
      player.onplaying = () => {
        if (generation !== this.generation || finished) return;
        studyTracker.media(mediaToken, true);
        markStart();
        clearTimeout(this.watchdog);
        const durationMs = Number.isFinite(player.duration) && player.duration > 0
          ? player.duration * 1000 : 60000;
        this.watchdog = setTimeout(() => {
          if (generation !== this.generation || finished) return;
          if (player.ended || (Number.isFinite(player.duration) &&
              player.duration > 0 && player.currentTime >= player.duration - 0.15)) finish();
          else fail();
        }, durationMs + 5000);
      };
      player.onended = finish;
      player.onerror = fail;
      // Safari/iOS pode deixar o áudio de mídia atenuado após speechSynthesis.
      // Solicitar sessão de reprodução antes de retomar o MP3, se disponível.
      try {
        const audioSession = (navigator as Navigator & {
          audioSession?: { type: string };
        }).audioSession;
        if (audioSession && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
          audioSession.type = "playback";
        }
      } catch { /* API indisponível ou bloqueada: manter reprodução original */ }
      // O mesmo player que iniciou a sessão é reutilizado após cada prompt.
      void player.play().catch(fail);
    };
    if (!prompt) {
      startExample();
      return;
    }
    // O prompt é sintetizado isoladamente. Somente depois começa o Cedar.
    // Aguardar após o evento onend do prompt (não após seu início),
    // para o iOS restaurar o volume da mídia antes do Cedar.
    this.play(prompt, language, rate, PROMPT_TO_CEDAR_DELAY_MS, () => {}, startExample, onError, false, markStart);
    generation = this.generation;
  }

  /** Play a registered story paragraph with the same mobile-safe media element. */
  playStoryMp3(url: string, rate: number, onDone: () => void, onError: () => void) {
    this.cancel();
    const generation = this.generation;
    const player = this.media ?? new Audio();
    this.media = player;
    player.preload = "auto";
    player.playbackRate = rate;
    player.preservesPitch = true;
    const token = `story-neural-${generation}`;
    this.mediaToken = token;
    let settled = false;
    const cleanup = () => {
      clearTimeout(this.watchdog);
      player.onplaying = player.onended = player.onerror = null;
      if (this.mediaToken === token) {
        studyTracker.media(token, false);
        this.mediaToken = null;
      }
    };
    const fail = () => {
      if (settled || generation !== this.generation) return;
      settled = true; cleanup(); player.pause(); onError();
    };
    const finish = () => {
      if (settled || generation !== this.generation) return;
      settled = true; cleanup(); onDone();
    };
    if (player.getAttribute("src") !== url) player.src = url;
    try { player.currentTime = 0; } catch { /* Metadata may not be ready. */ }
    player.onplaying = () => {
      if (settled || generation !== this.generation) return;
      studyTracker.media(token, true);
      clearTimeout(this.watchdog);
      const duration = Number.isFinite(player.duration) && player.duration > 0 ? player.duration * 1000 / rate : 60000;
      this.watchdog = setTimeout(() => {
        if (player.ended || (Number.isFinite(player.duration) && player.currentTime >= player.duration - .15)) finish();
        else fail();
      }, duration + 5000);
    };
    player.onended = finish;
    player.onerror = fail;
    try {
      const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
      if (session && /iPhone|iPad|iPod/i.test(navigator.userAgent)) session.type = "playback";
    } catch { /* Unsupported on this browser. */ }
    void player.play().catch(fail);
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
