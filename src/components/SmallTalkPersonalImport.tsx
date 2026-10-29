import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { loadSmallTalkIndex, loadSmallTalkItems } from '../services/smallTalkCatalogService';
import {
  commitSmallTalkPersonalImport,
  parseSmallTalkPersonalAnswers,
  planSmallTalkPersonalImport,
  readSmallTalkPersonalAnswers,
  smallTalkPersonalBackupText,
  type SmallTalkImportPlan
} from '../services/smallTalkPersonalAnswersService';
import type { SmallTalkPersonalAnswers } from '../types/smallTalk';

function downloadBackup(content: string): void {
  const file = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = `bej-small-talk-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Importador isolado: sem rede para respostas pessoais e sem gravação até confirmação. */
export function SmallTalkPersonalImport() {
  const [catalogIds, setCatalogIds] = useState<Set<string> | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const [currentCount, setCurrentCount] = useState(0);
  const [plan, setPlan] = useState<SmallTalkImportPlan | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [backupDownloaded, setBackupDownloaded] = useState(false);
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const pending = useRef<SmallTalkPersonalAnswers | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refreshCount = useCallback(() => {
    try { setCurrentCount(Object.keys(readSmallTalkPersonalAnswers(window.localStorage).answersByItemId).length); }
    catch (e) { setError(`Armazenamento existente inválido: ${String(e)}. Não importe até recuperar os dados.`); }
  }, []);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    void (async () => {
      try {
        const index = await loadSmallTalkIndex(controller.signal);
        const topics = index.topics.filter(t => t.enabled).map(t => t.id);
        const items = await loadSmallTalkItems(topics, 'en-US', controller.signal);
        if (alive) setCatalogIds(new Set(items.map(item => item.id)));
      } catch (e) { if (alive && !controller.signal.aborted) setCatalogError(String(e)); }
    })();
    refreshCount();
    return () => { alive = false; controller.abort(); };
  }, [refreshCount]);

  async function onFileSelected(event: ChangeEvent<HTMLInputElement>) {
    setPlan(null); setError(''); setSuccess(''); setBackupDownloaded(false); setBackupConfirmed(false);
    pending.current = null;
    const file = event.target.files?.[0];
    if (!file) return;
    if (!catalogIds) { setError('Catálogo indisponível. Aguarde o carregamento.'); return; }
    if (file.size > 8 * 1024 * 1024) { setError('Arquivo excede 8 MB.'); return; }
    try {
      const incoming = parseSmallTalkPersonalAnswers(await file.text());
      const existing = readSmallTalkPersonalAnswers(window.localStorage);
      const preview = planSmallTalkPersonalImport(incoming, existing, catalogIds);
      pending.current = incoming;
      setPlan(preview);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }

  function saveBackup() {
    setError('');
    try {
      downloadBackup(smallTalkPersonalBackupText(window.localStorage));
      setBackupDownloaded(true);
    } catch (e) { setError(`Não foi possível gerar o backup: ${String(e)}`); }
  }

  function importNow() {
    setError(''); setSuccess('');
    if (!pending.current || !catalogIds || !plan || !backupDownloaded || !backupConfirmed) return;
    try {
      const existing = readSmallTalkPersonalAnswers(window.localStorage);
      // Se outra aba modificou dados, a prévia anterior não é mais válida.
      if (JSON.stringify(existing) !== plan.baselineSnapshot) {
        throw new Error('Os dados foram alterados após a prévia. Selecione o arquivo novamente.');
      }
      const freshPlan = planSmallTalkPersonalImport(pending.current, existing, catalogIds);
      if (freshPlan.errors.length) throw new Error(freshPlan.errors.slice(0, 3).join(' | '));
      commitSmallTalkPersonalImport(freshPlan, window.localStorage);
      setSuccess(`Importação concluída: ${freshPlan.newRecords} novos, ${freshPlan.updatedRecords} atualizados, ${freshPlan.unchangedRecords} já existentes.`);
      pending.current = null;
      setPlan(null); setBackupDownloaded(false); setBackupConfirmed(false);
      if (inputRef.current) inputRef.current.value = '';
      refreshCount();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }

  return <section aria-labelledby="small-talk-private-import-title" style={{ marginBlock: '1.5rem' }}>
    <h4 id="small-talk-private-import-title">Small Talk — respostas pessoais</h4>
    <p>Importe suas respostas originais do DOCX para este navegador. O arquivo não será enviado a um servidor.</p>
    <p><strong>Registros neste dispositivo:</strong> {currentCount}.</p>
    <p className="settings-dialog-help"><strong>Atenção:</strong> este armazenamento ainda não está incluído na sincronização Google Drive do BEJ. Faça backup do Small Talk antes de limpar o navegador ou trocar de dispositivo.</p>
    {catalogError && <p role="alert">Não foi possível carregar o catálogo: {catalogError}</p>}
    <label htmlFor="small-talk-private-file">Arquivo JSON privado de respostas pessoais</label>
    <input id="small-talk-private-file" ref={inputRef} type="file" accept=".json,application/json" disabled={!catalogIds} onChange={event => { void onFileSelected(event); }} />
    {plan && <div aria-live="polite" style={{ marginBlock: '1rem' }}>
      <h5>Prévia (nenhum dado alterado)</h5>
      <p>Registros no arquivo: {plan.incomingRecords} · Novos: {plan.newRecords} · Atualizados: {plan.updatedRecords} · Já existentes: {plan.unchangedRecords}.</p>
      <p>Com resposta original: {plan.originals} · Sem resposta original: {plan.unanswered} · Revisões novas: {plan.revisionsAdded}.</p>
      {plan.errors.length > 0 && <div role="alert"><strong>Importação bloqueada ({plan.errors.length} conflitos).</strong><ul>{plan.errors.slice(0, 8).map((message, i) => <li key={i}>{message}</li>)}</ul></div>}
      {plan.errors.length === 0 && <>
        <button type="button" className="secondary-button" onClick={saveBackup}>1. Baixar backup atual do Small Talk</button>
        {backupDownloaded && <label style={{ display: 'block', marginBlock: '0.75rem' }}>
          <input type="checkbox" checked={backupConfirmed} onChange={e => setBackupConfirmed(e.target.checked)} /> Confirmei que o arquivo de backup foi salvo no meu dispositivo.
        </label>}
        <button type="button" disabled={!backupDownloaded || !backupConfirmed} onClick={importNow}>2. Confirmar importação privada</button>
      </>}
    </div>}
    {error && <p role="alert" style={{ color: 'var(--color-danger, #b42318)' }}>{error}</p>}
    {success && <p role="status">{success}</p>}
  </section>;
}
