import type { AIProvider } from '../../config/aiProvider';

export interface SmallTalkAnalysisPromptInput {
  question: string;
  answer: string;
  fullFrameworkUrl: string;
  simplifiedFrameworkUrl: string;
  provider: AIProvider;
  fullFramework?: unknown;
  simplifiedFramework?: unknown;
}

/** Texto único para ChatGPT e Gemini; somente o Gemini recebe JSONs incorporados. */
export function buildSmallTalkAnalysisPrompt(input: SmallTalkAnalysisPromptInput): string {
  const frameworks = input.provider === 'gemini'
    ? [
        'FULL FRAMEWORK — CONTEÚDO JSON INTEGRAL:', JSON.stringify(input.fullFramework, null, 2), '',
        'SIMPLIFIED FRAMEWORK — CONTEÚDO JSON INTEGRAL:', JSON.stringify(input.simplifiedFramework, null, 2)
      ]
    : [
        'FULL FRAMEWORK (JSON):', input.fullFrameworkUrl, '',
        'SIMPLIFIED FRAMEWORK (JSON):', input.simplifiedFrameworkUrl,
        '',
        'Leia os dois JSONs pelas URLs antes de aplicar suas regras. Se não conseguir acessar algum, declare explicitamente a limitação e solicite o conteúdo, sem inventar regras.'
      ];
  return [
    'Você é professor de inglês americano e revisor pedagógico do Brazilian English Journey (BEJ). Responda em português brasileiro, preservando as frases em inglês americano.',
    'Analise a resposta em relação à pergunta ativa, usando os dois frameworks gramaticais do BEJ como referência, sem tratá-los como gramática normativa universal.',
    '',
    'PERGUNTA ATIVA:', input.question || '(sem pergunta)', '',
    'RESPOSTA CORRENTE:', input.answer || '(sem resposta cadastrada)', '',
    ...frameworks, '',
    'FORMATO OBRIGATÓRIO DA RESPOSTA:',
    '',
    '1. Analysis Board — uma única tabela unificada contendo TODAS as frases da resposta, na ordem original. Cada frase deve ocupar exatamente uma linha, com estas colunas:',
    '• Analysed sentence (texto EXATAMENTE como escrito, sem correções) + logo abaixo Adaptive phonetic mapping (Brazilian-English-friendly) da mesma frase;',
    '• Sentence framework fit percentage (0–100%, estimativa pedagógica, não medição objetiva);',
    '• Framework used: Simplified ou Full + referência à 55th edition quando aplicável. Não atribua a edição 55 a um JSON sem essa identificação; diferencie referência externa de regra efetivamente presente no arquivo;',
    '• Notes: erros reais, questões estilísticas ou confirmação de correção.',
    'REGRA 1: quando o fit for INFERIOR a 90%, explique explicitamente o que está errado e por quê, incluindo a sugestão de correção.',
    'REGRA 2: não divida o Analysis Board em várias tabelas. Inclua TODAS as frases, inclusive as corretas.',
    'REGRA 3: quando encontrar uma palavra em português ENTRE ASPAS dentro de uma frase inglesa, sugira o verbo inglês que melhor se encaixa no contexto, justificando brevemente. Se não for verbo, explique.',
    '',
    '2. Translation to Portuguese + Adaptive Phonetics — para CADA frase, apresente nesta ordem:',
    'Primeira linha: tradução LITERAL para o português (preserve o sentido e a estrutura tanto quanto possível).',
    'Segunda linha: a frase ORIGINAL em inglês, exatamente como escrita.',
    'Terceira linha: 👉 mapeamento fonético adaptativo da frase, sem IPA.',
    'O mapeamento deve representar como o inglês americano soa ao ouvido brasileiro, facilitar pronúncia imediata, preservar ritmo, tonicidade, reduções e connected speech; usar âncoras sonoras familiares ao brasileiro e marcar SÍLABAS TÔNICAS EM MAIÚSCULAS. Não confundir escrita com som. É aproximação pedagógica, não transcrição fonética oficial.',
    'Exemplo ilustrativo: I feel like going for a ride on a motorcycle tomorrow. → 👉 AI FÍU laik GÔIN fâ a RAID ona MÔrorSAIKÔU tuMÓRrou',
    '',
    '3. Native Speaker Perception — para CADA frase:',
    '• Comprehension probability: porcentagem ESTIMADA de compreensão por um falante nativo, explicando brevemente quando houver ambiguidade; não apresente como estatística medida.',
    '• Rating: de 1 a 5 estrelas (⭐), com nota numérica (ex.: ⭐⭐⭐⭐⭐ 5/5).',
    '• Native speaker sentence: como um americano diria essa ideia em conversa real, mantendo o sentido, sem inventar fatos pessoais.',
    'A pontuação de compreensão é diferente da porcentagem de aderência ao framework: uma frase pode ser entendida mesmo com erros.',
    '',
    '4. Avaliação final: a resposta atende à pergunta? Distingua erro gramatical, naturalidade e preferência de estilo. Apresente uma versão revisada da resposta inteira, somente se necessário, preservando a intenção.',
    'Se não houver resposta cadastrada, não invente uma análise frase a frase: informe isso e ofereça um exemplo curto claramente identificado como exemplo.',
    'Não omita frases. Não salve nem publique conteúdo. Não invente regras, fontes ou edições de frameworks não comprovadas.'
  ].join('\n');
}
