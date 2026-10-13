import { useEffect, useMemo, useState } from "react";
import type { MentalIntention } from "../types/hashmap";

interface ChunkFlashcardsProps {
  intentions: MentalIntention[];
}

function pickRandomId(ids: string[]): string {
  return ids[Math.floor(Math.random() * ids.length)];
}

export function ChunkFlashcards({ intentions }: ChunkFlashcardsProps) {
  // O autor escolhe explicitamente quais intenções são chunks completos.
  const chunks = useMemo(
    () =>
      intentions.filter(
        (item) =>
          item.allowLanguageChunkPractice === true &&
          typeof item.id === "string" &&
          typeof item.english === "string" &&
          item.english.trim().length > 0 &&
          typeof item.intention === "string" &&
          item.intention.trim().length > 0
      ),
    [intentions]
  );

  // Estado da rodada em memória: cada ID só pode ser sorteado uma vez.
  const [drawnIds, setDrawnIds] = useState<string[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  useEffect(() => {
    setDrawnIds([]);
    setCurrentId(null);
    setAudioError(null);
  }, [chunks]);

  const currentChunk = chunks.find((item) => item.id === currentId) ?? null;
  const total = chunks.length;
  const completed = total > 0 && drawnIds.length === total;
  const shownCount = drawnIds.length;

  function nextChunk() {
    if (total === 0) return;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setAudioError(null);

    if (completed) {
      // Nova rodada: evita mostrar imediatamente o último chunk novamente.
      const candidates = chunks.filter((item) => total === 1 || item.id !== currentId);
      const firstId = pickRandomId(candidates.map((item) => item.id));
      setDrawnIds([firstId]);
      setCurrentId(firstId);
      return;
    }

    const seen = new Set(drawnIds);
    const remaining = chunks.filter((item) => !seen.has(item.id));
    if (remaining.length === 0) return;
    const nextId = pickRandomId(remaining.map((item) => item.id));
    setDrawnIds((previous) => [...previous, nextId]);
    setCurrentId(nextId);
  }

  function speak() {
    if (!currentChunk) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setAudioError("Seu navegador não oferece reprodução de voz.");
      return;
    }

    setAudioError(null);
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(currentChunk.english.trim());
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    const voices = synth.getVoices();
    const usVoice = voices.find((voice) => voice.lang.toLowerCase() === "en-us");
    const englishVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith("en"));
    if (usVoice || englishVoice) utterance.voice = usVoice ?? englishVoice ?? null;
    utterance.onerror = (event) => {
      if (event.error !== "canceled" && event.error !== "interrupted") {
        setAudioError("Não foi possível reproduzir o áudio neste navegador.");
      }
    };
    synth.speak(utterance);
  }

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return (
    <section className="chunk-flashcards" aria-labelledby="chunk-flashcards-title">
      <div className="chunk-flashcards-heading">
        <div>
          <p className="eyebrow">Prática de expressões completas</p>
          <h2 id="chunk-flashcards-title">Chunk Flashcards</h2>
          <p>Leia, ouça e repita cada expressão em voz alta.</p>
        </div>
        <span className="chunk-flashcards-total">{total} chunks disponíveis</span>
      </div>

      {total === 0 ? (
        <div className="chunk-flashcards-empty" role="status">
          <h3>Nenhum chunk habilitado</h3>
          <p>
            Marque intenções completas com <code>"allowLanguageChunkPractice": true</code>
            {" "}no JSON do Mental Hashmap para praticá-las aqui.
          </p>
        </div>
      ) : (
        <>
          <div className="chunk-flashcards-progress" aria-live="polite">
            <span>Rodada atual</span>
            <strong>{shownCount} de {total}</strong>
          </div>
          <div
            className="chunk-flashcards-progress-track"
            role="progressbar"
            aria-label="Chunks apresentados nesta rodada"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={shownCount}
          >
            <div style={{ width: `${(shownCount / total) * 100}%` }} />
          </div>

          <article className="chunk-flashcards-card" aria-live="polite">
            {currentChunk ? (
              <>
                <p className="chunk-flashcards-language">ENGLISH · EN-US</p>
                <div className="chunk-flashcards-english-row">
                  <h3>{currentChunk.english}</h3>
                  <button
                    type="button"
                    className="chunk-flashcards-speaker"
                    onClick={speak}
                    aria-label={`Ouvir pronúncia de ${currentChunk.english}`}
                    title="Ouvir pronúncia em inglês"
                  >
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
                      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                      <path d="M19 5a10 10 0 0 1 0 14" />
                    </svg>
                  </button>
                </div>
                <div className="chunk-flashcards-divider" />
                <p className="chunk-flashcards-language">PORTUGUÊS · PT-BR</p>
                <p className="chunk-flashcards-portuguese">{currentChunk.intention}</p>
              </>
            ) : (
              <div className="chunk-flashcards-start">
                <h3>Pronto para praticar?</h3>
                <p>Clique em Começar para sortear o primeiro chunk.</p>
              </div>
            )}
          </article>

          {audioError && <p className="chunk-flashcards-audio-error" role="alert">{audioError}</p>}
          {completed && (
            <p className="chunk-flashcards-finished" role="status">
              Você praticou todos os {total} chunks desta rodada!
            </p>
          )}
          <div className="chunk-flashcards-actions">
            <button type="button" className="primary-button" onClick={nextChunk}>
              {currentChunk === null ? "Começar" : completed ? "Nova rodada" : "Próximo →"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
