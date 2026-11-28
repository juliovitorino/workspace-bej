import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { StudyPeriod } from "./studyStats";
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
  period: StudyPeriod;
  previousPeriodDates?: { from: string; to: string } | null;
  currentPeriodDates?: { from: string; to: string } | null;
  now: Date;
  mode: ModuleValueMode;
  onToggle: () => void;
}

/** One accessible, responsive control for the entire ranking, on every device. */
export function StudyModuleTimeValue({ moduleName, time, percentage, lastActivity, rankChange, previousRank, currentRank, period, previousPeriodDates, currentPeriodDates, now, mode, onToggle }: StudyModuleTimeValueProps) {
  const { t, i18n } = useTranslation();
  const [detailOpen, setDetailOpen] = useState(false);
  const locale = i18n.language.toLowerCase();
  const labels = locale.startsWith("pt") ? ["Movimentação no ranking", "Período anterior", "Período atual", "Fechar", "Próxima informação"]
    : locale.startsWith("es") ? ["Movimiento en la clasificación", "Período anterior", "Período actual", "Cerrar", "Siguiente información"]
    : locale.startsWith("fr") ? ["Évolution du classement", "Période précédente", "Période actuelle", "Fermer", "Information suivante"]
    : ["Ranking movement", "Previous period", "Current period", "Close", "Next metric"];
  const periodNames: Record<string, { previous: Record<string, string>; current: Record<string, string> }> = {
    pt: { previous: { today: "Ontem", yesterday: "Anteontem", week: "Semana passada", "7": "7 dias anteriores", "30": "30 dias anteriores", month: "Mês passado", "90": "90 dias anteriores", ytd: "YTD do ano anterior" }, current: { today: "Hoje", yesterday: "Ontem", week: "Nesta semana", "7": "Últimos 7 dias", "30": "Últimos 30 dias", month: "Este mês", "90": "Últimos 90 dias", ytd: "YTD do ano atual" } },
    en: { previous: { today: "Yesterday", yesterday: "Day before yesterday", week: "Last week", "7": "Previous 7 days", "30": "Previous 30 days", month: "Last month", "90": "Previous 90 days", ytd: "Previous year YTD" }, current: { today: "Today", yesterday: "Yesterday", week: "This week", "7": "Last 7 days", "30": "Last 30 days", month: "This month", "90": "Last 90 days", ytd: "Current year YTD" } },
    es: { previous: { today: "Ayer", yesterday: "Anteayer", week: "Semana pasada", "7": "7 días anteriores", "30": "30 días anteriores", month: "Mes pasado", "90": "90 días anteriores", ytd: "YTD del año anterior" }, current: { today: "Hoy", yesterday: "Ayer", week: "Esta semana", "7": "Últimos 7 días", "30": "Últimos 30 días", month: "Este mes", "90": "Últimos 90 días", ytd: "YTD del año actual" } },
    fr: { previous: { today: "Hier", yesterday: "Avant-hier", week: "Semaine dernière", "7": "7 jours précédents", "30": "30 jours précédents", month: "Mois dernier", "90": "90 jours précédents", ytd: "YTD de l’année précédente" }, current: { today: "Aujourd’hui", yesterday: "Hier", week: "Cette semaine", "7": "7 derniers jours", "30": "30 derniers jours", month: "Ce mois-ci", "90": "90 derniers jours", ytd: "YTD de l’année en cours" } }
  };
  const language = locale.startsWith("pt") ? "pt" : locale.startsWith("es") ? "es" : locale.startsWith("fr") ? "fr" : "en";
  const dateRange = (range?: { from: string; to: string } | null) => range
    ? `${range.from.split("-").reverse().join("/")}${range.from === range.to ? "" : " – " + range.to.split("-").reverse().join("/")}`
    : "";
  const previousPeriodLabel = periodNames[language].previous[period] ?? dateRange(previousPeriodDates);
  const currentPeriodLabel = periodNames[language].current[period] ?? dateRange(currentPeriodDates);
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
    <>
    <button
      type="button"
      className="study-module-value"
      onClick={onToggle}
      aria-live="polite"
      aria-label={`${moduleName}: ${mode === "rankChange" ? movementLabel ?? "Sem alteração de posição" : visibleValue}. ${t("study.toggleModuleTimePercentage")}`}
      title={t("study.toggleModuleTimePercentage")}
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
    {mode === "rankChange" && movement && previousRank !== undefined && currentRank !== undefined && (
      <button type="button" className="study-rank-info-button" aria-label={`${moduleName}: ${labels[0]}`} title={labels[0]} onClick={() => setDetailOpen(true)}>ⓘ</button>
    )}
    {detailOpen && mode === "rankChange" && movement && previousRank !== undefined && currentRank !== undefined && createPortal(
      <div className="study-rank-detail-overlay" onClick={() => setDetailOpen(false)}>
        <section className="study-rank-detail-dialog" role="dialog" aria-modal="true" aria-label={`${moduleName}: ${labels[0]}`} onClick={event => event.stopPropagation()}>
          <strong>{moduleName} — {labels[0]}</strong>
          <div className="study-rank-detail-positions"><span><small>{labels[1]}<span className="study-rank-period-label">({previousPeriodLabel})</span></small><strong>{previousRank}º</strong></span><span aria-hidden="true">→</span><span><small>{labels[2]}<span className="study-rank-period-label">({currentPeriodLabel})</span></small><strong>{currentRank}º</strong></span></div>
          <span>{movementLabel}</span>
          <button type="button" className="study-rank-detail-close" onClick={() => setDetailOpen(false)}>{labels[3]}</button>
        </section>
      </div>, document.body
    )}
    </>
  );
}
