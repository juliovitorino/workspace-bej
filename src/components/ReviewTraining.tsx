import { t, languageName as localizedLanguageName } from "../i18n";
import { useTranslation } from "react-i18next";
import { isAuthorMode } from "../utils/authorMode";
import { LANGUAGES, type StudentLanguage } from "../config/languages";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MentalIntention } from "../types/hashmap";
import {
  evaluateTrainingWithAI,
  type AIEvaluationResult
} from "../services/aiEvaluationService";
import { translateStudentLanguageToPortuguese } from "../services/googleTranslateService";
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

interface ReviewTrainingProps {
  intention: MentalIntention;
  language: StudentLanguage;
  onBack: () => void;
}

export function ReviewTraining({
  intention,
  language,
  onBack
}: ReviewTrainingProps) {
  const { t } = useTranslation();
  const languageName = localizedLanguageName(language).toLowerCase();
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
    return () => {
      recognitionRef.current?.abort();

      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function handleToggleDictation() {
    if (dictating) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognitionApi = getSpeechRecognitionConstructor();

    if (!SpeechRecognitionApi) {
      setDictationError(
        t("common.voiceDictationIsUnavailableInThisBrowserUseChromeOr")
      );
      return;
    }

    setDictationError(null);

    const recognition = new SpeechRecognitionApi();
    recognition.lang = language;
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
          t("common.allowMicrophoneAccessInYourBrowserToUseDictation")
        );
        return;
      }

      if (event.error === "no-speech") {
        setDictationError(
          t("common.noSpeechDetectedClickTheMicrophoneAndTryAgain")
        );
        return;
      }

      setDictationError(t("common.couldNotRecognizeYourSpeechTryAgain"));
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
      setDictationError(t("common.couldNotStartTheMicrophone"));
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
          throw new Error(t("common.couldNotCopyTheSentence"));
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
    googleTranslateUrl.searchParams.set("sl", language.split("-")[0]);
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
    googleTranslateUrl.searchParams.set("sl", language.split("-")[0]);
    googleTranslateUrl.searchParams.set("tl", "pt");
    googleTranslateUrl.searchParams.set("text", englishText);
    googleTranslateUrl.searchParams.set("op", "translate");

    window.open(googleTranslateUrl.toString(), "_blank", "noopener,noreferrer");
  }

  function handlePrintWorksheet() {
    // Imprime somente a folha A4, isolada do layout e das alturas do aplicativo.
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
    printFrame.setAttribute("title", t("common.printWorksheet"));
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
  <title>Brazilian English Journey - Revisão</title>
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
    if (!isAuthorMode()) return;
    if (!studentText.trim()) {
      setEvaluationError(
        t("common.writeOrDictateASentenceBeforeRequestingAnEvaluation")
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
        language,
        intention,
        studentText,
        vocabulary: {
          verbs: [],
          adjectives: [],
          nouns: []
        }
      });

      setEvaluation(result);
    } catch (err) {
      setEvaluationError(
        err instanceof Error
          ? err.message
          : t("common.couldNotEvaluateTheSentence")
      );
    } finally {
      setEvaluating(false);
    }
  }

  async function handleGoogleTranslate() {
    if (!isAuthorMode()) return;
    if (!studentText.trim()) {
      setTranslationError(
        t("common.writeOrDictateASentenceBeforeRequestingATranslation")
      );
      return;
    }

    setTranslating(true);
    setTranslationError(null);
    setGoogleTranslation(null);

    try {
      const result = await translateStudentLanguageToPortuguese(studentText, language);
      setGoogleTranslation(result.translatedText);
    } catch (err) {
      setTranslationError(
        err instanceof Error
          ? err.message
          : t("common.couldNotTranslateTheSentenceWithGoogle")
      );
    } finally {
      setTranslating(false);
    }
  }

  function handleSpeakEnglish() {
    const englishText = studentText.trim();

    if (!englishText) {
      setSpeechError(t("common.thereIsNoSentenceInTargetlanguageToPlay", { targetLanguage: (languageName) }));
      return;
    }

    if (!("speechSynthesis" in window)) {
      setSpeechError(
        t("common.speechPlaybackIsUnavailableInThisBrowser")
      );
      return;
    }

    window.speechSynthesis.cancel();
    setSpeechError(null);
    setEvaluationSpeaking(null);

    const utterance = new SpeechSynthesisUtterance(englishText);
    const voices = window.speechSynthesis.getVoices();
    const americanVoice = voices.find(
      (voice) => voice.lang.toLowerCase() === language.toLowerCase()
    ) ?? voices.find(
      (voice) => voice.lang.toLowerCase().split("-")[0] === language.split("-")[0]
    );

    if (americanVoice) {
      utterance.voice = americanVoice;
    }

    utterance.lang = language;
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
      setSpeechError(t("common.couldNotPlayTheSentenceInTargetlanguage", { targetLanguage: (languageName) }));
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
            throw new Error(t("common.failedToCopyTheSentence"));
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
      setSpeechError(t("common.thereIsNoSentenceInTargetlanguageToPlay", { targetLanguage: (languageName) }));
      return;
    }

    if (!("speechSynthesis" in window)) {
      setSpeechError(
        t("common.speechPlaybackIsUnavailableInThisBrowser")
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
      (voice) => voice.lang.toLowerCase() === language.toLowerCase()
    ) ?? voices.find(
      (voice) => voice.lang.toLowerCase().split("-")[0] === language.split("-")[0]
    );

    if (americanVoice) {
      utterance.voice = americanVoice;
    }

    utterance.lang = language;
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
      setSpeechError(t("common.couldNotPlayTheSentenceInTargetlanguage", { targetLanguage: (languageName) }));
    };

    window.speechSynthesis.speak(utterance);
  }

  return (
    <section className="basic-training review-training">
      <div className="training-toolbar">
        <button
          type="button"
          className="secondary-button"
          onClick={onBack}
        >
          
          {t("common.backToHashmap")}
        </button>

      </div>

      <div className="training-page-header">
        <p className="eyebrow">{t("common.review")}</p>
        <h1>{intention.intention}</h1>
        <p className="detail-english">{intention.targetIntention ?? intention.english}</p>

        {intention.examples && intention.examples.length > 0 && (
          <section className="training-intention-example">
            <h3>{t("common.example")}</h3>
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
          
          {t("reviewTraining.createYourOwnSentenceInEnglishUsingTheCommunicativeIntention")}
        </p>
      </div>

      <div className="training-writing-area">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.55rem",
                marginBottom: "0.35rem"
              }}
            >
              <label htmlFor="review-training-answer" style={{ margin: 0 }}>
                
                {t("common.writeDictateYourSentence")}
              </label>

              {studentText.length > 0 && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleClearStudentText}
                  title={t("common.clearSentence")}
                  aria-label={t("common.clearSentence")}
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
                title={dictating ? t("common.stopDictation") : t("common.dictateASentenceInEnglish")}
                aria-label={dictating ? t("common.stopDictation") : t("common.dictateASentenceInEnglish")}
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
                  color: dictating ? "var(--bad)" : undefined,
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
                    ? t("common.sentenceCopied")
                    : copyStatus === "error"
                      ? t("common.copyError")
                      : t("common.copySentence")
                }
                aria-label={
                  copyStatus === "copied"
                    ? t("common.sentenceCopied")
                    : copyStatus === "error"
                      ? t("common.errorCopyingTheSentence")
                      : t("common.copySentenceToTheClipboard")
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
                title={t("common.openInGoogleTranslateEnglishPortuguese")}
                aria-label={t("common.openSentenceInGoogleTranslateFromEnglishToPortuguese")}
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
                
                title={t("common.printWorksheetA4")}
                aria-label={t("reviewTraining.printReviewWorksheet")}
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
              id="review-training-answer"
              rows={5}
              placeholder={t("common.typeYourSentenceInTargetlanguage", { targetLanguage: (languageName) })}
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
                  margin: "0.55rem 0 0",
                  display: "inline-flex",
                  alignItems: "center",
                  maxWidth: "100%",
                  boxSizing: "border-box",
                  padding: "0.5rem 0.9rem",
                  borderRadius: "999px",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  lineHeight: 1.4,
                  boxShadow: "0 2px 8px rgba(15, 23, 42, 0.06)",
                  color:
                    intentionValidation.status === "found"
                      ? "var(--good)"
                      : intentionValidation.status === "missing"
                        ? "var(--warning)"
                        : "var(--text-secondary)",
                  backgroundColor:
                    intentionValidation.status === "found"
                      ? "var(--good-soft)"
                      : intentionValidation.status === "missing"
                        ? "var(--warning-soft)"
                        : "var(--surface-soft)",
                  border:
                    intentionValidation.status === "found"
                      ? "1px solid var(--good-border)"
                      : intentionValidation.status === "missing"
                        ? "1px solid var(--warning-border)"
                        : "1px solid var(--text-secondary)"
                }}
              >
                {intentionValidation.status === "found"
                  ? "✓ " + t("common.communicativeIntentionIdentified")
                  : intentionValidation.status === "missing"
                    ? "⚠ " + t("common.youHavenTUsedTheCommunicativeIntentionYet")
                    : t("common.automaticValidationIsUnavailableForThisIntention")}
              </p>
            )}

            {dictationError && (
              <p
                role="alert"
                style={{
                  margin: "0.45rem 0 0",
                  color: "var(--bad)",
                  fontSize: "0.9rem"
                }}
              >
                {dictationError}
              </p>
            )}

            <div className="training-action-buttons">
              {AI_ENABLED && isAuthorMode() && (
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleEvaluate}
                  disabled={evaluating || !studentText.trim()}
                >
                  {evaluating
                    ? t("common.evaluatingWithAi")
                    : t("common.evaluateWithAi")}
                </button>
              )}

              {isAuthorMode() && (
                <button
                type="button"
                className="secondary-button"
                onClick={handleGoogleTranslate}
                disabled={translating || !studentText.trim()}
              >
                {translating
                  ? "Traduzindo..."
                  : t("common.translateWithGoogle")}
              </button>
              )}
            </div>
          </div>

          {isAuthorMode() && translationError && (
            <div className="status-card error-card google-translation-error">
              <h2>{t("common.couldNotTranslateTheSentence")}</h2>
              <p>{translationError}</p>
            </div>
          )}

          {isAuthorMode() && googleTranslation && (
            <>
              <section className="status-card google-translation-card" ref={googleTranslationCardRef}>
                <p className="eyebrow">{t("common.googleTranslation")}</p>
                <h2>{t("common.portugueseVersion")}</h2>
                <p>{googleTranslation}</p>
              </section>

              <div className="training-action-buttons">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleSpeakEnglish}
                  disabled={speaking || !studentText.trim()}
                >
                  {speaking ? "🔊 " + t("common.playing") : "🔊 " + t("common.listenInTargetlanguage", { targetLanguage: (languageName) })}
                </button>
              </div>
            </>
          )}

          {speechError && (
            <div className="status-card error-card google-translation-error">
              <h2>{t("common.couldNotPlayTheAudio")}</h2>
              <p>{speechError}</p>
            </div>
          )}

          {AI_ENABLED && isAuthorMode() && evaluationError && (
            <div className="status-card error-card ai-evaluation-error">
              <h2>{t("common.couldNotEvaluateTheSentence")}</h2>
              <p>{evaluationError}</p>
            </div>
          )}

          {AI_ENABLED && isAuthorMode() && evaluation && (
            <>
            <section className="ai-evaluation-card" ref={aiEvaluationCardRef}>
              <div className="ai-evaluation-header">
                <div>
                  <p className="eyebrow">{t("common.aiEvaluation")}</p>
                  <h2>{t("common.practiceResults")}</h2>
                </div>

                <div className="ai-score">
                  <strong>{evaluation.score}</strong>
                  <span>/ 10</span>
                </div>
              </div>

              <div className="ai-evaluation-grid">
                <div>
                  <span>{t("common.grammar")}</span>
                  <strong>{evaluation.grammar}</strong>
                </div>

                <div>
                  <span>{t("common.naturalness")}</span>
                  <strong>{evaluation.naturalness}</strong>
                </div>

                <div>
                  <span>{t("common.communicativeIntention")}</span>
                  <strong>
                    {evaluation.intentionUsedCorrectly
                      ? t("common.correct")
                      : t("common.needsImprovement")}
                  </strong>
                </div>

              </div>

              <div className="ai-feedback-section">
                <h3>{t("common.feedback")}</h3>
                <p>{evaluation.feedbackPt}</p>
              </div>

              <div className="ai-feedback-section">
                <h3>{t("common.correction")}</h3>

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
                    title={t("common.listenToTheCorrectionInEnglish")}
                    aria-label={t("common.listenToTheCorrectionInEnglish")}
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
                          ? t("common.sentenceCopied")
                          : t("common.couldNotCopyTheSentence")
                        : t("common.copyCorrection")
                    }
                    aria-label={
                      evaluationCopyStatus?.target === "corrected" &&
                      evaluationCopyStatus.status === "copied"
                        ? t("common.sentenceCopiedToTheClipboard")
                        : t("common.copyCorrectionToTheClipboard")
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
                      <span aria-hidden="true" style={{ color: "var(--good)" }}>✓</span>
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
                    title={t("common.translateCorrectionInGoogleTranslateEnglishPortuguese")}
                    aria-label={t("common.openCorrectionInGoogleTranslateFromEnglishToPortuguese")}
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
                <h3>{t("common.moreNaturalVersion")}</h3>

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
                    title={t("common.listenToTheMoreNaturalVersionInEnglish")}
                    aria-label={t("common.listenToTheMoreNaturalVersionInEnglish")}
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
                          ? t("common.sentenceCopied")
                          : t("common.couldNotCopyTheSentence")
                        : t("common.copyTheMoreNaturalVersion")
                    }
                    aria-label={
                      evaluationCopyStatus?.target === "better" &&
                      evaluationCopyStatus.status === "copied"
                        ? t("common.sentenceCopiedToTheClipboard")
                        : t("common.copyTheMoreNaturalVersionToTheClipboard")
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
                      <span aria-hidden="true" style={{ color: "var(--good)" }}>✓</span>
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
                    title={t("common.translateTheMoreNaturalVersionInGoogleTranslateEnglishPortuguese")}
                    aria-label={t("common.openTheMoreNaturalVersionInGoogleTranslateFromEnglish")}
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
            background: var(--surface) !important;
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
            background: var(--surface) !important;
            color: var(--text) !important;
            font: 11pt/1.35 Arial, Helvetica, sans-serif !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .basic-training-print-sheet * { box-sizing: border-box; }
          .basic-training-print-sheet h1,
          .basic-training-print-sheet h2,
          .basic-training-print-sheet p { margin: 0; }
          .basic-training-print-sheet .worksheet-top {
            border-bottom: 2px solid var(--accent);
            padding-bottom: 4mm;
            margin-bottom: 5mm;
          }
          .basic-training-print-sheet .worksheet-eyebrow {
            font-size: 9pt;
            letter-spacing: 1px;
            font-weight: 700;
            color: var(--accent);
            margin-bottom: 2mm;
          }
          .basic-training-print-sheet .worksheet-intention {
            font-size: 19pt;
            line-height: 1.2;
            font-weight: 750;
            margin-bottom: 1mm;
          }
          .basic-training-print-sheet .worksheet-english {
            color: var(--accent);
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
            background: var(--surface-soft) !important;
            padding: 3mm 4mm;
            border-radius: 2mm;
          }
          .basic-training-print-sheet .worksheet-example p + p { margin-top: 1.5mm; }
          .basic-training-print-sheet .worksheet-example-pt .intention-highlight {
            color: var(--warning) !important;
            background: var(--warning-soft) !important;
            font-weight: 700;
          }
          .basic-training-print-sheet .worksheet-example-en { color: var(--accent-hover) !important; }
          .basic-training-print-sheet .worksheet-example-en .intention-highlight {
            color: var(--accent-hover) !important;
            background: var(--accent-soft) !important;
            font-weight: 700;
          }
          .basic-training-print-sheet .worksheet-pattern { font-family: monospace; font-size: 10pt; }
          .basic-training-print-sheet .worksheet-writing-title {
            font-size: 11pt;
            font-weight: 700;
            margin-bottom: 2mm;
          }
          .basic-training-print-sheet .worksheet-writing-instruction {
            font-size: 9pt;
            color: var(--muted);
            margin-bottom: 3mm;
          }
          .basic-training-print-sheet .worksheet-writing-line {
            height: 10mm;
            border-bottom: 1px solid var(--border-strong);
            break-inside: avoid;
          }
        }
      `}</style>

      <div className="basic-training-print-sheet" aria-hidden="true">
        <header className="worksheet-top">
          <p className="worksheet-eyebrow">{t("reviewTraining.brazilianEnglishJourneyReview")}</p>
          <h1 className="worksheet-intention">{intention.intention}</h1>
          <p className="worksheet-english">{intention.targetIntention ?? intention.english}</p>
        </header>

        {intention.examples && intention.examples.length > 0 && (
          <section className="worksheet-section">
            <h2 className="worksheet-section-title">{t("common.example")}</h2>
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
            <h2 className="worksheet-section-title">{t("common.usagePattern")}</h2>
            <p className="worksheet-pattern">{intention.pattern}</p>
          </section>
        )}

        <section className="worksheet-writing">
          <h2 className="worksheet-writing-title">{t("common.myWritingPractice")}</h2>
          <p className="worksheet-writing-instruction">
            
            {t("reviewTraining.createSentencesInEnglishUsingTheCommunicativeIntention")}
          </p>
          {Array.from({ length: 10 }, (_, index) => (
            <div className="worksheet-writing-line" key={index} />
          ))}
        </section>
      </div>
    </section>
  );
}
