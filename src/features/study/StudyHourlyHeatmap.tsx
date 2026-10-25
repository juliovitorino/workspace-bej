import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { StudentLanguage } from "../../config/languages";
import { StudyCollapseToggle } from "./StudyCollapseToggle";
import type { StudyData, StudySession } from "./studyStorage";
import { localDay } from "./studyTrackingService";
import { previousDay } from "./studyStats";

type Period = "today" | "yesterday" | "7" | "30" | "90" | "all";
type Cell = { seconds: number; sessions: number };
const hours = Array.from({ length: 24 }, (_, i) => i);
const weekdays = Array.from({ length: 7 }, (_, i) => i);
const emptyGrid = (): Cell[][] => weekdays.map(() => hours.map(() => ({ seconds: 0, sessions: 0 })));

export function StudyHourlyHeatmap({ data, language, now, allSectionsExpanded }: { data: StudyData; language: StudentLanguage | "all"; now: Date; allSectionsExpanded?: boolean }) {
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { if (allSectionsExpanded !== undefined) setExpanded(allSectionsExpanded); }, [allSectionsExpanded]);
  const [period, setPeriod] = useState<Period>("30");
  const [selected, setSelected] = useState<{ weekday: number; hour: number } | null>(null);
  const grid = useMemo(() => {
    const result = emptyGrid();
    const today = localDay(now);
    const from = period === "all" ? "0000-01-01"
      : period === "today" ? today
      : period === "yesterday" ? previousDay(today, 1)
      : previousDay(today, 1 - Number(period));
    const to = period === "yesterday" ? previousDay(today, 1) : today;
    for (const session of data.sessions) {
      if (language !== "all" && session.language !== language) continue;
      const start = Date.parse(session.startedAt), end = Date.parse(session.endedAt);
      if (end <= start || session.activeSeconds <= 0) continue;
      const touched = new Set<string>();
      // Limit the estimation to the requested local calendar dates.
      let cursor = start;
      const slots: { day: string; weekday: number; hour: number; ms: number }[] = [];
      while (cursor < end) {
        const at = new Date(cursor), next = new Date(cursor);
        next.setMinutes(0, 0, 0);
        next.setHours(next.getHours() + 1);
        const until = Math.min(end, next.getTime());
        if (until <= cursor) break;
        slots.push({ day: localDay(at), weekday: (at.getDay() + 6) % 7, hour: at.getHours(), ms: until - cursor });
        cursor = until;
      }
      const dayMs = new Map<string, number>();
      for (const slot of slots) dayMs.set(slot.day, (dayMs.get(slot.day) ?? 0) + slot.ms);
      for (const slot of slots) {
        if (slot.day < from || slot.day > to) continue;
        const totalDaySeconds = session.dailySeconds?.[slot.day] ?? session.activeSeconds * (dayMs.get(slot.day) ?? 0) / (end - start);
        const cell = result[slot.weekday][slot.hour];
        cell.seconds += totalDaySeconds * slot.ms / (dayMs.get(slot.day) ?? 1);
        const key = `${slot.weekday}-${slot.hour}`;
        if (!touched.has(key)) { cell.sessions++; touched.add(key); }
      }
    }
    return result;
  }, [data, language, now, period]);
  const max = Math.max(1, ...grid.flat().map(cell => cell.seconds));
  const dayNames = useMemo(() => {
    // 2024-01-01 is Monday; use a stable Monday-based reference.
    return weekdays.map(i => new Date(2024, 0, 1 + i).toLocaleDateString(i18n.language, { weekday: "short" }).replace(".", ""));
  }, [i18n.language]);
  const selectedCell = selected && grid[selected.weekday][selected.hour];
  return <section className="study-panel bej-hourly-heatmap">
    <StudyCollapseToggle expanded={expanded} onToggle={() => setExpanded(v => !v)} title={t("studyHeatmap.title")} />
    {expanded && <>
      <div className="bej-hourly-toolbar">
        <label>{t("studyHeatmap.period")}
          <select value={period} onChange={e => { setPeriod(e.target.value as Period); setSelected(null); }}>
            {(["today", "yesterday", "7", "30", "90", "all"] as const).map(p => <option key={p} value={p}>{t(`study.periods.${p}`)}</option>)}
          </select>
        </label>
        <span className="study-note">{t("studyHeatmap.swipe")}</span>
      </div>
      <div className="bej-hourly-layout">
        <div className="bej-hourly-fixed-days" aria-hidden="true">
          <span className="bej-hourly-axis-spacer" />
          {dayNames.map((day, index) => <span key={index} className="bej-hourly-day">{day}</span>)}
        </div>
        <div className="bej-hourly-scroll" role="region" tabIndex={0} aria-label={t("studyHeatmap.scrollLabel")}>
          <div className="bej-hourly-grid">
            {hours.map(hour => <span className="bej-hourly-hour" key={`h${hour}`}>{String(hour).padStart(2, "0")}</span>)}
            {weekdays.flatMap(day => hours.map(hour => {
              const cell = grid[day][hour];
              const intensity = cell.seconds <= 0 ? 0 : Math.max(1, Math.ceil(cell.seconds / max * 4));
              const label = `${dayNames[day]} ${String(hour).padStart(2, "0")}:00 — ${Math.round(cell.seconds / 60)} ${t("studyHeatmap.minutes")}`;
              return <button key={`${day}-${hour}`} type="button"
                className={`bej-hourly-cell bej-hourly-level-${intensity}${selected?.weekday === day && selected.hour === hour ? " is-selected" : ""}`}
                aria-label={label} title={label} aria-pressed={selected?.weekday === day && selected.hour === hour}
                onClick={() => setSelected({ weekday: day, hour })} />;
            }))}
          </div>
        </div>
      </div>
      {selectedCell && selected && <p className="study-note" role="status">
        <strong>{dayNames[selected.weekday]} {String(selected.hour).padStart(2, "0")}:00–{String(selected.hour).padStart(2, "0")}:59</strong>
        {" · "}{Math.round(selectedCell.seconds / 60)} {t("studyHeatmap.minutes")}{" · "}{selectedCell.sessions} {t("studyHeatmap.sessions")}
      </p>}
      <p className="study-note">{t("studyHeatmap.estimateNote")}</p>
    </>}
  </section>;
}
