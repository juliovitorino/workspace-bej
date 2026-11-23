import { useId, useMemo, useState } from "react";

type Planet = { name: string; at: number; color: string; radius: number; labelDy: number };
const PLANETS: Planet[] = [
  { name: "Terra", at: 0, color: "#38bdf8", radius: 12, labelDy: 30 },
  { name: "Lua", at: 0.05, color: "#bfc5ce", radius: 7, labelDy: -16 },
  { name: "Marte", at: 0.15, color: "#e76f51", radius: 10, labelDy: 25 },
  { name: "Vênus", at: 0.25, color: "#e7b767", radius: 10, labelDy: -19 },
  { name: "Mercúrio", at: 0.35, color: "#aab0b8", radius: 8, labelDy: 24 },
  { name: "Júpiter", at: 0.5, color: "#d5a27b", radius: 17, labelDy: 34 },
  { name: "Saturno", at: 0.65, color: "#dfc58e", radius: 13, labelDy: -28 },
  { name: "Urano", at: 0.8, color: "#82dce5", radius: 11, labelDy: 27 },
  { name: "Netuno", at: 1, color: "#527ce8", radius: 13, labelDy: 30 },
];

// The polyline's cumulative distance, not its x position, determines mission progress.
const WAYPOINTS = [
  [44, 333], [86, 317], [131, 289], [170, 242], [202, 192],
  [267, 169], [335, 196], [403, 244], [471, 227],
  [520, 180], [498, 123], [452, 80], [508, 47], [577, 50],
] as const;
const ROUTE: { x: number; y: number }[] = WAYPOINTS.map(([x, y]) => ({ x, y }));
const DISTANCES = ROUTE.reduce<number[]>((acc, point, index) => {
  if (index === 0) return [0];
  const previous = ROUTE[index - 1];
  return [...acc, acc[index - 1] + Math.hypot(point.x - previous.x, point.y - previous.y)];
}, []);
const TOTAL = DISTANCES[DISTANCES.length - 1];
const routePoint = (fraction: number) => {
  const distance = Math.max(0, Math.min(1, fraction)) * TOTAL;
  let segment = 1;
  while (segment < DISTANCES.length - 1 && DISTANCES[segment] < distance) segment += 1;
  const from = ROUTE[segment - 1];
  const to = ROUTE[segment];
  const span = DISTANCES[segment] - DISTANCES[segment - 1];
  const t = span ? (distance - DISTANCES[segment - 1]) / span : 0;
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    angle: Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI + 90,
  };
};
const routeTo = (fraction: number) => {
  const distance = Math.max(0, Math.min(1, fraction)) * TOTAL;
  const points = [ROUTE[0]];
  for (let index = 1; index < ROUTE.length; index++) {
    if (DISTANCES[index] < distance) points.push(ROUTE[index]);
    else break;
  }
  points.push(routePoint(fraction));
  return points.map(point => `${point.x},${point.y}`).join(" ");
};

function PlanetArt({ planet, x, y, achieved }: { planet: Planet; x: number; y: number; achieved: boolean }) {
  const r = planet.radius;
  return <g>
    {achieved && <circle cx={x} cy={y} r={r + 6} fill="none" stroke="#6ee7b7" strokeWidth="2" opacity=".85" />}
    {planet.name === "Saturno" && <ellipse cx={x} cy={y} rx={r + 13} ry="7" transform={`rotate(-25 ${x} ${y})`} fill="none" stroke="#bba77d" strokeWidth="4" />}
    <circle cx={x} cy={y} r={r} fill={planet.color} stroke="#ffffff" strokeOpacity=".35" strokeWidth="1" />
    {["Lua", "Marte", "Mercúrio", "Vênus"].includes(planet.name) && <>
      <circle cx={x - r * .35} cy={y - r * .25} r={r * .22} fill="#17212e" fillOpacity=".23" stroke="#f8fafc" strokeOpacity=".3" strokeWidth=".8" />
      <circle cx={x + r * .3} cy={y + r * .22} r={r * .16} fill="#17212e" fillOpacity=".18" />
      <circle cx={x - r * .05} cy={y + r * .45} r={r * .1} fill="#f8fafc" fillOpacity=".25" />
    </>}
    {planet.name === "Terra" && <path d={`M ${x-r*.7} ${y-r*.4} l ${r*.6} -${r*.35} ${r*.45} ${r*.5} -${r*.3} ${r*.3} ${r*.4} ${r*.65} -${r*.35} -${r*.4} Z`} fill="#4ade80" />}
    {planet.name === "Júpiter" && <g stroke="#a46e54" strokeWidth="2.5" opacity=".8">
      <path d={`M ${x-r*.85} ${y-r*.3} H ${x+r*.85} M ${x-r} ${y+r*.1} H ${x+r} M ${x-r*.7} ${y+r*.5} H ${x+r*.7}`} />
    </g>}
    {planet.name === "Saturno" && <ellipse cx={x} cy={y} rx={r + 13} ry="7" transform={`rotate(-25 ${x} ${y})`} fill="none" stroke="#f0d99d" strokeWidth="2" />}
    {planet.name === "Netuno" && <path d={`M ${x-r*.75} ${y+2} Q ${x} ${y-3} ${x+r*.75} ${y+2}`} fill="none" stroke="#a5b4fc" strokeWidth="2" />}
    <text x={x} y={y + planet.labelDy} fill="#f8fafc" fontSize="12" fontWeight="600" textAnchor="middle">{planet.name}</text>
    <text x={x} y={y + planet.labelDy + 13} fill="#a5b4c8" fontSize="10" textAnchor="middle">{Math.round(planet.at * 100)}%</text>
    <title>{`${planet.name}: ${Math.round(planet.at * 100)}% ${achieved ? "conquistado" : "a conquistar"}`}</title>
  </g>;
}

type Tribute = "webb" | "voyager";
const TRIBUTE_DETAILS: Record<Tribute, { title: string; detail: string }> = {
  webb: { title: "James Webb Space Telescope", detail: "Lançado em 2021, observa o universo principalmente em infravermelho. Seu espelho principal possui 18 segmentos hexagonais dourados." },
  voyager: { title: "Voyager 1", detail: "Lançada em 1977, tornou-se o primeiro objeto construído pela humanidade a alcançar o espaço interestelar, em 2012." },
};

function SpaceTribute({ kind, x, y, onSelect }: { kind: Tribute; x: number; y: number; onSelect: (kind: Tribute) => void }) {
  const webb = kind === "webb";
  const label = webb ? "Telescópio James Webb" : "Sonda Voyager 1";
  return <g transform={`translate(${x} ${y})`} role="button" tabIndex={0}
    aria-label={`Conhecer ${label}`} onClick={() => onSelect(kind)}
    onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(kind); } }}
    style={{ cursor: "pointer", outline: "none" }}>
    <title>{`Homenagem: ${label}. Clique para conhecer.`}</title>
    <circle r="43" fill="#182d4d" fillOpacity=".85" stroke="#55759c" strokeDasharray="3 5" />
    {webb ? <>
      <g transform="translate(0 -12)">
        {Array.from({ length: 18 }, (_, index) => {
          const row = Math.floor(index / 6);
          const col = index % 6;
          const cx = (col - 2.5) * 10 + (row % 2 ? 5 : 0);
          const cy = (row - 1) * 17;
          return <path key={index} d={`M ${cx} ${cy-6} l 5 3 v 6 l -5 3 l -5 -3 v -6 Z`}
            fill={index % 3 === 0 ? "#f8d67a" : "#d5a342"} stroke="#ffefb0" strokeWidth=".8" />;
        })}
        <circle r="5" fill="#223a54" stroke="#e2e8f0" strokeWidth="1.5" />
      </g>
      <path d="M -29 15 L -40 29 L 40 29 L 29 15 Z" fill="#8e83c4" stroke="#c4b5fd" strokeWidth="1.5" />
      <path d="M -34 21 H 34 M -29 25 H 29" stroke="#ddd6fe" strokeWidth="1" />
    </> : <g transform="rotate(-22)">
      <path d="M -8 -5 L -8 -30 M 7 -4 L 22 -28 M -14 5 L -31 12 M 0 12 V 30" stroke="#cbd5e1" strokeWidth="2.5" fill="none" />
      <circle cx="22" cy="-28" r="8" fill="#b8c2cf" stroke="#f1f5f9" strokeWidth="1.5" />
      <ellipse cx="22" cy="-28" rx="5" ry="2.5" fill="#475569" />
      <rect x="-13" y="-9" width="26" height="20" rx="2" fill="#c49a55" stroke="#fef3c7" strokeWidth="1.5" />
      <path d="M -13 -2 H 13 M -13 5 H 13 M -4 -9 V 11 M 5 -9 V 11" stroke="#80623d" strokeWidth="1" />
      <circle cx="-31" cy="12" r="5" fill="#94a3b8" stroke="#e2e8f0" />
      <path d="M -19 30 Q 0 12 19 30" fill="none" stroke="#dbeafe" strokeWidth="3" />
    </g>}
    <text y="55" textAnchor="middle" fontSize="11" fontWeight="600" fill="#e2e8f0">{webb ? "James Webb" : "Voyager 1"}</text>
  </g>;
}

export function StudyPlanetMission({ percentage, progress, launchElapsedMs, onReplay }: {
  percentage: number;
  progress: number;
  launchElapsedMs: number;
  onReplay: () => void;
}) {
  const gradientId = useId().replace(/:/g, "");
  const [selectedTribute, setSelectedTribute] = useState<Tribute | null>(null);
  const completed = Math.max(0, Math.min(1, percentage / 100));
  const traveled = completed * progress;
  const position = routePoint(traveled);
  const next = PLANETS.find(planet => planet.at > completed);
  const stars = useMemo(() => Array.from({ length: 40 }, (_, index) => ({
    x: (index * 137 + 21) % 610,
    y: (index * 83 + 17) % 365,
    radius: index % 5 === 0 ? 1.6 : .75,
  })), []);
  // During takeoff, the rocket holds on Earth and performs the same staged rotation.
  const launching = launchElapsedMs < 1500;
  const launchAngle = launchElapsedMs <= 500 ? 0
    : launchElapsedMs <= 750 ? 45 * ((launchElapsedMs - 500) / 250)
    : launchElapsedMs <= 1000 ? 45
    : launchElapsedMs <= 1250 ? 45 + 45 * ((launchElapsedMs - 1000) / 250) : 90;
  // The green marker stays exactly on the route; the rocket flies beside it.
  // Use the segment normal to keep the separation consistent around bends.
  const headingRadians = (position.angle - 90) * Math.PI / 180;
  const offset = 35;
  const takeoffLift = Math.max(0, Math.min(1, (launchElapsedMs - 500) / 750));
  const rocketX = Math.max(22, Math.min(598, position.x + Math.sin(headingRadians) * offset * (launching ? takeoffLift : 1)));
  const cruiseY = Math.max(26, Math.min(365, position.y - Math.cos(headingRadians) * offset));
  const rocketY = launching ? position.y + (cruiseY - position.y) * takeoffLift : cruiseY;
  const rocketAngle = launching ? launchAngle : position.angle;
  return <div className="bej-planet-mission" style={{ width: "100%", maxWidth: 650, margin: "12px auto 18px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
      <strong>🚀 Missão Espacial BEJ</strong>
      <button type="button" className="secondary-button" onClick={onReplay} aria-label="Repetir missão espacial">↻ Repetir missão</button>
    </div>
    <svg viewBox="0 0 620 395" width="100%" role="img" aria-label={`Missão Espacial BEJ: ${percentage.toFixed(1)}% concluído. ${next ? `Próximo destino: ${next.name}` : "Netuno conquistado"}`} style={{ display: "block", background: "#0b1930", borderRadius: 16 }}>
      <defs>
        <linearGradient id={`bej-mission-trail-${gradientId}`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#38bdf8" /><stop offset="60%" stopColor="#a78bfa" /><stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>
      {stars.map((star, index) => <circle key={index} cx={star.x} cy={star.y} r={star.radius} fill="#e2e8f0" opacity=".55" />)}
      <polyline points={ROUTE.map(point => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#64748b" strokeWidth="3" strokeDasharray="5 8" strokeLinejoin="round" strokeLinecap="round" opacity=".75" />
      {traveled > 0 && <polyline points={routeTo(traveled)} fill="none" stroke={`url(#bej-mission-trail-${gradientId})`} strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />}
      {PLANETS.map(planet => {
        const point = routePoint(planet.at);
        return <PlanetArt key={planet.name} planet={planet} x={point.x} y={point.y} achieved={completed >= planet.at} />;
      })}
      {/* Scientific tributes are independent of the progress route and do not change milestones. */}
      <SpaceTribute kind="webb" x={116} y={79} onSelect={setSelectedTribute} />
      <SpaceTribute kind="voyager" x={333} y={70} onSelect={setSelectedTribute} />
      {/* A dashed tether connects the off-route rocket to the precise progress marker. */}
      <line x1={position.x} y1={position.y} x2={rocketX} y2={rocketY} stroke="#7dd3fc" strokeWidth="1.8" strokeDasharray="4 5" strokeLinecap="round" opacity=".9" />
      <circle cx={position.x} cy={position.y} r="9" fill="#22c55e" fillOpacity=".22" />
      <circle cx={position.x} cy={position.y} r="5.5" fill="#22c55e" stroke="#dcfce7" strokeWidth="1.5" />
      <g transform={`translate(${rocketX} ${rocketY}) rotate(${rocketAngle})`}>
        <path d="M -5 12 L -8 22 L 0 17 L 8 22 L 5 12" fill="#fb923c" />
        <path d="M 0 -20 Q 11 -9 9 9 L 5 14 H -5 L -9 9 Q -11 -9 0 -20 Z" fill="#f8fafc" stroke="#475569" strokeWidth="1.5" />
        <circle cy="-4" r="4.5" fill="#38bdf8" />
        <path d="M -9 4 L -14 14 L -7 10 M 9 4 L 14 14 L 7 10" fill="#ef4444" />
      </g>
    </svg>
    {selectedTribute && <div role="status" style={{ marginTop: 10, padding: "10px 12px", border: "1px solid #64748b", borderRadius: 10 }}>
      <strong>{TRIBUTE_DETAILS[selectedTribute].title}</strong>
      <button type="button" onClick={() => setSelectedTribute(null)} aria-label="Fechar homenagem" style={{ float: "right", cursor: "pointer" }}>×</button>
      <p style={{ margin: "6px 0 0", fontSize: 13 }}>{TRIBUTE_DETAILS[selectedTribute].detail}</p>
    </div>}
    <p style={{ margin: "8px 0 0", textAlign: "center", fontSize: 13 }}>
      {next ? `Próximo destino: ${next.name} (${Math.round(next.at * 100)}%)` : "🏆 Missão concluída: Netuno conquistado!"}
    </p>
  </div>;
}
