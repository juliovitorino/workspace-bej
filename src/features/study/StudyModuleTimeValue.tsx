import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ModuleValueMode } from "./studyModuleTime";
import { moduleRecencyParts } from "./studyModuleRecency";

interface StudyModuleTimeValueProps {
  moduleName: string;
  time: string;
  percentage: string;
  lastActivity?: number;
  rankChange?: number;
  previousRank?: number;
  currentRank?: number;
  now: Date;
  mode: ModuleValueMode;
  onToggle: () => void;
}

/** One accessible, responsive control for the entire ranking, on every device. */
export function StudyModuleTimeValue({ moduleName, time, percentage, lastActivity, rankChange, previousRank, currentRank, now, mode, onToggle }: StudyModuleTimeValueProps) {
  const { t, i18n } = useTranslation();
  const [detailOpen, setDetailOpen] = useState(false);
  const locale = i18n.language.toLowerCase();
  const labels = locale.startsWith("pt") ? ["Movimentação no ranking", "Período anterior", "Período atual", "Fechar"]
    : locale.startsWith("es") ? ["Movimiento en la clasificación", "Período anterior", "Período actual", "Cerrar"]
    : locale.startsWith("fr") ? ["Évolution du classement", "Période précédente", "Période actuelle", "Fermer"]
    : ["Ranking movement", "Previous period", "Current period", "Close"];
  const parts = lastActivity === undefined ? null : moduleRecencyParts(lastActivity, now.getTime());
  const lastActivityLabel = parts
    ? t("study.moduleActivityAgo", { time: `${parts.count}${t(`study.moduleRecencyUnits.${parts.unit}${parts.count === 1 ? "One" : "Other"}`)}` })
    : t("study.noModuleActivity");
  const fullValue = `${time} · ${percentage}`;
  const movement = rankChange && Number.isFinite(rankChange)
    ? `${rankChange > 0 ? "+" : "−"}${Math.abs(rankChange)}`
    : null;
  // Unchanged and non-comparable modules never show a movement indicator.
  const visibleValue = mode === "both" ? fullValue : mode === "time" ? time : mode === "percentage" ? percentage
    : mode === "recent" ? lastActivityLabel : movement ?? "";
  const movementLabel = movement
    ? `${rankChange! > 0 ? "Subiu" : "Desceu"} ${Math.abs(rankChange!)} ${Math.abs(rankChange!) === 1 ? "posição" : "posições"}`
    : null;

  return (
    <span className="study-module-value-wrapper" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDetailOpen(false); }}>
    <button
      type="button"
      className="study-module-value"
      onClick={() => { if (mode === "rankChange" && movement && previousRank !== undefined && currentRank !== undefined) setDetailOpen(open => !open); else onToggle(); }}
      aria-live="polite"
      aria-label={`${moduleName}: ${mode === "rankChange" ? movementLabel ?? "Sem alteração de posição" : visibleValue}. ${t("study.toggleModuleTimePercentage")}`}
      title={mode === "rankChange" && movement ? labels[0] : t("study.toggleModuleTimePercentage")}
    >
      {mode === "rankChange" && movement ? (
        <svg
          aria-hidden="true"
          width={movement.length > 2 ? 76 : 64}
          height="32"
          viewBox={`0 0 ${movement.length > 2 ? 76 : 64} 32`}
          style={{ display: "block", flex: "0 0 auto", maxWidth: "none" }}
        >
          <rect width="100%" height="32" rx="8" fill={rankChange! > 0 ? "#123d31" : "#4a252d"} />
          <g fill="none" stroke={rankChange! > 0 ? "#4ade80" : "#fb7185"} strokeWidth="3.25" strokeLinecap="round" strokeLinejoin="round">
            {rankChange! > 0 ? <path d="M16 24V8m-7 7 7-7 7 7" /> : <path d="M16 8v16m-7-7 7 7 7-7" />}
          </g>
          <text x="31" y="21" fill={rankChange! > 0 ? "#4ade80" : "#fb7185"} fontSize="14" fontWeight="800" fontFamily="inherit">{movement}</text>
        </svg>
      ) : visibleValue}
    </button>
    {detailOpen && mode === "rankChange" && movement && previousRank !== undefined && currentRank !== undefined && (
      <span className="study-rank-detail" role="group" aria-label={`${moduleName}: ${labels[0]}`}>
        <span className="study-rank-detail-heading">{labels[0]}</span>
        <span className="study-rank-detail-positions"><span><small>{labels[1]}</small><strong>{previousRank}º</strong></span><span aria-hidden="true">→</span><span><small>{labels[2]}</small><strong>{currentRank}º</strong></span></span>
        <span className="study-rank-detail-change">{movementLabel}</span>
        <button type="button" className="study-rank-detail-close" onClick={() => setDetailOpen(false)}>{labels[3]}</button>
      </span>
    )}
    </span>
  );
}
