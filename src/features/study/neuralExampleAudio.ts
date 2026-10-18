import type { Example } from "../../types/hashmap";
import { studyTracker } from "./studyTrackingService";
import { cancelStudyAudio, speakStudyAudio } from "./studyAudio";

export type NeuralVoice = "cedar" | "marin";
export const DEFAULT_NEURAL_VOICE: NeuralVoice = "cedar";

interface PlayOptions {
  example: Example;
  language: string;
  voice?: NeuralVoice;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
}

let currentAudio: HTMLAudioElement | null = null;
let currentToken: string | null = null;
let generation = 0;
let nextToken = 0;

export function cancelNeuralExampleAudio(): void {
  generation++;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.removeAttribute("src");
    currentAudio.load();
    currentAudio = null;
  }
  if (currentToken) {
    studyTracker.media(currentToken, false);
    currentToken = null;
  }
}

/** SHA-256 via Web Crypto, available in HTTPS and localhost contexts. */
async function sha256(text: string): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function safeAudioPath(path: unknown, language: string, voice: NeuralVoice, id: string): path is string {
  return typeof path === "string" &&
    path === `/audio/${language}/${voice}/${id}-${voice}.mp3`;
}

/**
 * Uses the recording when its path is trusted and the example text hash matches.
 * On HTTP without Web Crypto, the recorded file is allowed by its strict local path;
 * SHA-256 verification is skipped only because the browser API is unavailable.
 *
 * Note: secure/integrity-sensitive deployments should serve the app over HTTPS.
 */
export async function playNeuralExampleAudio({
  example, language, voice = DEFAULT_NEURAL_VOICE, onStart, onEnd, onError
}: PlayOptions): Promise<void> {
  cancelNeuralExampleAudio();
  cancelStudyAudio();
  const request = generation;
  const text = example.exampleItem;
  if (!text.trim()) { onError?.(); return; }

  const fallback = () => {
    if (request !== generation) return;
    if (!( "speechSynthesis" in window)) { onError?.(); return; }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.rate = 0.9;
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find(v => v.lang.toLowerCase() === language.toLowerCase()) ??
      voices.find(v => v.lang.toLowerCase().startsWith(language.slice(0, 2).toLowerCase())) ?? null;
    utterance.onstart = () => { if (request === generation) onStart?.(); };
    utterance.onend = () => { if (request === generation) onEnd?.(); };
    utterance.onerror = event => {
      if (request === generation && event.error !== "canceled" && event.error !== "interrupted") onError?.();
    };
    try { speakStudyAudio(utterance); } catch { onError?.(); }
  };

  if (language !== "en-US") { fallback(); return; }
  let hash: string | null = null;
  try { hash = await sha256(text); } catch { /* Web Crypto may be blocked on HTTP. */ }
  if (request !== generation) return;

  const order: NeuralVoice[] = voice === "marin" ? ["marin", "cedar"] : ["cedar"];
  const urls = order.flatMap(candidate => {
    const url = example.mp3?.[candidate];
    const recordedHash = example.hashmp3?.[candidate];
    const matchesHash = hash === null || recordedHash === hash;
    return safeAudioPath(url, language, candidate, example.id) &&
      typeof recordedHash === "string" && /^[a-f0-9]{64}$/i.test(recordedHash) &&
      matchesHash ? [url] : [];
  });
  const tryNext = (index: number) => {
    if (request !== generation) return;
    if (index >= urls.length) { fallback(); return; }
    const audio = new Audio(urls[index]);
    currentAudio = audio;
    let started = false;
    let failed = false;
    const token = `neural-${++nextToken}`;
    const clear = () => {
      if (currentAudio === audio) currentAudio = null;
      if (currentToken === token) { studyTracker.media(token, false); currentToken = null; }
    };
    audio.onplaying = () => {
      if (request !== generation) return;
      if (!started) { started = true; currentToken = token; studyTracker.media(token, true); onStart?.(); }
    };
    audio.onended = () => { if (request !== generation) return; clear(); onEnd?.(); };
    audio.onerror = () => {
      if (request !== generation || failed) return;
      failed = true;
      clear();
      if (started) onError?.(); else tryNext(index + 1);
    };
    void audio.play().catch(() => {
      if (request !== generation || failed) return;
      failed = true;
      clear();
      if (started) onError?.(); else tryNext(index + 1);
    });
  };
  tryNext(0);
}
