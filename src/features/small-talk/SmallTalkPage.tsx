import { useEffect, useMemo, useState } from 'react';
import { loadSmallTalkIndex, loadSmallTalkTopic } from '../../services/smallTalkCatalogService';
import { readSmallTalkPersonalAnswers } from '../../services/smallTalkPersonalAnswersService';
import type { SmallTalkItem, SmallTalkTopic, SmallTalkTopicIndexEntry, SmallTalkWalkingSettings } from '../../types/smallTalk';
import { readLocalJson, readWalkingSettings, saveLocalJson, SMALL_TALK_FAVORITES_KEY, SMALL_TALK_WALKING_SETTINGS_KEY } from './smallTalkPreferences';
import { SmallTalkWalking } from './SmallTalkWalking';

interface Props {
  onStudyState?: (active: boolean, mode: 'manual' | 'walking') => void;
  onWalkingChange?: (active: boolean) => void;
}

type LevelFilter = 'all' | 'unclassified' | 'a1' | 'a2' | 'b1' | 'b2' | 'c1';
const levelOptions: LevelFilter[] = ['all', 'unclassified', 'a1', 'a2', 'b1', 'b2', 'c1'];

export function SmallTalkPage({ onStudyState, onWalkingChange }: Props) {
  const [topics, setTopics] = useState<SmallTalkTopicIndexEntry[]>([]);
  const [topicId, setTopicId] = useState('');
  const [topic, setTopic] = useState<SmallTalkTopic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<LevelFilter>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => readLocalJson<string[]>(SMALL_TALK_FAVORITES_KEY, []));
  const [settings, setSettings] = useState<SmallTalkWalkingSettings>(readWalkingSettings);
  const [walking, setWalking] = useState(false);
  const [answerVisible, setAnswerVisible] = useState<string[]>([]);
  const [personalAnswers, setPersonalAnswers] = useState<ReturnType<typeof readSmallTalkPersonalAnswers> | null>(null);
  const [privateError, setPrivateError] = useState('');

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    loadSmallTalkIndex(controller.signal).then(index => {
      if (!active) return;
      const enabled = index.topics.filter(t => t.enabled).sort((a, b) => a.order - b.order);
      setTopics(enabled);
      setTopicId(current => current || enabled[0]?.id || '');
    }).catch(e => { if (active && !controller.signal.aborted) { setError(String(e)); setLoading(false); } });
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => {
    if (!topicId) return;
    let active = true;
    const controller = new AbortController();
    setLoading(true); setError(''); setAnswerVisible([]);
    loadSmallTalkTopic(topicId, 'en-US', controller.signal).then(value => {
      if (active) { setTopic(value); setLoading(false); }
    }).catch(e => { if (active && !controller.signal.aborted) { setError(String(e)); setLoading(false); } });
    return () => { active = false; controller.abort(); };
  }, [topicId]);

  useEffect(() => {
    try { setPersonalAnswers(readSmallTalkPersonalAnswers(window.localStorage)); setPrivateError(''); }
    catch { setPrivateError('O armazenamento privado não pôde ser lido. Faça backup e confira sua importação.'); setPersonalAnswers(null); }
  }, [walking]);

  const filtered = useMemo(() => {
    return (topic?.items ?? []).filter(item => {
      if (!item.enabled || !item.question?.text) return false;
      if (query.trim() && !item.question.text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) return false;
      if (level !== 'all' && (level === 'unclassified' ? item.level !== null : item.level !== level)) return false;
      if (favoritesOnly && !favorites.includes(item.id)) return false;
      return true;
    });
  }, [topic, query, level, favoritesOnly, favorites]);

  function toggleFavorite(id: string) {
    const next = favorites.includes(id) ? favorites.filter(v => v !== id) : [...favorites, id];
    try { saveLocalJson(SMALL_TALK_FAVORITES_KEY, next); setFavorites(next); }
    catch { setError('Não foi possível salvar favoritos no dispositivo.'); }
  }
  function updateWalking<K extends keyof SmallTalkWalkingSettings>(key: K, value: SmallTalkWalkingSettings[K]) {
    const next = { ...settings, [key]: value, defaultAnswerSource: 'original' as const };
    try { saveLocalJson(SMALL_TALK_WALKING_SETTINGS_KEY, next); setSettings(next); }
    catch { setError('Não foi possível salvar as configurações da caminhada.'); }
  }
  function reveal(id: string) { setAnswerVisible(old => old.includes(id) ? old.filter(v => v !== id) : [...old, id]); }
  function answerFor(item: SmallTalkItem) { return personalAnswers?.answersByItemId[item.id]?.original?.segments.map(s => s.text).join('\n\n') ?? ''; }
  const walkItems = useMemo(() => {
    const selected = filtered.slice();
    if (settings.shuffle) {
      // Sorteio somente ao iniciar, não no render (via função startWalking).
      return selected;
    }
    return selected;
  }, [filtered, settings.shuffle]);
  const [sessionItems, setSessionItems] = useState<SmallTalkItem[]>([]);
  function startWalking() {
    if (!walkItems.length) return;
    const selection = walkItems.slice();
    if (settings.shuffle) {
      for (let i = selection.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [selection[i], selection[j]] = [selection[j], selection[i]];
      }
    }
    setSessionItems(selection); setWalking(true);
  }

  if (walking) return <SmallTalkWalking items={sessionItems} settings={settings}
    onStudyState={onStudyState} onWalkingChange={onWalkingChange} onExit={() => { setWalking(false); onStudyState?.(false, 'walking'); }} />;

  return <section className="small-talk-page" aria-label="Small Talk">
    <header><p className="eyebrow">Brazilian English Journey</p><h2>💬 Small Talk</h2>
      <p>Pratique conversas reais com perguntas do seu documento. Responda em voz alta, com suas próprias palavras.</p>
    </header>
    {error && <p className="warning-banner" role="alert">{error}</p>}
    {privateError && <p className="warning-banner" role="alert">{privateError}</p>}
    <div className="small-talk-filters">
      <label>Tópico <select value={topicId} onChange={e => setTopicId(e.target.value)}>{topics.map(t => <option key={t.id} value={t.id}>{t.sourceTitle}</option>)}</select></label>
      <label>Pesquisar pergunta <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search questions..." /></label>
      <label>Nível <select value={level} onChange={e => setLevel(e.target.value as LevelFilter)}>{levelOptions.map(l => <option key={l} value={l}>{l === 'all' ? 'Todos' : l === 'unclassified' ? 'Sem classificação' : l.toUpperCase()}</option>)}</select></label>
      <label><input type="checkbox" checked={favoritesOnly} onChange={e => setFavoritesOnly(e.target.checked)} /> Apenas favoritos</label>
    </div>
    <section className="small-talk-settings" aria-labelledby="small-talk-settings-title">
      <h3 id="small-talk-settings-title">🚶 Configurar Modo Caminhada</h3>
      <p><strong>Resposta padrão:</strong> sempre a resposta original do DOCX, nunca uma revisão.</p>
      <label>Reproduzir resposta padrão <select value={settings.playDefaultAnswer ? 'yes' : 'no'} onChange={e => updateWalking('playDefaultAnswer', e.target.value === 'yes')}><option value="no">NÃO — eu respondo espontaneamente</option><option value="yes">SIM — ouvir minha resposta original</option></select></label>
      <label>Repetições <input type="number" min="1" max="10" value={settings.repeatCount} onChange={e => updateWalking('repeatCount', Math.max(1, Math.min(10, Number(e.target.value) || 5)))} /></label>
      <label>Pausa para responder (segundos) <input type="number" min="1" max="90" value={settings.pauseAfterQuestionSeconds} onChange={e => updateWalking('pauseAfterQuestionSeconds', Math.max(1, Math.min(90, Number(e.target.value) || 10)))} /></label>
      <label>Intervalo entre repetições (segundos) <input type="number" min="0" max="10" value={settings.pauseBetweenRepetitionsSeconds} onChange={e => updateWalking('pauseBetweenRepetitionsSeconds', Math.max(0, Math.min(10, Number(e.target.value) || 0)))} /></label>
      <label><input type="checkbox" checked={settings.shuffle} onChange={e => updateWalking('shuffle', e.target.checked)} /> Embaralhar perguntas</label>
      <label><input type="checkbox" checked={settings.keepScreenAwake} onChange={e => updateWalking('keepScreenAwake', e.target.checked)} /> Manter tela ligada quando possível</label>
      <p className="settings-dialog-help">Os filtros acima determinam quais perguntas entram na caminhada. Atualmente não há MP3s do Small Talk; o áudio usa a voz inglesa disponível no dispositivo.</p>
      <button type="button" className="primary-button" disabled={loading || !filtered.length} onClick={startWalking}>▶ Iniciar Modo Caminhada ({filtered.length} perguntas)</button>
    </section>
    <header className="results-header"><h3>{loading ? 'Carregando...' : `${topic?.title ?? ''} — ${filtered.length} perguntas`}</h3></header>
    <div className="small-talk-question-list">{filtered.map(item => {
      const original = answerFor(item);
      const shown = answerVisible.includes(item.id);
      return <article className="small-talk-question-card" key={item.id}>
        <p><strong>{item.question?.text}</strong></p>
        <p className="settings-dialog-help">{item.level?.toUpperCase() ?? 'Nível pendente'} · {item.reviewStatus === 'pending' ? 'Revisão editorial pendente' : item.reviewStatus}</p>
        <div className="small-talk-actions">
          <button type="button" className="secondary-button" aria-pressed={favorites.includes(item.id)} onClick={() => toggleFavorite(item.id)}>{favorites.includes(item.id) ? '★ Favorito' : '☆ Favoritar'}</button>
          {original && <button type="button" className="secondary-button" onClick={() => reveal(item.id)}>{shown ? 'Ocultar resposta original' : 'Ver resposta original'}</button>}
          {!original && <span className="settings-dialog-help">Sem resposta original importada</span>}
        </div>
        {shown && original && <p className="small-talk-original" style={{ whiteSpace: 'pre-wrap' }}>{original}</p>}
      </article>;
    })}</div>
    {!loading && filtered.length === 0 && <p>Nenhuma pergunta corresponde aos filtros.</p>}
  </section>;
}
