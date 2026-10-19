import { useEffect, useRef, useState } from "react";
import type { HashmapExampleV4 } from "../../types/hashmap";
import { cancelStudyAudio } from "./studyAudio";
import { playNeuralExampleAudio } from "./neuralExampleAudio";

export function useExampleAudio() {
  const [playback, setPlayback] = useState<{ id: string; state: "loading" | "playing" | "error" } | null>(null);
  const current = useRef(playback);
  const mounted = useRef(true);
  const update = (value: typeof playback) => { current.current = value; if (mounted.current) setPlayback(value); };
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; cancelStudyAudio(); };
  }, []);
  function play(example: HashmapExampleV4, language: string, onError?: () => void) {
    if (current.current?.id === example.id) {
      if (current.current.state === "loading") return;
      if (current.current.state === "playing") { cancelStudyAudio(); return; }
    }
    void playNeuralExampleAudio({ example, language,
      onLoading: () => update({ id: example.id, state: "loading" }),
      onStart: () => update({ id: example.id, state: "playing" }),
      onEnd: () => update(null),
      onError: () => { update({ id: example.id, state: "error" }); onError?.(); }
    });
  }
  return { playback, play };
}
