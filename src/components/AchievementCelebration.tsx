import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { ACHIEVEMENT_EVENT, type AchievementDetail } from "../utils/achievements";

/** Global visual host: no timer, navigation, or study-data side effects. */
export function AchievementCelebration() {
  const [current, setCurrent] = useState<AchievementDetail | null>(null);
  const queue = useRef<AchievementDetail[]>([]);
  const busy = useRef(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const next = () => {
      const achievement = queue.current.shift();
      if (!achievement) { busy.current = false; setCurrent(null); return; }
      busy.current = true;
      setCurrent(achievement);
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        for (const x of [0.16, 0.5, 0.84]) {
          void confetti({
            particleCount: 70, angle: 270, spread: 65, startVelocity: 28,
            gravity: 0.9, scalar: 0.9, ticks: 220, zIndex: 10000,
            origin: { x, y: -0.06 },
            colors: ["#ffd700", "#22c55e", "#3b82f6", "#f472b6", "#a855f7"]
          });
        }
      }
      timeout.current = setTimeout(next, 4200);
    };
    const receive = (event: Event) => {
      queue.current.push((event as CustomEvent<AchievementDetail>).detail);
      if (!busy.current) next();
    };
    window.addEventListener(ACHIEVEMENT_EVENT, receive);
    return () => { window.removeEventListener(ACHIEVEMENT_EVENT, receive); if (timeout.current) clearTimeout(timeout.current); };
  }, []);

  return current ? (
    <div role="status" aria-live="polite" aria-atomic="true" style={{
      position: "fixed", top: "max(18px, env(safe-area-inset-top))",
      left: "50%", transform: "translateX(-50%)", width: "min(92vw, 440px)",
      padding: "16px 20px", borderRadius: 16, textAlign: "center",
      background: "var(--surface, #132238)", color: "var(--text, #fff)",
      border: "2px solid #facc15", boxShadow: "0 12px 32px rgba(0,0,0,.24)",
      pointerEvents: "none", zIndex: 10001
    }}>
      <strong style={{ display: "block", fontSize: "1.2rem" }}>🎉 {current.title}</strong>
      <span style={{ display: "block", marginTop: 6, fontSize: ".95rem" }}>{current.description}</span>
    </div>
  ) : null;
}
