# Dashboard de Estudos

O dashboard registra a dedicação à aprendizagem. As 750 horas são uma sugestão pessoal para inglês, sem garantia de fluência ou certificação do FSI. Os outros idiomas não recebem metas automáticas.

## Armazenamento e recuperação

Uma única chave, `bej-study-data`, contém `{schemaVersion: 1, studyData, activeSession}`. `studyData` contém `goals`, `monthlyGoals`, `sessions` e `manualAdjustments`. Metas são horas por idioma; durações são segundos inteiros. Os registros têm IDs estáveis gerados por `crypto.randomUUID()` (com fallback via `crypto.getRandomValues`). Dados inválidos não são substituídos por histórico vazio.

Cada alteração valida o candidato inteiro e grava uma vez com `localStorage.setItem`. Web Locks serializa as alterações entre abas; um segundo lock dá a uma única aba a responsabilidade pelo monitoramento. A segunda aba mostra um aviso e aguarda a primeira fechar.

Sem Web Locks, a contagem continua em modo de compatibilidade, com aviso para usar uma única aba. A chave auxiliar `bej-study-tracking-lease` reserva o monitoramento por 45 segundos, renovada a cada cinco segundos. As abas verificam a reserva antes de confirmar tempo; uma aba que perde a reserva descarta seu trecho não confirmado. Outra aba pode assumir após a reserva expirar ou ser liberada. A reserva não entra no backup. Como `localStorage` não possui compare-and-swap, esse mecanismo reduz conflitos, mas não garante exclusão mútua diante de corridas simultâneas. Nesse modo, use uma única aba e evite editar o histórico em várias abas ao mesmo tempo. Uma aba com armazenamento indisponível não consegue registrar horas e apresenta erro.

O checkpoint tem o mesmo ID durante toda a sessão e é atualizado a cada 15 segundos, em pausas e transições. Na recuperação, apenas seus segundos confirmados viram uma sessão concluída; o tempo desde o último checkpoint até a reabertura nunca é adicionado. A consolidação do checkpoint e sua remoção acontecem na mesma gravação. Uma interrupção abrupta pode perder até o último trecho não confirmado. `pagehide` tenta consolidar, mas o sistema não depende de uma operação assíncrona terminar durante o fechamento.

O acumulador limita a confirmação de um intervalo sem observação a um minuto, para não atribuir horas de suspensão do processo ao estudo. Isso pode subestimar estudo em segundo plano quando o sistema suspende o JavaScript. Não há rastreamento de eventos por segundo, frase ou clique.

## Integrações

- **Mental Hashmap:** começa na primeira interação confiável (toque, teclado, busca ou rolagem). Cada interação renova uma janela de cinco minutos; além dela, não se soma tempo. Aba oculta, configurações e treinamento de outros módulos suspendem a medição.
- **Chunk Flashcards e Chunks Favoritos:** seguem os sinais do cronômetro existente: iniciar, pausar, retomar, esvaziar a lista e sair. Trocar cartões não cria outra sessão. Favoritos de intenção e exemplo usam o mesmo contexto de estudo.
- **Flashcards de Memória:** segue o cronômetro existente, iniciado na primeira revelação e parado ao concluir a rodada. A aba oculta suspende a medição. Não há um segundo controle de pausa.
- **Caminhada:** o módulo de origem é preservado, com `mode: "walking"`. A contagem começa em `SpeechSynthesisUtterance.onstart` e para em `onend`, erro, cancelamento ou pausa. Esperas entre repetições e áudio apenas enfileirado não contam. A medição manual fica suspensa enquanto a caminhada está aberta. Retomar o áudio mantém o ID da sessão de caminhada.
- Trocar módulo, idioma ou modalidade fecha o segmento anterior antes de iniciar outro. Configurações e treinamentos externos aos quatro módulos não acumulam horas. Exercícios, práticas básica/avançada/revisão, Speaking Game, Shadowing e flashcards pessoais não estão integrados nesta versão.

## Indicadores

Filtros usam os idiomas da configuração central e respeitam idioma, módulo, modalidade e período. O progresso da meta ignora apenas o filtro temporal e está identificado como histórico. Nenhuma hora de espanhol entra na meta de inglês. Cada idioma tem sua própria barra; somente a barra é limitada a 100%, sem descartar tempo excedente.

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
