# Contabilização de estudo

Módulos interativos usam timestamps: cada interação real confirma no máximo
180.000 ms desde a referência anterior. Entrar inicia a referência com zero.
O detalhe da intenção usa a mesma sessão do Hashmap, inclusive em portais.
Eventos sintéticos são excluídos; rolagem requer intenção manual recente.
Eventos frequentes atualizam o acumulado em memória e limitam gravações a 250 ms.
Navegação e eventos do ciclo de vida também confirmam checkpoints.

O relógio visual lê uma projeção limitada a três minutos. Sua atualização não
confirma tempo nem grava armazenamento. O intervalo de 15 segundos tenta obter
controle de módulo; não funciona como salvamento periódico.

A síntese de voz confirma reprodução pelos eventos de início, pausa, retomada,
término e erro. Reprodução e interação usam o mesmo acumulador, sem somar duas
vezes intervalos sobrepostos. Áudio externo aberto em outro aplicativo ou site
não pode ser comprovado pelo player interno.

Atividades Extras contam integralmente entre início/retomada e pausa/fim,
inclusive em segundo plano, sem limite de inatividade. O cronômetro deriva de
timestamps e recupera atrasos visuais. A identidade da aba em sessionStorage
permite retomar automaticamente um rascunho válido após recarregamento na mesma
aba. Outra proprietária ou uma recuperação já marcada exige confirmação;
tempo incerto não entra automaticamente no Dashboard.

## Persistência e concorrência

- `bej-study-v2:active:<módulo>`: checkpoint substituído mantendo o ID.
- `bej-study-v2:active:extra-activities`: rascunho do cronômetro externo.
- `bej-study-v2:session:<id>`: histórico finalizado.
- `bej-study-v2:goal:<idioma>`: meta.
- `bej-study-v2:adjustment:<id>`: ajuste manual.

As sessões guardam idioma e distribuição diária. Não há migração nem limpeza
global de armazenamento; favoritos e preferências permanecem independentes.
O Dashboard combina histórico e checkpoints confirmados, com precedência do
histórico para cada ID. Backup mantém registros finalizados; a exportação sela
a sessão interativa local antes de exportar. Rascunhos externos não finalizados
não são transportados como sessões completas.

Web Locks coordenam exclusividade por módulo e gravações curtas. Em HTTP sem
Web Locks, SharedWorker fornece um coordenador central. Sem essas APIs, o
rastreamento fica indisponível e preserva os dados. Não existe garantia baseada
em uma simples leitura/gravação de localStorage. Em navegadores sem notificação
de fechamento abrupto de portas do SharedWorker, um controle abandonado pode
exigir fechar todas as abas da origem. Não há sincronização entre dispositivos.

Interações ainda não persistidas podem ser perdidas se o processo terminar sem
evento de ciclo de vida. Relógios do sistema incorretos também limitam a
reconstrução. Testes temporais usam relógios simulados; testes em Chrome desktop
não substituem verificação física no Chrome do celular em HTTP.

## Arquivos desta implementação

- Serviço e captura: `studyTrackingService.ts`, `useStudyTracking.ts`,
  `useTrainingStudy.ts` e `studyStorage.ts`, em `src/features/study/`.
- Novos adaptadores: `studyAudio.ts` e `useStudyReading.ts`, na mesma pasta.
- Cronômetro externo: `src/features/study/ExtraActivities.tsx`.
- Integrações em `src/components/`: `AdvancedTraining.tsx`, `BasicTraining.tsx`,
  `ChunkFlashcards.tsx`, `IntentionDetails.tsx`, `InterpretationPanel.tsx`,
  `MemoryFlashcards.tsx`, `ReviewTraining.tsx` e `StoryShadowing.tsx`.
- Áudio de caminhada: `src/utils/walkingAudio.ts`.
- Texto de limitações em `src/i18n/locales/`: `pt-BR.json`, `en-US.json`,
  `es-ES.json` e `fr-FR.json`.
- Testes em `scripts/`: novo `test-study-events.mjs` e adaptações em
  `test-extra-activities.mjs`, `test-speaking-game.mjs`, `test-story-access.mjs`,
  `test-story-shadowing.mjs`, `test-study-dashboard.mjs`, `test-study-multitab.mjs`,
  `test-training-study.mjs` e `test-walking-mode.mjs`.
- Comando de testes: `package.json`; documentação: este arquivo e
  `docs/study-dashboard.md`.

## Validação realizada

Passaram `npm run test:study`, os testes de Speaking Game, Story Access,
Story Shadowing, Chunk Flashcards, Favorite Chunks, Walking Mode,
`npm run validate:i18n`, TypeScript/build e `git diff --check`.
Os testes temporais cobrem o exemplo de oito minutos, a tabela do teto de
três minutos, portais/detalhes, áudio sobreposto, pausa/retomada, uma aula de
90 minutos sem interações, recarregamento, backups e múltiplas abas.

Em Chrome desktop com perfil temporário e build de produção, passaram uso
simultâneo de Atividades Extras, Hashmap e Flashcards, consolidação, exclusão
de segunda proprietária, recuperação após fechamento, e layouts de Extras e
Dashboard em 390/1440 px nos temas claro/escuro, sem transbordamento. Não houve
alteração de CSS; o arquivo de estilos gerado manteve o hash anterior.
Não foi realizado teste físico no celular nem reprodução real longa de voz;
o ciclo de áudio foi verificado por eventos simulados nos testes.

O servidor Vite preexistente na porta 5173 manteve o PID 28940 antes e depois.
Nenhum Vite foi iniciado para testes. O servidor estático temporário na porta
5187 e o Chrome de teste foram encerrados; a liberação de 5187 foi verificada.
O build apresentou apenas o aviso de tamanho do bundle JavaScript.
Nenhum commit ou push foi executado.
