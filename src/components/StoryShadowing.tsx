import { ControlIcon } from "./ControlIcon";
import { useMemo, useRef, useState } from "react";
import { LANGUAGES, type StudentLanguage } from "../config/languages";
import { searchShadowingStories, type LocalStory } from "../services/localStoryService";
import { defaultShadowingSettings, formatPracticeTime, sentenceSegments, type ShadowingSettings } from "../utils/storyShadowing";
import { useStoryShadowing } from "../hooks/useStoryShadowing";
import { ChunkLevelSelect } from "./ChunkLevelSelect";
import type { ChunkLevel } from "../utils/chunkEligibility";

const techniqueNames = { listen: "Listen — Escutar", repeat: "Repeat after me — Repetir após a voz", shadow: "Shadowing — Acompanhar a voz", combined: "Listen → Repeat after me → Shadowing" };
function Settings({ value, onChange, sentenceAvailable }: { value: ShadowingSettings; onChange: (value: ShadowingSettings) => void; sentenceAvailable: boolean }) {
  function update<K extends keyof ShadowingSettings>(key: K, next: ShadowingSettings[K]) { onChange({ ...value, [key]: next }); }
  return <div className="shadowing-settings">
    <label>Escopo<select value={value.scope} onChange={e => update("scope", e.target.value as ShadowingSettings["scope"])}><option value="story">História inteira</option><option value="paragraph">Por parágrafo</option></select></label>
    <label>Controle<select value={value.control} onChange={e => onChange({ ...value, control: e.target.value as ShadowingSettings["control"], automatic: e.target.value === "automatic" })}><option value="automatic">Automático</option><option value="manual">Manual</option></select></label>
    <label>Técnica<select value={value.technique} onChange={e => update("technique", e.target.value as ShadowingSettings["technique"])}>{Object.entries(techniqueNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
    <label>Unidade<select value={value.unit} onChange={e => update("unit", e.target.value as ShadowingSettings["unit"])}><option value="paragraph">Parágrafo completo</option><option value="sentence" disabled={!sentenceAvailable}>Frase individual{!sentenceAvailable ? " (indisponível)" : ""}</option></select></label>
    <label>Velocidade<select value={value.rate} onChange={e => update("rate", Number(e.target.value))}>{[.8, .9, 1].map(v => <option key={v} value={v}>{v.toFixed(1)}×</option>)}</select></label>
    <label>Repetições<select value={value.repetitions} onChange={e => update("repetitions", Number(e.target.value))}>{Array.from({ length: 10 }, (_, i) => i + 1).map(v => <option key={v}>{v}</option>)}</select></label>
    <label>Intervalo entre reproduções (segundos)<input type="number" min="0" max="60" value={value.interval} onChange={e => update("interval", Math.max(0, Math.min(60, Number(e.target.value) || 0)))} /></label>
    <label><input type="checkbox" checked={value.automatic} disabled={value.control === "manual"} onChange={e => update("automatic", e.target.checked)} /> Avanço automático entre parágrafos</label>
    <label><input type="checkbox" checked={value.translation} onChange={e => update("translation", e.target.checked)} /> Mostrar tradução PT-BR</label>
    <label><input type="checkbox" checked={value.keepAwake} onChange={e => update("keepAwake", e.target.checked)} /> Manter tela ativa, se suportado</label>
    <p>Listen toca uma vez. As repetições configuradas se aplicam a Repeat after me e Shadowing. A pausa de resposta é estimada pelo tamanho do trecho, além do intervalo escolhido.</p>
  </div>;
}

function Practice({ story, language, settings, selected, onSettings, onBack, onMenu, onRestart }: {
  story: LocalStory; language: StudentLanguage; settings: ShadowingSettings; selected: number;
  onSettings: (settings: ShadowingSettings) => void; onBack: () => void; onMenu: () => void; onRestart: () => void;
}) {
  const session = useStoryShadowing(story, language, settings, selected);
  const [configuring, setConfiguring] = useState(false);
  const summaryRef = useRef<HTMLElement>(null);
  function play() {
    session.play();
    summaryRef.current?.scrollIntoView({
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      block: "start",
    });
  }
  const paragraph = story.paragraphs[session.paragraph];
  return <>
    <div className="shadowing-heading"><h3>{story.titleEn}</h3><button type="button" onClick={() => { session.stop(); onBack(); }}>Escolher outra história</button></div>
    <section ref={summaryRef} className="shadowing-session" aria-label="Resumo da prática">
      <div className="shadowing-session-meta"><span>{LANGUAGES[language].name}</span><span className="shadowing-level">{story.englishLevel}</span></div>
      <div className="shadowing-session-stats">
        <div className="shadowing-session-clock"><span className="shadowing-stat-label">Tempo de prática</span><time>{formatPracticeTime(session.elapsed)}</time><span className="shadowing-stat-note">Cada minuto conta</span></div>
        <div className="shadowing-session-progress">
          <span className="shadowing-stat-label">{settings.scope === "paragraph" ? "Seu parágrafo" : "Sua jornada na história"}</span>
          <p className="shadowing-paragraph-position"><strong>{String(session.paragraph + 1).padStart(2, "0")}</strong><span> / {String(story.paragraphs.length).padStart(2, "0")} parágrafos</span></p>
          <progress aria-label="Parágrafos concluídos" value={session.completed} max={settings.scope === "paragraph" ? 1 : story.paragraphs.length} />
          <span className="shadowing-stat-note">{session.completed} de {settings.scope === "paragraph" ? 1 : story.paragraphs.length} {session.completed === 1 ? "parágrafo concluído" : "parágrafos concluídos"}</span>
        </div>
      </div>
    </section>
    {session.complete ? <div role="status" className="status-card">
      <h3>{settings.scope === "paragraph" ? "Parágrafo concluído!" : session.completed === story.paragraphs.length ? "História concluída!" : "Prática concluída!"}</h3>
      <p>{session.completed} parágrafo(s) concluído(s) · {techniqueNames[settings.technique]}</p>
      <div className="shadowing-controls"><button type="button" onClick={onRestart}>Praticar novamente</button><button type="button" onClick={onBack}>Escolher outra história</button><button type="button" onClick={onMenu}>Voltar ao menu principal</button></div>
    </div> : <>
      <article className="shadowing-reading">
        <p lang={language}>{session.segments.map((part, index) => settings.unit === "sentence" && index === session.sentence ? <mark key={index}>{part}</mark> : <span key={index}>{part}</span>)}</p>
        {settings.translation && paragraph.pt && <p className="shadowing-translation" lang="pt-BR">{paragraph.pt}</p>}
      </article>
      <p role="status">{session.fullReading ? "Leitura completa do parágrafo" : techniqueNames[session.step.technique]} · Repetição {session.step.repetition}/{session.step.total} · <strong>{session.playing ? session.phase === "wait" ? "Pausa para praticar" : "Reproduzindo" : "Aguardando Play"}</strong></p>
      {settings.unit === "sentence" && <p>Frase {session.sentence + 1}/{session.segments.length}</p>}
      <div className="shadowing-controls shadowing-desktop-controls" role="group" aria-label="Controles de reprodução">
        <button type="button" aria-label="Anterior" disabled={!session.canPrevious} onClick={() => session.navigate(-1)}>⏮ Anterior</button>
        <button type="button" aria-label="Play" disabled={session.playing || !session.hasVoice || configuring} onClick={play}>▶ Play</button>
        <button type="button" aria-label="Pause" disabled={!session.playing} onClick={session.pause}>⏸ Pause</button>
        <button type="button" aria-label="Próximo" disabled={!session.canNext} onClick={() => session.navigate(1)}>Próximo ⏭</button>
        <button type="button" aria-label="Repetir" disabled={!session.hasVoice || configuring} onClick={session.repeat}>↻ Repetir</button>
        <button type="button" aria-label="Stop" onClick={session.stop}>■ Stop</button>
        <button type="button" aria-label="Configurações" aria-expanded={configuring} onClick={() => { session.pause(); setConfiguring(v => !v); }}>⚙ Configurações</button>
      </div>
      <div className="shadowing-mobile-controls" role="group" aria-label="Controles de reprodu??o mobile">
        <button type="button" aria-label="Anterior" disabled={!session.canPrevious} onClick={() => session.navigate(-1)}><ControlIcon lucide name="previous" /></button>
        <button type="button" className="walking-toggle" aria-label={session.playing ? "Pausar" : "Continuar"} disabled={!session.playing && (!session.hasVoice || configuring)} onClick={session.playing ? session.pause : play}><ControlIcon lucide name={session.playing ? "pause" : "play"} /></button>
        <button type="button" aria-label="Pr?ximo" disabled={!session.canNext} onClick={() => session.navigate(1)}><ControlIcon lucide name="next" /></button>
        <button type="button" aria-label="Repetir" disabled={!session.hasVoice || configuring} onClick={session.repeat}><ControlIcon lucide name="repeat" /></button>
        <button type="button" aria-label="Parar" onClick={session.stop}><ControlIcon lucide name="stop" /></button>
        <button type="button" aria-label="Configura??es" aria-expanded={configuring} onClick={() => { session.pause(); setConfiguring(v => !v); }}><ControlIcon lucide name="settings" /></button>
      </div>
    </>}
    {settings.unit === "sentence" && <button type="button" disabled={!session.hasVoice || configuring} onClick={session.readParagraph}>Ouvir parágrafo completo</button>}
    {!session.hasVoice && <p role="alert">Nenhuma voz compatível disponível. Habilite uma voz de {LANGUAGES[language].name} no sistema ou navegador. A lista será atualizada quando as vozes carregarem; o texto continua disponível para leitura.</p>}
    {session.error && <p role="alert">{session.error}</p>}
    {session.warning && <p role="status">{session.warning}</p>}
    {configuring && <Settings value={settings} sentenceAvailable={story.paragraphs.some(p => sentenceSegments(p.en, language).length > 1)} onChange={value => {
      session.configure(value);
      // The selected scope applies to the current paragraph when changed during practice.
      onSettings(value);
    }} />}
    <p className="walking-note">Ao continuar uma fala pausada, o trecho atual recomeça. Pausas programadas retomam o tempo restante. Mantenha a página aberta: áudio em segundo plano ou com a tela bloqueada depende do navegador e do sistema.</p>
  </>;
}

export function StoryShadowing({ language, onMenu }: { language: StudentLanguage; onMenu: () => void }) {
  const [level, setLevel] = useState<ChunkLevel>("all");
  const [query, setQuery] = useState("");
  const [story, setStory] = useState<LocalStory | null>(null);
  const [selected, setSelected] = useState(0);
  const [practicing, setPracticing] = useState(false);
  const [sessionVersion, setSessionVersion] = useState(0);
  const [settings, setSettings] = useState(defaultShadowingSettings);
  const stories = useMemo(() => searchShadowingStories(language, level, query), [language, level, query]);
  function back() { setPracticing(false); setStory(null); }
  return <section className="shadowing" aria-labelledby="shadowing-title">
    <h2 id="shadowing-title">🎧 Shadowing</h2>
    {practicing && story ? <Practice key={sessionVersion} {...{ story, language, settings, selected, onMenu }} onRestart={() => setSessionVersion(v => v + 1)} onSettings={setSettings} onBack={back} /> : story ? <>
      <h3>{story.titleEn}</h3><p>{story.englishLevel} · {story.paragraphs.length} parágrafos</p>
      <Settings value={settings} onChange={setSettings} sentenceAvailable={story.paragraphs.some(p => sentenceSegments(p.en, language).length > 1)} />
      {settings.scope === "paragraph" && <label>Selecionar parágrafo<select value={selected} onChange={e => setSelected(Number(e.target.value))}>{story.paragraphs.map((_, i) => <option key={i} value={i}>Parágrafo {i + 1}</option>)}</select></label>}
      <p className="shadowing-preview" lang={language}>{story.paragraphs[settings.scope === "paragraph" ? selected : 0].en}</p>
      <div className="shadowing-controls"><button type="button" onClick={back}>Voltar à seleção</button><button type="button" className="primary-button" onClick={() => { if (settings.scope === "story") setSelected(0); setPracticing(true); }}>Iniciar prática</button></div>
    </> : <>
      <div className="shadowing-search" role="search" aria-label="Pesquisar histórias para Shadowing">
        <ChunkLevelSelect value={level} onChange={setLevel} />
        <label><span aria-hidden="true">⌕ </span>Pesquisar histórias<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Título ou tema" /></label>
      </div>
      <p role="status">{stories.length} história(s) disponível(is)</p>
      {!stories.length && <p>{language !== "en-US" ? "Ainda não há histórias disponíveis neste idioma. Selecione outro idioma no cabeçalho para consultar sua biblioteca." : "Nenhuma história corresponde aos filtros. Experimente outro nível ou título."}</p>}
      <div className="shadowing-stories">{stories.map((item, i) => <article key={i}>
        <h3 lang={language}>{item.titleEn}</h3><p>{item.englishLevel} · {item.paragraphs.length} parágrafos</p>
        {item.topic && <p>{item.topic}</p>}
        <p className="shadowing-preview" lang={language}>{item.paragraphs[0].en}</p>
        <button type="button" className="primary-button" onClick={() => { setStory(item); setSelected(0); setPracticing(true); }}>Praticar</button>
      </article>)}</div>
    </>}
  </section>;
}
