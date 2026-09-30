export interface GoogleTranslationResult {
  translatedText: string;
  detectedSourceLanguage?: string;
}

export type GoogleTranslateLanguage = "pt" | "en";

interface GoogleTranslateApiResponse {
  data?: {
    translations?: Array<{
      translatedText?: string;
      detectedSourceLanguage?: string;
    }>;
  };
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

const GOOGLE_TRANSLATE_URL =
  "https://translation.googleapis.com/language/translate/v2";

function decodeHtmlEntities(value: string): string {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

async function translateText(
  text: string,
  source: GoogleTranslateLanguage,
  target: GoogleTranslateLanguage
): Promise<GoogleTranslationResult> {
  const normalizedText = text.trim();

  if (!normalizedText) {
    throw new Error("Digite uma frase antes de solicitar a tradução.");
  }

  const apiKey = import.meta.env.VITE_GOOGLE_TRANSLATE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "A variável VITE_GOOGLE_TRANSLATE_API_KEY não foi configurada."
    );
  }

  const response = await fetch(GOOGLE_TRANSLATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      q: normalizedText,
      source,
      target,
      format: "text",
    }),
  });

  const payload = (await response.json()) as GoogleTranslateApiResponse;

  if (!response.ok) {
    const apiMessage =
      payload.error?.message ?? "Não foi possível traduzir com o Google.";

    if (response.status === 429) {
      throw new Error(
        "O limite de traduções do Google foi atingido. Tente novamente mais tarde."
      );
    }

    if (response.status === 403) {
      throw new Error(
        `A chamada ao Google Translate foi recusada. Verifique a API key e suas restrições. ${apiMessage}`
      );
    }

    throw new Error(apiMessage);
  }

  const translation = payload.data?.translations?.[0];

  if (!translation?.translatedText) {
    throw new Error("O Google não retornou uma tradução.");
  }

  return {
    translatedText: decodeHtmlEntities(translation.translatedText),
    detectedSourceLanguage: translation.detectedSourceLanguage,
  };
}

export function translatePortugueseToEnglish(
  text: string
): Promise<GoogleTranslationResult> {
  return translateText(text, "pt", "en");
}

export function translateEnglishToPortuguese(
  text: string
): Promise<GoogleTranslationResult> {
  return translateText(text, "en", "pt");
}
