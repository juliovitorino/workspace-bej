import { useId, useMemo } from "react";

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
const ROUTE = WAYPOINTS.map(([x, y]) => ({ x, y }));
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

function PlanetArt({ planet, x, y, achieved, id }: { planet: Planet; x: number; y: number; achieved: boolean; id: string }) {
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

export function StudyPlanetMission({ percentage, progress, launchElapsedMs, onReplay }: {
  percentage: number;
  progress: number;
  launchElapsedMs: number;
  onReplay: () => void;
}) {
  const gradientId = useId().replace(/:/g, "");
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
  const rocketAngle = launching ? launchAngle : position.angle;
  const rocketY = launching ? position.y - Math.max(0, Math.min(1, (launchElapsedMs - 500) / 750)) * 17 : position.y;
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
        return <PlanetArt key={planet.name} planet={planet} x={point.x} y={point.y} achieved={completed >= planet.at} id={gradientId} />;
      })}
      <g transform={`translate(${position.x} ${rocketY}) rotate(${rocketAngle})`}>
        <path d="M -5 12 L -8 22 L 0 17 L 8 22 L 5 12" fill="#fb923c" />
        <path d="M 0 -20 Q 11 -9 9 9 L 5 14 H -5 L -9 9 Q -11 -9 0 -20 Z" fill="#f8fafc" stroke="#475569" strokeWidth="1.5" />
        <circle cy="-4" r="4.5" fill="#38bdf8" />
        <path d="M -9 4 L -14 14 L -7 10 M 9 4 L 14 14 L 7 10" fill="#ef4444" />
      </g>
    </svg>
    <p style={{ margin: "8px 0 0", textAlign: "center", fontSize: 13 }}>
      {next ? `Próximo destino: ${next.name} (${Math.round(next.at * 100)}%)` : "🏆 Missão concluída: Netuno conquistado!"}
    </p>
  </div>;
}
