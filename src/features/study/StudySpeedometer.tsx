import { useId } from "react";

type StudySpeedometerProps = {
  percentage: number;
  progress: number;
  hasGoal: boolean;
  subtitle: string;
};

/** Accessible, responsive SVG speedometer. Animation follows the goal section's flight progress. */
export function StudySpeedometer({ percentage, progress, hasGoal, subtitle }: StudySpeedometerProps) {
  const rawId = useId().replace(/:/g, "");
  const displayFraction = Math.max(0, Math.min(1, percentage / 100)) * progress;
  const angle = -90 + displayFraction * 180;
  const marks = Array.from({ length: 11 }, (_, index) => {
    const radians = (Math.PI * (180 - index * 18)) / 180;
    const inner = index % 5 === 0 ? 78 : 85;
    const outer = 99;
    return {
      x1: 120 + inner * Math.cos(radians),
      y1: 115 - inner * Math.sin(radians),
      x2: 120 + outer * Math.cos(radians),
      y2: 115 - outer * Math.sin(radians),
    };
  });
  return (
    <svg viewBox="0 0 240 150" width="100%" role="img"
      aria-label={hasGoal ? `${Math.round(percentage)}% — ${subtitle}` : subtitle}
      style={{ display: "block", maxWidth: 340, margin: "0 auto" }}>
      <defs>
        <linearGradient id={`bej-speedometer-face-${rawId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#344650" />
          <stop offset="100%" stopColor="#25333d" />
        </linearGradient>
      </defs>
      <path d="M 16 115 A 104 104 0 0 1 224 115 L 213 131 H 27 Z"
        fill={`url(#bej-speedometer-face-${rawId})`} />
      <path d="M 29 115 A 91 91 0 0 1 211 115" fill="none"
        stroke="#b8c6cc" strokeWidth="10" strokeLinecap="butt" />
      {marks.map((mark, index) => (
        <line key={index} {...mark} stroke="#b8c6cc" strokeWidth={index % 5 === 0 ? 5 : 4} />
      ))}
      <g transform={`rotate(${angle} 120 115)`}>
        <path d="M 115 115 L 117 43 Q 120 34 123 43 L 125 115 Z" fill="#ff4b10" />
      </g>
      <circle cx="120" cy="115" r="11" fill="#ff4b10" />
      <rect x="91" y="125" width="58" height="18" rx="2" fill="#02cbe5" stroke="#058ca1" strokeWidth="1" />
      <text x="120" y="138" textAnchor="middle" fontSize="12" fontWeight="700" fill="#102e3a">
        {hasGoal ? `${Math.round(percentage)}%` : "—"}
      </text>
    </svg>
  );
}
