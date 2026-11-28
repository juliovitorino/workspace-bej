import { useState, type CSSProperties } from "react";
import "./brainLearning.css";

type BodyPart = "Cérebro" | "Ouvidos" | "Olhos" | "Boca" | "Mãos";
type Activity = {
  id: string;
  label: string;
  icon: string;
  color: string;
  parts: BodyPart[];
  description: string;
  practice: string;
};

const activities: Activity[] = [
  { id: "listening", label: "Listening", icon: "👂", color: "#22b8cf", parts: ["Ouvidos", "Cérebro"], description: "O som chega pelos ouvidos e é interpretado por redes cerebrais que participam da compreensão da linguagem.", practice: "Ouça uma frase e tente compreender a intenção antes de ler a tradução." },
  { id: "speaking", label: "Speaking", icon: "🎙️", color: "#f59e0b", parts: ["Cérebro", "Boca", "Ouvidos"], description: "O cérebro organiza a mensagem e coordena a produção da fala. Você também escuta a própria voz para ajustar o que diz.", practice: "Responda em voz alta, mesmo que sua frase não esteja perfeita." },
  { id: "writing", label: "Writing", icon: "✍️", color: "#a78bfa", parts: ["Cérebro", "Olhos", "Mãos"], description: "Escrever envolve planejar frases, recuperar palavras, observar o texto e coordenar movimentos. A prática pode ajudar a consolidar o aprendizado.", practice: "Escreva uma frase nova com a intenção que acabou de estudar." },
  { id: "reading", label: "Reading", icon: "📖", color: "#60a5fa", parts: ["Olhos", "Cérebro"], description: "Os olhos captam a escrita e o cérebro reconhece padrões, relaciona palavras e constrói significado.", practice: "Leia uma frase e identifique a intenção antes de consultar a explicação." },
  { id: "shadowing", label: "Shadowing", icon: "🔁", color: "#fb7185", parts: ["Ouvidos", "Cérebro", "Boca"], description: "Ao ouvir e repetir, você pratica a coordenação entre percepção auditiva, articulação, ritmo e entonação.", practice: "Repita acompanhando o ritmo de uma gravação curta." },
  { id: "conversation", label: "Conversação", icon: "💬", color: "#34d399", parts: ["Ouvidos", "Cérebro", "Boca"], description: "Conversar integra compreensão, memória, planejamento e fala em tempo real. É uma oportunidade de aplicar o que você aprendeu.", practice: "Participe de um Small Talk e responda espontaneamente." }
];

const points: { part: BodyPart; x: number; y: number }[] = [
  { part: "Ouvidos", x: 118, y: 105 }, { part: "Ouvidos", x: 222, y: 105 },
  { part: "Olhos", x: 156, y: 97 }, { part: "Olhos", x: 184, y: 97 },
  { part: "Boca", x: 170, y: 132 },
  { part: "Mãos", x: 68, y: 334 }, { part: "Mãos", x: 272, y: 334 }
];

const links: { part: BodyPart; x: number; y: number }[] = [
  { part: "Ouvidos", x: 118, y: 105 }, { part: "Olhos", x: 156, y: 97 },
  { part: "Boca", x: 170, y: 132 }, { part: "Mãos", x: 68, y: 334 }
];

export function BrainLearningPage() {
  const [selected, setSelected] = useState("listening");
  const activity = activities.find(item => item.id === selected) ?? activities[0];
  const active = (part: BodyPart) => activity.parts.includes(part);

  return (
    <section className="bej-brain" aria-labelledby="bej-brain-title" style={{ "--brain-accent": activity.color } as CSSProperties}>
      <header className="bej-brain-header">
        <span>BRAZILIAN ENGLISH JOURNEY</span>
        <h1 id="bej-brain-title">🧠 BEJ e seu Cérebro</h1>
        <p>Descubra como você aprende inglês</p>
      </header>

      <div className="bej-brain-illustration">
        <svg viewBox="0 0 340 385" role="img" aria-label={`Corpo humano ilustrado. Partes destacadas para ${activity.label}: ${activity.parts.join(", ")}`}>
          <defs>
            <linearGradient id="bej-body-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#263b59" /><stop offset="1" stopColor="#15243d" />
            </linearGradient>
            <radialGradient id="bej-brain-glow">
              <stop offset="0" stopColor={activity.color} stopOpacity=".5" />
              <stop offset="1" stopColor={activity.color} stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="170" cy="100" r="83" fill="url(#bej-brain-glow)" opacity=".65" />
          <g stroke="#4d6b90" strokeWidth="1.5" fill="url(#bej-body-gradient)">
            <path d="M151 147 L151 170 Q125 176 106 188 Q87 201 80 226 L61 327 Q60 339 70 342 Q81 345 86 332 L112 258 L115 367 L225 367 L228 258 L254 332 Q259 345 270 342 Q280 339 279 327 L260 226 Q253 201 234 188 Q215 176 189 170 L189 147Z" />
            <rect x="145" y="55" width="50" height="101" rx="24" fill="#233751" />
            <ellipse cx="170" cy="91" rx="53" ry="68" fill="#233751" />
            <path d="M121 85 Q118 20 170 18 Q224 21 219 85 Q208 57 190 54 Q167 70 139 53 Q128 69 121 85" fill="#102039" />
          </g>
          <g fill="none" stroke="#a7bcd8" strokeWidth="1.5" opacity=".85">
            <path d="M149 97 Q155 92 162 97 M178 97 Q185 92 191 97" />
            <path d="M170 99 L167 118 L174 118" />
            <path d="M158 132 Q170 138 182 132" />
          </g>
          <g fill={active("Cérebro") ? activity.color : "#526983"} stroke={active("Cérebro") ? activity.color : "#7e94ae"} strokeWidth="1.4">
            <path d="M139 65 Q132 49 145 43 Q146 30 159 34 Q170 25 180 35 Q196 29 201 43 Q213 47 203 63 Q207 77 192 80 Q179 88 170 80 Q157 87 146 78 Q135 80 139 65Z" fillOpacity={active("Cérebro") ? ".35" : ".12"} />
            <path d="M170 35 Q164 44 169 50 Q159 56 169 65 L170 80 M149 45 Q158 47 156 57 Q147 60 151 69 M190 43 Q182 50 187 58 Q196 62 189 72" fill="none" />
          </g>
          {links.filter(p => active(p.part)).map(p => (
            <path key={p.part} className="bej-brain-signal" d={`M${p.x} ${p.y} Q${(p.x + 170) / 2} ${Math.min(p.y, 65) - 14} 170 56`}
              stroke={activity.color} strokeWidth="1.5" strokeDasharray="4 5" fill="none" />
          ))}
          {points.map((p, index) => (
            <g key={`${p.part}-${index}`}>
              <circle className={active(p.part) ? "bej-brain-point-active" : ""} cx={p.x} cy={p.y} r={active(p.part) ? 8 : 3}
                fill={active(p.part) ? activity.color : "#54677f"} fillOpacity={active(p.part) ? ".2" : ".5"}
                stroke={active(p.part) ? activity.color : "#54677f"} strokeWidth={active(p.part) ? 2 : 1} />
              {active(p.part) && <circle cx={p.x} cy={p.y} r="3" fill={activity.color} />}
            </g>
          ))}
          <g fontSize="10" fontWeight="600" fill="#d6e3f6">
            <path d="M204 52 L240 35 L286 35" stroke={active("Cérebro") ? activity.color : "#4d6583"} fill="none" />
            <text x="288" y="28" textAnchor="end" fill={active("Cérebro") ? activity.color : "#a3b5cc"}>CÉREBRO</text>
            <path d="M118 105 L82 112 L28 112" stroke={active("Ouvidos") ? activity.color : "#4d6583"} fill="none" />
            <text x="26" y="105" fill={active("Ouvidos") ? activity.color : "#a3b5cc"}>OUVIDOS</text>
            <path d="M184 97 L232 117 L309 117" stroke={active("Olhos") ? activity.color : "#4d6583"} fill="none" />
            <text x="307" y="110" textAnchor="end" fill={active("Olhos") ? activity.color : "#a3b5cc"}>OLHOS</text>
            <path d="M170 132 L219 150 L299 150" stroke={active("Boca") ? activity.color : "#4d6583"} fill="none" />
            <text x="297" y="144" textAnchor="end" fill={active("Boca") ? activity.color : "#a3b5cc"}>BOCA</text>
            <path d="M68 334 L40 354 L15 354" stroke={active("Mãos") ? activity.color : "#4d6583"} fill="none" />
            <text x="15" y="368" fill={active("Mãos") ? activity.color : "#a3b5cc"}>MÃOS</text>
          </g>
          <text x="170" y="380" textAnchor="middle" fontSize="9" fill="#7f96b5">Representação didática simplificada</text>
        </svg>
      </div>

      <div className="bej-brain-activities" role="group" aria-label="Escolha uma atividade de aprendizagem">
        {activities.map(item => (
          <button key={item.id} type="button" className={selected === item.id ? "bej-brain-activity selected" : "bej-brain-activity"}
            style={{ "--activity-color": item.color } as CSSProperties}
            aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>
            <span aria-hidden="true">{item.icon}</span><span>{item.label}</span>
          </button>
        ))}
      </div>

      <article className="bej-brain-explanation" aria-live="polite">
        <h2><span aria-hidden="true">{activity.icon}</span> {activity.label}</h2>
        <div className="bej-brain-parts">{activity.parts.map(part => <span key={part}>{part}</span>)}</div>
        <p>{activity.description}</p>
        <div className="bej-brain-practice">
          <h3>EXPERIMENTE NO BEJ</h3>
          <p>{activity.practice}</p>
        </div>
      </article>
      <p className="bej-brain-disclaimer">As conexões ilustradas são uma representação pedagógica, não um mapa literal de ativação cerebral.</p>
    </section>
  );
}
