// Same phone/tablet signals used by the existing training screens; viewport
// width alone must never enable Walking Mode on a desktop.
export function isMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
