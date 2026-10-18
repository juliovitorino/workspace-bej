# Calendário e revisão do escopo do reset

O novo botão usa os mesmos estilos e o mesmo SVG de linha dos controles do
Dashboard. Em mobile, integra a barra flutuante existente. Uma única barra de
períodos é apresentada em portal, à esquerda do botão, com altura limitada à
janela e seis opções verticais: Hoje, 7 dias, 30 dias, Mês, 90 dias e Tudo.

`StudyPeriodMenu.tsx` recebe `filters.period` e devolve a seleção diretamente ao
estado existente em `StudyDashboard.tsx`. Não existe outro estado de período,
cálculo de estatísticas, persistência de filtro ou navegação. Os filtros
tradicionais continuam sincronizados, incluindo período personalizado e datas.
Toda seleção explícita no Calendário fecha a barra e solicita, no mesmo lote de
atualizações React, a navegação para `study-time-by-module`. O efeito de rolagem
existente roda após a atualização do DOM, sem temporizadores, e posiciona o
gráfico Tempo por módulo com `scrollIntoView` e margem CSS de 16 px. A preferência
de movimento reduzido usa rolagem imediata. Selecionar novamente o período ativo
também navega; abrir/fechar sem seleção e os filtros tradicionais não navegam.
Idioma, módulo e demais filtros são preservados. Seleção, novo clique, Escape,
clique externo e outros controles incompatíveis fecham o menu. Botões têm rótulos,
tooltips, foco visível e estado acessível; setas, Home/End e Tab permitem navegação.

## Revisão solicitada do reset

O reset foi restringido aos registros que alimentam o Dashboard. Além do prefixo,
o serviço valida o contrato completo de cada registro, seu ID/chave e módulo.
`active:*` somente é aceito para módulos explicitamente conhecidos pelo
Dashboard. Chaves desconhecidas, mesmo com prefixo semelhante e campo de idioma,
ficam preservadas. A mesma verificação vale para a recuperação de exclusões.

Os textos nos quatro idiomas agora dizem que se trata dos registros de tempo do
Dashboard, incluindo o tempo de Atividades Extras. O reset não apaga exercícios,
conteúdo, progresso pedagógico, favoritos, preferências ou metas. Continuam
válidas a confirmação explícita, exclusividade, proteção de sessões abertas e
recuperação de falhas. Não foi executado reset nos dados reais do usuário.

## Arquivos e validação

Arquivos desta revisão: `StudyDashboard.tsx`, novo `StudyPeriodMenu.tsx`,
`study.css` e `studyStorage.ts` em `src/features/study/`; os quatro JSONs em
`src/i18n/locales/`; `scripts/test-study-reset.mjs`,
`scripts/test-training-study.mjs` e este documento. Alterações anteriores da
Zona de Perigo foram preservadas.

Passaram a suíte `npm run test:study`, validação i18n, TypeScript/build e
`git diff --check`. Os testes de reset incluem preservação de chaves desconhecidas
`active:*` e configurações com o próprio prefixo de estudo. Os testes do
Dashboard verificam os seis períodos, seleção bidirecional, período
personalizado, alternância e ausência de gravações.

Em Chrome temporário com build de produção, cada opção foi comparada ao filtro
tradicional e aos gráficos existentes. Foram verificados datas personalizadas,
preservação de idioma/módulo, destaque, fechamento, teclado, um único botão
visível, posicionamento à esquerda e ausência de transbordamento em 390/1440 px
nos temas claro/escuro. A Zona de Perigo permanece presente. Não houve teste
físico no celular. A barra de calendário não altera persistência nem contagem;
a alteração no serviço corresponde exclusivamente à revisão de reset solicitada.

Porta 5173: processo preexistente PID 14792 preservado. Nenhum Vite foi iniciado
para testes. O servidor estático da porta 5187 e o Chrome temporário foram
encerrados, com liberação da porta verificada. Sem commit ou push.

## Validação do aditivo de rolagem

Passaram os testes do componente em `test-training-study.mjs`, TypeScript/build
e `git diff --check`. Em Chrome temporário, os seis períodos e a repetição do
período ativo foram verificados em 1440 e 390 px, com e sem movimento reduzido:
menu fechado antes de uma única rolagem, filtro atualizado e título do gráfico
visível. Alternar o menu e usar o filtro tradicional não provocaram rolagem.
Neste aditivo, a porta 5173 estava sem listener na inspeção inicial e final;
nenhum Vite foi iniciado ou encerrado. O servidor estático em 5187 e o Chrome
temporário foram encerrados. Persistência e contabilização não foram alteradas.
