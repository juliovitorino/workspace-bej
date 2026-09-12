import type { MentalIntention } from "../types/hashmap";

export type TrainingEvaluationMode = "basic" | "advanced";

export interface TrainingVocabulary {
  verbs?: string[];
  adjectives?: string[];
  nouns?: string[];
  connectors?: string[];
}

export interface AIEvaluationRequest {
  mode: TrainingEvaluationMode;
  intention: MentalIntention;
  studentText: string;
  vocabulary?: TrainingVocabulary;
}

export interface AIEvaluationResult {
  score: number;
  grammar: "excellent" | "good" | "needs_improvement";
  naturalness: "excellent" | "good" | "needs_improvement";
  intentionUsedCorrectly: boolean;
  vocabularyUsedCorrectly: boolean;
  feedbackPt: string;
  correctedSentence: string;
  betterVersion: string;
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
  )?.trim() || "gemini-3.8-flash";

const GEMINI_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/` +
  `${encodeURIComponent(GEMINI_MODEL)}:generateContent`;

const evaluationSchema = {
  type: "OBJECT",
  properties: {
    score: {
      type: "INTEGER",
      description: "Score from 0 to 10."
    },
    grammar: {
      type: "STRING",
      enum: ["excellent", "good", "needs_improvement"]
    },
    naturalness: {
      type: "STRING",
      enum: ["excellent", "good", "needs_improvement"]
    },
    intentionUsedCorrectly: {
      type: "BOOLEAN"
    },
    vocabularyUsedCorrectly: {
      type: "BOOLEAN"
    },
    feedbackPt: {
      type: "STRING",
      description:
        "Short, constructive feedback in Brazilian Portuguese."
    },
    correctedSentence: {
      type: "STRING",
      description:
        "Corrected version that preserves the student's intended meaning."
    },
    betterVersion: {
      type: "STRING",
      description:
        "A natural American-English version of the student's answer."
    }
  },
  required: [
    "score",
    "grammar",
    "naturalness",
    "intentionUsedCorrectly",
    "vocabularyUsedCorrectly",
    "feedbackPt",
    "correctedSentence",
    "betterVersion"
  ]
};

function formatList(values?: string[]): string {
  if (!values || values.length === 0) {
    return "nenhum item obrigatório";
  }

  return values.join(", ");
}

function buildPrompt(request: AIEvaluationRequest): string {
  const {
    mode,
    intention,
    studentText,
    vocabulary
  } = request;

  const basicInstructions = `
O aluno está fazendo um TREINO BÁSICO.
Avalie se ele conseguiu criar uma frase coerente usando a intenção mental
e, quando possível, os elementos sorteados.
`;

  const advancedInstructions = `
O aluno está fazendo um TREINO AVANÇADO.
A resposta pode conter duas frases independentes e uma versão final unindo
as ideias com um ou mais conectores.
Avalie também se a relação lógica criada pelos conectores faz sentido.
`;

  return `
Você é um avaliador de inglês para um aluno brasileiro de nível intermediário.

Seu objetivo é avaliar a produção do aluno de forma prática, clara,
encorajadora e rigorosa, sem ser excessivamente acadêmico.

${mode === "basic" ? basicInstructions : advancedInstructions}

INTENÇÃO MENTAL:
Português: ${intention.intention}
English: ${intention.english}
Pattern: ${intention.pattern ?? "não informado"}

VOCABULÁRIO SORTEADO:
Verbos: ${formatList(vocabulary?.verbs)}
Adjetivos: ${formatList(vocabulary?.adjectives)}
Nouns: ${formatList(vocabulary?.nouns)}
Conectores: ${formatList(vocabulary?.connectors)}

RESPOSTA DO ALUNO:
${studentText}

CRITÉRIOS:
1. Gramática.
2. Naturalidade em inglês americano.
3. Uso correto da intenção mental.
4. Uso coerente do vocabulário sorteado.
5. No treino avançado, coerência entre as ideias e os conectores.
6. Não penalize o aluno apenas por não usar todos os itens sorteados
   quando a frase continuar natural e cumprir o objetivo comunicativo.
7. Preserve o sentido pretendido pelo aluno ao corrigir.
8. O feedback deve ser curto e em português do Brasil.
9. correctedSentence deve corrigir a resposta com o mínimo de alterações.
10. betterVersion deve mostrar uma forma mais natural de dizer a mesma ideia.

Dê uma nota inteira de 0 a 10.
Responda exclusivamente no formato JSON solicitado.
`.trim();
}

function normalizeResult(
  value: AIEvaluationResult
): AIEvaluationResult {
  return {
    ...value,
    score: Math.max(0, Math.min(10, Math.round(value.score)))
  };
}

export async function evaluateTrainingWithAI(
  request: AIEvaluationRequest
): Promise<AIEvaluationResult> {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "VITE_GEMINI_API_KEY não foi configurada no arquivo .env."
    );
  }

  if (!request.studentText.trim()) {
    throw new Error(
      "Escreva uma frase antes de solicitar a avaliação."
    );
  }

  const response = await fetch(
    GEMINI_ENDPOINT,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: buildPrompt(request)
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: evaluationSchema,
          temperature: 0.2
        }
      })
    }
  );

  const data = (await response.json()) as GeminiResponse;

  if (!response.ok || data.error) {
    throw new Error(
      data.error?.message ||
        `Erro ao acessar a IA (${response.status}).`
    );
  }

  if (data.promptFeedback?.blockReason) {
    throw new Error(
      `A avaliação foi bloqueada pela IA: ` +
        `${data.promptFeedback.blockReason}.`
    );
  }

  const responseText = data.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!responseText) {
    throw new Error(
      "A IA não retornou uma avaliação válida."
    );
  }

  try {
    const parsed = JSON.parse(responseText) as AIEvaluationResult;
    return normalizeResult(parsed);
  } catch {
    throw new Error(
      "A IA retornou uma resposta em formato inesperado."
    );
  }
}
