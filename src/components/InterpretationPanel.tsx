import { t, languageName as localizedLanguageName } from "../i18n";
import { useTranslation } from "react-i18next";
import { isAuthorMode } from "../utils/authorMode";
import { useTrainingStudy, type TrainingStudyReporter } from "../features/study/useTrainingStudy";
import type { StudentLanguage } from "../config/languages";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type FormEvent
} from "react";
import type { MentalIntention } from "../types/hashmap";
import { ConnectedSpeechButton } from "./ConnectedSpeechStudio";
import {
  generateInterpretationStory,
  type StoryGenerationResult
} from "../services/storyGenerationService";
import {
  searchLocalStories,
  getStoryTitle,
  getParagraphText,
  getIntentionText,
  getStoryHqImage,
  isStoryAvailable,
  type LocalStory
} from "../services/localStoryService";

type EnglishLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

interface InterpretationPanelProps {
  language?: StudentLanguage;
  sourceLanguage?: StudentLanguage;
  intentions: MentalIntention[];
  onSelectIntention: (item: MentalIntention) => void;
  onStudyState?: TrainingStudyReporter;
}

const THEMES = [
  "cotidiano",
  "trabalho",
  "viagem",
  "tecnologia",
  "família",
  "amizade",
  "surpresa",
  "decisão"
];

const TOPIC_MAP: Record<string, string> = {
  cotidiano: "daily-life",
  trabalho: "work",
  viagem: "travel",
  tecnologia: "technology",
  família: "family",
  amizade: "friendship",
  surpresa: "surprise",
  decisão: "decision"
};


function renderHighlightedText(
  text: string,
  highlights: string[]
) {
  const ranges = highlights.filter(highlight => highlight.length > 0)
    .map((highlight) => {
      const start = text.indexOf(highlight);

      return start >= 0
        ? {
            start,
            end: start + highlight.length,
            highlight
          }
        : null;
    })
    .filter(
      (
        range
      ): range is {
        start: number;
        end: number;
        highlight: string;
      } => range !== null
    )
    .sort((a, b) => a.start - b.start);

  if (ranges.length === 0) {
    return text;
  }

const parts: ReactNode[] = [];
  let cursor = 0;

  ranges.forEach((range, index) => {
    if (range.start < cursor) {
      return;
    }

    if (range.start > cursor) {
      parts.push(text.slice(cursor, range.start));
    }

    parts.push(
      <strong
        className="intention-highlight"
        key={`${range.start}-${range.end}-${index}`}
      >
        {text.slice(range.start, range.end)}
      </strong>
    );

    cursor = range.end;
  });

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return <>{parts}</>;
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));

    [result[index], result[randomIndex]] = [
      result[randomIndex],
      result[index]
    ];
  }

  return result;
}

export function InterpretationPanel({
  language = "en-US",
  sourceLanguage = "pt-BR",
  intentions,
  onSelectIntention,
  onStudyState
}: InterpretationPanelProps) {
  const { t } = useTranslation();
  const [authorMode, setAuthorMode] = useState(isAuthorMode);
  const aiEnabled = language === "en-US" && import.meta.env.VITE_AI_ENABLED === "true";
  const languageName = localizedLanguageName(language);
  // Keep the image-generation prompt in its original Portuguese language.
  const promptLanguageName = { "pt-BR": "português", "en-US": "inglês", "es-ES": "espanhol", "fr-FR": "francês" }[language];
  const generationController = useRef<AbortController | null>(null);
  const [englishLevel, setEnglishLevel] =
    useState<EnglishLevel>("B1");
  const [amount, setAmount] = useState(5);
  const [theme, setTheme] = useState("cotidiano");
  const [storedStory, setStory] =
    useState<StoryGenerationResult | null>(null);
  const story = useMemo(() => {
    if (!storedStory || !isStoryAvailable(storedStory, language) || !isStoryAvailable(storedStory, sourceLanguage)) return null;
    return {
      ...storedStory,
      title: getStoryTitle(storedStory, language),
      sourceTitle: getStoryTitle(storedStory, sourceLanguage),
      paragraphs: storedStory.paragraphs.map(paragraph => {
        const text = getParagraphText(paragraph, language);
        const sourceText = getParagraphText(paragraph, sourceLanguage);
        return {
          ...paragraph,
          text,
          sourceText,
          sourceIntentions: paragraph.intentions.map(intention => getIntentionText(intention, sourceLanguage)),
          intentions: paragraph.intentions.map(intention => {
            const targetIntent = getIntentionText(intention, language);
            return { ...intention, targetIntent: text.includes(targetIntent) ? targetIntent : "" };
          }),
        };
      }),
    };
  }, [storedStory, language, sourceLanguage]);
  // HQ always follows the origin language (Source); no cross-language fallback.
  const hqImage = story?.source === "local" ? getStoryHqImage(story, sourceLanguage) : undefined;
  const [languageNotice, setLanguageNotice] = useState<string | null>(null);
  const previousLanguage = useRef(language);
  const speechRevision = useRef(0);
  const [selectedIntentions, setSelectedIntentions] = useState<
    MentalIntention[]
  >([]);
  const [showTarget, setShowTarget] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { recordActivity, studyPaused: _studyPaused, toggleStudyPause: _toggleStudyPause, ...studyEvents } =
    useTrainingStudy(`${language}:${sourceLanguage}:${story?.id ?? "library"}`, !!story && !generating, generating, false, onStudyState);
  const studyContent = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!story || generating) return;
    // Page/ancestor scrolling does not bubble through the article's React handlers.
    const onScroll = (event: Event) => {
      const content = studyContent.current;
      if (!event.isTrusted || !content || !(event.target instanceof Node) || !event.target.contains(content)) return;
      const bounds = content.getBoundingClientRect();
      if (bounds.bottom > 0 && bounds.top < window.innerHeight) recordActivity();
    };
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", onScroll, { capture: true });
  }, [story, language, sourceLanguage, generating]);
  const [error, setError] = useState<string | null>(null);
  const [exportJson, setExportJson] = useState<string | null>(null);
  const [exportFileName, setExportFileName] = useState<string>("");
  const [copyFeedback, setCopyFeedback] = useState("Copiar JSON");
  const [hqCopyFeedback, setHqCopyFeedback] = useState<"idle" | "copied" | "error">("idle");
  const [storyCopyFeedback, setStoryCopyFeedback] = useState<"idle" | "copied" | "error">("idle");
  const [copiedParagraphIndex, setCopiedParagraphIndex] = useState<number | null>(null);
  const [copyParagraphErrorIndex, setCopyParagraphErrorIndex] = useState<number | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [speakingParagraphIndex, setSpeakingParagraphIndex] =
    useState<number | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLevel, setSearchLevel] =
    useState<EnglishLevel>("B1");
  const [searchTitle, setSearchTitle] = useState("");
  const [showHqImage, setShowHqImage] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [hqZoom, setHqZoom] = useState(1);
  const hqViewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (previousLanguage.current === language) return;
    previousLanguage.current = language;
    cancelGeneration();
    cancelSpeech();
    setSpeaking(false);
    setSpeakingParagraphIndex(null);
    setSpeechError(null);
    setShowHqImage(false);
    setShareError(null);
    setExportJson(null);
    setSelectedIntentions([]);
    setError(null);
    setStoryCopyFeedback("idle");
    setHqCopyFeedback("idle");
    setCopiedParagraphIndex(null);
    setCopyParagraphErrorIndex(null);
    if (storedStory && (!isStoryAvailable(storedStory, language) || !isStoryAvailable(storedStory, sourceLanguage))) {
      setStory(null);
      setLanguageNotice(t("stories.thisStoryIsNotAvailableInTargetlanguageYetChooseAnother", { targetLanguage: (languageName) }));
    } else {
      setLanguageNotice(null);
    }
  }, [language, sourceLanguage, storedStory, languageName]);

  useEffect(() => {
    if (!storedStory) return;
    storedStory.paragraphs.forEach((paragraph, index) => {
      const text = getParagraphText(paragraph, language);
      for (const intention of paragraph.intentions) {
        const excerpt = getIntentionText(intention, language);
        if (excerpt && text && !text.includes(excerpt)) {
          console.warn(`[InterpretationPanel] Destaque incompatível: ${getStoryTitle(storedStory, language)}, parágrafo ${index + 1}, ${language}.`);
        }
      }
    });
  }, [storedStory, language]);

  function cancelSpeech() {
    speechRevision.current++;
    window.speechSynthesis?.cancel();
  }

  function cancelGeneration() {
    generationController.current?.abort();
    generationController.current = null;
    setGenerating(false);
  }

  useEffect(() => {
    const refreshAuthorMode = () => {
      const active = isAuthorMode();
      setAuthorMode(active);
      if (!active) {
        cancelGeneration();
        setExportJson(null);
        setError(null);
      }
    };
    // storage covers other tabs; polling also observes the existing console/
    // localStorage activation mechanism in this tab without changing it.
    const timer = window.setInterval(refreshAuthorMode, 500);
    window.addEventListener("storage", refreshAuthorMode);
    window.addEventListener("focus", refreshAuthorMode);
    document.addEventListener("visibilitychange", refreshAuthorMode);
    return () => {
      generationController.current?.abort();
      generationController.current = null;
      window.clearInterval(timer);
      window.removeEventListener("storage", refreshAuthorMode);
      window.removeEventListener("focus", refreshAuthorMode);
      document.removeEventListener("visibilitychange", refreshAuthorMode);
    };
  }, []);

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        cancelSpeech();
      }
    };
  }, []);

  useEffect(() => {
    if (!showHqImage) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowHqImage(false);
        setShareError(null);
        setHqZoom(1);
        return;
      }

      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setHqZoom((current) => Math.min(3, current + 0.25));
        return;
      }

      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        setHqZoom((current) => Math.max(0.5, current - 0.25));
        return;
      }

      if (event.key === "0") {
        event.preventDefault();
        setHqZoom(1);
      }
    }

    function handleWheel(event: WheelEvent) {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      event.preventDefault();

      setHqZoom((current) => {
        const nextZoom =
          event.deltaY < 0
            ? current + 0.25
            : current - 0.25;

        return Math.min(3, Math.max(0.5, nextZoom));
      });
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("wheel", handleWheel);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [showHqImage]);

  const availableIntentions = useMemo(
    () =>
      intentions.filter(
        (item) => item.englishLevel === englishLevel
      ),
    [intentions, englishLevel]
  );

  const searchResults = useMemo(
    () => searchLocalStories(searchLevel, searchTitle, language).filter(localStory => isStoryAvailable(localStory, sourceLanguage)),
    [searchLevel, searchTitle, language, sourceLanguage]
  );

  useEffect(() => {
    setCopiedParagraphIndex(null);
    setCopyParagraphErrorIndex(null);
  }, [story]);

  const maxAmount = Math.max(1, availableIntentions.length);

  function handleLevelChange(nextLevel: EnglishLevel) {
    if (!isAuthorMode()) return;
    cancelGeneration();
    setEnglishLevel(nextLevel);
    setStory(null);
    setStoryCopyFeedback("idle");
    setShowHqImage(false);
    setSelectedIntentions([]);
    setShowTarget(false);
    setError(null);
    setSpeechError(null);
    setSpeaking(false);
    setSpeakingParagraphIndex(null);

    if ("speechSynthesis" in window) {
      cancelSpeech();
    }

    const levelCount = intentions.filter(
      (item) => item.englishLevel === nextLevel
    ).length;

    setAmount((current) =>
      Math.min(Math.max(current, 1), Math.max(levelCount, 1))
    );
  }

  function handleAmountChange(value: number) {
    if (!isAuthorMode()) return;
    if (Number.isNaN(value)) {
      return;
    }

    setAmount(
      Math.min(
        Math.max(value, 1),
        Math.max(availableIntentions.length, 1)
      )
    );
  }

  function handleStorySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchOpen(true);
  }

  function handleLoadLocalStory(localStory: LocalStory) {
    if (!isStoryAvailable(localStory, language) || !isStoryAvailable(localStory, sourceLanguage)) return;
    setLanguageNotice(null);
    speechRevision.current++;
    cancelGeneration();
    if ("speechSynthesis" in window) {
      cancelSpeech();
    }

    setEnglishLevel(searchLevel);
    setStoryCopyFeedback("idle");
    setStory({
      ...localStory,
      source: "local"
    });
    setShowHqImage(false);
    setSelectedIntentions([]);
    setShowTarget(false);
    setGenerating(false);
    setError(null);
    setSpeechError(null);
    setSpeaking(false);
    setSpeakingParagraphIndex(null);
    setExportJson(null);
    setHqCopyFeedback("idle");
    setSearchOpen(false);
  }

  async function handleGenerateStory() {
    if (!isAuthorMode() || !aiEnabled || generationController.current || language !== "en-US") return;
    if (availableIntentions.length === 0) {
      setError(
        t("stories.noIntentionsAvailableForLevelLevel", { level: (englishLevel) })
      );
      return;
    }

    const pickedIntentions = shuffle(availableIntentions).slice(
      0,
      Math.min(amount, availableIntentions.length)
    );
    const controller = new AbortController();
    generationController.current = controller;

    setGenerating(true);
    setError(null);
    setStory(null);
    setStoryCopyFeedback("idle");
    setShowHqImage(false);
    setShowTarget(false);
    setSelectedIntentions(pickedIntentions);
    setSpeechError(null);
    setSpeaking(false);
    setSpeakingParagraphIndex(null);

    if ("speechSynthesis" in window) {
      cancelSpeech();
    }

    try {
      const result = await generateInterpretationStory({
        intentions: pickedIntentions,
        englishLevel,
        theme
      }, controller.signal);

      if (generationController.current === controller && !controller.signal.aborted && isAuthorMode()) {
        setStory(result);
      }
    } catch (err) {
      if (generationController.current !== controller || controller.signal.aborted || !isAuthorMode()) return;
      setError(
        err instanceof Error
          ? err.message
          : t("stories.couldNotGenerateTheStory")
      );
    } finally {
      if (generationController.current === controller) {
        generationController.current = null;
        setGenerating(false);
      }
    }
  }

  function handleToggleTarget() {
    setShowTarget((current) => {
      const nextValue = !current;

      if (!nextValue && "speechSynthesis" in window) {
        cancelSpeech();
        setSpeaking(false);
        setSpeakingParagraphIndex(null);
        setSpeechError(null);
      }

      return nextValue;
    });
  }

  function handleSpeakStory() {
    if (!story) {
      return;
    }

    const targetText = [
      story.title,
      ...story.paragraphs.map((paragraph) => paragraph.text)
    ]
      .filter(Boolean)
      .join(". ")
      .trim();

    if (!targetText) {
      setSpeechError(t("stories.thereIsNoTextInTargetlanguageToPlay", { targetLanguage: (languageName) }));
      return;
    }

    if (!("speechSynthesis" in window)) {
      setSpeechError(
        t("common.speechPlaybackIsUnavailableInThisBrowser")
      );
      return;
    }

    cancelSpeech();
    setSpeechError(null);
    setSpeakingParagraphIndex(null);

    const revision = speechRevision.current;
    const utterance = new SpeechSynthesisUtterance(targetText);
    const voices = window.speechSynthesis.getVoices();
    const targetVoice = voices.find(
      (voice) => voice.lang.toLowerCase() === language.toLowerCase()
    );

    if (targetVoice) {
      utterance.voice = targetVoice;
    }

    utterance.lang = language;
    utterance.rate = 0.9;
    utterance.pitch = 1;

    utterance.onstart = () => {
      if (revision !== speechRevision.current) return;
      setSpeaking(true);
    };

    utterance.onend = () => {
      if (revision !== speechRevision.current) return;
      setSpeaking(false);
      setSpeakingParagraphIndex(null);
    };

    utterance.onerror = () => {
      if (revision !== speechRevision.current) return;
      setSpeaking(false);
      setSpeakingParagraphIndex(null);
      setSpeechError(t("stories.couldNotPlayTheStoryInTargetlanguage", { targetLanguage: (languageName) }));
    };

    window.speechSynthesis.speak(utterance);
  }

  async function handleCopyParagraph(text: string, index: number) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        try {
          textarea.select();
          if (!document.execCommand("copy")) {
            throw new Error(t("stories.couldNotCopyTheParagraph"));
          }
        } finally {
          textarea.remove();
        }
      }
      setCopyParagraphErrorIndex(null);
      setCopiedParagraphIndex(index);
    } catch (error) {
      console.error("[InterpretationPanel] Erro ao copiar parágrafo:", error);
      setCopiedParagraphIndex(null);
      setCopyParagraphErrorIndex(index);
    }
  }

  function handleSpeakParagraph(text: string, index: number) {
    const targetText = text.trim();

    if (!targetText) {
      setSpeechError(t("stories.thereIsNoTextInTargetlanguageToPlayInThis", { targetLanguage: (languageName) }));
      return;
    }

    if (!("speechSynthesis" in window)) {
      setSpeechError(
        t("common.speechPlaybackIsUnavailableInThisBrowser")
      );
      return;
    }

    cancelSpeech();
    setSpeechError(null);
    setSpeaking(false);
    setSpeakingParagraphIndex(null);

    const revision = speechRevision.current;
    const utterance = new SpeechSynthesisUtterance(targetText);
    const voices = window.speechSynthesis.getVoices();
    const targetVoice = voices.find(
      (voice) => voice.lang.toLowerCase() === language.toLowerCase()
    );

    if (targetVoice) {
      utterance.voice = targetVoice;
    }

    utterance.lang = language;
    utterance.rate = 0.9;
    utterance.pitch = 1;

    utterance.onstart = () => {
      if (revision !== speechRevision.current) return;
      setSpeaking(false);
      setSpeakingParagraphIndex(index);
    };

    utterance.onend = () => {
      if (revision !== speechRevision.current) return;
      setSpeakingParagraphIndex(null);
    };

    utterance.onerror = () => {
      if (revision !== speechRevision.current) return;
      setSpeakingParagraphIndex(null);
      setSpeechError(t("stories.couldNotPlayThisParagraphInTargetlanguage", { targetLanguage: (languageName) }));
    };

    window.speechSynthesis.speak(utterance);
  }

  function handleOpenExportJson() {
    if (!isAuthorMode() || !story || !storedStory || story.source !== "ai") {
      return;
    }

    try {
      const topic = TOPIC_MAP[theme] ?? "daily-life";

      const uuid =
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
              /[xy]/g,
              (character) => {
                const random = Math.floor(Math.random() * 16);
                const value =
                  character === "x"
                    ? random
                    : (random & 0x3) | 0x8;

                return value.toString(16);
              }
            );

      const id =
        `${englishLevel.toLowerCase()}-${topic}-${uuid}`;

      const localStory = {
        id,
        englishLevel,
        topic,
        titlePt: story.titlePt,
        titleEn: storedStory.titleEn,
        paragraphs: storedStory.paragraphs,
        intentionsUsed: story.intentionsUsed
      };

      setExportJson(JSON.stringify(localStory, null, 2));
      setExportFileName(`${id}.json`);
      setCopyFeedback(t("stories.copyJson"));
    } catch (error) {
      console.error(
        "[InterpretationPanel] Erro ao preparar JSON da história:",
        error
      );

      setError(
        t("stories.couldNotPrepareTheStoryJsonForExport")
      );
    }
  }

  async function handleCopyJson() {
    if (!isAuthorMode()) return;
    if (!exportJson) {
      return;
    }

    try {
      if (
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === "function"
      ) {
        await navigator.clipboard.writeText(exportJson);
      } else {
        const textArea = document.createElement("textarea");

        textArea.value = exportJson;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const copied = document.execCommand("copy");
        textArea.remove();

        if (!copied) {
          throw new Error(t("stories.yourBrowserDidNotAllowCopyingTheJson"));
        }
      }

      setCopyFeedback(t("stories.copied"));
    } catch (error) {
      console.error(
        "[InterpretationPanel] Erro ao copiar JSON:",
        error
      );

      setCopyFeedback(t("stories.couldNotCopy"));
    }
  }

  async function handleCopyLocalStoryForHq() {
    if (!isAuthorMode() || !story || story.source !== "local") {
      return;
    }

    const generationPrompt = [
      `Você receberá no objeto story deste JSON uma história bilíngue PT-BR/${language}. Use esse objeto como fonte única e obrigatória.`,
      "",
      "OBJETIVO",
      "Crie uma HQ educacional bilíngue, visualmente profissional, baseada exatamente na história fornecida. O resultado final deve ser uma imagem PNG única, vertical, contendo todas as cenas na ordem original.",
      "",
      "REGRAS DE CONTEÚDO",
      "1. Não reescreva, resuma, corrija, traduza novamente nem invente trechos. Preserve literalmente titlePt, title e todos os textos pt/text.",
      "2. Cada item de paragraphs corresponde a uma cena/quadro da HQ e deve aparecer exatamente na mesma ordem.",
      "3. Mantenha personagens, idade aparente, roupas, características físicas, cenários e objetos visualmente consistentes entre todas as cenas.",
      "4. Represente com clareza a ação, emoção e contexto de cada parágrafo, sem adicionar acontecimentos que contradigam a história.",
      "",
      "DIREÇÃO VISUAL",
      "5. Crie uma HQ moderna, limpa, cinematográfica, semi-realista, expressiva e apropriada para material educacional.",
      "6. Use uma composição vertical em alta resolução, com todos os quadros organizados de forma clara, equilibrada e fácil de acompanhar.",
      "7. Use enquadramentos variados, boa narrativa visual, expressões faciais naturais e continuidade visual entre as cenas. Evite aparência de banco de imagens.",
      "8. Cada quadro deve ter espaço suficiente para a ilustração e para os textos bilíngues sem comprometer a legibilidade.",
      "",
      "TEXTOS NA HQ",
      `9. Inclua em cada cena o texto PT-BR EXATO e, logo abaixo, o texto ${language} EXATO fornecidos no JSON.`,
      "10. Não altere nenhuma palavra. Preserve acentos, pontuação, apóstrofos, contrações e capitalização exatamente como recebidos.",
      `11. Diferencie visualmente PT-BR e ${language}. Mantenha o português em cor neutra/escura e destaque o ${promptLanguageName} em azul.`,
      "12. Use tipografia grande, limpa e altamente legível. Não deixe texto cortado, sobreposto, deformado ou fora dos quadros.",
      "13. Inclua titlePt e title no topo da HQ e informe discretamente o nível CEFR.",
      "",
      "QUALIDADE E VALIDAÇÃO",
      "14. A imagem final deve conter todas as cenas. Não omita, combine ou reordene cenas.",
      `15. Antes de finalizar, confira cena por cena se o texto PT-BR e ${language} está completo e corresponde literalmente ao JSON.`,
      "16. Se a quantidade de cenas exigir mais espaço, aumente a altura/composição da imagem em vez de reduzir o texto a um tamanho ilegível.",
      "17. Não inclua marcas d'água, logotipos de terceiros, explicações extras, exercícios ou conteúdo que não esteja na história.",
      "",
      "ENTREGÁVEL",
      "18. Gere e entregue a HQ final exclusivamente como uma única imagem PNG vertical em alta resolução. Não gere PDF nem qualquer outro formato de documento.",
      "19. O nome do arquivo PNG final é obrigatório e deve ser exatamente o valor de story.id acrescido da extensão .png: <story.id>.png.",
      "20. Use story.id como única fonte de verdade para o nome do arquivo. Ignore suggestedBaseName ou qualquer outro campo para definir o nome do arquivo.",
      "21. Não adicione ao nome do arquivo sufixos ou prefixos como -hq, -comic, -final, datas, horários, UUIDs adicionais ou qualquer outro texto.",
      "22. Antes de entregar, valide que o nome do arquivo corresponde exatamente a `${story.id}.png`.",
      "23. Execute a geração da imagem nesta conversa. Não responda apenas com roteiro, instruções, descrição da HQ ou um novo prompt."
    ].join("\n");

    const payload = {
      task: "generate_bilingual_comic_image",
      source: "Mental Hashmap - Brazilian English Journey",
      story: {
        id: story.id,
        englishLevel,
        titlePt: story.titlePt,
        title: story.title,
        language,
        paragraphs: story.paragraphs.map((paragraph, index) => ({
          scene: index + 1,
          pt: paragraph.pt,
          text: paragraph.text
        }))
      },
      output: {
        comicStyle: "modern educational comic, cinematic, semi-realistic",
        imageFormat: "PNG",
        documentFormat: null,
        layout: "single vertical comic image",
        fileName: `${story.id}.png`,
        fileNameSource: "story.id",
        fileNameRule: "The final PNG filename must be exactly <story.id>.png. Do not add prefixes, suffixes, timestamps or extra identifiers."
      },
      prompt: generationPrompt
    };

    const json = JSON.stringify(payload, null, 2);

    try {
      if (
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === "function"
      ) {
        await navigator.clipboard.writeText(json);
      } else {
        const textArea = document.createElement("textarea");

        textArea.value = json;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const copied = document.execCommand("copy");
        textArea.remove();

        if (!copied) {
          throw new Error(t("stories.yourBrowserDidNotAllowCopyingTheComicJson"));
        }
      }

      setHqCopyFeedback("copied");
    } catch (error) {
      console.error(
        "[InterpretationPanel] Erro ao copiar história para geração de HQ:",
        error
      );

      setHqCopyFeedback("error");
    }
  }

  function handleScrollHqVertical(direction: "up" | "down") {
    const viewport = hqViewportRef.current;

    if (!viewport) {
      return;
    }

    const distance = Math.max(180, viewport.clientHeight * 0.55);

    viewport.scrollBy({
      top: direction === "down" ? distance : -distance,
      behavior: "smooth"
    });
  }

  async function handleShareHq() {
    if (!hqImage) {
      return;
    }

    setShareError(null);

    if (!navigator.share) {
      setShareError(t("common.sharingIsUnavailableInThisBrowser"));
      return;
    }

    try {
      const absoluteImageUrl = new URL(hqImage, window.location.href).href;
      const response = await fetch(absoluteImageUrl);

      if (!response.ok) {
        throw new Error(t("common.couldNotLoadTheComicImage"));
      }

      const blob = await response.blob();
      const extension =
        blob.type === "image/jpeg"
          ? "jpg"
          : blob.type === "image/webp"
            ? "webp"
            : "png";

      const safeName = story?.id
        ? story.id.replace(/[^a-zA-Z0-9-_]/g, "-")
        : "mental-hashmap-story-hq";

      const file = new File(
        [blob],
        `${safeName}.${extension}`,
        { type: blob.type || "image/png" }
      );

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: t("stories.comicTitle", { title: (story?.titlePt ?? "Mental Hashmap") }),
          text: story?.title
            ? `${story.titlePt} — ${story.title}`
            : story?.titlePt ?? "Mental Hashmap",
          files: [file]
        });
        return;
      }

      await navigator.share({
        title: t("stories.comicTitle", { title: (story?.titlePt ?? "Mental Hashmap") }),
        text: story?.title
          ? `${story.titlePt} — ${story.title}`
          : story?.titlePt ?? "Mental Hashmap",
        url: absoluteImageUrl
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setShareError(t("common.couldNotShareTheComicOnThisDevice"));
    }
  }

  function handlePrintHq() {
    if (!hqImage) {
      return;
    }

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      return;
    }

    const absoluteImageUrl = new URL(hqImage, window.location.href).href;

    printWindow.document.title = `HQ - ${story?.titlePt ?? "Mental Hashmap"}`;
    printWindow.document.documentElement.style.margin = "0";
    printWindow.document.body.style.margin = "0";
    printWindow.document.body.style.display = "flex";
    printWindow.document.body.style.alignItems = "center";
    printWindow.document.body.style.justifyContent = "center";

    const style = printWindow.document.createElement("style");
    style.textContent = `
      @page {
        size: A4 portrait;
        margin: 0;
      }

      html,
      body {
        margin: 0 !important;
        padding: 0 !important;
        width: 210mm !important;
        height: 297mm !important;
        min-width: 210mm !important;
        min-height: 297mm !important;
        max-width: 210mm !important;
        max-height: 297mm !important;
        overflow: hidden !important;
        background: var(--surface) !important;
      }

      body {
        display: block !important;
      }

      img {
        position: fixed !important;
        top: 8mm !important;
        left: 8mm !important;
        width: 194mm !important;
        height: 281mm !important;
        max-width: 194mm !important;
        max-height: 281mm !important;
        object-fit: contain !important;
        object-position: center center !important;
        margin: 0 !important;
        padding: 0 !important;
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
    `;
    printWindow.document.head.appendChild(style);

    const image = printWindow.document.createElement("img");
    image.src = absoluteImageUrl;
    image.alt = `HQ da história: ${story?.titlePt ?? ""}`;

    image.onload = () => {
      printWindow.focus();
      printWindow.print();
    };

    image.onerror = () => {
      printWindow.close();
    };

    printWindow.addEventListener(
      "afterprint",
      () => {
        printWindow.close();
      },
      { once: true }
    );

    printWindow.document.body.appendChild(image);
  }

  async function handleCopyStoryPlainText() {
    if (!story) return;

    const crlf = "\r\n";
    const paragraphs = story.paragraphs;

    const bilingual = [
      story.titlePt,
      story.title,
      "",
      ...paragraphs.flatMap((paragraph) => [paragraph.pt, paragraph.text, ""])
    ].join(crlf).trim();

    const portuguese = [
      story.titlePt,
      "",
      ...paragraphs.map((paragraph) => paragraph.pt)
    ].join(crlf).trim();

    const target = [
      story.title,
      "",
      ...paragraphs.map((paragraph) => paragraph.text)
    ].join(crlf).trim();

    const plainText = [
      `PT-BR + ${language}`,
      bilingual,
      t("stories.fullStoryPtBr"),
      portuguese,
      t("stories.fullStoryLanguage", { language: (language) }),
      target
    ].join(crlf + crlf);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(plainText);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = plainText;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const copied = document.execCommand("copy");
        textArea.remove();
        if (!copied) throw new Error(t("stories.couldNotCopyTheStory"));
      }
      setStoryCopyFeedback("copied");
    } catch (error) {
      console.error("[InterpretationPanel] Erro ao copiar história:", error);
      setStoryCopyFeedback("error");
    }
  }

  function handlePrintStory() {
    if (!story) {
      return;
    }

    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&var(--accent-hover);");

    const exerciseParagraphs = story.paragraphs
      .map(
        (paragraph, index) => `
          <section class="exercise-paragraph">
            <p><strong>${index + 1}.</strong> ${escapeHtml(paragraph.pt)}</p>
            <div class="answer-line"></div>
            <div class="answer-line"></div>
          </section>
        `
      )
      .join("");

    const solutionParagraphs = story.paragraphs
      .map(
        (paragraph, index) => `
          <section class="solution-paragraph">
            <p class="pt"><strong>${index + 1}.</strong> ${escapeHtml(paragraph.pt)}</p>
            <p class="en">${escapeHtml(paragraph.text)}</p>
          </section>
        `
      )
      .join("");

    const printWindow = window.open("", "_blank", "width=900,height=700");

    if (!printWindow) {
      setError(
        t("stories.yourBrowserBlockedThePrintWindowAllowPopUpsTo")
      );
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(story.titlePt)} - Mental Hashmap</title>
          <style>
            @page {
              size: A4;
              margin: 14mm 16mm;
            }

            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              color: var(--text);
              background: var(--surface);
              font-family: Arial, Helvetica, sans-serif;
              font-size: 11pt;
              line-height: 1.42;
            }

            .page {
              width: 100%;
            }

            .exercise-page {
              break-after: page;
              page-break-after: always;
            }

            .header {
              border-bottom: 1px solid var(--border-strong);
              margin-bottom: 14px;
              padding-bottom: 9px;
            }

            .brand {
              margin: 0 0 4px;
              font-size: 9pt;
              font-weight: 700;
              letter-spacing: 0.08em;
              text-transform: uppercase;
              color: var(--muted);
            }

            h1 {
              margin: 0 0 5px;
              font-size: 18pt;
              line-height: 1.2;
            }

            .meta {
              margin: 0;
              color: var(--muted);
              font-size: 9.5pt;
            }

            .instructions {
              margin: 0 0 12px;
              padding: 8px 10px;
              border: 1px solid var(--border);
              border-radius: 7px;
              background: var(--surface-raised);
              font-size: 9.5pt;
            }

            .exercise-paragraph {
              break-inside: avoid;
              page-break-inside: avoid;
              margin: 0 0 10px;
            }

            .exercise-paragraph p,
            .solution-paragraph p {
              margin: 0 0 5px;
            }

            .answer-line {
              height: 34px;
              border-bottom: 1px solid var(--text-secondary);
            }

            .solution-paragraph {
              break-inside: avoid;
              page-break-inside: avoid;
              margin: 0 0 10px;
              padding-bottom: 8px;
              border-bottom: 1px solid var(--border);
            }

            .solution-paragraph .pt {
              font-weight: 600;
            }

            .solution-paragraph .en {
              margin-left: 18px;
              color: var(--text-secondary);
            }

            .solution-label {
              margin: 0 0 10px;
              font-size: 9.5pt;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.06em;
              color: var(--muted);
            }

            @media print {
              body {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <main>
            <section class="page exercise-page">
              <header class="header">
                <p class="brand">Brazilian English Journey · Mental Hashmap</p>
                <h1>${escapeHtml(story.titlePt)}</h1>
                <p class="meta">Nível ${escapeHtml(englishLevel)} · Exercício de interpretação</p>
              </header>

              <p class="instructions">
                Leia a história em português e escreva sua interpretação em ${escapeHtml(languageName)}
                nos espaços abaixo. A solução está na página 2.
              </p>

              ${exerciseParagraphs}
            </section>

            <section class="page solution-page">
              <header class="header">
                <p class="brand">Brazilian English Journey · Mental Hashmap</p>
                <h1>${escapeHtml(story.titlePt)}</h1>
                <p class="meta">${escapeHtml(story.title)}</p>
              </header>

              <p class="solution-label">Solução · PT-BR + ${escapeHtml(language)}</p>

              ${solutionParagraphs}
            </section>
          </main>

          <script>
            window.addEventListener("load", function () {
              window.focus();
              window.print();
            });
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  }

  function handleDownloadJson() {
    if (!isAuthorMode()) return;
    if (!exportJson || !exportFileName) {
      return;
    }

    const blob = new Blob([exportJson], {
      type: "application/json;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = exportFileName;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  return (
    <section className="interpretation-panel">
      <div className="interpretation-header">
        <div>
          <p className="eyebrow">{t("common.interpretation")}</p>
          <h1>{t("stories.storyFromIntentions")}</h1>

          <p className="interpretation-description">
            {authorMode && aiEnabled
              ? t("stories.chooseALevelTheNumberOfIntentionsAndATopic")
              : t("stories.searchLibraryStoriesByLevelAndTitleReadAndInterpret", { targetLanguage: (languageName) })}
          </p>
        </div>

        {authorMode && aiEnabled && <div className="interpretation-total">
          <strong>{availableIntentions.length}</strong>
          <span>
            {t("stories.availableIntentions", { count: availableIntentions.length, level: englishLevel })}
          </span>
        </div>}
      </div>

      {authorMode && aiEnabled && <div className="interpretation-controls">
        <div className="field">
          <label htmlFor="interpretation-level">
            
            {t("common.englishLevel")}
          </label>

          <select
            id="interpretation-level"
            value={englishLevel}
            onChange={(event) =>
              handleLevelChange(
                event.target.value as EnglishLevel
              )
            }
          >
            <option value="A1">A1</option>
            <option value="A2">A2</option>
            <option value="B1">B1</option>
            <option value="B2">B2</option>
            <option value="C1">C1</option>
            <option value="C2">C2</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="interpretation-amount">
            
            {t("stories.howManyIntentionsShouldBeUsed")}
          </label>

          <input
            id="interpretation-amount"
            type="number"
            min={1}
            max={maxAmount}
            value={amount}
            onChange={(event) =>
              handleAmountChange(Number(event.target.value))
            }
          />
        </div>

        <div className="field">
          <label htmlFor="interpretation-theme">{t("stories.topic")}</label>

          <select
            id="interpretation-theme"
            value={theme}
            onChange={(event) => {
              if (!isAuthorMode()) return;
              cancelGeneration();
              setTheme(event.target.value);
              setStory(null);
              setStoryCopyFeedback("idle");
              setShowHqImage(false);
              setShowTarget(false);
              setError(null);
              setSpeechError(null);
              setSpeaking(false);
              setSpeakingParagraphIndex(null);

              if ("speechSynthesis" in window) {
                cancelSpeech();
              }
            }}
          >
            {THEMES.map((themeOption) => (
              <option
                key={themeOption}
                value={themeOption}
              >
                {themeOption}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "0.75rem",
            flexWrap: "wrap"
          }}
        >
          <button
            type="button"
            className="primary-button"
            onClick={handleGenerateStory}
            disabled={
              generating || availableIntentions.length === 0
            }
          >
            {generating
              ? t("stories.generatingStory")
              : t("stories.generateStory")}
          </button>
        </div>
      </div>}

      <form className="story-search-bar" role="search" aria-label={t("stories.searchLibraryStories")} onSubmit={handleStorySearch}>
        <div className="field">
          <label htmlFor="story-search-level">{t("common.level")}</label>

          <select
            id="story-search-level"
            value={searchLevel}
            onChange={(event) =>
              setSearchLevel(event.target.value as EnglishLevel)
            }
          >
            <option value="A1">A1</option>
            <option value="A2">A2</option>
            <option value="B1">B1</option>
            <option value="B2">B2</option>
            <option value="C1">C1</option>
            <option value="C2">C2</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="story-search-title">{t("stories.storyTitle")}</label>

          <input
            id="story-search-title"
            type="search"
            value={searchTitle}
            onChange={(event) => setSearchTitle(event.target.value)}
            placeholder={t("stories.typePartOfTheTitleInPortugueseOrTargetlanguage", { targetLanguage: (languageName) })}
            autoComplete="off"
          />
        </div>
        <button type="submit" className="secondary-button" aria-label={t("common.searchStories")} title={t("common.searchStories")} aria-expanded={searchOpen}>
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
        </button>
      </form>

      {searchOpen && (
        <div
          className="status-card"
          style={{
            marginTop: "1rem",
            textAlign: "left"
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "1rem",
              marginBottom: "1rem"
            }}
          >
            <div>
              <p className="eyebrow">{t("stories.localLibrary")}</p>
              <h2 style={{ margin: 0 }}>{t("stories.searchForAStory")}</h2>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={() => setSearchOpen(false)}
            >
              
              {t("common.close")}
            </button>
          </div>

          <div style={{ marginTop: "1.25rem" }}>
            <p
              style={{
                margin: "0 0 0.75rem",
                fontWeight: 700
              }}
            >
              {t("stories.searchResults", { count: searchResults.length })}
            </p>

            {searchResults.length === 0 ? (
              <p style={{ margin: 0 }}>
                {searchTitle.trim()
                  ? t("stories.noTitleResults", { targetLanguage: languageName, level: searchLevel, title: searchTitle.trim() })
                  : t("stories.noSearchResults", { targetLanguage: languageName, level: searchLevel })}
              </p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: "0.65rem"
                }}
              >
                {searchResults.map((localStory, index) => (
                  <div
                    key={
                      localStory.id ??
                      `${localStory.titlePt}-${getStoryTitle(localStory, language)}-${index}`
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "1rem",
                      padding: "0.8rem 0.9rem",
                      border: "1px solid rgba(148, 163, 184, 0.35)",
                      borderRadius: "12px"
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <strong lang={sourceLanguage}>{getStoryTitle(localStory, sourceLanguage)}</strong>
                      <p
                        className="english"
                        lang={language}
                        style={{
                          margin: "0.2rem 0 0"
                        }}
                      >
                        {getStoryTitle(localStory, language)}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => handleLoadLocalStory(localStory)}
                      style={{ flexShrink: 0 }}
                    >
                      
                      {t("stories.load")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {languageNotice && <p role="status">{languageNotice}</p>}

      {authorMode && error && (
        <div className="status-card error-card">
          <h2>{t("stories.couldNotGenerateTheStory")}</h2>
          <p>{error}</p>
        </div>
      )}

      {authorMode && generating && (
        <div className="status-card">
          <div className="spinner" />
          <p>
            
            {t("stories.creatingAStoryWithYourIntentions")}
          </p>
        </div>
      )}

      {authorMode && !generating &&
        !error &&
        selectedIntentions.length > 0 && (
          <div className="interpretation-intentions">
            <p className="eyebrow">
              
              {t("stories.selectedIntentions")}
            </p>

            <div className="interpretation-intention-list">
              {selectedIntentions.map((item) => (
                <span
                  className="pill"
                  key={item.id}
                >
                  {item.intention}
                </span>
              ))}
            </div>
          </div>
        )}

      {!generating && story && (
        <article ref={studyContent} className="interpretation-story" {...studyEvents}>
          <div className="interpretation-story-header">
            <div>
              <p className="eyebrow">{t("stories.story")}</p>
              <h2 lang={language}>{story.title}</h2>

              <p lang={sourceLanguage} className="interpretation-title-en">{story.sourceTitle}</p>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "0.75rem",
                flexWrap: "wrap"
              }}
            >
              <button
                type="button"
                className="secondary-button"
                style={{
                  borderRadius: "999px",
                  minWidth: "3.5rem",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
                title={t("stories.printExerciseAndSolution")}
                aria-label={t("stories.printExerciseAndSolution")}
                onClick={handlePrintStory}
              >
                <svg
                  aria-hidden="true"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 9V2h12v7" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={() => void handleCopyStoryPlainText()}
                title={storyCopyFeedback === "copied" ? t("stories.storyCopied") : storyCopyFeedback === "error" ? t("stories.failedToCopyStory") : t("stories.copyFullStoryAsPlainText")}
                aria-label={storyCopyFeedback === "copied" ? t("stories.storyCopied") : t("stories.copyFullStoryAsPlainText")}
                style={{
                  borderRadius: "999px",
                  width: "3.5rem",
                  minWidth: "3.5rem",
                  height: "3rem",
                  minHeight: "3rem",
                  padding: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                {storyCopyFeedback === "copied" ? (
                  <span aria-hidden="true" style={{ fontSize: "1.25rem", fontWeight: 700 }}>✓</span>
                ) : storyCopyFeedback === "error" ? (
                  <span aria-hidden="true" style={{ fontSize: "1.25rem", fontWeight: 700 }}>!</span>
                ) : (
                  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>

              {authorMode && <ConnectedSpeechButton key={language}
                title={t("stories.storyTitleHistoriaTitle", { title: (story.title) })}
                blocks={story.paragraphs.map((paragraph) => ({ original: paragraph.text, portuguese: paragraph.pt }))}
                compact
              />}

              {authorMode && story.source === "local" && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleCopyLocalStoryForHq}
                  title={t("stories.copyStoryAndPromptToGenerateAComic")}
                  aria-label={t("stories.copyStoryAndPromptToGenerateAComic")}
                  style={{
                    minWidth: "3.5rem",
                    height: "3rem",
                    minHeight: "3rem",
                    padding: "0 0.7rem",
                    borderRadius: "999px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    whiteSpace: "nowrap"
                  }}
                >
                  {hqCopyFeedback === "copied"
                    ? "✓ " + t("stories.copied")
                    : hqCopyFeedback === "error"
                      ? t("common.copyError")
                      : "📋 " + t("common.comic")}
                </button>
              )}

              {story.source === "local" &&
                Boolean(hqImage) && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setShareError(null);
                      setHqZoom(1);
                      setShowHqImage(true);
                    }}
                    title={t("stories.viewStoryComic")}
                    aria-label={t("stories.viewStoryComic")}
                    style={{
                      width: "3.5rem",
                      minWidth: "3.5rem",
                      height: "3rem",
                      minHeight: "3rem",
                      padding: 0,
                      borderRadius: "999px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}
                  >
                    <span aria-hidden="true">📷</span>
                  </button>
                )}

              {authorMode && story.source === "ai" && (
                <button
                  type="button"
                  className="secondary-button"
                  style={{
                    borderRadius: "999px",
                    minWidth: "3.5rem"
                  }}
                  title={t("stories.exportAiGeneratedStory")}
                  onClick={handleOpenExportJson}
                >
                  {"{...}"}
                </button>
              )}

              {showTarget && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleSpeakStory}
                  disabled={speaking}
                  title={t("stories.listenToTheFullStoryInTargetlanguage", { targetLanguage: (languageName) })}
                >
                  {speaking ? "🔊 " + t("common.playing") : "🔊 " + t("common.listenInTargetlanguage", { targetLanguage: (languageName) })}
                </button>
              )}

              <button
                type="button"
                className={
                  showTarget
                    ? "secondary-button"
                    : "primary-button"
                }
                onClick={handleToggleTarget}
              >
                {showTarget
                  ? t("stories.hideTargetlanguageVersion", { targetLanguage: (languageName) })
                  : t("stories.showTargetlanguageVersion", { targetLanguage: (languageName) })}
              </button>
            </div>
          </div>

          {speechError && (
            <div className="status-card error-card google-translation-error">
              <h2>{t("common.couldNotPlayTheAudio")}</h2>
              <p>{speechError}</p>
            </div>
          )}

          <div className="interpretation-paragraphs">
            {story.paragraphs.map((paragraph, index) => (
              <section
                className="interpretation-paragraph"
                key={`${index}-${paragraph.sourceText}`}
              >
                <p lang={sourceLanguage} className="interpretation-pt">
                  {renderHighlightedText(
                    paragraph.sourceText,
                    paragraph.sourceIntentions
                  )}
                </p>

                {!showTarget && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.4rem" }}>
                    <ConnectedSpeechButton key={language}
                      title={t("stories.titleParagraphNumber", { title: (story.title), number: (index + 1) })}
                      blocks={[{ original: paragraph.text, portuguese: paragraph.pt }]}
                      compact
                    />
                  </div>
                )}

                {showTarget && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "stretch",
                      gap: "0.45rem"
                    }}
                  >
                    <p
                      lang={language}
                      className="english interpretation-en"
                      style={{ width: "100%", marginBottom: 0 }}
                    >
                      {renderHighlightedText(
                        paragraph.text,
                        paragraph.intentions.map(
                          (intention) => intention.targetIntent
                        )
                      )}
                    </p>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: "0.6rem",
                        flexWrap: "wrap",
                        width: "100%"
                      }}
                    >
                      <ConnectedSpeechButton key={language}
                        title={t("stories.titleParagraphNumber", { title: (story.title), number: (index + 1) })}
                        blocks={[{ original: paragraph.text, portuguese: paragraph.pt }]}
                        compact
                      />

                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                          handleSpeakParagraph(paragraph.text, index)
                        }
                        disabled={speakingParagraphIndex === index}
                        title={
                          speakingParagraphIndex === index
                            ? t("stories.playingThisParagraph")
                            : t("stories.listenToThisParagraphInTargetlanguage", { targetLanguage: (languageName) })
                        }
                        aria-label={
                          speakingParagraphIndex === index
                            ? t("stories.playingParagraphNumber", { number: (index + 1) })
                            : t("stories.listenToParagraphNumberInTargetlanguage", { number: (index + 1), targetLanguage: (languageName) })
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
                        <span aria-hidden="true">🔊</span>
                      </button>

                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => void handleCopyParagraph(paragraph.text, index)}
                        title={
                          copiedParagraphIndex === index
                            ? t("stories.paragraphInTargetlanguageCopied", { targetLanguage: (languageName) })
                            : copyParagraphErrorIndex === index
                              ? t("stories.copyFailedTryAgain")
                              : t("stories.copyThisParagraphInTargetlanguage", { targetLanguage: (languageName) })
                        }
                        aria-label={t("stories.copyParagraphNumberInTargetlanguage", { number: (index + 1), targetLanguage: (languageName) })}
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
                        {copiedParagraphIndex === index ? (
                          <span aria-hidden="true" style={{ fontWeight: 700 }}>✓</span>
                        ) : copyParagraphErrorIndex === index ? (
                          <span aria-hidden="true" style={{ fontWeight: 700 }}>!</span>
                        ) : (
                          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" strokeWidth="2"
                            strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2 2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </section>
            ))}
          </div>

          {showHqImage &&
            story.source === "local" &&
            hqImage && (
              <div
                role="dialog"
                aria-modal="true"
                aria-label={t("stories.comicForStoryTitle", { title: (story.titlePt) })}
                onMouseDown={(event) => {
                  event.stopPropagation();
                  setShowHqImage(false);
                  setShareError(null);
                  setHqZoom(1);
                }}
                style={{
                  position: "fixed",
                  inset: 0,
                  width: "100vw",
                  height: "100dvh",
                  zIndex: 10000,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  overflow: "hidden",
                  background: "rgba(0, 0, 0, 0.88)"
                }}
              >
                <div
                  ref={hqViewportRef}
                  onMouseDown={(event) => event.stopPropagation()}
                  onWheel={(event) => {
                    if (
                      event.ctrlKey ||
                      event.metaKey ||
                      event.shiftKey ||
                      hqZoom <= 1
                    ) {
                      return;
                    }

                    event.preventDefault();

                    const multiplier =
                      event.deltaMode === 1
                        ? 24
                        : event.deltaMode === 2
                          ? event.currentTarget.clientHeight
                          : 1;

                    event.currentTarget.scrollBy({
                      top: event.deltaY * multiplier,
                      behavior: "auto"
                    });
                  }}
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: hqZoom > 1 ? "flex-start" : "center",
                    justifyContent: hqZoom > 1 ? "flex-start" : "center",
                    width: "100vw",
                    height: "100dvh",
                    maxWidth: "100vw",
                    maxHeight: "100dvh",
                    boxSizing: "border-box",
                    overflowX: "auto",
                    overflowY: "auto",
                    padding: hqZoom > 1 ? "4rem 1rem 4rem" : 0
                  }}
                >
                  <img
                    src={hqImage}
                    alt={t("stories.comicForStoryTitle", { title: (story.titlePt) })}
                    style={{
                      display: "block",
                      width: "auto",
                      height: "auto",
                      maxWidth: "100%",
                      maxHeight: "calc(100dvh - 1rem)",
                      objectFit: "contain",
                      borderRadius: "12px",
                      transform: `scale(${hqZoom})`,
                      transformOrigin: hqZoom > 1 ? "top left" : "top center",
                      transition: "transform 120ms ease"
                    }}
                  />

                  <button
                    type="button"
                    onClick={handlePrintHq}
                    aria-label={t("common.printComic")}
                    title={t("common.printComic")}
                    style={{
                      position: "fixed",
                      top: "max(0.75rem, env(safe-area-inset-top))",
                      left: "max(0.75rem, env(safe-area-inset-left))",
                      zIndex: 10001,
                      width: "2.75rem",
                      minWidth: "2.75rem",
                      height: "2.75rem",
                      minHeight: "2.75rem",
                      padding: 0,
                      border: "1px solid rgba(255, 255, 255, 0.35)",
                      borderRadius: "999px",
                      background: "rgba(0, 0, 0, 0.68)",
                      color: "#ffffff",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <svg
                      aria-hidden="true"
                      width="21"
                      height="21"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="6 9 6 2 18 2 18 9" />
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                      <rect x="6" y="14" width="12" height="8" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={handleShareHq}
                    aria-label={t("common.shareComic")}
                    title={t("common.shareComic")}
                    style={{
                      position: "fixed",
                      top: "max(0.75rem, env(safe-area-inset-top))",
                      left: "calc(max(0.75rem, env(safe-area-inset-left)) + 3.35rem)",
                      zIndex: 10001,
                      width: "2.75rem",
                      minWidth: "2.75rem",
                      height: "2.75rem",
                      minHeight: "2.75rem",
                      padding: 0,
                      border: "1px solid rgba(255, 255, 255, 0.35)",
                      borderRadius: "999px",
                      background: "rgba(0, 0, 0, 0.68)",
                      color: "#ffffff",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <svg
                      aria-hidden="true"
                      width="21"
                      height="21"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="18" cy="5" r="3" />
                      <circle cx="6" cy="12" r="3" />
                      <circle cx="18" cy="19" r="3" />
                      <line x1="8.59" y1="10.51" x2="15.42" y2="6.49" />
                      <line x1="8.59" y1="13.49" x2="15.42" y2="17.51" />
                    </svg>
                  </button>

                  {shareError && (
                    <div
                      role="status"
                      style={{
                        position: "fixed",
                        top: "calc(max(0.75rem, env(safe-area-inset-top)) + 3.35rem)",
                        left: "max(0.75rem, env(safe-area-inset-left))",
                        zIndex: 10001,
                        maxWidth: "min(22rem, calc(100vw - 1.5rem))",
                        padding: "0.65rem 0.8rem",
                        borderRadius: "10px",
                        background: "rgba(0, 0, 0, 0.82)",
                        color: "#ffffff",
                        fontSize: "0.9rem"
                      }}
                    >
                      {shareError}
                    </div>
                  )}

                  {hqZoom > 1 && (
                    <div
                      role="group"
                      aria-label={t("common.comicVerticalMovementControls")}
                      style={{
                        position: "fixed",
                        right: "max(0.75rem, env(safe-area-inset-right))",
                        top: "50%",
                        transform: "translateY(-50%)",
                        zIndex: 10001,
                        display: "inline-flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "0.35rem",
                        padding: "0.35rem",
                        border: "1px solid rgba(255, 255, 255, 0.35)",
                        borderRadius: "999px",
                        background: "rgba(0, 0, 0, 0.72)",
                        color: "#ffffff"
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleScrollHqVertical("up")}
                        aria-label={t("common.moveComicUp")}
                        title={t("common.moveUp")}
                        style={{
                          width: "2.5rem",
                          height: "2.5rem",
                          padding: 0,
                          border: "1px solid rgba(255, 255, 255, 0.25)",
                          borderRadius: "999px",
                          background: "rgba(255, 255, 255, 0.08)",
                          color: "#ffffff",
                          fontSize: "1.25rem",
                          lineHeight: 1,
                          cursor: "pointer"
                        }}
                      >
                        ↑
                      </button>

                      <button
                        type="button"
                        onClick={() => handleScrollHqVertical("down")}
                        aria-label={t("common.moveComicDown")}
                        title={t("common.moveDown")}
                        style={{
                          width: "2.5rem",
                          height: "2.5rem",
                          padding: 0,
                          border: "1px solid rgba(255, 255, 255, 0.25)",
                          borderRadius: "999px",
                          background: "rgba(255, 255, 255, 0.08)",
                          color: "#ffffff",
                          fontSize: "1.25rem",
                          lineHeight: 1,
                          cursor: "pointer"
                        }}
                      >
                        ↓
                      </button>
                    </div>
                  )}

                  <div
                    role="group"
                    aria-label={t("common.comicZoomControls")}
                    style={{
                      position: "fixed",
                      left: "50%",
                      bottom: "max(0.75rem, env(safe-area-inset-bottom))",
                      transform: "translateX(-50%)",
                      zIndex: 10001,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      padding: "0.35rem",
                      border: "1px solid rgba(255, 255, 255, 0.35)",
                      borderRadius: "999px",
                      background: "rgba(0, 0, 0, 0.72)",
                      color: "#ffffff"
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setHqZoom((current) => Math.max(0.5, current - 0.25))
                      }
                      disabled={hqZoom <= 0.5}
                      aria-label={t("common.zoomComicOut")}
                      title={t("common.zoomOut")}
                      style={{
                        width: "2.5rem",
                        height: "2.5rem",
                        padding: 0,
                        border: "1px solid rgba(255, 255, 255, 0.25)",
                        borderRadius: "999px",
                        background: "rgba(255, 255, 255, 0.08)",
                        color: "#ffffff",
                        fontSize: "1.4rem",
                        cursor: hqZoom <= 0.5 ? "default" : "pointer",
                        opacity: hqZoom <= 0.5 ? 0.45 : 1
                      }}
                    >
                      −
                    </button>

                    <button
                      type="button"
                      onClick={() => setHqZoom(1)}
                      aria-label={t("common.resetComicZoomTo100")}
                      title={t("common.resetZoomTo100")}
                      style={{
                        minWidth: "4.25rem",
                        height: "2.5rem",
                        padding: "0 0.75rem",
                        border: "1px solid rgba(255, 255, 255, 0.25)",
                        borderRadius: "999px",
                        background: "rgba(255, 255, 255, 0.08)",
                        color: "#ffffff",
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      {Math.round(hqZoom * 100)}%
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setHqZoom((current) => Math.min(3, current + 0.25))
                      }
                      disabled={hqZoom >= 3}
                      aria-label={t("common.zoomComicIn")}
                      title={t("common.zoomIn")}
                      style={{
                        width: "2.5rem",
                        height: "2.5rem",
                        padding: 0,
                        border: "1px solid rgba(255, 255, 255, 0.25)",
                        borderRadius: "999px",
                        background: "rgba(255, 255, 255, 0.08)",
                        color: "#ffffff",
                        fontSize: "1.4rem",
                        cursor: hqZoom >= 3 ? "default" : "pointer",
                        opacity: hqZoom >= 3 ? 0.45 : 1
                      }}
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowHqImage(false);
                      setShareError(null);
                      setHqZoom(1);
                    }}
                    aria-label={t("common.closeComic")}
                    title={t("common.close")}
                    style={{
                      position: "fixed",
                      top: "max(0.75rem, env(safe-area-inset-top))",
                      right: "max(0.75rem, env(safe-area-inset-right))",
                      zIndex: 10001,
                      width: "2.75rem",
                      minWidth: "2.75rem",
                      height: "2.75rem",
                      minHeight: "2.75rem",
                      padding: 0,
                      border: "1px solid rgba(255, 255, 255, 0.35)",
                      borderRadius: "999px",
                      background: "rgba(0, 0, 0, 0.68)",
                      color: "#ffffff",
                      fontSize: "1.6rem",
                      lineHeight: 1,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            )}

          {authorMode && exportJson && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label={t("stories.storyJson")}
              onClick={() => setExportJson(null)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "1rem",
                background: "rgba(0, 0, 0, 0.55)"
              }}
            >
              <div
                className="status-card"
                onClick={(event) => event.stopPropagation()}
                style={{
                  width: "min(900px, 95vw)",
                  maxHeight: "90vh",
                  overflow: "auto",
                  textAlign: "left"
                }}
              >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "1rem",
                  marginBottom: "1rem"
                }}
              >
                <div>
                  <p className="eyebrow">{t("stories.storyJson")}</p>
                  <strong>{t("stories.readyToAddToTheLocalLibrary")}</strong>
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setExportJson(null)}
                  title={t("common.close")}
                >
                  
                  {t("common.close")}
                </button>
              </div>

              <pre
                style={{
                  maxHeight: "420px",
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  padding: "1rem",
                  borderRadius: "12px",
                  background: "rgba(0, 0, 0, 0.05)"
                }}
              >
                {exportJson}
              </pre>

              <div
                style={{
                  display: "flex",
                  gap: "0.75rem",
                  flexWrap: "wrap",
                  marginTop: "1rem"
                }}
              >
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleCopyJson}
                >
                  {copyFeedback}
                </button>

                <button
                  type="button"
                  className="primary-button"
                  onClick={handleDownloadJson}
                >
                  
                  {t("stories.downloadJson")}
                </button>
              </div>
              </div>
            </div>
          )}

          {story.source === "local" && (
            <div
              role="status"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.75rem",
                marginTop: "1.5rem",
                padding: "0.9rem 1rem",
                border: "1px solid rgba(202, 138, 4, 0.28)",
                borderRadius: "12px",
                background: "rgba(254, 240, 138, 0.28)",
                color: "inherit"
              }}
            >
              <span aria-hidden="true">🟡</span>

              <div>
                <strong>{t("stories.storyFromTheLocalLibrary")}</strong>
                <p style={{ margin: "0.25rem 0 0" }}>
                  
                  {t("stories.thisStoryWasLoadedFromTheMentalHashmapStoryLibrary")}
                </p>
              </div>
            </div>
          )}

          <div className="interpretation-used">
            <h3>{t("stories.intentionsUsed")}</h3>

            <div className="interpretation-used-list">
              {story.intentionsUsed.map((id) => {
                const intention = intentions.find(
                  (item) => item.id === id
                );

                return intention ? (
                  <button
                    type="button"
                    className="pill interpretation-used-button"
                    key={id}
                    onClick={() => onSelectIntention(intention)}
                    title={t("stories.viewDetailsForIntention", { intention: (intention.intention) })}
                  >
                    {intention.intention}
                  </button>
                ) : (
                  <span
                    className="pill"
                    key={id}
                  >
                    {story.paragraphs.flatMap(paragraph => paragraph.intentions).find(item => item.intentionId === id)?.ptIntent ?? t("stories.intentionUnavailableInThisCatalog")}
                  </span>
                );
              })}
            </div>
          </div>
        </article>
      )}
    </section>
  );
}
