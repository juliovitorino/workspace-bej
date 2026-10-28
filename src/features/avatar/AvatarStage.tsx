import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import * as THREE from "three";
import type { HashmapExampleV4 } from "../../types/hashmap";
import {
  DEFAULT_NEURAL_VOICE,
  getNeuralVoice,
  subscribeNeuralVoice,
  getActiveNeuralAudio
} from "../study/neuralExampleAudio";
import "./avatar.css";

interface AvatarStageProps {
  example: HashmapExampleV4 | null;
  isPlaying: boolean;
}

/**
 * MVP: personagens 3D procedurais (sem arquivos GLB).
 * A abertura da boca acompanha a energia do MP3 registrado no JSON.
 * Não é viseme/phoneme-level lip sync; para TTS do navegador há animação aproximada.
 */
export function AvatarStage({ example, isPlaying }: AvatarStageProps) {
  const voice = useSyncExternalStore(subscribeNeuralVoice, getNeuralVoice, () => DEFAULT_NEURAL_VOICE);
  const mountRef = useRef<HTMLDivElement>(null);
  const playingRef = useRef(isPlaying);
  const envelopeRef = useRef<Float32Array | null>(null);
  const [renderError, setRenderError] = useState(false);
  playingRef.current = isPlaying;

  const mp3Url = example?.mp3?.[voice];
  useEffect(() => {
    envelopeRef.current = null;
    if (!isPlaying || !mp3Url || !/^\/audio\/en-US\/(cedar|marin)\/[a-zA-Z0-9_-]+\.mp3$/.test(mp3Url)) return;
    if (typeof AudioContext === "undefined") return;

    const abort = new AbortController();
    let cancelled = false;
    let ctx: AudioContext | undefined;
    void (async () => {
      try {
        const response = await fetch(mp3Url, { signal: abort.signal });
        if (!response.ok) return;
        const bytes = await response.arrayBuffer();
        if (cancelled) return;
        ctx = new AudioContext();
        const decoded = await ctx.decodeAudioData(bytes);
        if (cancelled) return;
        const samples = decoded.getChannelData(0);
        const framesPerSecond = 40;
        const step = Math.max(1, Math.round(decoded.sampleRate / framesPerSecond));
        const envelope = new Float32Array(Math.ceil(samples.length / step));
        for (let i = 0; i < envelope.length; i++) {
          const from = i * step;
          const to = Math.min(samples.length, from + step);
          let sum = 0;
          for (let j = from; j < to; j += 3) sum += samples[j] * samples[j];
          envelope[i] = Math.sqrt(sum / Math.max(1, Math.ceil((to - from) / 3)));
        }
        // Normaliza em função do pico, sem ampliar silêncios.
        let peak = 0;
        for (const value of envelope) peak = Math.max(peak, value);
        if (peak > 0) for (let i = 0; i < envelope.length; i++) envelope[i] /= peak;
        envelopeRef.current = envelope;
      } catch {
        // Fallback: boca animada enquanto a reprodução estiver ativa.
      } finally {
        await ctx?.close().catch(() => undefined);
      }
    })();
    return () => { cancelled = true; abort.abort(); envelopeRef.current = null; };
  }, [mp3Url, isPlaying]);

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;
    setRenderError(false);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      setRenderError(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 30);
    camera.position.set(0, 0.45, 8.6);
    camera.lookAt(0, 0.12, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa8c4, 2.1));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
    keyLight.position.set(-3, 5, 6);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xb6dfff, 1.1);
    fillLight.position.set(4, 1, 2);
    scene.add(fillLight);

    const body = new THREE.Group();
    scene.add(body);
    const isCedar = voice === "cedar";
    const skin = new THREE.MeshStandardMaterial({ color: isCedar ? 0xc88963 : 0xe4a783, roughness: 0.85 });
    const hair = new THREE.MeshStandardMaterial({ color: isCedar ? 0x2b2525 : 0x4c3029, roughness: 0.95 });
    const shirt = new THREE.MeshStandardMaterial({ color: isCedar ? 0x1c5d92 : 0xe8aa32, roughness: 0.85 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x261a20, roughness: 0.85 });
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
    const iris = new THREE.MeshStandardMaterial({ color: isCedar ? 0x4c3428 : 0x386b72, roughness: 0.7 });
    const lip = new THREE.MeshStandardMaterial({ color: 0x7b3440, roughness: 0.9 });

    function ellipsoid(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), material);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      parent.add(mesh);
      return mesh;
    }

    // Meio corpo: tronco, ombros e pescoço.
    ellipsoid(body, shirt, 0, -1.55, 0, 1.34, 1.15, 0.70);
    ellipsoid(body, shirt, -1.12, -1.38, 0, 0.46, 0.72, 0.53);
    ellipsoid(body, shirt, 1.12, -1.38, 0, 0.46, 0.72, 0.53);
    ellipsoid(body, skin, 0, -0.65, 0, 0.33, 0.52, 0.33);
    const head = new THREE.Group();
    body.add(head);
    ellipsoid(head, skin, 0, 0.25, 0, 0.78, 0.99, 0.66);
    ellipsoid(head, skin, -0.76, 0.20, 0, 0.17, 0.30, 0.15);
    ellipsoid(head, skin, 0.76, 0.20, 0, 0.17, 0.30, 0.15);
    ellipsoid(head, skin, 0, 0.04, 0.66, 0.16, 0.23, 0.17);
    for (const x of [-0.30, 0.30]) {
      ellipsoid(head, white, x, 0.42, 0.568, 0.18, 0.12, 0.09);
      ellipsoid(head, iris, x, 0.42, 0.65, 0.080, 0.084, 0.05);
      ellipsoid(head, dark, x, 0.42, 0.695, 0.038, 0.048, 0.02);
      ellipsoid(head, hair, x, 0.64, 0.57, 0.20, 0.045, 0.04);
    }
    const mouth = ellipsoid(head, dark, 0, -0.22, 0.613, 0.23, 0.045, 0.035);
    ellipsoid(head, lip, 0, -0.29, 0.607, 0.24, 0.025, 0.027);
    if (isCedar) {
      ellipsoid(head, hair, 0, 1.05, -0.08, 0.80, 0.30, 0.64);
      for (const x of [-0.42, 0.0, 0.42]) ellipsoid(head, hair, x, 1.13, 0.33, 0.30, 0.18, 0.26);
    } else {
      ellipsoid(head, hair, 0, 1.10, -0.12, 0.86, 0.35, 0.69);
      ellipsoid(head, hair, -0.75, 0.13, -0.04, 0.27, 0.90, 0.43);
      ellipsoid(head, hair, 0.75, 0.13, -0.04, 0.27, 0.90, 0.43);
      ellipsoid(head, hair, -0.28, 1.03, 0.45, 0.43, 0.18, 0.25);
    }

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(host);
    resize();

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let frame = 0;
    let mouthAmount = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      frame = window.requestAnimationFrame(animate);
      const time = clock.getElapsedTime();
      let target = 0;
      if (playingRef.current) {
        const audio = getActiveNeuralAudio();
        const envelope = envelopeRef.current;
        if (audio && !audio.paused && envelope) {
          const index = Math.floor(audio.currentTime * 40);
          target = Math.min(1, (envelope[index] ?? 0) * 2.2);
        } else {
          // Fallback para SpeechSynthesis e período de carregamento do envelope.
          target = 0.18 + 0.43 * Math.abs(Math.sin(time * 13) * Math.cos(time * 7));
        }
      }
      mouthAmount += (target - mouthAmount) * 0.35;
      mouth.scale.y = 0.045 + mouthAmount * 0.26;
      mouth.position.y = -0.22 - mouthAmount * 0.07;
      if (!reducedMotion) {
        head.rotation.y = 0.035 * Math.sin(time * 0.8);
        head.rotation.z = 0.022 * Math.sin(time * 1.2);
        body.position.y = 0.014 * Math.sin(time * 1.6);
      }
      renderer.render(scene, camera);
    };
    animate();
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
      [skin, hair, shirt, dark, white, iris, lip].forEach((material) => material.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [voice]);

  return (
    <section className="bej-avatar" aria-label="Avatar 3D do professor de inglês">
      <div className="bej-avatar__scene" ref={mountRef} aria-hidden="true">
        {renderError && <p className="bej-avatar__fallback">Visualização 3D indisponível neste dispositivo.</p>}
      </div>
      <div className="bej-avatar__caption">
        <strong>{voice === "cedar" ? "Cedar · Professor" : "Marin · Professora"}</strong>
        <span>{isPlaying ? "Falando agora" : "Pronto para falar"}</span>
      </div>
    </section>
  );
}
