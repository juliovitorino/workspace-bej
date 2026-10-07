import { useEffect, useMemo, useRef, useState } from "react";
import type { MentalIntention } from "../types/hashmap";
import {
  evaluateTrainingWithAI,
  type AIEvaluationResult
} from "../services/aiEvaluationService";
import { translateEnglishToPortuguese } from "../services/googleTranslateService";

const AI_ENABLED = import.meta.env.VITE_AI_ENABLED === "true";

interface SpeechRecognitionResultEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<{
    0: {
      transcript: string;
    };
    isFinal: boolean;
  }>;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function isMobileDevice(): boolean {
  const userAgent = navigator.userAgent;

  const isPhoneOrTablet =
    /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(userAgent);

  const isIPadOS =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;

  return isPhoneOrTablet || isIPadOS;
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return (
    speechWindow.SpeechRecognition ??
    speechWindow.webkitSpeechRecognition ??
    null
  );
}


function renderHighlightedText(
  text: string,
  highlight?: string
) {
  if (!highlight) {
    return text;
  }

  const index = text.indexOf(highlight);

  if (index === -1) {
    return text;
  }

  const before = text.slice(0, index);
  const after = text.slice(index + highlight.length);

  return (
    <>
      {before}
      <strong className="intention-highlight">
        {highlight}
      </strong>
      {after}
    </>
  );
}

interface BasicTrainingProps {
  intention: MentalIntention;
  onBack: () => void;
}

interface VerbItem {
  id: string;
  base: string;
  type?: "regular" | "irregular";
  past?: string;
  pastParticiple?: string;
  thirdPerson?: string;
  gerund?: string;
  meanings?: string[];
  examples?: Array<{
    en: string;
    pt: string;
  }>;
}

interface NounItem {
  id: string;
  noun: string;
  meanings?: string[];
  examples?: Array<{
    en: string;
    pt: string;
  }>;
}

interface AdjectiveItem {
  id: string;
  adjective: string;
  meanings?: string[];
  examples?: Array<{
    en: string;
    pt: string;
  }>;
}

interface VerbData {
  verbs: VerbItem[];
}

interface NounData {
  nouns: NounItem[];
}

interface AdjectiveData {
  adjectives: AdjectiveItem[];
}

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * items.length);
  return items[randomIndex];
}

export function BasicTraining({
  intention,
  onBack
}: BasicTrainingProps) {
  const [verbs, setVerbs] = useState<VerbItem[]>([]);
  const [nouns, setNouns] = useState<NounItem[]>([]);
  const [adjectives, setAdjectives] = useState<AdjectiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [studentText, setStudentText] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<AIEvaluationResult | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [googleTranslation, setGoogleTranslation] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [evaluationSpeaking, setEvaluationSpeaking] = useState<
    "corrected" | "better" | null
  >(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [dictating, setDictating] = useState(false);
  const showDictationButton = !isMobileDevice();
  const [dictationError, setDictationError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    let active = true;

    async function loadVocabulary() {
      setLoading(true);
      setError(null);

      try {
        const [verbsResponse, nounsResponse, adjectivesResponse] =
          await Promise.all([
            fetch("/english-verbs-common.json"),
            fetch("/english-nouns-common.json"),
            fetch("/english-adjectives-common.json")
          ]);

        if (
          !verbsResponse.ok ||
          !nounsResponse.ok ||
          !adjectivesResponse.ok
        ) {
          throw new Error(
            "Não foi possível carregar os arquivos de vocabulário."
          );
        }

        const verbsData = (await verbsResponse.json()) as VerbData;
        const nounsData = (await nounsResponse.json()) as NounData;
        const adjectivesData =
          (await adjectivesResponse.json()) as AdjectiveData;

        if (!active) {
          return;
        }

        setVerbs(verbsData.verbs ?? []);
        setNouns(nounsData.nouns ?? []);
        setAdjectives(adjectivesData.adjectives ?? []);
      } catch (err) {
        if (!active) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Erro inesperado ao carregar o vocabulário."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadVocabulary();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();

      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const trainingItems = useMemo(() => {
    return {
      verb: pickRandom(verbs),
      noun: pickRandom(nouns),
      adjective: pickRandom(adjectives)
    };
  }, [verbs, nouns, adjectives, round]);

  function generateNewRound() {
    setRound((current) => current + 1);
    setStudentText("");
    setEvaluation(null);
    setEvaluationError(null);
    setGoogleTranslation(null);
    setTranslationError(null);
    setSpeechError(null);
    setSpeaking(false);
    setEvaluationSpeaking(null);
    setCopyStatus("idle");
    setDictationError(null);
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setDictating(false);

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  function handleToggleDictation() {
    if (dictating) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognitionApi = getSpeechRecognitionConstructor();

    if (!SpeechRecognitionApi) {
      setDictationError(
        "O ditado por voz não está disponível neste navegador. Use Chrome ou Edge no computador."
      );
      return;
    }

    setDictationError(null);

    const recognition = new SpeechRecognitionApi();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setDictating(true);
    };

    recognition.onresult = (event) => {
      const transcripts: string[] = [];

      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const result = event.results[index];

        if (result.isFinal && result[0]?.transcript) {
          transcripts.push(result[0].transcript.trim());
        }
      }

      const transcript = transcripts.join(" ").trim();

      if (!transcript) {
        return;
      }

      setStudentText((current) => {
        const currentText = current.trimEnd();

        return currentText
          ? `${currentText} ${transcript}`
          : transcript;
      });

      setCopyStatus("idle");
      setEvaluation(null);
      setEvaluationError(null);
      setGoogleTranslation(null);
      setTranslationError(null);
      setSpeechError(null);
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted") {
        return;
      }

      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setDictationError(
          "Permita o acesso ao microfone no navegador para usar o ditado."
        );
        return;
      }

      if (event.error === "no-speech") {
        setDictationError(
          "Nenhuma fala foi detectada. Clique no microfone e tente novamente."
        );
        return;
      }

      setDictationError("Não foi possível reconhecer sua fala. Tente novamente.");
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setDictating(false);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setDictating(false);
      setDictationError("Não foi possível iniciar o microfone.");
    }
  }

  function handleClearStudentText() {
    setStudentText("");
    setCopyStatus("idle");
    setEvaluation(null);
    setEvaluationError(null);
    setGoogleTranslation(null);
    setTranslationError(null);
    setSpeechError(null);
    setSpeaking(false);
    setEvaluationSpeaking(null);
    setDictationError(null);
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setDictating(false);

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  async function handleCopyStudentText() {
    const textToCopy = studentText.trim();

    if (!textToCopy) {
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = textToCopy;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        textarea.style.pointerEvents = "none";
        document.body.appendChild(textarea);
        textarea.select();

        const copied = document.execCommand("copy");
        document.body.removeChild(textarea);

        if (!copied) {
          throw new Error("Não foi possível copiar a frase.");
        }
      }

      setCopyStatus("copied");
      window.setTimeout(() => {
        setCopyStatus("idle");
      }, 1500);
    } catch {
      setCopyStatus("error");
      window.setTimeout(() => {
        setCopyStatus("idle");
      }, 1500);
    }
  }

  function handleOpenGoogleTranslate() {
    const englishText = studentText.trim();

    if (!englishText) {
      return;
    }

    const googleTranslateUrl = new URL("https://translate.google.com/");
    googleTranslateUrl.searchParams.set("hl", "pt-BR");
    googleTranslateUrl.searchParams.set("sl", "en");
    googleTranslateUrl.searchParams.set("tl", "pt");
    googleTranslateUrl.searchParams.set("text", englishText);
    googleTranslateUrl.searchParams.set("op", "translate");

    window.open(
      googleTranslateUrl.toString(),
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function handleEvaluate() {
    if (
      !trainingItems.verb ||
      !trainingItems.adjective ||
      !trainingItems.noun
    ) {
      return;
    }

    if (!studentText.trim()) {
      setEvaluationError(
        "Escreva ou dite uma frase antes de solicitar a avaliação."
      );
      return;
    }

    setEvaluating(true);
    setEvaluationError(null);
    setEvaluation(null);

    try {
      const result = await evaluateTrainingWithAI({
        mode: "basic",
        intention,
        studentText,
        vocabulary: {
          verbs: [trainingItems.verb.base],
          adjectives: [trainingItems.adjective.adjective],
          nouns: [trainingItems.noun.noun]
        }
      });

      setEvaluation(result);
    } catch (err) {
      setEvaluationError(
        err instanceof Error
          ? err.message
          : "Não foi possível avaliar a frase."
      );
    } finally {
      setEvaluating(false);
    }
  }

  async function handleGoogleTranslate() {
    if (!studentText.trim()) {
      setTranslationError(
        "Escreva ou dite uma frase antes de solicitar a tradução."
      );
      return;
    }

    setTranslating(true);
    setTranslationError(null);
    setGoogleTranslation(null);

    try {
      const result = await translateEnglishToPortuguese(studentText);
      setGoogleTranslation(result.translatedText);
    } catch (err) {
      setTranslationError(
        err instanceof Error
          ? err.message
          : "Não foi possível traduzir a frase com o Google."
      );
    } finally {
      setTranslating(false);
    }
  }

  function handleSpeakEnglish() {
    const englishText = studentText.trim();

    if (!englishText) {
      setSpeechError("Não há uma frase em inglês para reproduzir.");
      return;
    }

    if (!("speechSynthesis" in window)) {
      setSpeechError(
        "O recurso de voz não está disponível neste navegador."
      );
      return;
    }

    window.speechSynthesis.cancel();
    setSpeechError(null);
    setEvaluationSpeaking(null);

    const utterance = new SpeechSynthesisUtterance(englishText);
    const voices = window.speechSynthesis.getVoices();
    const americanVoice = voices.find(
      (voice) => voice.lang.toLowerCase() === "en-us"
    );

    if (americanVoice) {
      utterance.voice = americanVoice;
    }

    utterance.lang = "en-US";
    utterance.rate = 0.9;
    utterance.pitch = 1;

    utterance.onstart = () => {
      setSpeaking(true);
    };

    utterance.onend = () => {
      setSpeaking(false);
    };

    utterance.onerror = () => {
      setSpeaking(false);
      setSpeechError("Não foi possível reproduzir a frase em inglês.");
    };

    window.speechSynthesis.speak(utterance);
  }

  function handleSpeakEvaluationSentence(
    text: string,
    target: "corrected" | "better"
  ) {
    const englishText = text.trim();

    if (!englishText) {
      setSpeechError("Não há uma frase em inglês para reproduzir.");
      return;
    }

    if (!("speechSynthesis" in window)) {
      setSpeechError(
        "O recurso de voz não está disponível neste navegador."
      );
      return;
    }

    window.speechSynthesis.cancel();
    setSpeechError(null);
    setSpeaking(false);
    setEvaluationSpeaking(null);

    const utterance = new SpeechSynthesisUtterance(englishText);
    const voices = window.speechSynthesis.getVoices();
    const americanVoice = voices.find(
      (voice) => voice.lang.toLowerCase() === "en-us"
    );

    if (americanVoice) {
      utterance.voice = americanVoice;
    }

    utterance.lang = "en-US";
    utterance.rate = 0.9;
    utterance.pitch = 1;

    utterance.onstart = () => {
      setSpeaking(false);
      setEvaluationSpeaking(target);
    };

    utterance.onend = () => {
      setEvaluationSpeaking(null);
    };

    utterance.onerror = () => {
      setEvaluationSpeaking(null);
      setSpeechError("Não foi possível reproduzir a frase em inglês.");
    };

    window.speechSynthesis.speak(utterance);
  }

  return (
    <section className="basic-training">
      <div className="training-toolbar">
        <button
          type="button"
          className="secondary-button"
          onClick={onBack}
        >
          Voltar para o Hashmap
        </button>

        {!loading && !error && (
          <button
            type="button"
            className="primary-button"
            onClick={generateNewRound}
          >
            Sortear novamente
          </button>
        )}
      </div>

      <div className="training-page-header">
        <p className="eyebrow">Treino básico</p>
        <h1>{intention.intention}</h1>
        <p className="detail-english">{intention.english}</p>

        {intention.examples && intention.examples.length > 0 && (
          <section className="training-intention-example">
            <h3>Exemplo</h3>
            <div className="example">
              <p>
                {renderHighlightedText(
                  intention.examples[0].pt,
                  intention.examples[0].ptIntent
                )}
              </p>
              <p className="english">
                {renderHighlightedText(
                  intention.examples[0].en,
                  intention.examples[0].enIntent
                )}
              </p>
            </div>
          </section>
        )}

        {intention.pattern && (
          <p className="training-pattern">{intention.pattern}</p>
        )}

        <p className="training-instruction">
          Crie uma frase usando a intenção mental e tente incluir
          o verbo, o adjetivo e o substantivo sorteados abaixo.
        </p>
      </div>

      {loading && (
        <div className="status-card">
          <div className="spinner" />
          <p>Carregando vocabulário...</p>
        </div>
      )}

      {!loading && error && (
        <div className="status-card error-card">
          <h2>Não foi possível carregar o treino.</h2>
          <p>{error}</p>
        </div>
      )}

      {!loading &&
        !error &&
        trainingItems.verb &&
        trainingItems.adjective &&
        trainingItems.noun && (
          <div className="basic-training-grid">
            <article className="training-word-card">
              <p className="eyebrow">Verbo</p>
              <h2>{trainingItems.verb.base}</h2>

              {trainingItems.verb.meanings &&
                trainingItems.verb.meanings.length > 0 && (
                  <p className="training-translation">
                    {trainingItems.verb.meanings.join(" / ")}
                  </p>
                )}

              <div className="training-verb-forms">
                <div className="training-verb-form">
                  <span>Presente</span>
                  <strong>
                    {trainingItems.verb.thirdPerson
                      ? `${trainingItems.verb.base} / ${trainingItems.verb.thirdPerson}`
                      : trainingItems.verb.base}
                  </strong>
                </div>

                {trainingItems.verb.past && (
                  <div className="training-verb-form">
                    <span>Passado</span>
                    <strong>{trainingItems.verb.past}</strong>
                  </div>
                )}

                {trainingItems.verb.pastParticiple && (
                  <div className="training-verb-form">
                    <span>Particípio</span>
                    <strong>{trainingItems.verb.pastParticiple}</strong>
                  </div>
                )}

                {trainingItems.verb.type && (
                  <div className="training-verb-form">
                    <span>Tipo</span>
                    <strong>
                      {trainingItems.verb.type === "irregular"
                        ? "Irregular"
                        : "Regular"}
                    </strong>
                  </div>
                )}
              </div>
            </article>

            <article className="training-word-card">
              <p className="eyebrow">Adjetivo</p>
              <h2>{trainingItems.adjective.adjective}</h2>

              {trainingItems.adjective.meanings &&
                trainingItems.adjective.meanings.length > 0 && (
                  <p className="training-translation">
                    {trainingItems.adjective.meanings.join(" / ")}
                  </p>
                )}
            </article>

            <article className="training-word-card">
              <p className="eyebrow">Noun</p>
              <h2>{trainingItems.noun.noun}</h2>

              {trainingItems.noun.meanings &&
                trainingItems.noun.meanings.length > 0 && (
                  <p className="training-translation">
                    {trainingItems.noun.meanings.join(" / ")}
                  </p>
                )}
            </article>
          </div>
        )}

      {!loading && !error && (
        <>
          <div className="training-writing-area">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.55rem",
                marginBottom: "0.35rem"
              }}
            >
              <label htmlFor="basic-training-answer" style={{ margin: 0 }}>
                Escreva (Dite) sua frase
              </label>

              {studentText.length > 0 && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleClearStudentText}
                  title="Limpar frase"
                  aria-label="Limpar frase"
                  style={{
                    width: "2.25rem",
                    minWidth: "2.25rem",
                    height: "2.25rem",
                    minHeight: "2.25rem",
                    padding: 0,
                    borderRadius: "999px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0
                  }}
                >
                  <svg
                    aria-hidden="true"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v5" />
                    <path d="M14 11v5" />
                  </svg>
                </button>
              )}

              {showDictationButton && (
                <button
                type="button"
                className="secondary-button"
                onClick={handleToggleDictation}
                title={dictating ? "Parar ditado" : "Ditar frase em inglês"}
                aria-label={dictating ? "Parar ditado" : "Ditar frase em inglês"}
                aria-pressed={dictating}
                style={{
                  width: "2.25rem",
                  minWidth: "2.25rem",
                  height: "2.25rem",
                  minHeight: "2.25rem",
                  padding: 0,
                  borderRadius: "999px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  color: dictating ? "#dc2626" : undefined,
                  boxShadow: dictating
                    ? "0 0 0 2px rgba(220, 38, 38, 0.18)"
                    : undefined
                }}
              >
                <svg
                  aria-hidden="true"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="2" width="6" height="11" rx="3" />
                  <path d="M5 10a7 7 0 0 0 14 0" />
                  <path d="M12 17v5" />
                  <path d="M8 22h8" />
                </svg>
                </button>
              )}

              <button
                type="button"
                className="secondary-button"
                onClick={handleCopyStudentText}
                disabled={!studentText.trim()}
                title={
                  copyStatus === "copied"
                    ? "Frase copiada"
                    : copyStatus === "error"
                      ? "Erro ao copiar"
                      : "Copiar frase"
                }
                aria-label={
                  copyStatus === "copied"
                    ? "Frase copiada"
                    : copyStatus === "error"
                      ? "Erro ao copiar a frase"
                      : "Copiar frase para a área de transferência"
                }
                style={{
                  width: "2.25rem",
                  minWidth: "2.25rem",
                  height: "2.25rem",
                  minHeight: "2.25rem",
                  padding: 0,
                  borderRadius: "999px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}
              >
                {copyStatus === "copied" ? (
                  <span aria-hidden="true">✓</span>
                ) : (
                  <svg
                    aria-hidden="true"
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={handleOpenGoogleTranslate}
                disabled={!studentText.trim()}
                title="Abrir no Google Tradutor (inglês → português)"
                aria-label="Abrir frase no Google Tradutor do inglês para português"
                style={{
                  width: "2.25rem",
                  minWidth: "2.25rem",
                  height: "2.25rem",
                  minHeight: "2.25rem",
                  padding: "0.28rem",
                  borderRadius: "999px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  overflow: "hidden"
                }}
              >
                <img
                  src="/google-translate-icon.png"
                  alt=""
                  aria-hidden="true"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    display: "block"
                  }}
                />
              </button>
            </div>

            <textarea
              id="basic-training-answer"
              rows={5}
              placeholder="Digite sua frase em inglês..."
              value={studentText}
              onChange={(event) => {
                setStudentText(event.target.value);
                setCopyStatus("idle");
                setEvaluation(null);
                setEvaluationError(null);
                setGoogleTranslation(null);
                setTranslationError(null);
                setSpeechError(null);
                setSpeaking(false);
                setEvaluationSpeaking(null);

                if ("speechSynthesis" in window) {
                  window.speechSynthesis.cancel();
                }
              }}
            />

            {dictationError && (
              <p
                role="alert"
                style={{
                  margin: "0.45rem 0 0",
                  color: "#b91c1c",
                  fontSize: "0.9rem"
                }}
              >
                {dictationError}
              </p>
            )}

            <div className="training-action-buttons">
              {AI_ENABLED && (
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleEvaluate}
                  disabled={evaluating || !studentText.trim()}
                >
                  {evaluating
                    ? "Avaliando com IA..."
                    : "Avaliar com IA"}
                </button>
              )}

              <button
                type="button"
                className="secondary-button"
                onClick={handleGoogleTranslate}
                disabled={translating || !studentText.trim()}
              >
                {translating
                  ? "Traduzindo..."
                  : "Traduzir com Google"}
              </button>
            </div>
          </div>

          {translationError && (
            <div className="status-card error-card google-translation-error">
              <h2>Não foi possível traduzir a frase.</h2>
              <p>{translationError}</p>
            </div>
          )}

          {googleTranslation && (
            <>
              <section className="status-card google-translation-card">
                <p className="eyebrow">Tradução do Google</p>
                <h2>Versão em português</h2>
                <p>{googleTranslation}</p>
              </section>

              <div className="training-action-buttons">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleSpeakEnglish}
                  disabled={speaking || !studentText.trim()}
                >
                  {speaking ? "🔊 Reproduzindo..." : "🔊 Ouvir inglês"}
                </button>
              </div>
            </>
          )}

          {speechError && (
            <div className="status-card error-card google-translation-error">
              <h2>Não foi possível reproduzir o áudio.</h2>
              <p>{speechError}</p>
            </div>
          )}

          {AI_ENABLED && evaluationError && (
            <div className="status-card error-card ai-evaluation-error">
              <h2>Não foi possível avaliar a frase.</h2>
              <p>{evaluationError}</p>
            </div>
          )}

          {AI_ENABLED && evaluation && (
            <section className="ai-evaluation-card">
              <div className="ai-evaluation-header">
                <div>
                  <p className="eyebrow">Avaliação com IA</p>
                  <h2>Resultado do treino</h2>
                </div>

                <div className="ai-score">
                  <strong>{evaluation.score}</strong>
                  <span>/ 10</span>
                </div>
              </div>

              <div className="ai-evaluation-grid">
                <div>
                  <span>Gramática</span>
                  <strong>{evaluation.grammar}</strong>
                </div>

                <div>
                  <span>Naturalidade</span>
                  <strong>{evaluation.naturalness}</strong>
                </div>

                <div>
                  <span>Intenção mental</span>
                  <strong>
                    {evaluation.intentionUsedCorrectly
                      ? "Correta"
                      : "Precisa melhorar"}
                  </strong>
                </div>

                <div>
                  <span>Vocabulário sorteado</span>
                  <strong>
                    {evaluation.vocabularyUsedCorrectly
                      ? "Bom uso"
                      : "Precisa melhorar"}
                  </strong>
                </div>
              </div>

              <div className="ai-feedback-section">
                <h3>Feedback</h3>
                <p>{evaluation.feedbackPt}</p>
              </div>

              <div className="ai-feedback-section">
                <h3>Correção</h3>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem"
                  }}
                >
                  <p className="english" style={{ flex: 1, margin: 0 }}>
                    {evaluation.correctedSentence}
                  </p>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      handleSpeakEvaluationSentence(
                        evaluation.correctedSentence,
                        "corrected"
                      )
                    }
                    disabled={evaluationSpeaking === "corrected"}
                    title="Ouvir a correção em inglês"
                    aria-label="Ouvir a correção em inglês"
                    style={{
                      width: "2.5rem",
                      minWidth: "2.5rem",
                      height: "2.5rem",
                      minHeight: "2.5rem",
                      padding: 0,
                      borderRadius: "999px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}
                  >
                    <span aria-hidden="true">🔊</span>
                  </button>
                </div>
              </div>

              <div className="ai-feedback-section">
                <h3>Versão mais natural</h3>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem"
                  }}
                >
                  <p className="english" style={{ flex: 1, margin: 0 }}>
                    {evaluation.betterVersion}
                  </p>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      handleSpeakEvaluationSentence(
                        evaluation.betterVersion,
                        "better"
                      )
                    }
                    disabled={evaluationSpeaking === "better"}
                    title="Ouvir a versão mais natural em inglês"
                    aria-label="Ouvir a versão mais natural em inglês"
                    style={{
                      width: "2.5rem",
                      minWidth: "2.5rem",
                      height: "2.5rem",
                      minHeight: "2.5rem",
                      padding: 0,
                      borderRadius: "999px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}
                  >
                    <span aria-hidden="true">🔊</span>
                  </button>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </section>
  );
}
