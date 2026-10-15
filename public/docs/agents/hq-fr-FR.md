# Agente BEJ HQ — fr-FR

**Perfil:** criação de HQ educativa em francês da França.
**Idioma alvo:** `fr-FR`.
**Protocolo obrigatório:** `docs/agents/hq-common.md` e `AGENTS.md` da raiz.

## Missão
Selecionar uma história dos catálogos de `src/data/stories/`, criar uma HQ A4 vertical exclusivamente em **Français (France)**, salvar a imagem e registrar sua referência no JSON, respeitando o fluxo de aprovação em duas fases.

## Campos autorizados
- Título: `story.titleFr`.
- Texto de cada quadro: `story.paragraphs[i].fr`.
- Intenções linguísticas (somente para destaque, se pedido): `story.paragraphs[i].intentions[*].frIntent` **se este for o caminho efetivo**; descobrir a localização real das intenções no schema antes de usá-las.
- Identificador: `story.id` (uso interno; não mostrar UUID nos relatórios).
- Nível: `story.englishLevel` ou o nível indicado pelo catálogo, conforme schema real.
- Fonte de apoio sem impressão: português (`titlePt`, `paragraphs[i].pt`).

## Fluxo específico
1. **FASE 1 — sem edições:** ler `AGENTS.md` e `hq-common.md`; examinar JSONs, estrutura de `hqImage`, referências existentes e capacidade de geração de imagem; identificar uma história sem HQ em `fr-FR` e apresentar plano. Aguardar aprovação.
2. **FASE 2 — com aprovação:** extrair título e parágrafos na ordem exata; preparar prompt visual; gerar a imagem por ferramenta disponível, ou interromper e entregar o prompt se não houver ferramenta; validar a imagem; salvar em `public/images/hq/fr-FR/<nivel>/<story.id>.png` (ou `.jpg` real); atualizar a referência por idioma sem quebrar as demais; executar validações.
3. Repetir somente se o usuário solicitar lote e depois de verificar a conclusão de cada HQ.

## Instrução para geração da imagem
> Produza **uma página de história em quadrinhos educativa A4 vertical**, com proporção 210:297, margens seguras, acabamento profissional, personagens visualmente consistentes e exatamente um quadro/cena para cada parágrafo da história. Use o título e os textos de **Français (France)** fornecidos abaixo, na mesma ordem e **sem alterar, omitir, repetir, resumir ou acrescentar nenhuma palavra**. Priorize letras grandes e contraste; preserve pontuação, acentos e sinais. Não inclua traduções ou legendas extras. Destaque expressões somente se explicitamente solicitado e sem alterar o texto. Evite cortar texto, balões e quadros. Não incluir texto inglês ou espanhol. Manter francês da França exatamente como no JSON.
>
> TÍTULO: {título extraído literalmente de `titleFr`}
>
> CENAS (uma por parágrafo, na ordem):
> {lista numerada de textos extraídos literalmente de `paragraphs[].fr`}
>
> IDENTIDADE VISUAL: {descrição consistente dos personagens e ambientes inferida da própria história; sem inventar fatos narrativos conflitantes}

## Critérios de bloqueio
- Texto de `titleFr` ou `paragraphs[].fr` ausente: não substituir por inglês/português; registrar pendência.
- Ferramenta de imagem indisponível: não afirmar que a HQ foi criada; fornecer prompt e aguardar imagem gerada externamente.
- Arte com texto incorreto ou ilegível: não atualizar JSON.
- Destino já existente: pedir autorização antes de sobrescrever.
- `hqImage` incompatível com três idiomas: propor ajuste mínimo e aguardar aprovação antes de alterar.

## Saída esperada
Imagem final em `public/images/hq/fr-FR/<nivel>/` e referência correta no catálogo, após confirmação da existência e validação do arquivo.
