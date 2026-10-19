import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { StudyPeriod } from "./studyStats";

const periods: StudyPeriod[] = ["today", "yesterday", "7", "30", "month", "90", "all"];
export function StudyPeriodMenu({ anchor, period, onSelect, onClose }: {
  anchor: HTMLElement; period: StudyPeriod; onSelect: (period: StudyPeriod) => void; onClose: () => void;
}) {
  const { t } = useTranslation();
  const menu = useRef<HTMLDivElement>(null);
  const rect = anchor.getBoundingClientRect();
  const top = Math.max(8, Math.min(rect.top, window.innerHeight - 340));
  const left = Math.max(8, rect.left - 124);
  useEffect(() => {
    const buttons = menu.current?.querySelectorAll<HTMLButtonElement>("button");
    (buttons?.[Math.max(0, periods.indexOf(period))])?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !menu.current?.contains(event.target) && !anchor.contains(event.target)) onClose(); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); onClose(); anchor.focus({ preventScroll: true }); } };
    window.addEventListener("pointerdown", outside, true); window.addEventListener("keydown", escape);
    window.addEventListener("resize", onClose);
    return () => { window.removeEventListener("pointerdown", outside, true); window.removeEventListener("keydown", escape); window.removeEventListener("resize", onClose); };
  }, [anchor, onClose]);
  return createPortal(<div ref={menu} id="study-period-menu" className="study-period-menu" role="group" aria-label={t("study.calendar")}
    style={{ top, left, maxHeight: window.innerHeight - top - 8 }} onKeyDown={event => {
      const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "ArrowDown" ? (index + 1) % buttons.length : event.key === "ArrowUp" ? (index + buttons.length - 1) % buttons.length : event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : -1;
      if (next >= 0) { event.preventDefault(); buttons[next].focus({ preventScroll: true }); }
    }}>
    {periods.map(value => <button type="button" key={value} title={t(`study.periods.${value}`)} aria-label={t(`study.periods.${value}`)} aria-pressed={period === value}
      onClick={() => { onSelect(value); anchor.focus({ preventScroll: true }); }}>{t(`study.periods.${value}`)}</button>)}
  </div>, document.body);
}
