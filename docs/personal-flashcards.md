# BEJ 4.0 — Meus Flashcards (isolado)

## Escopo
- O botão `+` aparece no Memory Flashcards oficial e abre exclusivamente o editor de criação. Quando não existem cartões pessoais, um botão secundário `⋯` ao lado do `+` permite importar backup sem entrar no editor.
- O Memory Flashcards oficial, seu deck, relógio, progresso e chunks não são persistidos nem modificados.
- A sidebar mostra **Meus Flashcards** apenas se `countPersonalFlashcards() >= 1` no IndexedDB.
- O módulo pessoal tem seus próprios cartões, estudo, edição, exclusão e backup. As opções de backup ficam em um menu `⋯` fora do formulário de criação.
- Os cartões são vinculados à direção exata `Source → Target`. Outros pares não os mostram, mas a sidebar permanece disponível se houver qualquer cartão pessoal.
- `front` e `back` obrigatórios; `context` e imagem opcionais.
- Imagens JPG, PNG ou WebP com tamanho máximo de 3 MiB são armazenadas como `Blob` no IndexedDB.
- Backup exportado/importado em JSON, com imagens codificadas como Data URL. Importação adiciona cartões novos sem sobrescrever os existentes.
- As legendas utilizam o i18next já existente (Source).
- Nenhum JSON pedagógico, API, backend ou dependência adicional foi modificado.

## Teste manual sugerido
1. Em um navegador sem cartões pessoais, verificar que a sidebar não exibe **Meus Flashcards**.
2. Entrar no Memory Flashcards, virar um cartão e clicar `+`. Cancelar e verificar que a rodada continua no mesmo ponto.
3. Criar um cartão `pt-BR → en-US` com frente, verso, contexto e imagem JPG/PNG/WebP.
4. Confirmar que **Meus Flashcards** aparece na sidebar sem recarregar.
5. Entrar no módulo pessoal, virar o cartão, conferir contexto e imagem; testar edição.
6. Alternar para `en-US → pt-BR`: a coleção desse par deverá estar vazia, mas a sidebar continuará visível.
7. Retornar ao par original, exportar backup, excluir o cartão e confirmar que a opção some da sidebar.
8. Com a coleção vazia, no Memory Flashcards usar o botão secundário `⋯` ao lado do `+` para importar o backup. Confirmar que a restauração **não** aparece no formulário de criação e que a sidebar volta a exibir o módulo.
9. Atualizar a página e confirmar a persistência dos cartões no mesmo navegador.
10. Validar captions com Source pt-BR, en-US, es-ES e fr-FR; testar em mobile.
11. Executar `npm run validate:i18n` e `npm run build`.

## Limitações
- IndexedDB é armazenamento local por origem e navegador; apagar os dados do site pode remover cartões.
- O botão `+` abre somente a criação; o `⋯` adjacente oferece restauração quando a sidebar está oculta.
- A importação é aditiva, não substitutiva.
- Sem sincronização entre dispositivos, contas ou armazenamento em servidor.
