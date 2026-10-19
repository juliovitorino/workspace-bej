import { studyTracker } from "./studyTrackingService";
import { cancelNeuralExampleAudio } from "./neuralExampleAudio";

// Preserve existing player handlers and UI. Only real synthesis lifecycle events
// prove playback; queuing an utterance or clicking Play does not prove speech.
const tracked = new Map<SpeechSynthesisUtterance, string>();
let sequence = 0;
export function speakStudyAudio(utterance: SpeechSynthesisUtterance, neuralFallback = false) {
  if (!neuralFallback) cancelStudyAudio();
  const token = `speech-${++sequence}`;
  tracked.set(utterance, token);
  const start = utterance.onstart, pause = utterance.onpause, resume = utterance.onresume;
  const end = utterance.onend, error = utterance.onerror;
  const stop = () => {
    if (!tracked.has(utterance)) return;
    tracked.delete(utterance); studyTracker.media(token, false);
  };
  utterance.onstart = event => {
    if (event?.isTrusted !== false && tracked.has(utterance)) studyTracker.media(token, true);
    start?.call(utterance, event);
  };
  utterance.onpause = event => { if (event?.isTrusted !== false) studyTracker.media(token, false); pause?.call(utterance, event); };
  utterance.onresume = event => {
    if (event?.isTrusted !== false && tracked.has(utterance)) studyTracker.media(token, true, true);
    resume?.call(utterance, event);
  };
  utterance.onend = event => { if (event?.isTrusted !== false) stop(); end?.call(utterance, event); };
  utterance.onerror = event => { if (event?.isTrusted !== false) stop(); error?.call(utterance, event); };
  try { window.speechSynthesis.speak(utterance); }
  catch (failure) { stop(); throw failure; }
}
export function cancelStudyAudio() {
  cancelNeuralExampleAudio();
  const tokens = [...tracked.values()]; tracked.clear();
  for (const token of tokens) studyTracker.media(token, false);
  window.speechSynthesis?.cancel();
}
