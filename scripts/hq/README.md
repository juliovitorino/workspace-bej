# BEJ — Gerador de HQ A4 por linha de comando

Implementação para a branch `feature/agent-hq-enus`. **Não altera os agentes `.codex/agents/hashmap_hq_*.toml`.**

## Pré-requisitos

Na raiz do projeto:

```powershell
npm install sharp
```

O projeto já usa `openai` como dependência de desenvolvimento. `sharp` é necessário para montar quatro painéis em uma página A4 e embutir texto exato nos balões, com PNG 300 DPI. `npm install` atualiza `package.json` e `package-lock.json` localmente. Não há backend, banco de dados ou cache.

Configure `OPENAI_API_KEY` **somente na sessão do terminal**, sem incluir a chave no repositório:

```powershell
$env:OPENAI_API_KEY = 'SUA_CHAVE'
```

As chamadas reais à API de texto e imagem são **pagas**. O custo é aproximadamente **1 chamada de roteiro + 4 imagens por HQ**, e depende dos modelos, resolução e preços vigentes. Modelo padrão de texto `gpt-4.1-mini`; modelo de imagem `gpt-image-1.5`. É possível substituir com `BEJ_HQ_TEXT_MODEL` e `BEJ_HQ_IMAGE_MODEL` se a conta/API suportar os parâmetros esperados.

## Etapa 1 — Simulação (zero custo)

```powershell
node .\scripts\hq\generate.mjs --locale=en-US --dry-run --max-images=3
```

Seleciona exemplos sem `hqImage`, sem imagem final existente e sem candidato pendente. Mostra os IDs. Não chama a API, não grava arquivos e não altera JSON.

Para selecionar um exemplo específico:

```powershell
node .\scripts\hq\generate.mjs --locale=en-US --dry-run --example-id=UUID
```

## Etapa 2 — Gerar apenas um candidato

```powershell
node .\scripts\hq\generate.mjs --locale=en-US --max-images=1
```

Ou restringir a um UUID:

```powershell
node .\scripts\hq\generate.mjs --locale=en-US --example-id=UUID --max-images=1
```

O gerador cria roteiro curto em quatro quadros, quatro ilustrações originais sem texto, e sobrepõe balões com falas em SVG. A frase `exampleItem` é incluída **exatamente como fornecida** no quarto quadro. O resultado é um PNG de **2480 × 3508 px, 300 DPI**, com margens de 118 px e grade 2×2. Os painéis nativos de 1024 × 1536 px são ajustados para aproximadamente 1106 × 1620 px, sem ampliação drástica.

A imagem fica em `reports/hq/pending/en-US/UUID.png` e o roteiro/manifesto em `reports/hq/pending/en-US/UUID.json`. **O catálogo NÃO é alterado nessa etapa.** Se a API ou a composição falhar, a execução para e o JSON continua intacto.

## Etapa 3 — Revisão visual obrigatória

Abra o PNG em tamanho real, e preferencialmente faça uma impressão de teste A4. Confira:

- quatro cenas coerentes, variadas e com os mesmos personagens;
- balões compactos e orgânicos **dentro** da cena, com cauda apontando ao falante;
- rostos, ações e objetos narrativos visíveis, sem faixas brancas de legenda;
- frase-alvo idêntica ao `exampleItem`, pontuação e acentos inclusive;
- legibilidade e nitidez na impressão, sem textos ou artefatos espúrios.

**A validação automática não consegue atestar qualidade visual, direção correta das caudas ou ausência de texto acidental gerado na imagem.** Não aprove HQs que falhem nesses requisitos. A aprovação é explícita e manual; o script não a simula.

## Etapa 4 — Aprovar e publicar

Depois de conferir visualmente a imagem:

```powershell
node .\scripts\hq\generate.mjs --locale=en-US --approve-id=UUID --reviewed
```

O script confere dimensões, PNG, DPI, hash do candidato, identidade do exemplo, frase e nível; cria backup do JSON; publica o PNG em `public/images/hq/<nivel>/en-US/UUID.png`; e insere **somente** `hqImage` no exemplo certo. Se houver `hqImage` ou arquivo final preexistente, **não sobrescreve**. O JSON não é reserializado por inteiro. Se o catálogo mudou durante a geração, a aprovação é recusada.

Outros idiomas são aceitos por `--locale=pt-BR|es-ES|fr-FR`, mas a primeira execução recomendada é um único exemplo `en-US`.

## Cuidados

- Nenhum `commit`, `push` ou `tag` é feito pelo script.
- Não rode várias gerações em paralelo sobre o mesmo catálogo.
- Uma falha após chamadas de API pode consumir créditos sem gerar uma HQ aprovada.
- Os arquivos `reports/hq/pending` são artefatos de revisão. **Não os inclua no commit**; somente imagens aprovadas e alterações de catálogo devem ser versionadas.
- As regras completas de aceitação permanecem em `.codex/agents/hashmap_hq_en_us.toml` e `.codex/docs/EXEMPLO-VISUAL-E-CHECKLIST.md`.
- Para ver todas as opções: `node .\scripts\hq\generate.mjs --help`.
