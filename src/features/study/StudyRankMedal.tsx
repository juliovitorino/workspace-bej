import type { ReactElement } from "react";

type MedalRank = 1 | 2 | 3;

const medalColors: Record<MedalRank, { ribbon: string; ribbonShadow: string; edge: string; face: string; highlight: string; star: string }> = {
  1: { ribbon: "#2563a6", ribbonShadow: "#173f7b", edge: "#b77912", face: "#f4c542", highlight: "#ffe49a", star: "#966008" },
  2: { ribbon: "#2563a6", ribbonShadow: "#173f7b", edge: "#7b8797", face: "#c9d2df", highlight: "#f0f4f8", star: "#667487" },
  3: { ribbon: "#2563a6", ribbonShadow: "#173f7b", edge: "#925326", face: "#cd8a52", highlight: "#f0ba8a", star: "#7d441e" }
};

/** Decorative podium medal. The visible/accessible ranking is owned by the parent row. */
export function StudyRankMedal({ rank }: { rank: MedalRank }): ReactElement {
  const color = medalColors[rank];
  return (
    <svg className="study-rank-medal" viewBox="0 0 32 40" width="26" height="32" fill="none" aria-hidden="true" focusable="false">
      <path d="M5 2h9l5 16-8 4L5 2Z" fill={color.ribbon} />
      <path d="M18 2h9l-6 20-8-4L18 2Z" fill={color.ribbonShadow} />
      <path d="M14 2h4l-2 13-2-13Z" fill="#e9f1ff" opacity=".75" />
      <circle cx="16" cy="26" r="12" fill={color.edge} />
      <circle cx="16" cy="26" r="9.7" fill={color.face} stroke={color.highlight} strokeWidth="1.3" />
      <path d="M16 19.6 17.9 23.6l4.4.6-3.2 3.1.8 4.4-3.9-2.1-3.9 2.1.8-4.4-3.2-3.1 4.4-.6L16 19.6Z" fill={color.star} />
      <path d="M11.2 20.5a8.1 8.1 0 0 1 7.1-2.1" stroke={color.highlight} strokeWidth="1.3" strokeLinecap="round" opacity=".85" />
    </svg>
  );
}
