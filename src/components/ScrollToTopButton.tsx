import { useEffect, useState } from "react";

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 768px)");
    const updateVisibility = () => {
      const next = mobile.matches && window.scrollY > 300;
      setVisible(previous => previous === next ? previous : next);
    };

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    mobile.addEventListener("change", updateVisibility);
    return () => {
      window.removeEventListener("scroll", updateVisibility);
      mobile.removeEventListener("change", updateVisibility);
    };
  }, []);

  if (!visible) return null;

  return (
    <button type="button" className="scroll-to-top-button" aria-label="Ir para o topo" title="Ir para o topo"
      onClick={() => window.scrollTo({
        top: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"
      })}>
      <svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5m-7 7 7-7 7 7" />
      </svg>
    </button>
  );
}
