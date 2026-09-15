import type { MentalIntention } from "../types/hashmap";

export interface StoryParagraph {
  pt: string;
  en: string;
}

export interface StoryGenerationResult {
  titlePt: string;
  titleEn: string;
  paragraphs: StoryParagraph[];
  intentionsUsed: string[];
}

export interface StoryGenerationRequest {
  intentions: MentalIntention[];
  englishLevel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  theme: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

const GEMINI_API_KEY = (
  import.meta.env.VITE_GEMINI_API_KEY as string | undefined
)?.trim();

const GEMINI_MODEL =
  (
    import.meta.env.VITE_GEMINI_MODEL as string | undefined
  )?.trim() || "gemini-3.5-flash";

const GEMINI_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/` +
  `${encodeURIComponent(GEMINI_MODEL)}:generateContent`;

const storySchema = {
  type: "OBJECT",
  properties: {
    titlePt: { type: "STRING" },
    titleEn: { type: "STRING" },
    paragraphs: {
      type: "ARRAY",
      minItems: 6,
      maxItems: 10,
      items: {
        type: "OBJECT",
        properties: {
          pt: { type: "STRING" },
          en: { type: "STRING" }
        },
        required: ["pt", "en"]
      }
    },
    intentionsUsed: {
      type: "ARRAY",
      items: { type: "STRING" }
    }
  },
  required: ["titlePt", "titleEn", "paragraphs", "intentionsUsed"]
};

function buildIntentionsContext(intentions: MentalIntention[]): string {
  return intentions
    .map((item, index) =>
      [
        `${index + 1}. ID: ${item.id}`,
        `Intenção: ${item.intention}`,
        `English: ${item.english}`,
        `Pattern: ${item.pattern ?? "não informado"}`
      ].join("\n")
    )
    .join("\n\n");
}

function buildPrompt(request: StoryGenerationRequest): string {
  const { intentions, englishLevel, theme } = request;

  return `
Você é um gerador de histórias curtas para treino de interpretação de inglês.

OBJETIVO:
Criar uma história curta, natural e coerente em português e inglês,
usando de forma orgânica as intenções linguísticas fornecidas.

NÍVEL DE INGLÊS:
${englishLevel}

TEMA:
${theme || "cotidiano"}

INTENÇÕES QUE DEVEM SER USADAS:
${buildIntentionsContext(intentions)}

REGRAS OBRIGATÓRIAS:
1. Gere entre 6 e 10 parágrafos curtos.
2. Cada parágrafo deve conter uma ideia curta e clara.
3. A história deve ter começo, desenvolvimento e final.
4. Use todas as intenções fornecidas pelo menos uma vez, de forma natural.
5. Não transforme a história em uma lista de estruturas.
6. O vocabulário e a complexidade do inglês devem ser compatíveis com o nível ${englishLevel}.
7. O texto em português deve ser natural em português do Brasil.
8. O texto em inglês deve ser natural em inglês americano.
9. Cada campo "en" deve corresponder diretamente ao campo "pt" do mesmo parágrafo.
10. Não adicione explicações gramaticais, notas, comentários ou markdown.
11. "intentionsUsed" deve conter somente os IDs das intenções realmente usadas.
12. Preserve o sentido entre português e inglês.
13. Evite tradução excessivamente literal quando uma forma natural em inglês for melhor.
14. O título também deve ter versão em português e inglês.
15. Responda exclusivamente no formato JSON solicitado.
`.trim();
}

function validateStory(
  story: StoryGenerationResult,
  requestedIntentions: MentalIntention[]
): StoryGenerationResult {
  if (
    !Array.isArray(story.paragraphs) ||
    story.paragraphs.length < 6 ||
    story.paragraphs.length > 10
  ) {
    throw new Error(
      "A IA retornou uma história fora do limite de 6 a 10 parágrafos."
    );
  }

  const requestedIds = new Set(requestedIntentions.map((item) => item.id));
  const usedIds = new Set(story.intentionsUsed ?? []);

  const missingIntentions = [...requestedIds].filter(
    (id) => !usedIds.has(id)
  );

  if (missingIntentions.length > 0) {
    throw new Error(
      `A IA não utilizou todas as intenções solicitadas: ${missingIntentions.join(", ")}`
    );
  }

  const invalidIntentions = [...usedIds].filter(
    (id) => !requestedIds.has(id)
  );

  if (invalidIntentions.length > 0) {
    throw new Error(
      `A IA retornou IDs de intenções não solicitadas: ${invalidIntentions.join(", ")}`
    );
  }

  for (const paragraph of story.paragraphs) {
    if (!paragraph.pt?.trim() || !paragraph.en?.trim()) {
      throw new Error("A IA retornou um parágrafo incompleto.");
    }
  }

  if (!story.titlePt?.trim() || !story.titleEn?.trim()) {
    throw new Error("A IA retornou uma história sem título completo.");
  }

  return story;
}

export async function generateInterpretationStory(
  request: StoryGenerationRequest
): Promise<StoryGenerationResult> {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "VITE_GEMINI_API_KEY não foi configurada no arquivo .env."
    );
  }

  if (!request.intentions.length) {
    throw new Error(
      "Selecione pelo menos uma intenção para gerar a história."
    );
  }

  const response = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: buildPrompt(request) }]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: storySchema,
        temperature: 0.7
      }
    })
  });

  const data = (await response.json()) as GeminiResponse;

  if (!response.ok || data.error) {
    throw new Error(
      data.error?.message || `Erro ao acessar a IA (${response.status}).`
    );
  }

  if (data.promptFeedback?.blockReason) {
    throw new Error(
      `A geração foi bloqueada pela IA: ${data.promptFeedback.blockReason}.`
    );
  }

  const responseText = data.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!responseText) {
    throw new Error("A IA não retornou uma história válida.");
  }

  try {
    const parsed = JSON.parse(responseText) as StoryGenerationResult;
    return validateStory(parsed, request.intentions);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error(
      "A IA retornou uma resposta em formato inesperado."
    );
  }
}
