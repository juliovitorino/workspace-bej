import { useEffect, useRef, useState } from 'react';
import type { SmallTalkItem, SmallTalkWalkingSettings } from '../../types/smallTalk';
import { getSmallTalkDefaultAnswer } from '../../services/smallTalkPersonalAnswersService';
import { speakStudyAudio } from '../study/studyAudio';
import { SMALL_TALK_WALKING_PROGRESS_KEY, saveLocalJson, readLocalJson } from './smallTalkPreferences';

interface Props {
  items: SmallTalkItem[];
  settings: SmallTalkWalkingSettings;
  onExit: () => void;
  onStudyState?: (active: boolean, mode: 'manual' | 'walking') => void;
  onWalkingChange?: (active: boolean) => void;
}

type Phase = 'idle' | 'question' | 'thinking' | 'answer' | 'between' | 'paused' | 'complete' | 'error';
interface Progress { itemId: string; repetition: number; completed: number; updatedAt: string }

function speak(text: string, onEnd: () => void, onError: () => void): () => void {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    onError(); return () => undefined;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.95;
  const voice = window.speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith('en-us'));
  if (voice) utterance.voice = voice;
  utterance.onend = onEnd;
  utterance.onerror = onError;
  speakStudyAudio(utterance);
  return () => { utterance.onend = utterance.onerror = null; window.speechSynthesis.cancel(); };
}

export function SmallTalkWalking({ items, settings, onExit, onStudyState, onWalkingChange }: Props) {
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [index, setIndex] = useState(0);
  const [repetition, setRepetition] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [hasOriginal, setHasOriginal] = useState(false);
  const generation = useRef(0);
  const cancelCurrent = useRef<() => void>(() => undefined);
  const wakeLock = useRef<{ release(): Promise<void> } | null>(null);
  const current = items[index];

  function stopAudio() { generation.current++; cancelCurrent.current(); cancelCurrent.current = () => undefined; window.speechSynthesis?.cancel(); }

  useEffect(() => {
    onWalkingChange?.(true);
    return () => { stopAudio(); onStudyState?.(false, 'walking'); onWalkingChange?.(false); void wakeLock.current?.release().catch(() => undefined); };
  }, []);

  useEffect(() => {
    if (!settings.keepScreenAwake || !started || paused) return;
    let done = false;
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } };
    void nav.wakeLock?.request('screen').then(lock => { if (done) void lock.release(); else wakeLock.current = lock; }).catch(() => undefined);
    return () => { done = true; void wakeLock.current?.release().catch(() => undefined); wakeLock.current = null; };
  }, [settings.keepScreenAwake, started, paused]);

  useEffect(() => {
    onStudyState?.(started && !paused && phase !== 'complete' && phase !== 'error', 'walking');
  }, [started, paused, phase]);

  useEffect(() => {
    if (!current) { setPhase('complete'); return; }
    try { setHasOriginal(!!getSmallTalkDefaultAnswer(current.id, window.localStorage)?.length); }
    catch { setHasOriginal(false); }
  }, [current?.id]);

  useEffect(() => {
    if (!started || paused || !current || phase === 'complete' || phase === 'error') return;
    let cancelled = false;
    const myGeneration = ++generation.current;
    const live = () => !cancelled && myGeneration === generation.current;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const wait = (ms: number, then: () => void) => {
      timer = setTimeout(() => { if (live()) then(); }, ms);
    };
    const next = () => {
      if (!live()) return;
      const completedNow = completed + (repetition + 1 >= settings.repeatCount ? 1 : 0);
      if (repetition + 1 < settings.repeatCount) setRepetition(repetition + 1);
      else {
        setCompleted(completedNow);
        setRepetition(0);
        if (index + 1 < items.length) setIndex(index + 1);
        else setPhase('complete');
      }
    };
    const playAnswer = () => {
      if (!live()) return;
      let original: string[] = [];
      try { original = getSmallTalkDefaultAnswer(current.id, window.localStorage)?.map(s => s.text) ?? []; }
      catch { /* original opcional quando storage indisponível */ }
      if (!settings.playDefaultAnswer || !original.length) {
        setPhase('between'); wait(settings.pauseBetweenRepetitionsSeconds * 1000, next); return;
      }
      setPhase('answer');
      cancelCurrent.current = speak(original.join(' '), () => {
        if (live()) { setPhase('between'); wait(settings.pauseBetweenRepetitionsSeconds * 1000, next); }
      }, () => { if (live()) { setError('Não foi possível reproduzir a resposta.'); setPhase('error'); } });
    };
    setPhase('question');
    cancelCurrent.current = speak(current.question?.text ?? '', () => {
      if (live()) { setPhase('thinking'); wait(settings.pauseAfterQuestionSeconds * 1000, playAnswer); }
    }, () => { if (live()) { setError('Falha na síntese de voz. Verifique o áudio do navegador.'); setPhase('error'); } });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      cancelCurrent.current();
      cancelCurrent.current = () => undefined;
      window.speechSynthesis?.cancel();
    };
  }, [started, paused, index, repetition, settings.repeatCount, settings.playDefaultAnswer, settings.pauseAfterQuestionSeconds, settings.pauseBetweenRepetitionsSeconds]);

  useEffect(() => {
    if (!started || !current) return;
    try { saveLocalJson(SMALL_TALK_WALKING_PROGRESS_KEY, { itemId: current.id, repetition, completed, updatedAt: new Date().toISOString() } satisfies Progress); }
    catch { /* não bloquear a caminhada */ }
  }, [started, current?.id, repetition, completed]);

  function restart() { stopAudio(); setStarted(false); setPaused(false); setIndex(0); setRepetition(0); setCompleted(0); setError(''); setPhase('idle'); }
  function skip() { stopAudio(); setRepetition(0); setCompleted(v => v + 1); if (index === items.length - 1) setPhase('complete'); else setIndex(v => v + 1); }
  function togglePause() { stopAudio(); setPaused(value => !value); setPhase('paused'); }
  const previous = readLocalJson<Progress | null>(SMALL_TALK_WALKING_PROGRESS_KEY, null);

  return <section className="small-talk-walk" aria-label="Small Talk — modo caminhada">
    <header><h2>🚶 Small Talk — Modo Caminhada</h2><p>Responda em voz alta. Nenhum áudio da sua voz é gravado.</p></header>
    <p><strong>{completed} / {items.length}</strong> perguntas · Repetição <strong>{Math.min(repetition + 1, settings.repeatCount)} / {settings.repeatCount}</strong></p>
    <h3>{current?.question?.text ?? 'Treino concluído!'}</h3>
    <p role="status">{phase === 'question' ? '🔊 Pergunta' : phase === 'thinking' ? '🎤 Sua vez de responder em voz alta' : phase === 'answer' ? '🔊 Resposta original do documento' : phase === 'between' ? 'Próxima repetição' : phase === 'paused' ? 'Pausado' : phase === 'complete' ? 'Sessão concluída' : phase === 'error' ? 'Erro de áudio' : 'Pronto para começar'}</p>
    {settings.playDefaultAnswer && !hasOriginal && <p className="warning-banner">Esta pergunta não possui resposta original importada; será feita apenas a pausa para resposta espontânea.</p>}
    {error && <p role="alert">{error}</p>}
    {!started && phase !== 'complete' && <button className="primary-button" type="button" onClick={() => { setStarted(true); setPhase('question'); }}>▶ Iniciar</button>}
    {started && phase !== 'complete' && <div className="small-talk-actions">
      <button type="button" className="secondary-button" onClick={togglePause}>{paused ? '▶ Continuar' : '⏸ Pausar'}</button>
      <button type="button" className="secondary-button" onClick={skip}>⏭ Pular pergunta</button>
      <button type="button" className="secondary-button" onClick={restart}>↺ Recomeçar</button>
    </div>}
    {phase === 'complete' && <p>Você praticou {completed} perguntas nesta sessão.</p>}
    <p className="settings-dialog-help">Voz: síntese de fala disponível no navegador. Cedar/Marin neural exigem MP3s próprios e ainda não estão conectados ao Small Talk.</p>
    {!started && previous && <p className="settings-dialog-help">Última posição registrada: {previous.completed} perguntas concluídas. Este MVP recomeça do início por segurança.</p>}
    <button type="button" className="secondary-button" onClick={() => { stopAudio(); onExit(); }}>Voltar ao Small Talk</button>
  </section>;
}
