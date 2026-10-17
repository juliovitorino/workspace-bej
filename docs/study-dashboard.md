# Dashboard de Estudos

O dashboard registra a dedicação à aprendizagem. As 750 horas são uma sugestão pessoal para inglês, sem garantia de fluência ou certificação do FSI. Os outros idiomas não recebem metas automáticas.

## Armazenamento e recuperação

Uma única chave, `bej-study-data`, contém `{schemaVersion: 1, studyData, activeSession}` e, opcionalmente, `extraActivity`. `studyData` contém `goals`, `monthlyGoals`, `sessions` e `manualAdjustments`. Metas são horas por idioma; durações são segundos inteiros. Os registros têm IDs estáveis gerados por `crypto.randomUUID()` (com fallback via `crypto.getRandomValues`). Dados inválidos não são substituídos por histórico vazio.

Cada alteração valida o candidato inteiro e grava uma vez com `localStorage.setItem`. Web Locks serializa as alterações entre abas; um segundo lock dá a uma única aba a responsabilidade pelo monitoramento. A segunda aba mostra um aviso e aguarda a primeira fechar.

Sem Web Locks, a contagem continua em modo de compatibilidade, com aviso para usar uma única aba. A chave auxiliar `bej-study-tracking-lease` reserva o monitoramento por 45 segundos, renovada a cada cinco segundos. As abas verificam a reserva antes de confirmar tempo; uma aba que perde a reserva descarta seu trecho não confirmado. Outra aba pode assumir após a reserva expirar ou ser liberada. A reserva não entra no backup. Como `localStorage` não possui compare-and-swap, esse mecanismo reduz conflitos, mas não garante exclusão mútua diante de corridas simultâneas. Nesse modo, use uma única aba e evite editar o histórico em várias abas ao mesmo tempo. Uma aba com armazenamento indisponível não consegue registrar horas e apresenta erro.

O checkpoint tem o mesmo ID durante toda a sessão e é atualizado a cada 15 segundos, em pausas e transições. Na recuperação, apenas seus segundos confirmados viram uma sessão concluída; o tempo desde o último checkpoint até a reabertura nunca é adicionado. A consolidação do checkpoint e sua remoção acontecem na mesma gravação. Uma interrupção abrupta pode perder até o último trecho não confirmado. `pagehide` tenta consolidar, mas o sistema não depende de uma operação assíncrona terminar durante o fechamento.

O acumulador limita a confirmação de um intervalo sem observação a um minuto, para não atribuir horas de suspensão do processo ao estudo. Isso pode subestimar estudo em segundo plano quando o sistema suspende o JavaScript. Não há rastreamento de eventos por segundo, frase ou clique.

## Integrações

- **Mental Hashmap:** começa na primeira interação confiável (toque, teclado, busca ou rolagem). Cada interação renova uma janela de cinco minutos; além dela, não se soma tempo. Aba oculta, configurações e treinamento de outros módulos suspendem a medição.
- **Chunk Flashcards e Chunks Favoritos:** seguem os sinais do cronômetro existente: iniciar, pausar, retomar, esvaziar a lista e sair. Trocar cartões não cria outra sessão. Favoritos de intenção e exemplo usam o mesmo contexto de estudo.
- **Flashcards de Memória:** segue o cronômetro existente, iniciado na primeira revelação e parado ao concluir a rodada. A aba oculta suspende a medição. Não há um segundo controle de pausa.
- **Caminhada:** o módulo de origem é preservado, com `mode: "walking"`. A contagem começa em `SpeechSynthesisUtterance.onstart` e para em `onend`, erro, cancelamento ou pausa. Esperas entre repetições e áudio apenas enfileirado não contam. A medição manual fica suspensa enquanto a caminhada está aberta. Retomar o áudio mantém o ID da sessão de caminhada.
- **Shadowing:** usa `module: "shadowing"` e `mode: "manual"`, acompanhando o estado ativo do cronômetro existente da prática. Reprodução, leitura integral e janelas guiadas de repetição contam; pausa, configurações, conclusão e espera pelo próximo comando não contam. A biblioteca de histórias aberta não inicia uma sessão. Trocar ou reiniciar a história pausa/retoma o mesmo acumulador, sem copiar o valor do cronômetro visual. A troca de idioma finaliza o segmento anterior. Shadowing usa histórias locais e não depende do carregamento do catálogo do Mental Hashmap para registrar estudo.
- **Exercício Básico e Avançado:** usam `basic-training` e `advanced-training`, sempre em modo `manual`. O App resolve o módulo efetivo do treinamento, mantém separados os sinais do exercício e da origem e usa apenas o sinal do contexto exibido. Abrir a tela não inicia a contagem. Toques, teclado, entrada de texto e rolagem confiáveis dentro do exercício renovam a janela central `IDLE_MS` de cinco minutos. Essa janela também cobre leitura de correções e revisão silenciosa: o sistema não sabe o instante exato em que o estudante deixa de ler; somente o tempo além da janela é excluído. O primeiro início e os resultados do ditado renovam a atividade, mas apenas deixar o microfone aberto não mantém a contagem indefinidamente. Reprodução de áudio efetivamente iniciada usa os estados existentes de TTS; seu término renova a janela de leitura.
- Avaliações/traduções pendentes pausam a espera passiva, preservando o ID da sessão. Interagir durante a requisição permite continuar estudando outros conteúdos. A chegada de uma resposta não renova sozinha uma janela já expirada. Não se acrescenta automaticamente o tempo gasto aguardando a rede. O quadro compacto lê segundos e estado com `studyTracker.readSession`; sua atualização de um segundo não grava no armazenamento nem cria outro acumulador.
- O quadro dos exercícios inclui pausa/continuação explícita. A pausa manual tem prioridade sobre digitação, rolagem, ditado e reprodução, excluindo todo o intervalo de descanso, inclusive a janela de tolerância de inatividade. Somente o botão Continuar retoma a medição, mantendo o ID e o tempo da sessão. O estado manual é local ao exercício atual; mudar de idioma/intenção ou fechar o exercício o encerra. A pausa controla o acompanhamento de horas, sem alterar o conteúdo do exercício ou os controles de áudio existentes.
- Trocar módulo, idioma ou modalidade fecha o segmento anterior antes de iniciar outro. Configurações e treinamentos externos aos módulos monitorados não acumulam horas. Revisão, a tela genérica de seleção de exercícios e flashcards pessoais não estão integrados nesta versão. Prática livre de Shadowing fora das janelas guiadas não tem estado confiável de atividade e não é contabilizada.

### Jogo da Fala e Interpretação

Ambos usam o rastreador central em modo `manual`, sem outro cronômetro ou chave de armazenamento. No Jogo da Fala, iniciar ou retomar a prática inicia a janela de cinco minutos (`IDLE_MS`); interações confiáveis durante a prática a renovam. Pausa, encerramento e carregamento suspendem a contagem. Rodadas automáticas não renovam a janela. Configuração e preparação inicial não contam.

Na Interpretação, abrir a biblioteca ou selecionar uma história não conta. Toques, teclado, entrada de texto e rolagem na área do conteúdo iniciam/renovam a janela de cinco minutos para leitura e revisão. Geração passiva e biblioteca ficam fora da contagem; áudio não mantém uma sessão indefinidamente. Trocar história reinicia a necessidade de interação. Sair, trocar idioma ou ocultar a aba interrompe a medição pelo ciclo central existente.

Os módulos aparecem nos filtros, histórico, gráficos e totais por idioma e metas existentes. Suas sessões integram o mesmo backup de versão 1; restauração preserva IDs e mesclagem sem duplicar segundos.

## Indicadores

Filtros usam os idiomas da configuração central e respeitam idioma, módulo, modalidade, período, origem e categoria externa. Selecionar uma categoria restringe a análise às sessões externas daquela categoria; a origem interna ignora a categoria oculta. Ajustes manuais entram em todas as atividades, sem serem reclassificados como estudo interno ou externo. O progresso oficial da meta é o histórico real do idioma, incluindo atividades externas confirmadas e ajustes, independentemente dos filtros de análise. Nenhuma hora de espanhol entra na meta de inglês. Cada idioma tem sua própria barra; somente a barra é limitada a 100%, sem descartar tempo excedente.

### Atividades Extras (4.9.0)

O menu Atividades Extras registra conversação, escrita, aula particular e outros estudos, usando os idiomas centrais do aplicativo. Iniciar, pausar, continuar, parar/salvar e descartar usam o mesmo controle de exclusividade do rastreador e a mesma gravação atômica de `bej-study-data`. Idioma, categoria e observação (até 1.000 caracteres) ficam bloqueados durante a sessão. Uma sessão de zero segundos pode ser descartada, mas não salva.

`extraActivity` guarda ID estável, responsável pela sessão, timestamps, estado, milissegundos confirmados em checkpoints e distribuição diária. Não é o `activeSession` interno. O tempo externo é calculado pela diferença de timestamps, descontando pausas; a atualização visual de um segundo não acumula nem grava segundos. O checkpoint de 15 segundos do serviço central também confirma o estado temporário externo. Trocar de aba, navegar entre módulos, abrir outro aplicativo ou bloquear a tela não aplica o limite de inatividade de cinco minutos nem o limite interno de suspensão do processo.

Enquanto houver uma sessão externa, inclusive pausada ou pendente, o rastreador suspende os módulos internos, mostra orientação para abrir Atividades Extras e impede outra sessão externa. As operações verificam o mesmo Web Lock ou a reserva de compatibilidade já existente. Uma segunda aba só pode recuperar depois de obter o controle. Sem Web Locks, a reserva em localStorage continua sendo consultiva; deve-se usar uma única aba, pois localStorage não fornece exclusão atômica entre processos.

Ao recarregar/fechar e reabrir a página, o novo responsável marca a sessão para recuperação. Nesse momento congela o limite estimado; outras recargas não o aumentam. A tela mostra idioma, categoria, observação, início, tempo previamente acumulado, adicional estimado e total sugerido. O estudante informa o tempo real em segundos, com prévia HH:MM:SS, até esse limite. Uma sessão pausada não recebe nenhum tempo após a pausa. Confirmar salva e remove a sessão temporária na mesma gravação; repetir a confirmação não duplica o registro. Descartar remove somente o temporário. Falha de gravação preserva o estado anterior para nova tentativa.

Sessões concluídas usam `module: "extra-activities"`, `mode: "manual"`, `category` obrigatória e `note` opcional. O schema permanece na versão 1 e as sessões antigas continuam válidas. `dailySeconds` divide o tempo pelos dias locais, inclusive na meia-noite. Uma confirmação inferior ao estimado conserva os primeiros intervalos elegíveis, até atingir exatamente a duração confirmada; a soma diária é igual a `activeSeconds`.

O Dashboard mantém os indicadores anteriores e acrescenta tempo interno, externo e consolidado (interno + externo confirmado + ajustes). As quatro categorias aparecem, inclusive com zero. Sessões externas entram nos gráficos e no mesmo histórico paginado de 20 registros, com categoria e observação. Por exemplo, 30h internas + 18h externas = 48h consolidadas e 6,4% da meta de 750h; filtrar apenas conversação não altera a meta oficial.

Backup exporta apenas as sessões concluídas, incluindo categoria, observação e distribuição diária. O temporário não é exportado nem contabilizado. Restauração fica bloqueada enquanto houver sessão externa, e volta a usar a mesclagem por ID ao salvar ou descartar. Backups antigos permanecem compatíveis.

Em celulares, o navegador pode suspender a atualização visual ou encerrar a página para liberar memória. Timestamps permitem calcular o período elegível, mas não comprovam quanto desse período foi estudo: após interrupção é indispensável a confirmação. Limpeza do armazenamento pelo usuário ou pelo sistema pode remover dados locais; mantenha backups das sessões concluídas. Mudanças regressivas no relógio impedem salvar um intervalo inconsistente até sua correção.

`node scripts/test-extra-activities.mjs` cobre os fluxos de 45 minutos, pausas, recuperação ativa/pausada, recarga repetida, descarte, falha atômica de gravação, confirmação idempotente, meia-noite, concorrência, consolidação de 48h e backup. Os testes de UI do dashboard também verificam filtros, meta oficial, categorias e histórico unificado.

Dias com estudo exigem tempo positivo. Sequências exigem ao menos 60 segundos no dia local, somando registros desse dia. A sequência atual pode terminar hoje ou ontem; a maior sequência é a do período filtrado. Registros automáticos incluem `dailySeconds`, preservando a divisão real dos intervalos ativos à meia-noite. Backups compatíveis sem esse campo atribuem os segundos à data local do início da sessão. O gráfico usa dias para períodos curtos, semanas para 30 dias e meses para histórico/90 dias. O histórico agrupa a mesma sessão por dia quando atravessa a meia-noite.

Ajustes manuais são registros separados, aplicados uma única vez na data de referência. Não são atribuídos a módulo/modalidade; esses filtros específicos os excluem. Lançamentos idênticos de idioma, data, duração e descrição são bloqueados na interface. Correção preserva o ID; correção e exclusão exigem confirmação. Sessões automáticas não são editadas pelos ajustes.

## Backup e restauração

O download usa `Blob`, `URL.createObjectURL` e um link nativo. Formato:

```json
{
  "schemaVersion": 1,
  "application": "Brazilian English Journey",
  "exportedAt": "2026-10-17T12:00:00.000Z",
  "studyData": {
    "goals": { "en-US": 750 },
    "monthlyGoals": {},
    "sessions": [],
    "manualAdjustments": []
  }
}
```

Exportar primeiro consolida o trecho ativo confirmado. Se o estudo continuar, é criado um novo segmento com outro ID: o trecho já exportado nunca volta a crescer sob o mesmo ID. Uma sessão ativa pertencente a outra aba bloqueia a exportação até ser consolidada nessa aba. O nome do arquivo usa a data/hora UTC: `bej-study-backup-YYYYMMDD-HHMMSS.json`.

O limite de importação é 5 MiB. Leitura, versão, aplicação, idiomas, módulos, durações finitas não negativas, IDs e datas são validados antes de qualquer importação. Nenhuma string é executada ou interpretada como HTML. A prévia mostra registros novos, duplicados, conflitos, ajustes novos, tempo atual e previsto. Duplicatas idênticas no próprio arquivo também são deduplicadas. Conflitos internos ou com o histórico bloqueiam toda a restauração, sem sobrescrever registros. O usuário pode cancelar e corrigir a origem do conflito.

Metas locais prevalecem por padrão e metas ausentes são adicionadas. Divergências são exibidas, com opção explícita de usar os valores do backup. Antes da gravação, sob lock, o estado é comparado ao da prévia. Se mudou, é necessário selecionar o arquivo novamente. Checkbox e botão exigem confirmação explícita. A mesclagem inteira usa uma única gravação; falha de quota mantém o valor anterior. O dashboard recebe o evento de atualização após o sucesso.

Reimportar o mesmo arquivo não aumenta o tempo. A deduplicação por ID não detecta duas sessões diferentes que representam o mesmo intervalo em dispositivos distintos. Não há sincronização automática, autenticação, backend ou banco de dados. Favoritos, preferências e catálogos do Mental Hashmap ficam fora do backup e das gravações.

## Validação

`node scripts/test-study-dashboard.mjs` valida contagem, pausa, inatividade, modalidades, idioma, meia-noite, recuperação, formatos de backup, totais, idempotência, conflitos, metas, quota e isolamento do armazenamento. `node scripts/test-chunk-flashcards.mjs` também testa os sinais reais de início/pausa/retomada dos cartões e os eventos de reprodução da caminhada. Complementar com build, validação i18n e conferência em navegador desktop/mobile.

`node scripts/test-training-study.mjs` testa os componentes reais dos exercícios com tempo simulado: 65 segundos por módulo, primeira interação confiável, janela de inatividade e retomada, exclusão do módulo de origem, saída, idioma, ditado, áudio, espera de rede, leitura do quadro central e backup idempotente. O teste observa que as atualizações visuais não causam persistência por segundo.
