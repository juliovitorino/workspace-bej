import { useSyncExternalStore } from "react";
import { getNeuralVoice, setNeuralVoice, subscribeNeuralVoice, type NeuralVoice } from "../features/study/neuralExampleAudio";

export function NeuralVoiceSelect() {
  const voice = useSyncExternalStore(subscribeNeuralVoice, getNeuralVoice, getNeuralVoice);
  return <label className="neural-voice-select"><span>Cedar / Marin</span>{" "}
    <select aria-label="Cedar / Marin" value={voice} onChange={event => setNeuralVoice(event.target.value as NeuralVoice)}>
      <option value="cedar">Cedar</option><option value="marin">Marin</option>
    </select>
  </label>;
}
