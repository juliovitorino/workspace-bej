import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { loadSmallTalkIndex, loadSmallTalkTopic } from '../../services/smallTalkCatalogService';
import { readSmallTalkPersonalAnswers } from '../../services/smallTalkPersonalAnswersService';
import type { SmallTalkItem, SmallTalkTopic, SmallTalkTopicIndexEntry, SmallTalkWalkingSettings } from '../../types/smallTalk';
import { readLocalJson, readWalkingSettings, saveLocalJson, SMALL_TALK_FAVORITES_KEY, SMALL_TALK_WALKING_SETTINGS_KEY } from './smallTalkPreferences';
import { SmallTalkWalking } from './SmallTalkWalking';
import { readAnswerOverrides, saveAnswerOverride, restoreOriginalAnswer, pruneRedundantAnswerOverrides } from './smallTalkAnswerOverrides';
import { readQuestionOverrides, saveQuestionOverride, restoreOriginalQuestion, pruneRedundantQuestionOverrides } from './smallTalkQuestionOverrides';

interface Props {
  onStudyState?: (active: boolean, mode: 'manual' | 'walking') => void;
  onWalkingChange?: (active: boolean) => void;
}

type LevelFilter = 'all' | 'unclassified' | 'a1' | 'a2' | 'b1' | 'b2' | 'c1';
const levelOptions: LevelFilter[] = ['all', 'unclassified', 'a1', 'a2', 'b1', 'b2', 'c1'];

// Normalização apenas visual: preserva sourceTitle e IDs do catálogo JSON.
function topicDisplayName(title: string): string {
  const lowerCaseWords = new Set(['and', 'or', 'of', 'the', 'a', 'an', 'to', 'in', 'on', 'for']);
  return title.trim().toLocaleLowerCase('en-US').replace(/\p{L}+/gu, (word, position) => {
    if (position > 0 && lowerCaseWords.has(word)) return word;
    return word.charAt(0).toLocaleUpperCase('en-US') + word.slice(1);
  });
}
const topicSorter = new Intl.Collator('en-US', { sensitivity: 'base', numeric: true });


export function SmallTalkPage({ onStudyState, onWalkingChange }: Props) {
  const [topics, setTopics] = useState<SmallTalkTopicIndexEntry[]>([]);
  const [topicId, setTopicId] = useState('');
  const [topicsMenuOpen, setTopicsMenuOpen] = useState(false);
  const [topicsMenuQuery, setTopicsMenuQuery] = useState('');
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editorId, setEditorId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [answerOverrides, setAnswerOverrides] = useState<ReturnType<typeof readAnswerOverrides>>(() => {
    try { return readAnswerOverrides(); } catch { return {}; }
  });
  const [editError, setEditError] = useState('');
  const [questionOverrides, setQuestionOverrides] = useState(() => { try { return readQuestionOverrides(); } catch { return {}; } });
  const [questionEditorId, setQuestionEditorId] = useState<string | null>(null);
  const [questionDraft, setQuestionDraft] = useState('');
  const [printMode, setPrintMode] = useState<'both' | 'questions' | null>(null);
  const [backupMessage, setBackupMessage] = useState('');
  const [exportCard, setExportCard] = useState<{ item: SmallTalkItem; json: string } | null>(null);
  const [exportApproved, setExportApproved] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [topicExport, setTopicExport] = useState<{ json: string; count: number; answered: number; edited: number; topicId: string } | null>(null);
  const [topicExportApproved, setTopicExportApproved] = useState(false);
  const [topicExportStatus, setTopicExportStatus] = useState('');

  function questionFor(item: SmallTalkItem) { return questionOverrides[item.id]?.text ?? item.question?.text ?? ''; }
  function itemWithQuestion(item: SmallTalkItem): SmallTalkItem {
    const question = questionFor(item);
    return { ...item, question: item.question ? { ...item.question, text: question,
      audio: item.question.text === question ? item.question.audio : null } : null };
  }
  function openQuestionEditor(item: SmallTalkItem) { setQuestionEditorId(item.id); setQuestionDraft(questionFor(item)); setEditError(''); }
  function saveQuestionEditor() {
    if (!questionEditorId || !questionDraft.trim()) { setEditError('Digite uma pergunta.'); return; }
    try { setQuestionOverrides(saveQuestionOverride(questionEditorId, questionDraft, topic?.items.find(item => item.id === questionEditorId)?.question?.text)); setQuestionEditorId(null); setEditError(''); }
    catch { setEditError('Erro ao salvar pergunta no armazenamento local.'); }
  }
  function restoreQuestion(id: string) {
    try { setQuestionOverrides(restoreOriginalQuestion(id)); setQuestionEditorId(null); setEditError(''); }
    catch { setEditError('Erro ao restaurar pergunta.'); }
  }
  async function copyCardText() {
    if (!exportCard) return;
    const text = [questionFor(exportCard.item).trim(), answerFor(exportCard.item).trim()].filter(Boolean).join('\n\n');
    if (navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(text); setExportMessage('Pergunta e resposta copiadas!'); return; } catch { /* fallback */ }
    }
    const field = document.createElement('textarea');
    field.value = text; field.style.position = 'fixed'; field.style.opacity = '0';
    document.body.appendChild(field); field.focus(); field.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch { /* acesso negado */ }
    field.remove(); setExportMessage(copied ? 'Pergunta e resposta copiadas!' : 'Não foi possível copiar. Verifique as permissões.');
  }
  function printTopic(mode: 'both' | 'questions') {
    if (!topic || loading || topic.topicId !== topicId) return;
    const esc = (value: string) => value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    const items = topic.items.filter(item => item.enabled && questionFor(item).trim());
    const cards = items.map((item,index) => '<article class="qa"><div class="q">' + (index + 1) + '. ' + esc(questionFor(item)) + '</div>' +
      (mode === 'both' && answerFor(item).trim() ? '<div class="a">' + esc(answerFor(item).trim()) + '</div>' : '') +
      (mode === 'questions' ? '<div class="notes"></div>' : '') + '</article>').join('');
    const popup = window.open('', '_blank');
    if (!popup) { setEditError('Permita pop-ups para imprimir.'); return; }
    const css = '@page{size:A4;margin:17mm 16mm}body{font:12pt/1.55 Arial,sans-serif;color:#111827;background:white;margin:0}h1{color:#15438f;font-size:20pt}header{border-bottom:2px solid #1d4ed8;margin-bottom:20px}.qa{break-inside:avoid;page-break-inside:avoid;border-bottom:1px solid #ddd;margin-bottom:16px;padding-bottom:12px}.q{font-weight:700;color:#154bb2;white-space:pre-wrap}.a{margin:8px 0 0 20px;white-space:pre-wrap}.notes{margin:10px 0 0 20px;min-height:54px;border-bottom:1px dotted #999}.print{padding:10px}@media print{.print{display:none}}';
    popup.document.open();popup.document.write('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(topic.title) + '</title><style>' + css + '</style></head><body><button class="print" onclick="window.print()">Imprimir / Salvar como PDF</button><header><h1>' + esc(topic.title) + '</h1><p>Brazilian English Journey — ' + (mode === 'both' ? 'Perguntas e respostas' : 'Somente perguntas') + ' — ' + items.length + ' perguntas</p></header>' + cards + '</body></html>');popup.document.close();
    // Aciona o diálogo nativo assim que o documento da nova aba estiver renderizado.
    // O botão no documento continua disponível como alternativa em navegadores restritivos.
    // O evento afterprint ocorre tanto ao imprimir quanto ao cancelar o diálogo.
    // Fechamos somente a aba temporária criada pelo próprio BEJ.
    popup.addEventListener('afterprint', () => {
      popup.setTimeout(() => { if (!popup.closed) popup.close(); }, 100);
    }, { once: true });
    popup.focus();
    popup.setTimeout(() => {
      if (popup.closed) return;
      popup.focus();
      popup.print();
    }, 350);
    setPrintMode(null);
  }
  function prepareTopicExport() {
    if (!topic || loading || topic.topicId !== topicId) return;
    // Todos os itens do catálogo, independentemente de filtros, favoritos ou nível.
    // Preserva campos, ordem e IDs; a resposta ativa tem precedência:
    // edição local > resposta pública > original privado.
    const items = topic.items.map(item => {
      const answer = answerFor(item).trim();
      const activeItem = itemWithQuestion(item);
      if (!answer) return { ...activeItem, answer: null };
      // MP3 público só pode ser mantido quando o texto ainda é o publicado.
      const audio = item.answer?.text === answer ? item.answer.audio : null;
      return { ...activeItem, answer: { text: answer, audio } };
    });
    const output: SmallTalkTopic = { ...topic, items };
    setTopicExport({
      json: JSON.stringify(output, null, 2),
      count: items.length,
      answered: items.filter(item => !!item.answer?.text).length,
      edited: items.filter(item => Object.prototype.hasOwnProperty.call(answerOverrides, item.id) || Object.prototype.hasOwnProperty.call(questionOverrides, item.id)).length,
      topicId: topic.topicId
    });
    setTopicExportApproved(false);
    setTopicExportStatus('');
  }
  async function shareOrDownloadTopic() {
    if (!topicExport || !topicExportApproved) return;
    const filename = `${topicExport.topicId}.json`;
    const file = new File([topicExport.json], filename, { type: 'application/json' });
    // O compartilhamento nativo permite escolher Google Drive no iOS/Android.
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ files: [file], title: `BEJ Small Talk — ${topicExport.topicId}` });
        setTopicExportStatus('Arquivo enviado ao menu de compartilhamento. Confirme o salvamento no Google Drive.');
        return;
      }
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') {
        setTopicExportStatus('Compartilhamento cancelado. Use Baixar JSON para salvar o arquivo.');
        return;
      }
      // Safari/Chrome sem suporte a arquivos compartilhados: baixar localmente.
    }
    downloadTopicJson();
  }
  function downloadTopicJson() {
    if (!topicExport || !topicExportApproved) return;
    try {
      const blob = new Blob([topicExport.json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${topicExport.topicId}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      setTopicExportStatus('Arquivo gerado. Salve no Google Drive para depois substituir o JSON no VS Code.');
    } catch {
      setTopicExportStatus('O navegador não conseguiu gerar o arquivo. Tente outro navegador.');
    }
  }

  function openCardExport(item: SmallTalkItem) {
    const text = answerFor(item).trim();
    // Cards sem resposta também podem ser exportados.
    const publicItem: SmallTalkItem = { ...itemWithQuestion(item), answer: text ? { text, audio: item.answer?.text === text ? item.answer.audio : null } : null };
    setExportCard({ item, json: JSON.stringify(publicItem, null, 2) });
    setExportApproved(false);
    setExportMessage('');
  }
  async function copyCardJson() {
    if (!exportCard || !exportApproved) return;

    // A Clipboard API pode estar indisponível em contextos não seguros
    // (por exemplo, acesso à aplicação via IP local no celular).
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(exportCard.json);
        setExportMessage('JSON copiado para a área de transferência.');
        return;
      } catch {
        // Tenta o método alternativo abaixo.
      }
    }

    const textarea = document.querySelector<HTMLTextAreaElement>(
      '.small-talk-export-modal textarea[aria-label="JSON do card"]'
    );
    if (!textarea) {
      setExportMessage('Não foi possível acessar o texto. Utilize Baixar JSON.');
      return;
    }

    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    try {
      if (document.execCommand('copy')) {
        setExportMessage('JSON copiado para a área de transferência.');
        return;
      }
    } catch {
      // Mantém o texto selecionado para cópia manual.
    }
    setExportMessage('Cópia automática indisponível. O JSON está selecionado: pressione Ctrl+C (ou Copiar no celular), ou use Baixar JSON.');
  }
  function downloadCardJson() {
    if (!exportCard || !exportApproved) return;
    const blob = new Blob([exportCard.json + '\n'], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `small-talk-${topicId}-${exportCard.item.id}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    setExportMessage('JSON gerado. Incorpore manualmente no arquivo do tópico.');
  }

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    loadSmallTalkIndex(controller.signal).then(index => {
      if (!active) return;
      const enabled = index.topics.filter(t => t.enabled).sort((a, b) => topicSorter.compare(topicDisplayName(a.sourceTitle), topicDisplayName(b.sourceTitle)) || a.order - b.order);
      setTopics(enabled);
      setTopicId(current => current || enabled.find(t => t.id === 'greetings')?.id || enabled[0]?.id || '');
    }).catch(e => { if (active && !controller.signal.aborted) { setError(String(e)); setLoading(false); } });
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => {
    if (!topicId) return;
    let active = true;
    const controller = new AbortController();
    setLoading(true); setError(''); setAnswerVisible([]);
    loadSmallTalkTopic(topicId, 'en-US', controller.signal).then(value => {
      if (active) {
        // A limpeza só considera IDs e textos do tópico público efetivamente carregado.
        // Se o armazenamento falhar, não bloqueamos o estudo nem apagamos dados.
        try { setAnswerOverrides(pruneRedundantAnswerOverrides(value.items)); } catch { /* dados preservados */ }
        try { setQuestionOverrides(pruneRedundantQuestionOverrides(value.items)); } catch { /* dados preservados */ }
        setTopic(value); setLoading(false);
      }
    }).catch(e => { if (active && !controller.signal.aborted) { setError(String(e)); setLoading(false); } });
    return () => { active = false; controller.abort(); };
  }, [topicId]);

  useEffect(() => {
    try { setPersonalAnswers(readSmallTalkPersonalAnswers(window.localStorage)); setPrivateError(''); }
    catch { setPrivateError('O armazenamento privado não pôde ser lido. Faça backup e confira sua importação.'); setPersonalAnswers(null); }
  }, [walking]);

  const menuTopics = useMemo(() => topics.filter(t =>
    topicDisplayName(t.sourceTitle).toLocaleLowerCase('en-US').includes(topicsMenuQuery.trim().toLocaleLowerCase('en-US'))
  ), [topics, topicsMenuQuery]);

  useEffect(() => {
    if (!topicsMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onEscape(event: KeyboardEvent) { if (event.key === 'Escape') setTopicsMenuOpen(false); }
    document.addEventListener('keydown', onEscape);
    return () => { document.removeEventListener('keydown', onEscape); document.body.style.overflow = previousOverflow; };
  }, [topicsMenuOpen]);

  function selectTopic(id: string) {
    setTopicId(id);
    setQuery(''); // Evita ocultar perguntas por um termo de busca do tópico anterior.
    setTopicsMenuOpen(false);
  }

  const filtered = useMemo(() => {
    return (topic?.items ?? []).filter(item => {
      if (!item.enabled || !item.question?.text) return false;
      if (query.trim() && !questionFor(item).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) return false;
      if (level !== 'all' && (level === 'unclassified' ? item.level !== null : item.level !== level)) return false;
      if (favoritesOnly && !favorites.includes(item.id)) return false;
      return true;
    });
  }, [topic, query, level, favoritesOnly, favorites, questionOverrides]);

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
  function answerFor(item: SmallTalkItem) {
    if (Object.prototype.hasOwnProperty.call(answerOverrides, item.id)) return answerOverrides[item.id].text ?? '';
    return item.answer?.text || personalAnswers?.answersByItemId[item.id]?.original?.segments.map(s => s.text).join('\n\n') || '';
  }
  function openEditor(item: SmallTalkItem) { setEditorId(item.id); setDraft(answerFor(item)); setEditError(''); }
  function saveEditor() {
    if (!editorId || !draft.trim()) { setEditError('Digite uma resposta ou use a lixeira para removê-la.'); return; }
    try { setAnswerOverrides(saveAnswerOverride(editorId, draft.trim(), topic?.items.find(item => item.id === editorId)?.answer?.text)); setEditorId(null); setAnswerVisible(v => v.includes(editorId) ? v : [...v, editorId]); setEditError(''); }
    catch { setEditError('Não foi possível salvar. Verifique o armazenamento local.'); }
  }
  function removeAnswer(id: string) {
    if (!window.confirm('Ocultar esta resposta ativa? O original importado será preservado e poderá ser restaurado.')) return;
    try { setAnswerOverrides(saveAnswerOverride(id, null)); setAnswerVisible(v => v.filter(x => x !== id)); setEditorId(null); setEditError(''); }
    catch { setEditError('Não foi possível remover a resposta ativa.'); }
  }
  function restoreAnswer(id: string) {
    try { setAnswerOverrides(restoreOriginalAnswer(id)); setEditorId(null); setEditError(''); }
    catch { setEditError('Não foi possível restaurar a resposta importada.'); }
  }
  function downloadEdits() {
    try {
      const backup = JSON.stringify({ schemaVersion: '1.0.0', module: 'small-talk', dataType: 'question-answer-overrides',
        questions: readQuestionOverrides(), answers: readAnswerOverrides(), exportedAt: new Date().toISOString() }, null, 2);
      const blob = new Blob([backup], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'small-talk-perguntas-respostas-privado.json'; a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch { setEditError('Falha ao exportar as edições locais.'); }
  }
  async function importEdits(file: File) {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('Formato inválido');
      const data = parsed as Record<string, unknown>;
      if (data.schemaVersion !== '1.0.0' || data.module !== 'small-talk' ||
          !['question-answer-overrides','answer-overrides'].includes(String(data.dataType))) throw Error('Backup incompatível');
      const incomingQuestions = data.dataType === 'answer-overrides' ? {} : data.questions;
      const incomingAnswers = data.dataType === 'answer-overrides' ? data.overrides : data.answers;
      const valid = (v: unknown, allowNull: boolean) => v !== null && typeof v === 'object' && !Array.isArray(v) &&
        Object.entries(v).every(([id, raw]) => {
          if (!id || !raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
          const e = raw as Record<string, unknown>;
          return typeof e.updatedAt === 'string' && !Number.isNaN(Date.parse(e.updatedAt)) &&
            ((typeof e.text === 'string' && !!e.text.trim()) || (allowNull && e.text === null));
        });
      if (!valid(incomingQuestions, false) || !valid(incomingAnswers, true)) throw Error('Edições inválidas');
      const merge = <T extends {updatedAt: string}>(old: Record<string,T>, added: Record<string,T>) => {
        const next = {...old};
        for (const [id, value] of Object.entries(added)) {
          if (!next[id] || Date.parse(value.updatedAt) > Date.parse(next[id].updatedAt)) next[id] = value;
        }
        return next;
      };
      const questions = merge(readQuestionOverrides(), incomingQuestions as ReturnType<typeof readQuestionOverrides>);
      const answers = merge(readAnswerOverrides(), incomingAnswers as ReturnType<typeof readAnswerOverrides>);
      localStorage.setItem('bej:small-talk:question-overrides:v1', JSON.stringify(questions));
      localStorage.setItem('bej:small-talk:answer-overrides:v1', JSON.stringify(answers));
      // Remover duplicatas apenas depois da mesclagem; manter as demais revisões intactas.
      if (topic && topic.topicId === topicId) {
        try { setQuestionOverrides(pruneRedundantQuestionOverrides(topic.items)); } catch { setQuestionOverrides(questions); }
        try { setAnswerOverrides(pruneRedundantAnswerOverrides(topic.items)); } catch { setAnswerOverrides(answers); }
      } else { setQuestionOverrides(questions); setAnswerOverrides(answers); }
      setBackupMessage('Edições importadas e mescladas pela data. Confira seus cards.');
    } catch { setBackupMessage('Backup inválido ou armazenamento indisponível. Confira o arquivo.'); }
  }
  function googleTranslate(text: string) {
    window.open('https://translate.google.com/?sl=en&tl=pt&text=' + encodeURIComponent(text) + '&op=translate', '_blank', 'noopener,noreferrer');
  }
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
    setTopicsMenuOpen(false); setSessionItems(selection.map(itemWithQuestion)); setWalking(true);
  }

  if (walking) return <SmallTalkWalking items={sessionItems} settings={settings}
    onStudyState={onStudyState} onWalkingChange={onWalkingChange} onExit={() => { setWalking(false); onStudyState?.(false, 'walking'); }} />;

  return <section className="small-talk-page" aria-label="Small Talk">
    <header><p className="eyebrow">Brazilian English Journey</p><h2>💬 Small Talk</h2>
      <p>Pratique conversas reais com perguntas do seu documento. Responda em voz alta, com suas próprias palavras.</p>
    </header>
    {error && <p className="warning-banner" role="alert">{error}</p>}
    {privateError && <p className="warning-banner" role="alert">{privateError}</p>}
    {/* Mesmo SVG de três pontos do Dashboard; o portal usa a pilha flutuante do aplicativo. */}
    {document.getElementById('app-floating-controls') && createPortal(
      <div className="study-mobile-controls small-talk-mobile-controls">
        <button type="button" aria-label="Abrir lista de tópicos" title="Selecionar tópico"
          aria-expanded={topicsMenuOpen} aria-haspopup="dialog" aria-controls="small-talk-topics-modal"
          onClick={() => setTopicsMenuOpen(true)}>
          <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
          </svg>
        </button>
      </div>, document.getElementById('app-floating-controls')!
    )}
    <button type="button" className="small-talk-topics-trigger small-talk-topics-trigger--desktop"
      aria-label="Abrir lista de tópicos" title="Selecionar tópico" aria-expanded={topicsMenuOpen}
      aria-haspopup="dialog" aria-controls="small-talk-topics-modal" onClick={() => setTopicsMenuOpen(true)}>
      <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
      </svg>
    </button>
    {topicsMenuOpen && <div className="small-talk-topics-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setTopicsMenuOpen(false); }}>
      <div id="small-talk-topics-modal" className="small-talk-topics-modal" role="dialog" aria-modal="true" aria-labelledby="small-talk-topics-modal-title">
        <div className="small-talk-topics-modal-header">
          <div>
            <h3 id="small-talk-topics-modal-title">Tópicos do Small Talk</h3>
            <p>Escolha um dos {topics.length} tópicos para visualizar as perguntas.</p>
          </div>
          <button type="button" className="small-talk-topics-close" aria-label="Fechar lista de tópicos" title="Fechar" onClick={() => setTopicsMenuOpen(false)}>✕</button>
        </div>
        <label className="small-talk-topics-search">Pesquisar tópico
          <span className="small-talk-topics-search-field">
            <input type="search" autoFocus value={topicsMenuQuery}
              onChange={event => setTopicsMenuQuery(event.target.value)}
              placeholder="Digite o nome do tópico..." />
            {topicsMenuQuery.length > 0 && (
              <button type="button" className="small-talk-topics-clear"
                aria-label="Limpar pesquisa de tópicos" title="Limpar pesquisa"
                onClick={() => setTopicsMenuQuery('')}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
                  strokeLinejoin="round" aria-hidden="true" focusable="false">
                  <path d="M21 4H9a2 2 0 0 0-1.5.7L2 12l5.5 7.3A2 2 0 0 0 9 20h12a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1Z" />
                  <path d="m13 9 6 6m0-6-6 6" />
                </svg>
              </button>
            )}
          </span>
        </label>
        <nav className="small-talk-topics-nav" aria-label="Lista alfabética de tópicos">
          {menuTopics.map(t => <button key={t.id} type="button" className={`small-talk-topic-option${topicId === t.id ? ' is-selected' : ''}`} aria-current={topicId === t.id ? 'true' : undefined} onClick={() => selectTopic(t.id)}>{topicDisplayName(t.sourceTitle)}{topicId === t.id && <span aria-hidden="true">✓</span>}</button>)}
          {menuTopics.length === 0 && <p className="small-talk-topics-empty">Nenhum tópico encontrado.</p>}
        </nav>
      </div>
    </div>}
    <div className="small-talk-filters">
      <label>Tópico <select value={topicId} onChange={e => selectTopic(e.target.value)}>{topics.map(t => <option key={t.id} value={t.id}>{topicDisplayName(t.sourceTitle)}</option>)}</select></label>
      <label>Pesquisar pergunta <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search questions..." /></label>
      <label>Nível <select value={level} onChange={e => setLevel(e.target.value as LevelFilter)}>{levelOptions.map(l => <option key={l} value={l}>{l === 'all' ? 'Todos' : l === 'unclassified' ? 'Sem classificação' : l.toUpperCase()}</option>)}</select></label>
      <label><input type="checkbox" checked={favoritesOnly} onChange={e => setFavoritesOnly(e.target.checked)} /> Apenas favoritos</label>
    </div>
    <div className="small-talk-configuration-toggle">
      <button type="button" className="small-talk-icon-button" aria-label="Configurar Modo Caminhada" title="Configurar Modo Caminhada" aria-expanded={settingsOpen} aria-controls="small-talk-settings-panel" onClick={() => setSettingsOpen(v => !v)}>⚙️</button>
      <span>Configurar Modo Caminhada</span>
      <button type="button" className="primary-button" disabled={loading || !filtered.length} onClick={startWalking}>▶ Iniciar Modo Caminhada ({filtered.length} perguntas)</button>
    </div>
    {settingsOpen && <section id="small-talk-settings-panel" className="small-talk-settings" aria-labelledby="small-talk-settings-title">
      <h3 id="small-talk-settings-title">🚶 Configurar Modo Caminhada</h3>
      <p><strong>Resposta padrão:</strong> edição local, resposta pública ou original importado (nessa ordem).</p>
      <label>Reproduzir resposta padrão <select value={settings.playDefaultAnswer ? 'yes' : 'no'} onChange={e => updateWalking('playDefaultAnswer', e.target.value === 'yes')}><option value="no">NÃO — eu respondo espontaneamente</option><option value="yes">SIM — ouvir minha resposta original</option></select></label>
      <label>Repetições <input type="number" min="1" max="10" value={settings.repeatCount} onChange={e => updateWalking('repeatCount', Math.max(1, Math.min(10, Number(e.target.value) || 5)))} /></label>
      <label>Pausa para responder (segundos) <input type="number" min="1" max="90" value={settings.pauseAfterQuestionSeconds} onChange={e => updateWalking('pauseAfterQuestionSeconds', Math.max(1, Math.min(90, Number(e.target.value) || 10)))} /></label>
      <label>Intervalo entre repetições (segundos) <input type="number" min="0" max="10" value={settings.pauseBetweenRepetitionsSeconds} onChange={e => updateWalking('pauseBetweenRepetitionsSeconds', Math.max(0, Math.min(10, Number(e.target.value) || 0)))} /></label>
      <label><input type="checkbox" checked={settings.shuffle} onChange={e => updateWalking('shuffle', e.target.checked)} /> Embaralhar perguntas</label>
      <label><input type="checkbox" checked={settings.keepScreenAwake} onChange={e => updateWalking('keepScreenAwake', e.target.checked)} /> Manter tela ligada quando possível</label>
      <p className="settings-dialog-help">Os filtros acima determinam quais perguntas entram na caminhada. Atualmente não há MP3s do Small Talk; o áudio usa a voz inglesa disponível no dispositivo.</p>
      <button type="button" className="primary-button" disabled={loading || !filtered.length} onClick={startWalking}>▶ Iniciar Modo Caminhada ({filtered.length} perguntas)</button>
    </section>}
    {editError && <p className="warning-banner" role="alert">{editError}</p>}
    <div className="small-talk-backup-actions">
      <button type="button" className="secondary-button" onClick={downloadEdits}>⬇ Backup privado (perguntas + respostas)</button>
      <label className="small-talk-import-label">⬆ Importar backup
        <input type="file" accept="application/json,.json" onChange={event => { const file = event.currentTarget.files?.[0]; if (file) void importEdits(file); event.currentTarget.value = ''; }} />
      </label><span className="settings-dialog-help">Salve no Drive e importe em outro dispositivo. Não há sincronização automática destas edições.</span>
      {backupMessage && <span role="status">{backupMessage}</span>}
    </div>
    <div className="small-talk-topic-export-bar">
      <button type="button" className="small-talk-topic-export-trigger" title="Exportar tópico inteiro"
        aria-label="Exportar tópico inteiro" disabled={loading || !topic || topic.topicId !== topicId}
        onClick={prepareTopicExport}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
          strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 16V3m0 0-4 4m4-4 4 4"/>
          <path d="M4 14v4a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-4"/>
        </svg>
        <span>Exportar tópico inteiro</span>
      </button>
      <button type="button" className="small-talk-topic-export-trigger" aria-label="Imprimir tópico A4" disabled={loading || !topic || topic.topicId !== topicId} onClick={() => setPrintMode('both')}>🖨️ <span>Imprimir tópico</span></button>
      <span className="settings-dialog-help">Exportação e impressão incluem o tópico inteiro.</span>
    </div>
    <header className="results-header"><h3>{loading ? 'Carregando...' : `${topic?.title ?? ''} — ${filtered.length} perguntas`}</h3></header>
    <div className="small-talk-question-list">{filtered.map(item => {
      const original = answerFor(item);
      const shown = answerVisible.includes(item.id);
      const modified = Object.prototype.hasOwnProperty.call(answerOverrides, item.id);
      const baseOriginal = personalAnswers?.answersByItemId[item.id]?.original?.segments.map(s => s.text).join('\n\n') ?? '';
      return <article className="small-talk-question-card" key={item.id}>
        <div className="small-talk-question-heading"><p><strong>{questionFor(item)}</strong></p>
          <button type="button" className="small-talk-icon-button" aria-label="Editar pergunta" title="Editar pergunta" onClick={() => openQuestionEditor(item)}>✏️</button>
          {questionOverrides[item.id] && <button type="button" className="small-talk-restore-button" onClick={() => restoreQuestion(item.id)}>Restaurar pergunta</button>}
        </div>
        {questionEditorId === item.id && <div className="small-talk-editor">
          <label><strong>Editar pergunta (original preservada)</strong>
            <textarea rows={3} value={questionDraft} onChange={e => setQuestionDraft(e.target.value)} spellCheck lang="en-US" /></label>
          <div className="small-talk-actions"><button type="button" className="primary-button" onClick={saveQuestionEditor}>Salvar pergunta</button>
            <button type="button" className="secondary-button" onClick={() => setQuestionEditorId(null)}>Cancelar</button></div>
        </div>}
        <p className="settings-dialog-help">{item.level?.toUpperCase() ?? 'Nível pendente'} · {item.reviewStatus === 'pending' ? 'Revisão editorial pendente' : item.reviewStatus}</p>
        <div className="small-talk-actions">
          <button type="button" className="small-talk-icon-button" aria-label={favorites.includes(item.id) ? 'Desfavoritar' : 'Favoritar'} title={favorites.includes(item.id) ? 'Desfavoritar' : 'Favoritar'} aria-pressed={favorites.includes(item.id)} onClick={() => toggleFavorite(item.id)}>{favorites.includes(item.id) ? '★' : '☆'}</button>
          <button type="button" className="small-talk-icon-button" aria-label={shown ? 'Ocultar resposta' : 'Ver resposta'} title={shown ? 'Ocultar resposta' : 'Ver resposta'} aria-pressed={shown} disabled={!original} onClick={() => reveal(item.id)}>👁️</button>
          <button type="button" className="small-talk-icon-button" aria-label="Editar resposta" title="Editar resposta" onClick={() => openEditor(item)}>✏️</button>
          <button type="button" className="small-talk-icon-button" aria-label="Excluir resposta ativa" title="Excluir resposta ativa" disabled={!original} onClick={() => removeAnswer(item.id)}>🗑️</button>
          <button type="button" className="small-talk-icon-button" aria-label="Exportar JSON público deste card"
            title="Exportar JSON público deste card" onClick={() => openCardExport(item)}>📋</button>
          <button type="button" className="small-talk-icon-button" aria-label="Abrir resposta no Google Tradutor" title="Google Tradutor (resposta ativa)" disabled={!original} onClick={() => googleTranslate(original)}>🌐</button>
          {modified && <button type="button" className="small-talk-restore-button" title="Recuperar o original importado" onClick={() => restoreAnswer(item.id)}>Restaurar original</button>}
          {!original && !modified && <span className="settings-dialog-help">Sem resposta importada — use o lápis para incluir</span>}
          {modified && <span className="settings-dialog-help">Resposta editada localmente</span>}
        </div>
        {shown && original && <p className="small-talk-original" style={{ whiteSpace: 'pre-wrap' }}>{original}</p>}
        {editorId === item.id && <div className="small-talk-editor">
          <label htmlFor={`small-talk-editor-${item.id}`}><strong>{baseOriginal ? 'Editar resposta ativa (original preservado)' : 'Incluir resposta pessoal'}</strong></label>
          <textarea id={`small-talk-editor-${item.id}`} value={draft} onChange={e => setDraft(e.target.value)} rows={6} spellCheck lang="en-US" />
          <div className="small-talk-actions">
            <button type="button" className="primary-button" onClick={saveEditor}>Salvar resposta</button>
            <button type="button" className="secondary-button" onClick={() => { setEditorId(null); setEditError(''); }}>Cancelar</button>
          </div>
        </div>}
      </article>;
    })}</div>
    {!loading && filtered.length === 0 && <p>Nenhuma pergunta corresponde aos filtros.</p>}
    {printMode && <div className="small-talk-export-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setPrintMode(null); }}>
      <section className="small-talk-export-modal" role="dialog" aria-modal="true" aria-labelledby="small-talk-print-title">
        <header className="small-talk-export-header"><h3 id="small-talk-print-title">🖨️ Imprimir tópico A4</h3><button type="button" aria-label="Fechar" onClick={() => setPrintMode(null)}>✕</button></header>
        <p>Imprime todas as perguntas ativas do tópico, incluindo suas edições locais, independentemente dos filtros.</p>
        <label>Formato <select value={printMode} onChange={e => setPrintMode(e.target.value as 'both' | 'questions')}>
          <option value="both">Perguntas e respostas</option><option value="questions">Somente perguntas com espaço para anotações</option>
        </select></label>
        <div className="small-talk-actions"><button type="button" className="primary-button" onClick={() => printTopic(printMode)}>Abrir impressão</button>
          <button type="button" className="secondary-button" onClick={() => setPrintMode(null)}>Cancelar</button></div>
      </section>
    </div>}
    {topicExport && <div className="small-talk-export-overlay"
      onMouseDown={event => { if (event.target === event.currentTarget) setTopicExport(null); }}>
      <section className="small-talk-export-modal" role="dialog" aria-modal="true"
        aria-labelledby="small-talk-topic-export-title">
        <header className="small-talk-export-header">
          <h3 id="small-talk-topic-export-title">Exportar tópico inteiro</h3>
          <button type="button" aria-label="Fechar exportação do tópico"
            onClick={() => setTopicExport(null)}>✕</button>
        </header>
        <p><strong>Arquivo:</strong> <code>{topicExport.topicId}.json</code></p>
        <p><strong>{topicExport.count}</strong> cards; <strong>{topicExport.answered}</strong> com resposta;
          <strong> {topicExport.edited}</strong> com edição local.</p>
        <p>O arquivo preserva o contrato completo do catálogo. Ele substitui <strong>o arquivo inteiro</strong> em
          <code> public/small-talk/en-US/topics/{topicExport.topicId}.json</code>,
          após sua revisão no VS Code. As respostas vazias permanecem sem texto.</p>
        <p><strong>Atenção:</strong> respostas importadas e edições locais podem conter dados pessoais.
          Revise antes de publicar. Exportar não publica nem sincroniza os dados.</p>
        <label className="small-talk-export-consent">
          <input type="checkbox" checked={topicExportApproved}
            onChange={event => setTopicExportApproved(event.target.checked)} />
          Confirmo que quero exportar as respostas deste tópico para revisão e possível publicação.
        </label>
        <div className="small-talk-actions">
          <button type="button" className="primary-button" disabled={!topicExportApproved}
            onClick={() => void shareOrDownloadTopic()}>Compartilhar / Salvar no Drive</button>
          <button type="button" className="secondary-button" disabled={!topicExportApproved}
            onClick={downloadTopicJson}>Baixar JSON</button>
          <button type="button" className="secondary-button"
            onClick={() => setTopicExport(null)}>Fechar</button>
        </div>
        {topicExportStatus && <p role="status">{topicExportStatus}</p>}
      </section>
    </div>}
    {exportCard && <div className="small-talk-export-overlay"
      onMouseDown={event => { if (event.target === event.currentTarget) setExportCard(null); }}>
      <section className="small-talk-export-modal" role="dialog" aria-modal="true" aria-labelledby="small-talk-export-title">
        <header className="small-talk-export-header">
          <h3 id="small-talk-export-title">Exportar card para JSON público</h3>
          <button type="button" aria-label="Fechar exportação" onClick={() => setExportCard(null)}>✕</button>
        </header>
        <p><strong>Arquivo de destino:</strong> <code>public/small-talk/en-US/topics/{topicId}.json</code></p>
        <p>O JSON abaixo é somente o objeto do card. Substitua o item com o mesmo ID dentro de <code>items</code>; não substitua o arquivo inteiro.</p>
        <textarea readOnly spellCheck={false} aria-label="JSON do card" value={exportCard.json} rows={12}
          onFocus={event => event.currentTarget.select()} />
        <label className="small-talk-export-consent">
          <input type="checkbox" checked={exportApproved} onChange={event => setExportApproved(event.target.checked)} />
          Confirmo que revisei esta pergunta e resposta e autorizo sua publicação para todos os usuários.
        </label>
        <div className="small-talk-actions">
          <button type="button" className="secondary-button" onClick={() => void copyCardText()}>📋 Copiar pergunta + resposta</button>
          <button type="button" className="primary-button" disabled={!exportApproved} onClick={() => void copyCardJson()}>Copiar JSON</button>
          <button type="button" className="secondary-button" disabled={!exportApproved} onClick={downloadCardJson}>Baixar JSON</button>
          <button type="button" className="secondary-button" onClick={() => setExportCard(null)}>Fechar</button>
        </div>
        {exportMessage && <p role="status">{exportMessage}</p>}
      </section>
    </div>}

  </section>;
}
