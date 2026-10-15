# BEJ — Protocolo compartilhado de geração de HQ

## Finalidade
Produzir **uma HQ por história e por idioma** do Brazilian English Journey, com imagem A4 vertical e referência consistente no catálogo de histórias. Este documento é um **perfil de instruções para Codex**, não uma integração automática com um serviço de imagens.

## Regras de operação
1. Ler o `AGENTS.md` da raiz e este protocolo antes de executar qualquer tarefa. Respeitar regras existentes e não sobrescrever alterações não relacionadas.
2. Na **FASE 1**, executar `git status`, localizar os catálogos `src/data/stories/stories-a1.json` a `stories-c2.json`, inspecionar o schema real, os consumidores de `hqImage`, a convenção de arquivos e o acesso às ferramentas de imagem. Propor plano e **aguardar aprovação** sem modificar arquivos.
3. Na **FASE 2**, após aprovação, executar **uma história por vez**; só avançar à próxima depois de validar a atual. Nunca criar commit, push ou merge sem autorização.
4. Preferir histórias ainda sem HQ no idioma escolhido. Não sobrescrever imagem existente sem autorização.
5. Preservar exatamente IDs, nível, ordem de cenas, títulos e textos do JSON. Não corrigir gramática, não resumir, não traduzir e não inserir frases extras na arte.
6. Criar uma HQ completa em **A4 vertical (210 × 297 mm; proporção 1:√2)**, com margens seguras, quadros na ordem dos parágrafos, personagens consistentes, tipografia legível, sem cortes e sem balões que ocultem personagens importantes.
7. Usar apenas os campos do idioma selecionado; o português pode orientar a interpretação sem aparecer na HQ, salvo pedido explícito.
8. Não inventar imagens nem declarar arquivo gerado sem comprovação. Se a ferramenta de geração de imagens não estiver disponível no Codex, **interromper antes da geração** e fornecer o prompt final e o nome do arquivo para geração no ChatGPT; continuar a integração somente quando a imagem real estiver acessível ao ambiente.
9. Validar visualmente imagem final: formato, resolução adequada, fidelidade integral dos textos, ortografia, legibilidade, sequência, consistência de personagens e ausência de conteúdo de outro idioma. Se houver erros, solicitar nova geração ou correção; nunca afirmar validação visual sem inspeção real.
10. Após validar a imagem, copiar/salvar em `public/images/hq/<locale>/<nivel>/<story.id>.png` (ou `.jpg` se esse for o formato real). O `<nivel>` é minúsculo (`a1`, `a2`, `b1`, `b2`, `c1`, `c2`). Manter a extensão correspondente ao arquivo verdadeiro; não renomear JPEG para PNG.
11. **Só então** atualizar a referência da HQ no JSON da história. Antes, inspecionar como o app consome `hqImage`. Um único `hqImage` não representa três imagens independentes: preservar compatibilidade e propor o menor ajuste de schema e dos consumidores para referências por idioma. **Não alterar schema ou componentes sem aprovação na FASE 1.** Nunca sobrescrever a referência de outro idioma.
12. Confirmar que o caminho referenciado existe, que o JSON continua válido, que o app resolve o recurso e que o build/testes relevantes passam. Reportar sucesso, falhas e pendências sem exibir UUIDs ao usuário.

## Caminho do projeto (referência do usuário)
`C:\Users\julio.vitorino\Documents\workspaces\mental-hashmap-app-mvp\mental-hashmap-app`

Este caminho é uma referência para execução **local** no Windows; não presumir que o ambiente remoto tem acesso a ele. Se o repositório aberto no Codex estiver em outro diretório, usar a raiz efetiva do workspace, mantendo o caminho relativo `public/images/hq/...`.

## Padrão de saída e limites
- Arte final: PNG preferencial, JPG somente se adequado e efetivamente produzido.
- Um arquivo de imagem por história e idioma, nomeado exatamente `<story.id>.<ext>`.
- Não gerar PDF salvo pedido explícito.
- Não adicionar backend, banco de dados, API paga, bibliotecas ou automações externas sem autorização.
- Não prometer processamento agendado ou produção diária automática sem ferramentas e permissões correspondentes.
- O arquivo de imagem deve ser gerado por uma ferramenta efetivamente disponível; **o Codex não é, por si só, um gerador de imagens**.

## Relatório de cada HQ
Informar: idioma, nível, título, nome do arquivo (sem UUID em texto visível), pasta relativa, referência JSON atualizada, validação visual realizada ou pendente, testes e bloqueios. Nunca alegar download ou gravação local sem confirmação.
