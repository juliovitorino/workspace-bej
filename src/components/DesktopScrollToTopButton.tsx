import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

/** Separate desktop control: mobile floating controls remain untouched. */
export function DesktopScrollToTopButton({ active }: { active: boolean }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => {
      setVisible(active && window.matchMedia("(min-width: 821px)").matches && window.scrollY > 300);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [active]);

  if (!visible) return null;
  return (
    <button type="button" className="desktop-scroll-to-top"
      aria-label={t("navigation.backToTop")} title={t("navigation.backToTop")}
      onClick={() => window.scrollTo({
        top: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"
      })}>
      <svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5m-7 7 7-7 7 7" />
      </svg>
    </button>
  );
}
