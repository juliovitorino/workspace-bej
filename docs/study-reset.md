# Zona de Perigo do Dashboard

## Correção de UX após o teste com inglês e espanhol

O botão individual identifica o idioma da operação, por exemplo
**Redefinir Inglês americano**. O global usa **Redefinir todos os idiomas**.
O diálogo global destaca **Atenção! Redefinir TODOS os idiomas**, informa o
filtro atual do Dashboard apenas como contexto e explica que ele não limita a
exclusão. A confirmação global em português agora exige exatamente
`REDEFINIR TODOS OS IDIOMAS`, com botão **Excluir dados de todos os idiomas**.
Todos esses textos estão traduzidos para en-US, es-ES e fr-FR.

`readStudyResetImpact` utiliza as leituras existentes, a consolidação de
checkpoints por ID e `totalSeconds`. Apresenta tempo, sessões e ajustes manuais
por idioma, incluindo total geral e idiomas sem registros. Ajustes entram no
tempo e têm contagem própria. Abrir/verificar a confirmação não modifica dados.

A prévia acompanha eventos de armazenamento e foco. Mudanças nos registros
atualizam a tabela e apagam a frase digitada, exigindo nova revisão. O serviço
compara novamente a identificação exata das chaves e seus conteúdos sob o
lock de escrita antes de excluir; uma diferença rejeita a operação como
desatualizada, mesmo que tempo e contagens coincidam. Essa proteção complementa
as verificações existentes de sessões ativas. Não altera formato de persistência
nem regras de exclusão e preserva Calendário e contabilização.

Arquivos desta correção: `StudyDangerZone.tsx`, `StudyDashboard.tsx`,
`studyStorage.ts` e `study.css` em `src/features/study/`; os quatro arquivos de
tradução em `src/i18n/locales/`; `scripts/test-study-reset.mjs` e este documento.

Passaram a suíte de estudo, i18n, TypeScript/build e `git diff --check`.
Em Chrome temporário com duas abas foram verificados reset EN preservando ES/FR,
reset global com inglês selecionado, cancelamento, frase incompleta, mudança
dos registros em outra aba, nova confirmação, cliques repetidos e preservação
de metas/preferências. Diálogos e tabela foram conferidos em 390/1440 px,
claro/escuro, sem transbordamento do diálogo. Não houve teste físico no celular.
Nenhum dado real do usuário foi redefinido.

Nesta correção, o Vite da porta 5173 manteve o PID 37832. Nenhum Vite de teste
foi iniciado; Chrome e servidor estático temporários na porta 5187 foram
encerrados, com liberação verificada. Sem commit ou push.

A seção fica ao final de **Meus dados**, abaixo de exportação/restauração.
O reset por idioma exige a frase traduzida exata; o geral usa uma frase reforçada.
O diálogo nativo mantém o foco, abre em Cancelar e impede confirmação por Enter.
Uma trava em memória impede cliques repetidos enquanto a operação está pendente.

## Persistência e proteção

`resetStudyData` e `checkStudyReset`, em `studyStorage.ts`, validam o escopo e
usam o coordenador existente (Web Locks ou SharedWorker). O lock de escrita
serializa reset, checkpoints e restauração. Controles livres de módulos são
mantidos durante a exclusão; controles ocupados só são aceitos quando um
checkpoint identifica com segurança um idioma fora do escopo.

Sessões afetadas abertas em outra aba, mesmo em segundo plano ou pausadas,
bloqueiam a confirmação e são verificadas novamente antes da exclusão.
Atividades Extras pendentes, inclusive pausadas ou aguardando recuperação,
exigem finalização ou descarte explícito. O serviço não termina atividades.
Um controle ocupado sem checkpoint identificável bloqueia conservadoramente.
Checkpoints abandonados sem proprietária podem ser removidos.

São excluídas somente chaves `bej-study-v2:session:*`, `adjustment:*` e `active:*`
cujos registros pertençam aos idiomas selecionados. A enumeração usa o
armazenamento atual, não snapshots React. São preservadas `goal:*` (metas totais
e mensais), todas as preferências, idiomas selecionados, favoritos, conteúdos
pedagógicos e chaves independentes. Não há `localStorage.clear()` nem migração.

A revisão posterior restringe `active:*` aos módulos conhecidos pelo Dashboard
e valida contratos, IDs e chaves dos registros antes de excluir. Chaves de outras
funcionalidades com prefixos semelhantes também são preservadas. Os detalhes e
testes adicionais estão em [study-calendar.md](study-calendar.md).

Cada idioma recebe `bej-study-v2:reset:<idioma>` com geração nova e a lista
precisa de chaves pendentes. Esse registro é persistido antes de remover dados.
As leituras ignoram chaves pendentes imediatamente. Se houver interrupção,
a próxima operação coordenada conclui as remoções de forma idempotente e esvazia
a lista, mantendo a geração. Uma falha parcial de reset geral pode afetar apenas
parte dos idiomas; não há promessa de atomicidade de múltiplas chaves e não é
exibido sucesso em caso de erro. Repetir o reset conclui o escopo solicitado.

Snapshots e gravações enfileiradas carregam as gerações observadas. Gravações
de registros de uma geração anterior são rejeitadas. O rastreador invalida seu
acumulador quando a geração do idioma muda. Eventos `storage` e
`bej-study-changed` atualizam os modelos do Dashboard nas outras abas e na própria
aba. Uma restauração explicitamente confirmada depois do reset continua
permitida; uma prévia anterior fica desatualizada e não pode ser aplicada.

## Arquivos

- `src/features/study/StudyDangerZone.tsx`: seção e confirmação acessível.
- `src/features/study/StudyDashboard.tsx`: integração e invalidação da prévia.
- `src/features/study/studyStorage.ts`: serviço, diário e gerações.
- `src/features/study/studyTrackingService.ts`: proteção contra gravações antigas.
- `src/features/study/study.css`: estilos restritos à seção e ao diálogo.
- `src/i18n/locales/{pt-BR,en-US,es-ES,fr-FR}.json`: textos e frases localizados.
- `scripts/test-study-reset.mjs` e `package.json`: testes integrados à suíte.

Sem APIs seguras de coordenação, o reset é indisponível. Aplicam-se as limitações
do SharedWorker já documentadas em `study-tracking.md`. O registro de recuperação
depende do armazenamento da origem permanecer íntegro e gravável. Não há
sincronização entre dispositivos. Nenhum commit ou push é realizado.

## Validação desta entrega

Passaram `npm run test:study` (incluindo os novos testes de reset),
`npm run validate:i18n`, TypeScript/build e `git diff --check`.
Os testes cobrem isolamento por idioma, reset geral, preservação, sessões
ativas/pausadas, gravações enfileiradas e snapshots antigos, Dashboard/backup,
restauração posterior e falha durante exclusão com recuperação e repetição.

Em Chrome desktop com perfil temporário, foram verificados três tabs,
bloqueio por Atividades Extras e Hashmap, foco em Cancelar, confirmação parcial
rejeitada, Enter sem exclusão, cancelamento e reset por idioma e geral.
O diálogo foi conferido em 390 e 1440 px, nos temas claro/escuro, sem
transbordamento. Não houve teste físico no celular. Os estilos novos estão
restritos à Zona de Perigo e ao diálogo; outras seções mantêm seus estilos.

A porta 5173 estava e permaneceu ocupada pelo Node/Vite preexistente, PID 17544.
Nenhum Vite de teste foi iniciado. O servidor estático temporário usou 5187;
o Chrome temporário e esse servidor foram encerrados, com liberação da porta
verificada. O build apresenta o aviso de tamanho do bundle JavaScript.
