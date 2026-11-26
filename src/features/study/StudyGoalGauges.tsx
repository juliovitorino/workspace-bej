import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LANGUAGES, type StudentLanguage } from "../../config/languages";
import { languageName } from "../../i18n";
import type { StudyData } from "./studyStorage";
import { studyEntries } from "./studyStats";
import { localDay } from "./studyTrackingService";
import { StudySpeedometer } from "./StudySpeedometer";
import { StudyPlanetMission } from "./StudyPlanetMission";

const hoursAndMinutes = (seconds: number) => `${Math.floor(seconds / 3600)}h ${String(Math.floor(seconds % 3600 / 60)).padStart(2, "0")}min`;

// Launch sequence: hold upright, climb to 45°, hold, level to 90°, then cruise.
const LAUNCH_DURATION_MS = 1500;
const CRUISE_DURATION_MS = 1800;
const smoothStep = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
const launchPose = (elapsedMs: number) => {
  if (elapsedMs <= 500) return { angle: 0, y: 49 };
  if (elapsedMs <= 750) {
    const t = smoothStep((elapsedMs - 500) / 250);
    return { angle: 45 * t, y: 49 - 10 * t };
  }
  if (elapsedMs <= 1000) return { angle: 45, y: 39 };
  if (elapsedMs <= 1250) {
    const t = smoothStep((elapsedMs - 1000) / 250);
    return { angle: 45 + 45 * t, y: 39 - 10 * t };
  }
  return { angle: 90, y: 29 };
};
const cruiseProgress = (elapsedMs: number) => {
  const t = Math.max(0, Math.min(1, (elapsedMs - LAUNCH_DURATION_MS) / CRUISE_DURATION_MS));
  return 1 - Math.pow(1 - t, 3);
};

/** SVG historical goal visualization. Display only; no persistence changes. */
export function StudyGoalGauges({ data, goals, monthlyGoals, language, now, hideZeroData = false, explanationVisible, onToggleExplanation }: {
  data: StudyData;
  goals: StudyData["goals"];
  monthlyGoals: StudyData["monthlyGoals"];
  language: StudentLanguage | "all";
  now: Date;
  hideZeroData?: boolean;
  explanationVisible: boolean;
  onToggleExplanation: () => void;
}) {
  const { t } = useTranslation();
  const journeyRef = useRef<HTMLElement | null>(null);
  const [launchElapsedMs, setLaunchElapsedMs] = useState(0);
  const [missionView, setMissionView] = useState(false);
  const [isPhoneViewport, setIsPhoneViewport] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 600px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 600px)");
    const update = () => {
      setIsPhoneViewport(media.matches);
      if (media.matches) setMissionView(false);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const flightProgress = cruiseProgress(launchElapsedMs);
  const rocketPose = launchPose(launchElapsedMs);
  const flightFrameRef = useRef<number | null>(null);
  const launchFlight = () => {
    if (flightFrameRef.current !== null) cancelAnimationFrame(flightFrameRef.current);
    flightFrameRef.current = null;
    setLaunchElapsedMs(0);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setLaunchElapsedMs(LAUNCH_DURATION_MS + CRUISE_DURATION_MS);
      return;
    }
    let startTime: number | undefined;
    const tick = (now: number) => {
      if (startTime === undefined) startTime = now;
      const elapsed = Math.min(LAUNCH_DURATION_MS + CRUISE_DURATION_MS, now - startTime);
      setLaunchElapsedMs(elapsed);
      if (elapsed < LAUNCH_DURATION_MS + CRUISE_DURATION_MS) flightFrameRef.current = requestAnimationFrame(tick);
      else flightFrameRef.current = null;
    };
    flightFrameRef.current = requestAnimationFrame(tick);
  };
  const switchMissionView = () => {
    // A newly selected view starts its own animation at the moment of the click.
    if (isPhoneViewport) return;
    setMissionView(previous => !previous);
    launchFlight();
  };
  useEffect(() => {
    const section = journeyRef.current;
    if (!section) return;
    let started = false;
    const observer = new IntersectionObserver(entries => {
      if (started || !entries.some(entry => entry.isIntersecting)) return;
      started = true;
      observer.disconnect();
      launchFlight();
    }, { threshold: 0.2 });
    observer.observe(section);
    return () => {
      observer.disconnect();
      if (flightFrameRef.current !== null) cancelAnimationFrame(flightFrameRef.current);
      flightFrameRef.current = null;
    };
  }, []);

  const totals = useMemo(() => {
    const result: Record<string, { all: number; month: number }> = {};
    const month = localDay(now).slice(0, 7);
    for (const entry of studyEntries(data)) {
      const current = result[entry.language] ?? { all: 0, month: 0 };
      current.all += entry.seconds;
      if (entry.date.startsWith(month)) current.month += entry.seconds;
      result[entry.language] = current;
    }
    return result;
  }, [data, now]);
  const languages = (Object.keys(LANGUAGES) as StudentLanguage[]).filter(code => (language === "all" || code === language) && (!hideZeroData || (totals[code]?.all ?? 0) > 0));
  return <section ref={journeyRef} className="study-panel bej-goal-gauges" aria-labelledby="bej-goals-title">
    <div className="study-goal-heading"><h3 id="bej-goals-title">{t("study.journey")}</h3>
      <button type="button" className="secondary-button study-goal-info" aria-label={t(explanationVisible ? "study.hideGoalExplanation" : "study.showGoalExplanation")} aria-expanded={explanationVisible} aria-controls="bej-goals-explanation" onClick={onToggleExplanation}>ⓘ</button>
    </div>
    <p id="bej-goals-explanation" className="study-goal-explanation" data-expanded={explanationVisible}>{t("study.historicalNote")}</p>
    <div className="bej-gauge-grid">{languages.map(code => {
      const actual = totals[code]?.all ?? 0;
      const target = goals[code];
      const percentage = target ? actual / (target * 3600) * 100 : 0;
      const fraction = Math.max(0, Math.min(1, percentage / 100));
      const flightFraction = fraction * flightProgress;
      const monthly = monthlyGoals[code];
      return <article className="bej-gauge-item" key={code} aria-label={`${languageName(code)}: ${hoursAndMinutes(actual)} / ${target ? `${target}h` : t("study.noGoal")}`}>
        <h4>{languageName(code)}</h4>
        <div className="bej-gauge-visual">
          <button type="button" onClick={switchMissionView} disabled={isPhoneViewport} aria-pressed={missionView} aria-label={isPhoneViewport ? "Velocímetro de progresso" : missionView ? "Mostrar jornada espacial clássica" : "Mostrar Missão Espacial BEJ"} title={missionView ? "Voltar à jornada clássica" : "Abrir Missão Espacial BEJ"} style={{ display: "block", width: "100%", background: "none", border: "none", padding: 0, cursor: isPhoneViewport ? "default" : "pointer" }}>
            <StudySpeedometer percentage={percentage} progress={flightProgress} hasGoal={Boolean(target)} subtitle={t("bejOverview.goalCompleted")} />
          </button>
          {!isPhoneViewport && <p style={{ fontSize: 12, textAlign: "center", margin: "2px 0 0", opacity: .8 }}>Toque no velocímetro para {missionView ? "voltar à jornada clássica" : "ver a Missão Espacial BEJ"}</p>}
        </div>
        {target !== undefined && target > 0 && missionView && !isPhoneViewport && <StudyPlanetMission percentage={percentage} progress={flightProgress} launchElapsedMs={launchElapsedMs} onReplay={launchFlight} />}
        {target !== undefined && target > 0 && (!missionView || isPhoneViewport) && <div className="bej-rocket-journey" role="group" aria-label={`${languageName(code)}: ${percentage.toFixed(1)}% ${t("bejOverview.goalCompleted")}`} style={{ width: "100%", maxWidth: 520, margin: "12px auto 18px" }}>
          <svg viewBox="0 0 360 112" width="100%" role="group" aria-label="Jornada espacial da meta" style={{ display: "block", overflow: "visible" }}>
            <path d="M 38 62 H 322" fill="none" stroke="#94a3b8" strokeOpacity=".38" strokeWidth="12" strokeLinecap="round" />
            {flightFraction > 0 && <path d={`M 38 62 H ${38 + 284 * flightFraction}`} fill="none" stroke="#22c55e" strokeWidth="12" strokeLinecap="round" />}
            {flightFraction > 0 && <>
              <circle cx={38 + 284 * flightFraction} cy="62" r="15" fill="#22c55e" fillOpacity=".2" />
              <circle cx={38 + 284 * flightFraction} cy="62" r="9" fill="#22c55e" stroke="#f8fafc" strokeWidth="2.5" />
            </>}
            <g transform="translate(12 40)">
              <rect x="0" y="43" width="34" height="5" rx="2" fill="#475569" />
              <rect x="4" y="7" width="5" height="36" fill="#64748b" />
              <path d="M 6 13 H 26 M 6 23 H 26 M 6 33 H 26" stroke="#94a3b8" strokeWidth="2" />
              <path d="M 17 43 V 10 L 24 2 L 31 10 V 43 Z" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5" />
            </g>
            <g role="button" tabIndex={0} aria-label="Repetir animação do foguete" onClick={launchFlight} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); launchFlight(); } }} style={{ cursor: "pointer" }}>
              <title>Repetir animação do foguete</title>
              <circle cx="322" cy="62" r="32" fill="transparent" />
              <g transform="translate(322 62)">
                <circle r="22" fill="#3b82f6" />
                <path d="M -18 -7 Q -9 -19 2 -13 L 4 -3 L -6 5 L -16 2 L -10 15 L 3 11 L 11 17 L 20 3 L 11 -6 L 15 -15" fill="#34d399" />
                <ellipse rx="27" ry="9" transform="rotate(-25)" stroke="#93c5fd" strokeWidth="2.5" fill="none" />
              </g>
            </g>
            {flightFraction > 0 && <path d={`M ${38 + 284 * flightFraction} 45 V 62`} stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 3" />}
            <g transform={`translate(${38 + 284 * flightFraction} ${rocketPose.y}) rotate(${rocketPose.angle})`}>
              <path d="M -6 13 L -10 23 L 0 19 L 10 23 L 6 13" fill="#f97316" />
              <path d="M 0 -22 Q 13 -10 10 9 L 6 15 H -6 L -10 9 Q -13 -10 0 -22 Z" fill="#f8fafc" stroke="#475569" strokeWidth="1.5" />
              <circle cy="-4" r="5" fill="#38bdf8" stroke="#0284c7" strokeWidth="2" />
              <path d="M -10 4 L -17 15 L -8 11 M 10 4 L 17 15 L 8 11" fill="#ef4444" />
            </g>
            <text x="38" y="108" textAnchor="middle" fontSize="11" fill="currentColor">0%</text>
            <text x="322" y="108" textAnchor="middle" fontSize="11" fill="currentColor">100%</text>
          </svg>
        </div>}
        <div className="bej-gauge-numbers"><strong>{hoursAndMinutes(actual)}</strong><span>/ {target ? `${target}h` : t("study.noGoal")}</span></div>
        {target && <p className="bej-gauge-remaining">{percentage >= 100 ? t("study.reached") : `${t("bejOverview.remaining")}: ${hoursAndMinutes(Math.max(0, target * 3600 - actual))}`}</p>}
        {monthly && <p className="bej-gauge-monthly">{t("study.monthlyProgress", { actual: hoursAndMinutes(totals[code]?.month ?? 0), target: monthly })}</p>}
      </article>;
    })}</div>
  </section>;
}
