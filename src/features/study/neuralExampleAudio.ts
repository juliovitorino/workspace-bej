import type { HashmapExampleV4 } from "../../types/hashmap";
import { studyTracker } from "./studyTrackingService";
import { cancelStudyAudio, speakStudyAudio } from "./studyAudio";

export type NeuralVoice = "cedar" | "marin";
export const DEFAULT_NEURAL_VOICE: NeuralVoice = "cedar";
export const STORAGE_TTS_VOICE_KEY = "bej.tts.voice";
let selectedVoice: NeuralVoice = DEFAULT_NEURAL_VOICE;
try {
  const saved = localStorage.getItem(STORAGE_TTS_VOICE_KEY);
  if (saved === "cedar" || saved === "marin") selectedVoice = saved;
} catch { /* Storage may be unavailable; keep the session preference. */ }
export const getNeuralVoice = () => selectedVoice;
const subscribers = new Set<() => void>();
export function subscribeNeuralVoice(listener: () => void) {
  subscribers.add(listener);
  return () => { subscribers.delete(listener); };
}
export function setNeuralVoice(voice: NeuralVoice) {
  if (voice !== "cedar" && voice !== "marin" || voice === selectedVoice) return;
  cancelStudyAudio();
  selectedVoice = voice;
  try { localStorage.setItem(STORAGE_TTS_VOICE_KEY, voice); } catch { /* Session still works. */ }
  subscribers.forEach(listener => listener());
}

interface PlayOptions {
  example: HashmapExampleV4;
  language: string;
  voice?: NeuralVoice;
  onLoading?: () => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
}
let audio: HTMLAudioElement | null = null;
/** Somente leitura: fornece o relógio real do MP3 para o avatar. */
export function getActiveNeuralAudio(): HTMLAudioElement | null { return audio; }
let generation = 0;
let token: string | null = null;
let onCancel: (() => void) | undefined;

function releaseAudio() {
  if (audio) {
    audio.onplaying = audio.onended = audio.onerror = null;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    audio = null;
  }
  if (token) { studyTracker.media(token, false); token = null; }
}
export function cancelNeuralExampleAudio(): void {
  generation++;
  releaseAudio();
  const notify = onCancel;
  onCancel = undefined;
  notify?.();
}

/** Play only this locale's registered local URL; missing/failed files use browser speech. */
export async function playNeuralExampleAudio({ example, language, voice = getNeuralVoice(),
  onLoading, onStart, onEnd, onError }: PlayOptions): Promise<void> {
  cancelStudyAudio();
  const request = generation;
  onCancel = onEnd;
  const active = () => request === generation;
  const finish = (error = false) => {
    if (!active()) return;
    generation++;
    onCancel = undefined;
    releaseAudio();
    if (error) onError?.(); else onEnd?.();
  };
  const text = example.exampleItem;
  if (!text.trim()) { finish(true); return; }
  onLoading?.();
  const fallback = () => {
    if (!active()) return;
    releaseAudio();
    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") { finish(true); return; }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.rate = 0.9;
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find(v => v.lang.toLowerCase() === language.toLowerCase()) ??
      voices.find(v => v.lang.toLowerCase().split("-")[0] === language.toLowerCase().split("-")[0]) ?? null;
    utterance.onstart = () => { if (active()) onStart?.(); };
    utterance.onend = () => finish();
    utterance.onerror = () => finish(true);
    try { speakStudyAudio(utterance, true); } catch { finish(true); }
  };
  const url = example.mp3?.[voice];
  // Accept registered filenames without deriving one from the example UUID.
  if (language !== "en-US" || typeof url !== "string" ||
      !/^\/audio\/en-US\/(cedar|marin)\/[a-zA-Z0-9_-]+\.mp3$/.test(url)) { fallback(); return; }
  try {
    audio = new Audio(url);
    const current = audio;
    let failed = false;
    token = `neural-${request}`;
    const fail = () => {
      if (!active() || failed) return;
      failed = true;
      fallback();
    };
    current.onplaying = () => {
      if (!active() || failed) return;
      if (token) studyTracker.media(token, true);
      onStart?.();
    };
    current.onended = () => finish();
    current.onerror = fail;
    void current.play().catch(fail);
  } catch { fallback(); }
}
