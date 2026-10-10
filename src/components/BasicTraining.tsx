import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MentalIntention } from "../types/hashmap";
import {
  evaluateTrainingWithAI,
  type AIEvaluationResult
} from "../services/aiEvaluationService";
import { translateEnglishToPortuguese } from "../services/googleTranslateService";
import { validateIntention } from "../services/intentionValidator";

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
  const intentionValidation = useMemo(
    () => validateIntention(studentText, intention),
    [studentText, intention]
  );
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
  const [evaluationCopyStatus, setEvaluationCopyStatus] = useState<{
    target: "corrected" | "better";
    status: "copied" | "error";
  } | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [dictating, setDictating] = useState(false);
  const showDictationButton = !isMobileDevice();
  const [dictationError, setDictationError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const trainingGridRef = useRef<HTMLDivElement>(null);

  const googleTranslationCardRef = useRef<HTMLElement | null>(null);
  const aiEvaluationCardRef = useRef<HTMLElement | null>(null);

  // O resultado precisa estar montado no DOM antes de posicionar a tela.
  useLayoutEffect(() => {
    if (googleTranslation) {
      googleTranslationCardRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
    }
  }, [googleTranslation]);

  useLayoutEffect(() => {
    if (evaluation && AI_ENABLED) {
      aiEvaluationCardRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
    }
  }, [evaluation]);

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
    setEvaluationCopyStatus(null);
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

    // Após um novo sorteio, reposiciona o estudo no início dos cartões sorteados apenas no celular.
    if (window.matchMedia("(max-width: 820px)").matches) {
      window.requestAnimationFrame(() => {
        trainingGridRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      });
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
    setEvaluationCopyStatus(null);
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
    setEvaluationCopyStatus(null);
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

  function handleOpenEvaluationGoogleTranslate(text: string) {
    const englishText = text.trim();
    if (!englishText) return;

    const googleTranslateUrl = new URL("https://translate.google.com/");
    googleTranslateUrl.searchParams.set("hl", "pt-BR");
    googleTranslateUrl.searchParams.set("sl", "en");
    googleTranslateUrl.searchParams.set("tl", "pt");
    googleTranslateUrl.searchParams.set("text", englishText);
    googleTranslateUrl.searchParams.set("op", "translate");

    window.open(googleTranslateUrl.toString(), "_blank", "noopener,noreferrer");
  }

  function handlePrintWorksheet() {
    // Imprime somente a folha A4, isolada do layout e das alturas do aplicativo.
    // O HTML já contém o vocabulário do sorteio atual, sem gerar outra rodada.
    const worksheet = document.querySelector<HTMLElement>(
      ".basic-training-print-sheet"
    );
    const worksheetStyles = document.querySelector<HTMLStyleElement>(
      ".basic-training > style"
    );

    if (!worksheet || !worksheetStyles) {
      return;
    }

    const printFrame = document.createElement("iframe");
    printFrame.setAttribute("title", "Impressão da folha de exercícios");
    printFrame.setAttribute("aria-hidden", "true");
    printFrame.style.position = "fixed";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "0";
    printFrame.style.opacity = "0";
    printFrame.style.pointerEvents = "none";

    // O iframe não herda o CSS do site: isso evita páginas extras em branco.
    printFrame.srcdoc = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Brazilian English Journey - Treino Básico</title>
  <style>${worksheetStyles.textContent ?? ""}</style>
  <style>
    @media print {
      html, body { margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 0 !important; overflow: visible !important; }
      .basic-training-print-sheet { position: static !important; top: auto !important; left: auto !important; width: 100% !important; }
    }
  </style>
</head>
<body>${worksheet.outerHTML}</body>
</html>`;

    printFrame.onload = () => {
      const printWindow = printFrame.contentWindow;
      if (!printWindow) {
        printFrame.remove();
        return;
      }

      printWindow.addEventListener("afterprint", () => {
        window.setTimeout(() => printFrame.remove(), 500);
      }, { once: true });
      printWindow.focus();
      printWindow.print();
    };

    document.body.appendChild(printFrame);
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
    setEvaluationCopyStatus(null);

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

  async function handleCopyEvaluationSentence(
    text: string,
    target: "corrected" | "better"
  ) {
    const textToCopy = text.trim();
    if (!textToCopy) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        // Compatibilidade com navegadores sem Clipboard API.
        const textarea = document.createElement("textarea");
        textarea.value = textToCopy;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        textarea.style.pointerEvents = "none";
        document.body.appendChild(textarea);
        try {
          textarea.select();
          if (!document.execCommand("copy")) {
            throw new Error("Falha ao copiar a frase.");
          }
        } finally {
          textarea.remove();
        }
      }
      setEvaluationCopyStatus({ target, status: "copied" });
    } catch {
      setEvaluationCopyStatus({ target, status: "error" });
    }
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
          <div className="basic-training-grid" ref={trainingGridRef}>
            <article className="training-word-card">
              <p className="eyebrow">
                Verbo{trainingItems.verb.type && (
                  <> ({trainingItems.verb.type === "irregular" ? "IRREGULAR" : "REGULAR"})</>
                )}
              </p>
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

              <button
                type="button"
                className="secondary-button"
                onClick={handlePrintWorksheet}
                disabled={loading || Boolean(error) || !trainingItems.verb || !trainingItems.noun || !trainingItems.adjective}
                title="Imprimir folha de exercícios (A4)"
                aria-label="Imprimir folha de exercícios do treino básico"
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
                  <path d="M6 9V3h12v6" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                  <path d="M18 12h.01" />
                </svg>
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
    setEvaluationCopyStatus(null);
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

            {intentionValidation.status !== "empty" && (
              <p
                role="status"
                aria-live="polite"
                style={{
                  margin: "0.45rem 0 0",
                  fontSize: "0.9rem",
                  fontWeight: 500,
                  color:
                    intentionValidation.status === "found"
                      ? "#15803d"
                      : intentionValidation.status === "missing"
                        ? "#b45309"
                        : "#64748b"
                }}
              >
                {intentionValidation.status === "found"
                  ? "✓ Intenção mental identificada!"
                  : intentionValidation.status === "missing"
                    ? "⚠ Você ainda não utilizou a intenção mental."
                    : "Validação automática indisponível para esta intenção."}
              </p>
            )}

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
              <section className="status-card google-translation-card" ref={googleTranslationCardRef}>
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
            <>
            <section className="ai-evaluation-card" ref={aiEvaluationCardRef}>
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
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: "0.6rem",
                    width: "100%"
                  }}
                >
                  <p className="english" style={{ margin: 0, width: "100%", overflowWrap: "anywhere" }}>
                    {evaluation.correctedSentence}
                  </p>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
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

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      handleCopyEvaluationSentence(
                        evaluation.correctedSentence,
                        "corrected"
                      )
                    }
                    disabled={!evaluation.correctedSentence.trim()}
                    title={
                      evaluationCopyStatus?.target === "corrected"
                        ? evaluationCopyStatus.status === "copied"
                          ? "Frase copiada!"
                          : "Não foi possível copiar a frase"
                        : "Copiar correção"
                    }
                    aria-label={
                      evaluationCopyStatus?.target === "corrected" &&
                      evaluationCopyStatus.status === "copied"
                        ? "Frase copiada para a área de transferência"
                        : "Copiar correção para a área de transferência"
                    }
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
                    {evaluationCopyStatus?.target === "corrected" &&
                    evaluationCopyStatus.status === "copied" ? (
                      <span aria-hidden="true" style={{ color: "#15803d" }}>✓</span>
                    ) : (
                      <svg
                        aria-hidden="true"
                        width="19"
                        height="19"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="8" y="8" width="12" height="12" rx="2" />
                        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
                      </svg>
                    )}
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleOpenEvaluationGoogleTranslate(evaluation.correctedSentence)}
                    disabled={!evaluation.correctedSentence.trim()}
                    title="Traduzir correção no Google Tradutor (inglês → português)"
                    aria-label="Abrir correção no Google Tradutor do inglês para português"
                    style={{
                      width: "2.5rem",
                      minWidth: "2.5rem",
                      height: "2.5rem",
                      minHeight: "2.5rem",
                      padding: "0.32rem",
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
                </div>
              </div>

              <div className="ai-feedback-section">
                <h3>Versão mais natural</h3>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: "0.6rem",
                    width: "100%"
                  }}
                >
                  <p className="english" style={{ margin: 0, width: "100%", overflowWrap: "anywhere" }}>
                    {evaluation.betterVersion}
                  </p>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
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

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      handleCopyEvaluationSentence(
                        evaluation.betterVersion,
                        "better"
                      )
                    }
                    disabled={!evaluation.betterVersion.trim()}
                    title={
                      evaluationCopyStatus?.target === "better"
                        ? evaluationCopyStatus.status === "copied"
                          ? "Frase copiada!"
                          : "Não foi possível copiar a frase"
                        : "Copiar versão mais natural"
                    }
                    aria-label={
                      evaluationCopyStatus?.target === "better" &&
                      evaluationCopyStatus.status === "copied"
                        ? "Frase copiada para a área de transferência"
                        : "Copiar versão mais natural para a área de transferência"
                    }
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
                    {evaluationCopyStatus?.target === "better" &&
                    evaluationCopyStatus.status === "copied" ? (
                      <span aria-hidden="true" style={{ color: "#15803d" }}>✓</span>
                    ) : (
                      <svg
                        aria-hidden="true"
                        width="19"
                        height="19"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="8" y="8" width="12" height="12" rx="2" />
                        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
                      </svg>
                    )}
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleOpenEvaluationGoogleTranslate(evaluation.betterVersion)}
                    disabled={!evaluation.betterVersion.trim()}
                    title="Traduzir versão mais natural no Google Tradutor (inglês → português)"
                    aria-label="Abrir versão mais natural no Google Tradutor do inglês para português"
                    style={{
                      width: "2.5rem",
                      minWidth: "2.5rem",
                      height: "2.5rem",
                      minHeight: "2.5rem",
                      padding: "0.32rem",
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
                </div>
              </div>
            </section>
            <div className="training-toolbar" style={{ marginTop: "1rem", marginBottom: "1rem" }}>
              <button
                type="button"
                className="primary-button"
                onClick={generateNewRound}
              >
                Sortear novamente
              </button>
            </div>
            </>
          )}
        </>
      )}

      {/* Folha A4 exclusiva para impressão. Não interfere na tela do treino. */}
      <style>{`
        @media screen {
          .basic-training-print-sheet { display: none !important; }
        }
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          body * { visibility: hidden !important; }
          .basic-training > :not(.basic-training-print-sheet):not(style) {
            display: none !important;
          }
          .basic-training {
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            background: #fff !important;
            box-shadow: none !important;
            min-height: 0 !important;
          }
          .basic-training-print-sheet,
          .basic-training-print-sheet * { visibility: visible !important; }
          .basic-training-print-sheet {
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            box-sizing: border-box !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #fff !important;
            color: #172033 !important;
            font: 11pt/1.35 Arial, Helvetica, sans-serif !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .basic-training-print-sheet * { box-sizing: border-box; }
          .basic-training-print-sheet h1,
          .basic-training-print-sheet h2,
          .basic-training-print-sheet p { margin: 0; }
          .basic-training-print-sheet .worksheet-top {
            border-bottom: 2px solid #334ad9;
            padding-bottom: 4mm;
            margin-bottom: 5mm;
          }
          .basic-training-print-sheet .worksheet-eyebrow {
            font-size: 9pt;
            letter-spacing: 1px;
            font-weight: 700;
            color: #334ad9;
            margin-bottom: 2mm;
          }
          .basic-training-print-sheet .worksheet-intention {
            font-size: 19pt;
            line-height: 1.2;
            font-weight: 750;
            margin-bottom: 1mm;
          }
          .basic-training-print-sheet .worksheet-english {
            color: #334ad9;
            font-size: 14pt;
            font-weight: 700;
          }
          .basic-training-print-sheet .worksheet-section { margin-bottom: 5mm; break-inside: avoid; }
          .basic-training-print-sheet .worksheet-section-title {
            font-size: 10pt;
            font-weight: 700;
            margin-bottom: 2mm;
          }
          .basic-training-print-sheet .worksheet-example {
            background: #f4f6fa !important;
            padding: 3mm 4mm;
            border-radius: 2mm;
          }
          .basic-training-print-sheet .worksheet-example p + p { margin-top: 1.5mm; }
          .basic-training-print-sheet .worksheet-example-pt .intention-highlight {
            color: #b84d00 !important;
            background: #ffe8c9 !important;
            font-weight: 700;
          }
          .basic-training-print-sheet .worksheet-example-en { color: #2445c6 !important; }
          .basic-training-print-sheet .worksheet-example-en .intention-highlight {
            color: #1438c0 !important;
            background: #dce7ff !important;
            font-weight: 700;
          }
          .basic-training-print-sheet .worksheet-pattern { font-family: monospace; font-size: 10pt; }
          .basic-training-print-sheet .worksheet-vocabulary {
            display: grid;
            grid-template-columns: 1.6fr 1fr 1fr;
            gap: 3mm;
            margin-bottom: 6mm;
            break-inside: avoid;
          }
          .basic-training-print-sheet .worksheet-vocab-card {
            border: 1px solid #ccd5e4;
            border-radius: 2mm;
            padding: 3mm;
            min-height: 34mm;
          }
          .basic-training-print-sheet .worksheet-vocab-label {
            color: #334ad9;
            font-size: 8pt;
            font-weight: 700;
            letter-spacing: .5px;
          }
          .basic-training-print-sheet .worksheet-vocab-word {
            font-size: 13pt;
            font-weight: 700;
            margin: 1mm 0 !important;
          }
          .basic-training-print-sheet .worksheet-vocab-meaning {
            font-size: 9pt;
            color: #59677b;
            margin-bottom: 2mm !important;
          }
          .basic-training-print-sheet .worksheet-verb-forms {
            border-top: 1px solid #e0e5ef;
            padding-top: 2mm;
            font-size: 9pt;
          }
          .basic-training-print-sheet .worksheet-verb-forms p + p { margin-top: 1mm; }
          .basic-training-print-sheet .worksheet-writing-title {
            font-size: 11pt;
            font-weight: 700;
            margin-bottom: 2mm;
          }
          .basic-training-print-sheet .worksheet-writing-instruction {
            font-size: 9pt;
            color: #536076;
            margin-bottom: 3mm;
          }
          .basic-training-print-sheet .worksheet-writing-line {
            height: 10mm;
            border-bottom: 1px solid #b5c0cf;
            break-inside: avoid;
          }
        }
      `}</style>

      <div className="basic-training-print-sheet" aria-hidden="true">
        <header className="worksheet-top">
          <p className="worksheet-eyebrow">BRAZILIAN ENGLISH JOURNEY · TREINO BÁSICO</p>
          <h1 className="worksheet-intention">{intention.intention}</h1>
          <p className="worksheet-english">{intention.english}</p>
        </header>

        {intention.examples && intention.examples.length > 0 && (
          <section className="worksheet-section">
            <h2 className="worksheet-section-title">Exemplo</h2>
            <div className="worksheet-example">
              <p className="worksheet-example-pt">
                {renderHighlightedText(intention.examples[0].pt, intention.examples[0].ptIntent)}
              </p>
              <p className="worksheet-example-en">
                {renderHighlightedText(intention.examples[0].en, intention.examples[0].enIntent)}
              </p>
            </div>
          </section>
        )}

        {intention.pattern && (
          <section className="worksheet-section">
            <h2 className="worksheet-section-title">Pattern de uso</h2>
            <p className="worksheet-pattern">{intention.pattern}</p>
          </section>
        )}

        {trainingItems.verb && trainingItems.noun && trainingItems.adjective && (
          <section className="worksheet-vocabulary">
            <div className="worksheet-vocab-card">
              <p className="worksheet-vocab-label">VERBO</p>
              <p className="worksheet-vocab-word">{trainingItems.verb.base}</p>
              <p className="worksheet-vocab-meaning">{trainingItems.verb.meanings?.join(" / ")}</p>
              <div className="worksheet-verb-forms">
                <p><strong>Presente:</strong> {trainingItems.verb.base}{trainingItems.verb.thirdPerson ? ` / ${trainingItems.verb.thirdPerson}` : ""}</p>
                <p><strong>Passado:</strong> {trainingItems.verb.past ?? "—"}</p>
                <p><strong>Particípio:</strong> {trainingItems.verb.pastParticiple ?? "—"}</p>
              </div>
            </div>
            <div className="worksheet-vocab-card">
              <p className="worksheet-vocab-label">ADJETIVO</p>
              <p className="worksheet-vocab-word">{trainingItems.adjective.adjective}</p>
              <p className="worksheet-vocab-meaning">{trainingItems.adjective.meanings?.join(" / ")}</p>
            </div>
            <div className="worksheet-vocab-card">
              <p className="worksheet-vocab-label">NOUN</p>
              <p className="worksheet-vocab-word">{trainingItems.noun.noun}</p>
              <p className="worksheet-vocab-meaning">{trainingItems.noun.meanings?.join(" / ")}</p>
            </div>
          </section>
        )}

        <section className="worksheet-writing">
          <h2 className="worksheet-writing-title">Minha prática escrita</h2>
          <p className="worksheet-writing-instruction">
            Crie frases em inglês com a intenção mental e tente usar o verbo, o adjetivo e o substantivo sorteados.
          </p>
          {Array.from({ length: 10 }, (_, index) => (
            <div className="worksheet-writing-line" key={index} />
          ))}
        </section>
      </div>
    </section>
  );
}
