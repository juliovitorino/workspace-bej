# Auditoria de i18n — BEJ 4.0, Fase 1

Data: 16/10/2026. Escopo: preparação dos recursos; **a interface ainda não está internacionalizada**. Nenhum componente, serviço ou JSON pedagógico foi modificado. Não houve instalação de bibliotecas.

## Cobertura e método

- **1070 ocorrências de textos fixos de interface identificadas e mapeadas**. Uma ocorrência corresponde a um literal, trecho JSX ou texto fixo de template, não à quantidade de vezes que aparece na tela. Textos repetidos em atributos e botões contam separadamente.
- **704 chaves finais por idioma**, total de 2816 valores nos quatro dicionários.
- **52 arquivos analisados**: arquivos TypeScript/TSX de src, o CSS da aplicação e index.html. Os catálogos JSON pedagógicos não integram o denominador.
- **33 arquivos com locais de futura integração**; demais arquivos não têm captions traduzíveis no escopo.
- **159 chaves com interpolação** (incluindo variantes de plural).
- **14 famílias de plural**, com sufixos _one, _other e _many presentes nos quatro idiomas.
- Zero chaves ausentes, propriedades duplicadas, valores vazios ou divergências de variáveis na validação local.

A extração utilizou a AST do TypeScript, seguida de revisão dos candidatos e busca complementar de rótulos curtos, atributos acessíveis, textos numéricos e HTML de impressão. Seletores, CSS, mensagens de console, prompts e conteúdo pedagógico foram classificados separadamente. A contagem considera cada ocorrência de origem uma única vez, mesmo quando origina variantes de plural ou duas mensagens condicionais completas. Os templates HTML de impressão são referenciados pela linha inicial do template.

As chaves são semânticas, agrupadas por módulo; common reúne mensagens compartilhadas. Textos equivalentes diferindo apenas em pontuação, capitalização ou ícone foram consolidados quando as quatro traduções mantêm o mesmo sentido. Ícones devem permanecer na apresentação na Fase 2. Marcas e termos técnicos não devem ser traduzidos como dados.

## Regra para a integração futura

O idioma da interface será **Source**. Target continuará selecionando exclusivamente o conteúdo estudado. Não integrar bibliotecas, não alterar captions em React e não mudar fluxos nesta fase. Os JSONs são recursos preparados para revisão, não uma instalação/configuração de i18next.

Interpolação: usar {{variavel}}, com os mesmos nomes nos quatro recursos. count é a quantidade inteira usada na seleção do plural; total, number, round, seconds e time têm funções distintas. Os nomes de idiomas interpolados também precisarão ser localizados segundo Source. categorySuffix representa o sufixo opcional já presente nos resumos; sua montagem deve ser revista na integração para não concatenar português. Nenhum valor de intenção, exemplo, tag, descrição ou padrão foi traduzido.

Plurais: _one/_other/_many seguem o formato JSON v4 do i18next. _many foi incluído de modo uniforme porque as regras Intl de português, espanhol e francês podem selecioná-lo para milhões; em inglês, a variante adicional é inofensiva. _many reutiliza a forma plural por extenso; não há compactação numérica nesta fase. A seleção depende do locale, inclusive para zero em francês e português. Não usar apenas count === 1 na integração.

## Distribuição por módulo

| Módulo de origem | Ocorrências |
| --- | ---: |
| advancedTraining | 146 |
| app | 12 |
| basicTraining | 126 |
| catalog | 5 |
| connectedSpeech | 32 |
| details | 92 |
| document | 1 |
| evaluation | 7 |
| exercises | 26 |
| filters | 47 |
| flashcards | 58 |
| hashmap | 17 |
| header | 1 |
| languages | 4 |
| memory | 26 |
| navigation | 12 |
| reviewTraining | 87 |
| settings | 14 |
| shadowing | 95 |
| speaking | 66 |
| stories | 121 |
| storyGeneration | 20 |
| translation | 7 |
| validation | 3 |
| vocabulary | 10 |
| walking | 35 |

## Arquivos analisados e integração futura

| Arquivo | Ocorrências mapeadas | Integração de captions |
| --- | ---: | --- |
| src/App.css | 0 | Não neste escopo |
| src/App.tsx | 12 | Sim |
| src/components/AdvancedTraining.tsx | 146 | Sim |
| src/components/AppSettingsDialog.tsx | 14 | Sim |
| src/components/BasicTraining.tsx | 126 | Sim |
| src/components/ChunkFlashcards.tsx | 56 | Sim |
| src/components/ChunkLevelSelect.tsx | 2 | Sim |
| src/components/ConnectedSpeechStudio.tsx | 32 | Sim |
| src/components/ControlIcon.tsx | 0 | Não neste escopo |
| src/components/ExercisePanel.tsx | 26 | Sim |
| src/components/Header.tsx | 1 | Sim |
| src/components/IntentionCard.tsx | 13 | Sim |
| src/components/IntentionDetails.tsx | 92 | Sim |
| src/components/IntentionList.tsx | 4 | Sim |
| src/components/IntentionValidationFeedback.tsx | 3 | Sim |
| src/components/InterpretationPanel.tsx | 121 | Sim |
| src/components/MemoryFlashcards.tsx | 26 | Sim |
| src/components/ReviewTraining.tsx | 87 | Sim |
| src/components/ScrollToTopButton.tsx | 2 | Sim |
| src/components/SearchPanel.tsx | 47 | Sim |
| src/components/Sidebar.tsx | 10 | Sim |
| src/components/SpeakingGame.tsx | 4 | Sim |
| src/components/SpeakingGamePlayStep.tsx | 35 | Sim |
| src/components/SpeakingGameReadyStep.tsx | 13 | Sim |
| src/components/SpeakingGameSetupStep.tsx | 14 | Sim |
| src/components/StoryShadowing.tsx | 90 | Sim |
| src/components/WalkingMode.tsx | 35 | Sim |
| src/config/languages.ts | 4 | Sim |
| src/config/speakingGameForms.ts | 0 | Não neste escopo |
| src/hooks/useStoryShadowing.ts | 5 | Sim |
| src/main.tsx | 0 | Não neste escopo |
| src/services/aiEvaluationService.ts | 7 | Sim |
| src/services/cacheService.ts | 0 | Não neste escopo |
| src/services/englishVerbService.ts | 10 | Sim |
| src/services/googleTranslateService.ts | 7 | Sim |
| src/services/hashmapService.ts | 5 | Sim |
| src/services/intentionValidator.ts | 0 | Não neste escopo |
| src/services/localStoryService.ts | 0 | Não neste escopo |
| src/services/storyGenerationService.ts | 20 | Sim |
| src/types/englishVerb.ts | 0 | Não neste escopo |
| src/types/hashmap.ts | 0 | Não neste escopo |
| src/types/speakingGameTypes.ts | 0 | Não neste escopo |
| src/utils/authorMode.ts | 0 | Não neste escopo |
| src/utils/chunkEligibility.ts | 0 | Não neste escopo |
| src/utils/mobileDevice.ts | 0 | Não neste escopo |
| src/utils/normalizeText.ts | 0 | Não neste escopo |
| src/utils/searchIntentions.ts | 0 | Não neste escopo |
| src/utils/speakingGameEngine.ts | 0 | Não neste escopo |
| src/utils/storyShadowing.ts | 0 | Não neste escopo |
| src/utils/walkingAudio.ts | 0 | Não neste escopo |
| src/vite-env.d.ts | 0 | Não neste escopo |
| index.html | 1 | Sim |

## Interpolação e pluralização

As frases compostas foram preparadas como mensagens completas para permitir mudança de ordem entre idiomas. A revisão de textos dinâmicos não altera a lógica atual.

| Família de plural | Locais de origem |
| --- | --- |
| hashmap.results_{one,other,many} | src/App.tsx:377 |
| flashcards.availableChunks_{one,other,many} | src/components/ChunkFlashcards.tsx:417 |
| flashcards.roundPracticed_{one,other,many} | src/components/ChunkFlashcards.tsx:529 |
| exercises.availableAtLevel_{one,other,many} | src/components/ExercisePanel.tsx:294 |
| exercises.drawnIntentions_{one,other,many} | src/components/ExercisePanel.tsx:435<br>src/components/ExercisePanel.tsx:436 |
| stories.availableIntentions_{one,other,many} | src/components/InterpretationPanel.tsx:1342 |
| stories.searchResults_{one,other,many} | src/components/InterpretationPanel.tsx:1525<br>src/components/InterpretationPanel.tsx:1524 |
| memory.studiedChunks_{one,other,many} | src/components/MemoryFlashcards.tsx:123<br>src/components/MemoryFlashcards.tsx:126 |
| memory.remainingChunks_{one,other,many} | src/components/MemoryFlashcards.tsx:126 |
| filters.tagsFound_{one,other,many} | src/components/SearchPanel.tsx:343 |
| filters.tagsSelected_{one,other,many} | src/components/SearchPanel.tsx:344 |
| shadowing.completedParagraphs_{one,other,many} | src/components/StoryShadowing.tsx:53 |
| shadowing.completionSummary_{one,other,many} | src/components/StoryShadowing.tsx:59 |
| shadowing.availableStories_{one,other,many} | src/components/StoryShadowing.tsx:121 |

Todas as variáveis de cada chave dinâmica estão na última coluna do inventário. Templates de impressão usam as mesmas convenções. A posição de parágrafo e o indicador N/total são formatos, e não formas de plural. As frases com contagens que antes continham fragmentos isolados foram substituídas nos recursos por mensagens completas; a estrutura JSX será ajustada somente na Fase 2.

## Revisão humana e decisões pendentes

1. **Glossário pedagógico**: intenção mental foi vertida como “communicative intention”, “intención comunicativa” e “intention de communication”. Validar se o produto prefere preservar uma tradução literal como termo de marca. Pattern, chunk, flashcard, treino/prática e tag também requerem aprovação editorial de consistência. Chunk foi preservado. HQ foi adaptada para comic/cómic/BD nos captions, sem tocar nas imagens ou conteúdo.
2. **Identidade**: Brazilian English Journey, BEJ, Mental Hashmap, Hashmap, Memory Flashcards, Chunk Flashcards, Connected Speech Studio, YouTube e Google permanecem reconhecíveis. Confirmar se nomes de módulos devem continuar em inglês em todos os menus. Nomes próprios, níveis e códigos não foram traduzidos.
3. **Idiomas fixos e mensagens antigas**: existem captions com inglês, português, EN-US e PT-BR fixos em treino avançado, revisão, impressão e Shadowing. As traduções preservam esse significado atual; torná-los dinâmicos é decisão de integração posterior. Shadowing ainda orienta mudar o idioma no cabeçalho, apesar de o seletor ter sido movido ao menu. A frase não foi silenciosamente atualizada.
4. **Codificação**: StoryShadowing contém “Controles de reprodu??o mobile”, “Pr?ximo” e “Configura??es”. As versões pt-BR dos recursos recuperam o sentido claro; o fonte permanece intacto. Validar os rótulos na Fase 2.
5. **Voz**: instruções faladas de Walking Mode/Shadowing seguem o idioma estudado e foram excluídas dos captions Source. A integração não deve trocar inadvertidamente a língua do áudio ao alterar a língua da interface.
6. **Erros externos**: textos retornados por Google/Gemini, feedback gerado por IA e mensagens de exceções do navegador não são um conjunto fechado de traduções. Os wrappers fixos foram incluídos; detalhes externos devem ter tratamento próprio. Há mensagens de validação de geração que hoje interpolam identificadores; na futura interface, preferir nomes/descrições e não apresentar UUIDs.
7. **Tom**: português brasileiro e espanhol usam tratamento próximo; francês usa vous; inglês usa instruções diretas. Recomenda-se revisão por falantes nativos antes da aprovação editorial.
8. **Impressão e editor**: revisar quebra de linha e expansão dos captions, inclusive tooltips e botões, em viewport mobile. O material ainda não foi integrado e não há teste visual de traduções em tela nesta fase.

## Exclusões e limites

- JSONs de intenções, histórias, verbos, adjetivos, substantivos e demais materiais pedagógicos: intention, examples, searchTerms, tags, description, pattern, englishLevel e allowLanguageChunkPractice não são captions. Nenhum desses arquivos foi editado.
- Formas e desafios de config/speakingGameForms.ts, nomes nativos de tempos verbais específicos (como Passé composé/Pretérito indefinido), padrões de validação e falas de utils/walkingAudio.ts/useStoryShadowing.ts são conteúdo de estudo/áudio Target; não devem seguir Source automaticamente. Rótulos genéricos de gramática usados na interface foram incluídos.
- Prompts de geração/avaliação de IA, schemas enviados aos provedores, prompts de HQ copiados pelo autor e instruções de nome de PNG: excluídos por serem instruções técnicas/pedagógicas, não interface. Botões, feedback de cópia e erros relacionados estão incluídos.
- IDs, UUIDs, URLs, nomes de variáveis, propriedades, enums, seletores CSS, classes, media queries, CSS embutido e paths: excluídos por serem código. O HTML de impressão foi revisado para separar captions do código.
- Logs de diagnóstico e mensagens exclusivas de console: excluídos por não serem apresentados ao estudante.
- Marcas isoladas, símbolos gráficos, números de exemplo, códigos de idioma, níveis CEFR, unidades tipográficas px e valores temporais sem palavras: preservados como identidade/formatação; não geram chaves artificiais. Descrições HTML e captions compostos contendo marcas foram incluídos quando há texto traduzível.
- Textos que dependem apenas de dados carregados ou do usuário não são enumeráveis nesta auditoria. Não se promete cobertura de conteúdo gerado em runtime ou vindo de APIs. Não foram encontrados captions fixos traduzíveis em CSS.
- Os textos fixos de interface identificados no escopo selecionado estão mapeados abaixo. A análise estática com revisão contextual não substitui uma varredura visual de todos os estados de erro, janelas de impressão e pop-ups na integração.

## Validação

Validação local dos quatro JSONs: sintaxe válida; propriedades duplicadas verificadas recursivamente na AST JSON; conjuntos de chaves idênticos; zero valores vazios; variáveis idênticas por chave; todas as famílias plurais com one/other/many em cada idioma. Nenhuma dependência instalada. Build: aprovado com `npm run build` (TypeScript e Vite). Permanece o aviso de bundle acima de 500 kB. O bundle da interface manteve o mesmo resultado, pois os recursos ainda não foram integrados.

## Limpeza dos artefatos de trabalho

Removidos após a validação: `.tmp-build-i18n.cjs`, `.tmp-final-i18n.cjs`, `.tmp-i18n-audit.cjs`, `.tmp-i18n-audit.json`, `.tmp-i18n-extra.json`, `.tmp-i18n-selected.json` e `.tmp-i18n-translations.tsv`. Nenhum temporário foi retido. O status final contém somente os quatro dicionários e este relatório, todos novos; nenhum arquivo original foi alterado.

## Inventário rastreável

Os locais referem-se ao fonte existente, que não foi modificado. A mesma ocorrência pode aparecer em chaves condicionais/plurais sem duplicar a contagem de cobertura. Textos são os valores-base preparados em pt-BR, não alterações aplicadas ao JSX.

| Chave | Texto-base pt-BR | Arquivos e linhas | Variáveis |
| --- | --- | --- | --- |
| advancedTraining.adjectives | Adjetivos | src/components/AdvancedTraining.tsx:1097<br>src/components/AdvancedTraining.tsx:2393 | — |
| advancedTraining.advancedPracticeRequiresAtLeast2Verbs2Adjectives2 | O treino avançado precisa de pelo menos 2 verbos, 2 adjetivos, 2 substantivos e 4 conectores. | src/components/AdvancedTraining.tsx:1045 | — |
| advancedTraining.advancedPracticeResults | Resultado do treino avançado | src/components/AdvancedTraining.tsx:1842 | — |
| advancedTraining.availableConnectors | Conectores disponíveis | src/components/AdvancedTraining.tsx:1123 | — |
| advancedTraining.availableConnectorsEnUsPtBr | Conectores disponíveis (EN-US / PT-BR) | src/components/AdvancedTraining.tsx:2413 | — |
| advancedTraining.brazilianEnglishJourneyAdvancedPractice | Brazilian English Journey · Treino avançado | src/components/AdvancedTraining.tsx:2349<br>src/components/AdvancedTraining.tsx:712 (template de impressão) | — |
| advancedTraining.clearSentence1 | Limpar frase 1 | src/components/AdvancedTraining.tsx:1210<br>src/components/AdvancedTraining.tsx:1211 | — |
| advancedTraining.clearSentence2 | Limpar frase 2 | src/components/AdvancedTraining.tsx:1388<br>src/components/AdvancedTraining.tsx:1389 | — |
| advancedTraining.combineTheTwoIdeas | Junte as duas ideias | src/components/AdvancedTraining.tsx:1511<br>src/components/AdvancedTraining.tsx:2431 | — |
| advancedTraining.completeBothSentencesAndTheCombinedVersionBeforeRequestingAn | Preencha as duas frases e a versão combinada antes de solicitar a avaliação. | src/components/AdvancedTraining.tsx:755 | — |
| advancedTraining.copySentence1 | Copiar frase 1 | src/components/AdvancedTraining.tsx:1166 | — |
| advancedTraining.copySentence1ToTheClipboard | Copiar frase 1 para a área de transferência | src/components/AdvancedTraining.tsx:1169 | — |
| advancedTraining.copySentence2 | Copiar frase 2 | src/components/AdvancedTraining.tsx:1344 | — |
| advancedTraining.copySentence2ToTheClipboard | Copiar frase 2 para a área de transferência | src/components/AdvancedTraining.tsx:1347 | — |
| advancedTraining.couldNotCopySentence1 | Não foi possível copiar a frase 1 | src/components/AdvancedTraining.tsx:1165<br>src/components/AdvancedTraining.tsx:1317 | — |
| advancedTraining.couldNotCopySentence2 | Não foi possível copiar a frase 2 | src/components/AdvancedTraining.tsx:1343<br>src/components/AdvancedTraining.tsx:1495 | — |
| advancedTraining.couldNotEvaluateTheAdvancedPractice | Não foi possível avaliar o treino avançado. | src/components/AdvancedTraining.tsx:794 | — |
| advancedTraining.couldNotEvaluateThePractice | Não foi possível avaliar o treino. | src/components/AdvancedTraining.tsx:1832 | — |
| advancedTraining.createTheFirstSentenceInTargetlanguage | Crie a primeira frase em {{targetLanguage}}... | src/components/AdvancedTraining.tsx:1305 | targetLanguage |
| advancedTraining.createTheSecondSentenceInTargetlanguage | Crie a segunda frase em {{targetLanguage}}... | src/components/AdvancedTraining.tsx:1483 | targetLanguage |
| advancedTraining.createTwoIndependentSentencesUsingTheRandomlySelectedItemsThen | Crie duas frases independentes usando os elementos sorteados. Depois escolha um ou mais conectores para juntar as ideias em uma frase mais complexa. | src/components/AdvancedTraining.tsx:1021 | — |
| advancedTraining.createTwoSentencesInEnglishUsingTheRandomlySelectedVocabulary | Crie duas frases em inglês com o vocabulário sorteado. Depois use um ou mais conectores para juntá-las. | src/components/AdvancedTraining.tsx:2429 | — |
| advancedTraining.dictateSentence1InEnglish | Ditar frase 1 em inglês | src/components/AdvancedTraining.tsx:1253<br>src/components/AdvancedTraining.tsx:1258 | — |
| advancedTraining.dictateSentence2InEnglish | Ditar frase 2 em inglês | src/components/AdvancedTraining.tsx:1431<br>src/components/AdvancedTraining.tsx:1436 | — |
| advancedTraining.notEnoughVocabulary | Vocabulário insuficiente. | src/components/AdvancedTraining.tsx:1043 | — |
| advancedTraining.nouns | Substantivos | src/components/AdvancedTraining.tsx:1110<br>src/components/AdvancedTraining.tsx:2402 | — |
| advancedTraining.printAdvancedPractice | Impressão do treino avançado | src/components/AdvancedTraining.tsx:703 | — |
| advancedTraining.printAdvancedPracticeWorksheet | Imprimir folha de exercícios do treino avançado | src/components/AdvancedTraining.tsx:1690 | — |
| advancedTraining.sentence1 | Frase 1 | src/components/AdvancedTraining.tsx:1154<br>src/components/AdvancedTraining.tsx:2431 | — |
| advancedTraining.sentence1Copied | Frase 1 copiada! | src/components/AdvancedTraining.tsx:1163<br>src/components/AdvancedTraining.tsx:1317 | — |
| advancedTraining.sentence1CopiedToTheClipboard | Frase 1 copiada para a área de transferência | src/components/AdvancedTraining.tsx:1168 | — |
| advancedTraining.sentence2 | Frase 2 | src/components/AdvancedTraining.tsx:1332<br>src/components/AdvancedTraining.tsx:2431 | — |
| advancedTraining.sentence2Copied | Frase 2 copiada! | src/components/AdvancedTraining.tsx:1341<br>src/components/AdvancedTraining.tsx:1495 | — |
| advancedTraining.sentence2CopiedToTheClipboard | Frase 2 copiada para a área de transferência | src/components/AdvancedTraining.tsx:1346 | — |
| advancedTraining.stopDictatingSentence1 | Parar ditado da frase 1 | src/components/AdvancedTraining.tsx:1257 | — |
| advancedTraining.stopDictatingSentence2 | Parar ditado da frase 2 | src/components/AdvancedTraining.tsx:1435 | — |
| advancedTraining.useOneOrMoreConnectorsToCombineYourTwoSentences | Use um ou mais conectores para juntar suas duas frases... | src/components/AdvancedTraining.tsx:1726 | — |
| advancedTraining.verbs | Verbos | src/components/AdvancedTraining.tsx:1055<br>src/components/AdvancedTraining.tsx:2379 | — |
| advancedTraining.vocabularyAndConnectors | Vocabulário e conectores | src/components/AdvancedTraining.tsx:1872 | — |
| advancedTraining.writeTheCombinedSentenceBeforeRequestingATranslation | Escreva a frase combinada antes de solicitar a tradução. | src/components/AdvancedTraining.tsx:805 | — |
| app.checkForUpdates | Tentar atualizar | src/App.tsx:341 | — |
| app.couldNotAccessTheExternalSourceShowingTheLatestVersion | Não foi possível acessar a fonte externa. Exibindo a última versão salva localmente. | src/App.tsx:334 | — |
| app.couldNotLoadMentalHashmap | Não foi possível carregar o Mental Hashmap. | src/App.tsx:89<br>src/App.tsx:192<br>src/App.tsx:317 | — |
| app.loadingMentalHashmap | Carregando Mental Hashmap... | src/App.tsx:311 | — |
| app.results | Resultados | src/App.tsx:374 | — |
| app.tryAgain | Tentar novamente | src/App.tsx:325 | — |
| app.tryingAgain | Tentando novamente... | src/App.tsx:325 | — |
| basicTraining.brazilianEnglishJourneyBasicPractice | Brazilian English Journey · Treino básico | src/components/BasicTraining.tsx:598 (template de impressão)<br>src/components/BasicTraining.tsx:1863 | — |
| basicTraining.couldNotPlayTheExampleInLanguage | Não foi possível reproduzir o exemplo em {{language}}. | src/components/BasicTraining.tsx:367 | language |
| basicTraining.createASentenceInTargetlanguageUsingTheCommunicativeIntentionUse | Crie uma frase em {{targetLanguage}} usando a intenção mental. Use o exemplo em {{sourceLanguage}} como referência. Ao sortear novamente, outro exemplo será exibido, quando disponível. | src/components/BasicTraining.tsx:909 | sourceLanguage, targetLanguage |
| basicTraining.createASentenceUsingTheCommunicativeIntentionAndTryTo | Crie uma frase usando a intenção mental e tente incluir o verbo, o adjetivo e o substantivo sorteados abaixo. | src/components/BasicTraining.tsx:908 | — |
| basicTraining.createSentencesInEnglishUsingTheCommunicativeIntentionAndTry | Crie frases em inglês com a intenção mental e tente usar o verbo, o adjetivo e o substantivo sorteados. | src/components/BasicTraining.tsx:1920 | — |
| basicTraining.createSentencesInTargetlanguageUsingTheCommunicativeIntentionShownAbove | Crie frases em {{targetLanguage}} usando a intenção mental apresentada acima. | src/components/BasicTraining.tsx:1921 | targetLanguage |
| basicTraining.dictateASentenceInTargetlanguage | Ditar frase em {{targetLanguage}} | src/components/BasicTraining.tsx:1062<br>src/components/BasicTraining.tsx:1063 | targetLanguage |
| basicTraining.irregular | IRREGULAR | src/components/BasicTraining.tsx:937 | — |
| basicTraining.listen | Ouvir | src/components/BasicTraining.tsx:884<br>src/components/BasicTraining.tsx:895 | — |
| basicTraining.listening | Ouvindo | src/components/BasicTraining.tsx:884<br>src/components/BasicTraining.tsx:895 | — |
| basicTraining.listenInSourcelanguage | Ouvir em {{sourceLanguage}} | src/components/BasicTraining.tsx:883 | sourceLanguage |
| basicTraining.listenInTargetlanguage | Ouvir em {{targetLanguage}} | src/components/BasicTraining.tsx:894 | targetLanguage |
| basicTraining.listenToTheCorrectionInTargetlanguage | Ouvir a correção em {{targetLanguage}} | src/components/BasicTraining.tsx:1455<br>src/components/BasicTraining.tsx:1456 | targetLanguage |
| basicTraining.listenToTheExampleInSourcelanguage | Ouvir exemplo em {{sourceLanguage}} | src/components/BasicTraining.tsx:882 | sourceLanguage |
| basicTraining.listenToTheExampleInTargetlanguage | Ouvir exemplo em {{targetLanguage}} | src/components/BasicTraining.tsx:893 | targetLanguage |
| basicTraining.listenToTheMoreNaturalVersionInTargetlanguage | Ouvir a versão mais natural em {{targetLanguage}} | src/components/BasicTraining.tsx:1594<br>src/components/BasicTraining.tsx:1595 | targetLanguage |
| basicTraining.openCorrectionInGoogleTranslateFromTargetlanguageToSourcelanguage | Abrir correção no Google Tradutor de {{targetLanguage}} para {{sourceLanguage}} | src/components/BasicTraining.tsx:1536 | sourceLanguage, targetLanguage |
| basicTraining.openInGoogleTranslateTargetlanguageSourcelanguage | Abrir no Google Tradutor ({{targetLanguage}} → {{sourceLanguage}}) | src/components/BasicTraining.tsx:1158 | sourceLanguage, targetLanguage |
| basicTraining.openSentenceInGoogleTranslateFromTargetlanguageToSourcelanguage | Abrir frase no Google Tradutor de {{targetLanguage}} para {{sourceLanguage}} | src/components/BasicTraining.tsx:1159 | sourceLanguage, targetLanguage |
| basicTraining.openTheMoreNaturalVersionInGoogleTranslateFromTargetlanguage | Abrir versão mais natural no Google Tradutor de {{targetLanguage}} para {{sourceLanguage}} | src/components/BasicTraining.tsx:1675 | sourceLanguage, targetLanguage |
| basicTraining.printBasicPracticeWorksheet | Imprimir folha de exercícios do treino básico | src/components/BasicTraining.tsx:1193 | — |
| basicTraining.regular | REGULAR | src/components/BasicTraining.tsx:937 | — |
| basicTraining.source | Origem: | src/components/BasicTraining.tsx:876<br>src/components/BasicTraining.tsx:1872 | — |
| basicTraining.study | Estudo: | src/components/BasicTraining.tsx:887<br>src/components/BasicTraining.tsx:1876 | — |
| basicTraining.translateCorrectionInGoogleTranslateTargetlanguageSourcelanguage | Traduzir correção no Google Tradutor ({{targetLanguage}} → {{sourceLanguage}}) | src/components/BasicTraining.tsx:1535 | sourceLanguage, targetLanguage |
| basicTraining.translateTheMoreNaturalVersionInGoogleTranslateTargetlanguageSourcelanguage | Traduzir versão mais natural no Google Tradutor ({{targetLanguage}} → {{sourceLanguage}}) | src/components/BasicTraining.tsx:1674 | sourceLanguage, targetLanguage |
| basicTraining.verb | Verbo | src/components/BasicTraining.tsx:936<br>src/components/BasicTraining.tsx:1894 | — |
| basicTraining.versionIn | Versão em | src/components/BasicTraining.tsx:1347 | — |
| catalog.couldNotLoadMentalHashmapLanguageHttpStatus | Não foi possível carregar Mental Hashmap ({{language}}). HTTP {{status}} | src/services/hashmapService.ts:93 | language, status |
| catalog.invalidJsonLanguageInvalidMentalIntentionsOrExamples | JSON inválido ({{language}}): intenções ou exemplos inválidos. | src/services/hashmapService.ts:85 | language |
| catalog.invalidJsonLanguageMetadataOrMentalmapNotFound | JSON inválido ({{language}}): metadata ou mentalMap não encontrado. | src/services/hashmapService.ts:79 | language |
| catalog.invalidJsonLanguageSchemaversionOrMetadataLanguageMismatch | JSON inválido ({{language}}): schemaVersion ou metadata.language incompatível. | src/services/hashmapService.ts:82 | language |
| catalog.theSourceAndStudyLanguagesMustBeDifferent | Idioma de origem e idioma de estudo devem ser diferentes. | src/services/hashmapService.ts:178 | — |
| common.aboutTheApp | Sobre o app | src/components/AppSettingsDialog.tsx:39<br>src/components/Sidebar.tsx:93 | — |
| common.adjective | Adjetivo | src/components/BasicTraining.tsx:977<br>src/components/SpeakingGamePlayStep.tsx:211<br>src/components/BasicTraining.tsx:1904 | — |
| common.advancedPractice | Treino avançado | src/components/AdvancedTraining.tsx:992<br>src/components/ChunkFlashcards.tsx:354<br>src/components/ExercisePanel.tsx:335<br>src/components/IntentionDetails.tsx:940 | — |
| common.aiEvaluation | Avaliação com IA | src/components/AdvancedTraining.tsx:1841<br>src/components/BasicTraining.tsx:1383<br>src/components/ReviewTraining.tsx:1051 | — |
| common.aiReturnedAnUnexpectedResponseFormat | A IA retornou uma resposta em formato inesperado. | src/services/aiEvaluationService.ts:273<br>src/services/storyGenerationService.ts:376 | — |
| common.allLevels | Todos os níveis | src/components/ChunkLevelSelect.tsx:11<br>src/components/MemoryFlashcards.tsx:114 | — |
| common.allowMicrophoneAccessInYourBrowserToUseDictation | Permita o acesso ao microfone no navegador para usar o ditado. | src/components/AdvancedTraining.tsx:506<br>src/components/BasicTraining.tsx:445<br>src/components/ReviewTraining.tsx:234 | — |
| common.anUnexpectedErrorOccurredWhileLoadingVocabulary | Erro inesperado ao carregar o vocabulário. | src/components/AdvancedTraining.tsx:347<br>src/components/BasicTraining.tsx:277 | — |
| common.automatic | Automático | src/components/SpeakingGameSetupStep.tsx:78<br>src/components/StoryShadowing.tsx:15 | — |
| common.automaticValidationIsUnavailableForThisIntention | Validação automática indisponível para esta intenção. | src/components/AdvancedTraining.tsx:224<br>src/components/BasicTraining.tsx:1290<br>src/components/IntentionValidationFeedback.tsx:25<br>src/components/ReviewTraining.tsx:958 | — |
| common.backToHashmap | Voltar para o Hashmap | src/components/AdvancedTraining.tsx:977<br>src/components/BasicTraining.tsx:853<br>src/components/ReviewTraining.tsx:633 | — |
| common.basicPractice | Treino básico | src/components/BasicTraining.tsx:868<br>src/components/ChunkFlashcards.tsx:345<br>src/components/ExercisePanel.tsx:322<br>src/components/IntentionDetails.tsx:932 | — |
| common.category | Categoria | src/components/ExercisePanel.tsx:365<br>src/components/SearchPanel.tsx:198 | — |
| common.chunkFlashcards | Chunk Flashcards | src/components/ChunkFlashcards.tsx:413<br>src/components/SearchPanel.tsx:241<br>src/components/Sidebar.tsx:28 | — |
| common.chunkPositionInTheRound | Posição do chunk na rodada | src/components/ChunkFlashcards.tsx:475<br>src/components/WalkingMode.tsx:148 | — |
| common.clearSentence | Limpar frase | src/components/AdvancedTraining.tsx:1519<br>src/components/AdvancedTraining.tsx:1520<br>src/components/BasicTraining.tsx:1022<br>src/components/BasicTraining.tsx:1023<br>src/components/ReviewTraining.tsx:691<br>src/components/ReviewTraining.tsx:692 | — |
| common.close | Fechar | src/components/AppSettingsDialog.tsx:40<br>src/components/ConnectedSpeechStudio.tsx:171<br>src/components/IntentionDetails.tsx:1445<br>src/components/InterpretationPanel.tsx:1512<br>src/components/InterpretationPanel.tsx:2386 | — |
| common.closeComic | Fechar HQ | src/components/IntentionDetails.tsx:1802<br>src/components/InterpretationPanel.tsx:2309 | — |
| common.comic | HQ | src/components/InterpretationPanel.tsx:179<br>src/components/InterpretationPanel.tsx:437<br>src/components/SearchPanel.tsx:231 | — |
| common.comicVerticalMovementControls | Controles de movimento vertical da HQ | src/components/IntentionDetails.tsx:1645<br>src/components/InterpretationPanel.tsx:2152 | — |
| common.comicZoomControls | Controles de zoom da HQ | src/components/IntentionDetails.tsx:1709<br>src/components/InterpretationPanel.tsx:2216 | — |
| common.communicativeIntention | Intenção mental | src/components/AdvancedTraining.tsx:1863<br>src/components/BasicTraining.tsx:1405<br>src/components/ReviewTraining.tsx:1073<br>src/components/IntentionDetails.tsx:851 | — |
| common.communicativeIntentionIdentified | Intenção mental identificada! | src/components/AdvancedTraining.tsx:221<br>src/components/BasicTraining.tsx:1287<br>src/components/IntentionValidationFeedback.tsx:17<br>src/components/ReviewTraining.tsx:955 | — |
| common.copyCorrection | Copiar correção | src/components/AdvancedTraining.tsx:1946<br>src/components/BasicTraining.tsx:1488<br>src/components/ReviewTraining.tsx:1148 | — |
| common.copyCorrectionToTheClipboard | Copiar correção para a área de transferência | src/components/AdvancedTraining.tsx:1952<br>src/components/BasicTraining.tsx:1494<br>src/components/ReviewTraining.tsx:1154 | — |
| common.copyError | Erro ao copiar | src/components/AdvancedTraining.tsx:1607<br>src/components/BasicTraining.tsx:1110<br>src/components/InterpretationPanel.tsx:864<br>src/components/ReviewTraining.tsx:779 | — |
| common.copyIntentionId | Copiar ID da intenção | src/components/IntentionCard.tsx:128<br>src/components/IntentionDetails.tsx:970<br>src/components/IntentionDetails.tsx:971 | — |
| common.copyIntentionIdForIntention | Copiar ID da intenção {{intention}} | src/components/ChunkFlashcards.tsx:332<br>src/components/IntentionCard.tsx:129 | intention |
| common.copySentence | Copiar frase | src/components/AdvancedTraining.tsx:1608<br>src/components/BasicTraining.tsx:1111<br>src/components/ReviewTraining.tsx:780 | — |
| common.copySentenceToTheClipboard | Copiar frase para a área de transferência | src/components/AdvancedTraining.tsx:1615<br>src/components/BasicTraining.tsx:1118<br>src/components/ReviewTraining.tsx:787 | — |
| common.copyTheMoreNaturalVersion | Copiar versão mais natural | src/components/AdvancedTraining.tsx:2085<br>src/components/BasicTraining.tsx:1627<br>src/components/ReviewTraining.tsx:1287 | — |
| common.copyTheMoreNaturalVersionToTheClipboard | Copiar versão mais natural para a área de transferência | src/components/AdvancedTraining.tsx:2091<br>src/components/BasicTraining.tsx:1633<br>src/components/ReviewTraining.tsx:1293 | — |
| common.correct | Correta | src/components/AdvancedTraining.tsx:1866<br>src/components/BasicTraining.tsx:1408<br>src/components/ReviewTraining.tsx:1076 | — |
| common.correction | Correção | src/components/AdvancedTraining.tsx:1887<br>src/components/BasicTraining.tsx:1429<br>src/components/ReviewTraining.tsx:1089 | — |
| common.couldNotCopyTheSentence | Não foi possível copiar a frase. | src/components/AdvancedTraining.tsx:602<br>src/components/AdvancedTraining.tsx:638<br>src/components/BasicTraining.tsx:522<br>src/components/ReviewTraining.tsx:310<br>src/components/AdvancedTraining.tsx:1945<br>src/components/AdvancedTraining.tsx:2084<br>src/components/BasicTraining.tsx:1487<br>src/components/BasicTraining.tsx:1626<br>src/components/ReviewTraining.tsx:1147<br>src/components/ReviewTraining.tsx:1286 | — |
| common.couldNotEvaluateTheSentence | Não foi possível avaliar a frase. | src/components/BasicTraining.tsx:670<br>src/components/BasicTraining.tsx:1373<br>src/components/ReviewTraining.tsx:450<br>src/components/ReviewTraining.tsx:1041 | — |
| common.couldNotKeepTheScreenAwake | Não foi possível manter a tela ativa. | src/components/WalkingMode.tsx:118<br>src/hooks/useStoryShadowing.ts:144 | — |
| common.couldNotLoadTheComicImage | Não foi possível carregar a imagem da HQ. | src/components/IntentionDetails.tsx:467<br>src/components/InterpretationPanel.tsx:902 | — |
| common.couldNotLoadThePractice | Não foi possível carregar o treino. | src/components/AdvancedTraining.tsx:1036<br>src/components/BasicTraining.tsx:922 | — |
| common.couldNotLoadTheVocabularyFiles | Não foi possível carregar os arquivos de vocabulário. | src/components/AdvancedTraining.tsx:320<br>src/components/BasicTraining.tsx:253 | — |
| common.couldNotPlayTheAudio | Não foi possível reproduzir o áudio. | src/components/AdvancedTraining.tsx:1825<br>src/components/BasicTraining.tsx:1366<br>src/components/IntentionDetails.tsx:1341<br>src/components/InterpretationPanel.tsx:1811<br>src/components/ReviewTraining.tsx:1034 | — |
| common.couldNotPlayTheSentenceInTargetlanguage | Não foi possível reproduzir a frase em {{targetLanguage}}. | src/components/AdvancedTraining.tsx:873<br>src/components/AdvancedTraining.tsx:963<br>src/components/BasicTraining.tsx:749<br>src/components/BasicTraining.tsx:839<br>src/components/ReviewTraining.tsx:529<br>src/components/ReviewTraining.tsx:619 | targetLanguage |
| common.couldNotRecognizeYourSpeechTryAgain | Não foi possível reconhecer sua fala. Tente novamente. | src/components/AdvancedTraining.tsx:518<br>src/components/BasicTraining.tsx:457<br>src/components/ReviewTraining.tsx:246 | — |
| common.couldNotShareTheComicOnThisDevice | Não foi possível compartilhar a HQ neste dispositivo. | src/components/IntentionDetails.tsx:511<br>src/components/InterpretationPanel.tsx:946 | — |
| common.couldNotStartTheMicrophone | Não foi possível iniciar o microfone. | src/components/AdvancedTraining.tsx:535<br>src/components/BasicTraining.tsx:472<br>src/components/ReviewTraining.tsx:261 | — |
| common.couldNotTranslateTheSentence | Não foi possível traduzir a frase. | src/components/AdvancedTraining.tsx:1797<br>src/components/BasicTraining.tsx:1338<br>src/components/ReviewTraining.tsx:1006 | — |
| common.couldNotTranslateTheSentenceWithGoogle | Não foi possível traduzir a frase com o Google. | src/components/AdvancedTraining.tsx:821<br>src/components/BasicTraining.tsx:697<br>src/components/ReviewTraining.tsx:477 | — |
| common.countOfTotal | {{count}} de {{total}} | src/components/ChunkFlashcards.tsx:513<br>src/components/StoryShadowing.tsx:53 | count, total |
| common.dictateASentenceInEnglish | Ditar frase em inglês | src/components/AdvancedTraining.tsx:1559<br>src/components/AdvancedTraining.tsx:1560<br>src/components/ReviewTraining.tsx:731<br>src/components/ReviewTraining.tsx:732 | — |
| common.drawAgain | Sortear novamente | src/components/AdvancedTraining.tsx:986<br>src/components/AdvancedTraining.tsx:2173<br>src/components/BasicTraining.tsx:862<br>src/components/BasicTraining.tsx:1712<br>src/components/ExercisePanel.tsx:414 | — |
| common.englishLevel | Nível de inglês | src/components/ExercisePanel.tsx:344<br>src/components/InterpretationPanel.tsx:1350 | — |
| common.errorAccessingAiStatus | Erro ao acessar a IA ({{status}}). | src/services/aiEvaluationService.ts:245<br>src/services/storyGenerationService.ts:344 | status |
| common.errorCopyingTheSentence | Erro ao copiar a frase | src/components/AdvancedTraining.tsx:1614<br>src/components/BasicTraining.tsx:1117<br>src/components/ReviewTraining.tsx:786 | — |
| common.evaluateWithAi | Avaliar com IA | src/components/AdvancedTraining.tsx:1776<br>src/components/BasicTraining.tsx:1317<br>src/components/ReviewTraining.tsx:985 | — |
| common.evaluatingWithAi | Avaliando com IA... | src/components/AdvancedTraining.tsx:1775<br>src/components/BasicTraining.tsx:1316<br>src/components/ReviewTraining.tsx:984 | — |
| common.example | Exemplo | src/components/AdvancedTraining.tsx:998<br>src/components/AdvancedTraining.tsx:2356<br>src/components/BasicTraining.tsx:874<br>src/components/BasicTraining.tsx:1870<br>src/components/ReviewTraining.tsx:645<br>src/components/ReviewTraining.tsx:1484 | — |
| common.exercises | Exercícios | src/components/ExercisePanel.tsx:281<br>src/components/Sidebar.tsx:24 | — |
| common.failedToCopyId | Falha ao copiar ID | src/components/IntentionCard.tsx:53<br>src/components/IntentionDetails.tsx:302 | — |
| common.failedToCopyTheSentence | Falha ao copiar a frase. | src/components/AdvancedTraining.tsx:901<br>src/components/BasicTraining.tsx:777<br>src/components/ReviewTraining.tsx:557 | — |
| common.feedback | Comentários | src/components/AdvancedTraining.tsx:1882<br>src/components/BasicTraining.tsx:1424<br>src/components/ReviewTraining.tsx:1084 | — |
| common.goodUse | Bom uso | src/components/AdvancedTraining.tsx:1875<br>src/components/BasicTraining.tsx:1417 | — |
| common.googleTranslation | Tradução do Google | src/components/AdvancedTraining.tsx:1805<br>src/components/BasicTraining.tsx:1346<br>src/components/ReviewTraining.tsx:1014 | — |
| common.grammar | Gramática | src/components/AdvancedTraining.tsx:1853<br>src/components/BasicTraining.tsx:1395<br>src/components/ReviewTraining.tsx:1063 | — |
| common.idCopied | ID copiado | src/components/ChunkFlashcards.tsx:332<br>src/components/IntentionCard.tsx:129<br>src/components/IntentionDetails.tsx:971<br>src/components/ChunkFlashcards.tsx:333<br>src/components/IntentionCard.tsx:128<br>src/components/IntentionDetails.tsx:970 | — |
| common.intentionIntention | Intenção: {{intention}} | src/components/IntentionDetails.tsx:962<br>src/services/storyGenerationService.ts:114 | intention |
| common.interpretation | Interpretação | src/components/InterpretationPanel.tsx:1329<br>src/components/Sidebar.tsx:40 | — |
| common.level | Nível | src/components/IntentionDetails.tsx:867<br>src/components/InterpretationPanel.tsx:1448<br>src/components/SearchPanel.tsx:217 | — |
| common.listenInTargetlanguage | Ouvir {{targetLanguage}} | src/components/AdvancedTraining.tsx:1817<br>src/components/BasicTraining.tsx:1358<br>src/components/InterpretationPanel.tsx:1789<br>src/components/ReviewTraining.tsx:1026 | targetLanguage |
| common.listenToTheCorrectionInEnglish | Ouvir a correção em inglês | src/components/AdvancedTraining.tsx:1913<br>src/components/AdvancedTraining.tsx:1914<br>src/components/ReviewTraining.tsx:1115<br>src/components/ReviewTraining.tsx:1116 | — |
| common.listenToTheMoreNaturalVersionInEnglish | Ouvir a versão mais natural em inglês | src/components/AdvancedTraining.tsx:2052<br>src/components/AdvancedTraining.tsx:2053<br>src/components/ReviewTraining.tsx:1254<br>src/components/ReviewTraining.tsx:1255 | — |
| common.loadingVocabulary | Carregando vocabulário... | src/components/AdvancedTraining.tsx:1030<br>src/components/BasicTraining.tsx:916 | — |
| common.manual | Manual | src/components/SpeakingGameSetupStep.tsx:64<br>src/components/StoryShadowing.tsx:15 | — |
| common.moreNaturalVersion | Versão mais natural | src/components/AdvancedTraining.tsx:2026<br>src/components/BasicTraining.tsx:1568<br>src/components/ReviewTraining.tsx:1228 | — |
| common.moveComicDown | Mover HQ para baixo | src/components/IntentionDetails.tsx:1687<br>src/components/InterpretationPanel.tsx:2194 | — |
| common.moveComicUp | Mover HQ para cima | src/components/IntentionDetails.tsx:1666<br>src/components/InterpretationPanel.tsx:2173 | — |
| common.moveDown | Mover para baixo | src/components/IntentionDetails.tsx:1688<br>src/components/InterpretationPanel.tsx:2195 | — |
| common.moveUp | Mover para cima | src/components/IntentionDetails.tsx:1667<br>src/components/InterpretationPanel.tsx:2174 | — |
| common.myWritingPractice | Minha prática escrita | src/components/AdvancedTraining.tsx:2427<br>src/components/BasicTraining.tsx:1917<br>src/components/ReviewTraining.tsx:1504 | — |
| common.naturalness | Naturalidade | src/components/AdvancedTraining.tsx:1858<br>src/components/BasicTraining.tsx:1400<br>src/components/ReviewTraining.tsx:1068 | — |
| common.needsImprovement | Precisa melhorar | src/components/AdvancedTraining.tsx:1867<br>src/components/AdvancedTraining.tsx:1876<br>src/components/BasicTraining.tsx:1409<br>src/components/BasicTraining.tsx:1418<br>src/components/ReviewTraining.tsx:1077 | — |
| common.next | Próximo | src/components/ChunkFlashcards.tsx:540<br>src/components/SpeakingGamePlayStep.tsx:275<br>src/components/StoryShadowing.tsx:72<br>src/components/StoryShadowing.tsx:80 | — |
| common.noChunksAvailableForLevelLevel | Nenhum chunk disponível para o nível {{level}}. | src/components/ChunkFlashcards.tsx:503<br>src/components/WalkingMode.tsx:152 | level |
| common.noSpeechDetectedClickTheMicrophoneAndTryAgain | Nenhuma fala foi detectada. Clique no microfone e tente novamente. | src/components/AdvancedTraining.tsx:513<br>src/components/BasicTraining.tsx:452<br>src/components/ReviewTraining.tsx:241 | — |
| common.noun | Substantivo | src/components/BasicTraining.tsx:989<br>src/components/SpeakingGamePlayStep.tsx:228<br>src/components/BasicTraining.tsx:1909 | — |
| common.openCorrectionInGoogleTranslateFromEnglishToPortuguese | Abrir correção no Google Tradutor do inglês para português | src/components/AdvancedTraining.tsx:1994<br>src/components/ReviewTraining.tsx:1196 | — |
| common.openInGoogleTranslateEnglishPortuguese | Abrir no Google Tradutor (inglês → português) | src/components/AdvancedTraining.tsx:1655<br>src/components/ReviewTraining.tsx:827 | — |
| common.openSentenceInGoogleTranslateFromEnglishToPortuguese | Abrir frase no Google Tradutor do inglês para português | src/components/AdvancedTraining.tsx:1656<br>src/components/ReviewTraining.tsx:828 | — |
| common.openTheMoreNaturalVersionInGoogleTranslateFromEnglish | Abrir versão mais natural no Google Tradutor do inglês para português | src/components/AdvancedTraining.tsx:2133<br>src/components/ReviewTraining.tsx:1335 | — |
| common.participle | Particípio | src/components/AdvancedTraining.tsx:1085<br>src/components/BasicTraining.tsx:968<br>src/components/SpeakingGamePlayStep.tsx:106<br>src/components/SpeakingGamePlayStep.tsx:109<br>src/components/AdvancedTraining.tsx:2387<br>src/components/BasicTraining.tsx:1900 | — |
| common.past | Passado | src/components/AdvancedTraining.tsx:1078<br>src/components/BasicTraining.tsx:961<br>src/components/AdvancedTraining.tsx:2386<br>src/components/BasicTraining.tsx:1899 | — |
| common.pause | Pausar | src/components/SpeakingGamePlayStep.tsx:371<br>src/components/StoryShadowing.tsx:79<br>src/components/WalkingMode.tsx:158<br>src/components/StoryShadowing.tsx:71 | — |
| common.paused | Pausado | src/components/SpeakingGamePlayStep.tsx:296<br>src/components/WalkingMode.tsx:153 | — |
| common.playing | Reproduzindo... | src/components/AdvancedTraining.tsx:1817<br>src/components/BasicTraining.tsx:1358<br>src/components/InterpretationPanel.tsx:1789<br>src/components/ReviewTraining.tsx:1026<br>src/components/StoryShadowing.tsx:66 | — |
| common.portugueseVersion | Versão em português | src/components/AdvancedTraining.tsx:1806<br>src/components/ReviewTraining.tsx:1015 | — |
| common.practiceResults | Resultado do treino | src/components/BasicTraining.tsx:1384<br>src/components/ReviewTraining.tsx:1052 | — |
| common.present | Presente | src/components/AdvancedTraining.tsx:1068<br>src/components/BasicTraining.tsx:951<br>src/components/AdvancedTraining.tsx:2385<br>src/components/BasicTraining.tsx:1898 | — |
| common.previous | Anterior | src/components/SpeakingGameReadyStep.tsx:93<br>src/components/SpeakingGameSetupStep.tsx:156<br>src/components/StoryShadowing.tsx:69<br>src/components/StoryShadowing.tsx:78 | — |
| common.print | Imprimir | src/components/ConnectedSpeechStudio.tsx:170<br>src/components/IntentionDetails.tsx:959 | — |
| common.printComic | Imprimir HQ | src/components/IntentionDetails.tsx:1539<br>src/components/IntentionDetails.tsx:1540<br>src/components/InterpretationPanel.tsx:2046<br>src/components/InterpretationPanel.tsx:2047 | — |
| common.printWorksheet | Impressão da folha de exercícios | src/components/BasicTraining.tsx:588<br>src/components/ReviewTraining.tsx:375 | — |
| common.printWorksheetA4 | Imprimir folha de exercícios (A4) | src/components/AdvancedTraining.tsx:1689<br>src/components/BasicTraining.tsx:1192<br>src/components/ReviewTraining.tsx:861 | — |
| common.resetComicZoomTo100 | Restaurar zoom da HQ para 100% | src/components/IntentionDetails.tsx:1753<br>src/components/InterpretationPanel.tsx:2260 | — |
| common.resetZoomTo100 | Restaurar zoom para 100% | src/components/IntentionDetails.tsx:1754<br>src/components/InterpretationPanel.tsx:2261 | — |
| common.resume | Continuar | src/components/SpeakingGamePlayStep.tsx:371<br>src/components/StoryShadowing.tsx:79<br>src/components/WalkingMode.tsx:158 | — |
| common.review | Revisão | src/components/IntentionDetails.tsx:948<br>src/components/ReviewTraining.tsx:639 | — |
| common.searchStories | Pesquisar histórias | src/components/InterpretationPanel.tsx:1478<br>src/components/StoryShadowing.tsx:125 | — |
| common.selectedVocabulary | Vocabulário sorteado | src/components/BasicTraining.tsx:1414<br>src/components/SpeakingGamePlayStep.tsx:209 | — |
| common.sentenceCopied | Frase copiada | src/components/AdvancedTraining.tsx:1605<br>src/components/AdvancedTraining.tsx:1612<br>src/components/BasicTraining.tsx:1108<br>src/components/BasicTraining.tsx:1115<br>src/components/IntentionDetails.tsx:1188<br>src/components/ReviewTraining.tsx:777<br>src/components/ReviewTraining.tsx:784<br>src/components/AdvancedTraining.tsx:1944<br>src/components/AdvancedTraining.tsx:2083<br>src/components/BasicTraining.tsx:1486<br>src/components/BasicTraining.tsx:1625<br>src/components/ReviewTraining.tsx:1146<br>src/components/ReviewTraining.tsx:1285 | — |
| common.sentenceCopiedToTheClipboard | Frase copiada para a área de transferência | src/components/AdvancedTraining.tsx:1951<br>src/components/AdvancedTraining.tsx:2090<br>src/components/BasicTraining.tsx:1493<br>src/components/BasicTraining.tsx:1632<br>src/components/ReviewTraining.tsx:1153<br>src/components/ReviewTraining.tsx:1292 | — |
| common.shadowing | Shadowing | src/components/StoryShadowing.tsx:110<br>src/components/Sidebar.tsx:20 | — |
| common.shareComic | Compartilhar HQ | src/components/IntentionDetails.tsx:1581<br>src/components/IntentionDetails.tsx:1582<br>src/components/InterpretationPanel.tsx:2088<br>src/components/InterpretationPanel.tsx:2089 | — |
| common.sharingIsUnavailableInThisBrowser | O compartilhamento não está disponível neste navegador. | src/components/IntentionDetails.tsx:458<br>src/components/InterpretationPanel.tsx:893 | — |
| common.sourceLanguage | Idioma de origem | src/components/AppSettingsDialog.tsx:46<br>src/components/MemoryFlashcards.tsx:135 | — |
| common.speakingGame | Jogo da Fala | src/components/Sidebar.tsx:36<br>src/components/SpeakingGameReadyStep.tsx:40<br>src/components/SpeakingGameSetupStep.tsx:42 | — |
| common.speechPlaybackIsUnavailableInThisBrowser | O recurso de voz não está disponível neste navegador. | src/components/AdvancedTraining.tsx:838<br>src/components/AdvancedTraining.tsx:926<br>src/components/BasicTraining.tsx:346<br>src/components/BasicTraining.tsx:714<br>src/components/BasicTraining.tsx:802<br>src/components/IntentionDetails.tsx:227<br>src/components/InterpretationPanel.tsx:532<br>src/components/InterpretationPanel.tsx:616<br>src/components/ReviewTraining.tsx:494<br>src/components/ReviewTraining.tsx:582 | — |
| common.stop | Parar | src/components/SpeakingGamePlayStep.tsx:379<br>src/components/StoryShadowing.tsx:82<br>src/components/WalkingMode.tsx:160<br>src/components/StoryShadowing.tsx:74 | — |
| common.stopDictation | Parar ditado | src/components/AdvancedTraining.tsx:1252<br>src/components/AdvancedTraining.tsx:1430<br>src/components/AdvancedTraining.tsx:1559<br>src/components/AdvancedTraining.tsx:1560<br>src/components/BasicTraining.tsx:1062<br>src/components/BasicTraining.tsx:1063<br>src/components/ReviewTraining.tsx:731<br>src/components/ReviewTraining.tsx:732 | — |
| common.studyTime | Tempo de estudo | src/components/ChunkFlashcards.tsx:420<br>src/components/MemoryFlashcards.tsx:121<br>src/components/SpeakingGameReadyStep.tsx:48<br>src/components/WalkingMode.tsx:147 | — |
| common.thereIsNoSentenceInTargetlanguageToPlay | Não há uma frase em {{targetLanguage}} para reproduzir. | src/components/AdvancedTraining.tsx:832<br>src/components/AdvancedTraining.tsx:920<br>src/components/BasicTraining.tsx:708<br>src/components/BasicTraining.tsx:796<br>src/components/ReviewTraining.tsx:488<br>src/components/ReviewTraining.tsx:576 | targetLanguage |
| common.thisBrowserCannotKeepTheScreenAwake | Este navegador não permite manter a tela ativa. | src/components/WalkingMode.tsx:106<br>src/hooks/useStoryShadowing.ts:134 | — |
| common.thisFeatureIsOnlyAvailableInAuthorMode | Recurso exclusivo do Modo Autor. | src/services/aiEvaluationService.ts:199<br>src/services/googleTranslateService.ts:38 | — |
| common.translateCorrectionInGoogleTranslateEnglishPortuguese | Traduzir correção no Google Tradutor (inglês → português) | src/components/AdvancedTraining.tsx:1993<br>src/components/ReviewTraining.tsx:1195 | — |
| common.translateTheMoreNaturalVersionInGoogleTranslateEnglishPortuguese | Traduzir versão mais natural no Google Tradutor (inglês → português) | src/components/AdvancedTraining.tsx:2132<br>src/components/ReviewTraining.tsx:1334 | — |
| common.translateWithGoogle | Traduzir com Google | src/components/AdvancedTraining.tsx:1789<br>src/components/BasicTraining.tsx:1330<br>src/components/ReviewTraining.tsx:998 | — |
| common.typeYourSentenceInTargetlanguage | Digite sua frase em {{targetLanguage}}... | src/components/BasicTraining.tsx:1229<br>src/components/ReviewTraining.tsx:898 | targetLanguage |
| common.usagePattern | Pattern de uso | src/components/AdvancedTraining.tsx:2370<br>src/components/BasicTraining.tsx:1886<br>src/components/ReviewTraining.tsx:1498 | — |
| common.viteGeminiApiKeyIsNotConfiguredInTheEnv | VITE_GEMINI_API_KEY não foi configurada no arquivo .env. | src/services/aiEvaluationService.ts:202<br>src/services/storyGenerationService.ts:287 | — |
| common.voiceDictationIsUnavailableInThisBrowserUseChromeOr | O ditado por voz não está disponível neste navegador. Use Chrome ou Edge no computador. | src/components/AdvancedTraining.tsx:433<br>src/components/BasicTraining.tsx:383<br>src/components/ReviewTraining.tsx:172 | — |
| common.walkingMode | Modo Caminhada | src/components/ChunkFlashcards.tsx:538<br>src/components/WalkingMode.tsx:146 | — |
| common.writeDictateYourSentence | Escreva (Dite) sua frase | src/components/BasicTraining.tsx:1014<br>src/components/ReviewTraining.tsx:683 | — |
| common.writeOrDictateASentenceBeforeRequestingAnEvaluation | Escreva ou dite uma frase antes de solicitar a avaliação. | src/components/BasicTraining.tsx:641<br>src/components/ReviewTraining.tsx:422 | — |
| common.writeOrDictateASentenceBeforeRequestingATranslation | Escreva ou dite uma frase antes de solicitar a tradução. | src/components/BasicTraining.tsx:681<br>src/components/ReviewTraining.tsx:461 | — |
| common.youHavenTUsedTheCommunicativeIntentionYet | Você ainda não utilizou a intenção mental. | src/components/AdvancedTraining.tsx:223<br>src/components/BasicTraining.tsx:1289<br>src/components/IntentionValidationFeedback.tsx:21<br>src/components/ReviewTraining.tsx:957 | — |
| common.zoomComicIn | Aumentar zoom da HQ | src/components/IntentionDetails.tsx:1776<br>src/components/InterpretationPanel.tsx:2283 | — |
| common.zoomComicOut | Diminuir zoom da HQ | src/components/IntentionDetails.tsx:1732<br>src/components/InterpretationPanel.tsx:2239 | — |
| common.zoomIn | Aumentar zoom | src/components/IntentionDetails.tsx:1777<br>src/components/InterpretationPanel.tsx:2284 | — |
| common.zoomOut | Diminuir zoom | src/components/IntentionDetails.tsx:1733<br>src/components/InterpretationPanel.tsx:2240 | — |
| connectedSpeech.bold | Negrito | src/components/ConnectedSpeechStudio.tsx:182 | — |
| connectedSpeech.clipboardUnavailable | Clipboard indisponível | src/components/ConnectedSpeechStudio.tsx:151 | — |
| connectedSpeech.connectedSpeechEditable | Connected Speech · Editável | src/components/ConnectedSpeechStudio.tsx:204 | — |
| connectedSpeech.connectedSpeechPx | Connected speech (px) | src/components/ConnectedSpeechStudio.tsx:178 | — |
| connectedSpeech.connectedSpeechStudioTitle | Connected Speech Studio — {{title}} | src/components/ConnectedSpeechStudio.tsx:255 | title |
| connectedSpeech.connectedSpeechTitle | Connected Speech: {{title}} | src/components/ConnectedSpeechStudio.tsx:266 | title |
| connectedSpeech.contentCopiedWithFormattingWhenSupported | Conteúdo copiado (com formatação quando suportada). | src/components/ConnectedSpeechStudio.tsx:153 | — |
| connectedSpeech.copyFormattedText | Copiar formatado | src/components/ConnectedSpeechStudio.tsx:169 | — |
| connectedSpeech.copyPlainText | Copiar texto puro | src/components/ConnectedSpeechStudio.tsx:168 | — |
| connectedSpeech.couldNotCopyCheckClipboardPermissions | Não foi possível copiar. Verifique as permissões da área de transferência. | src/components/ConnectedSpeechStudio.tsx:155 | — |
| connectedSpeech.editConnectedSpeechForPassageNumber | Editar connected speech do trecho {{number}} | src/components/ConnectedSpeechStudio.tsx:215 | number |
| connectedSpeech.editsRestoredFromTheOriginalEnglish | Edições restauradas a partir do inglês original. | src/components/ConnectedSpeechStudio.tsx:121 | — |
| connectedSpeech.firstClickTheEditableConnectedSpeechText | Clique primeiro no texto editável de Connected Speech. | src/components/ConnectedSpeechStudio.tsx:96 | — |
| connectedSpeech.highlighter | Marca-texto | src/components/ConnectedSpeechStudio.tsx:188 | — |
| connectedSpeech.insertLinkingSymbol | Inserir símbolo de linking | src/components/ConnectedSpeechStudio.tsx:184 | — |
| connectedSpeech.insertLinkingSymbolAtTheCursor | Inserir símbolo de linking (‿) na posição do cursor | src/components/ConnectedSpeechStudio.tsx:184 | — |
| connectedSpeech.linking | ‿ Linking | src/components/ConnectedSpeechStudio.tsx:184 | — |
| connectedSpeech.linkingSymbolInserted | Símbolo de linking ‿ inserido. | src/components/ConnectedSpeechStudio.tsx:111 | — |
| connectedSpeech.openConnectedSpeechStudioInANewTab | Abrir Connected Speech Studio em nova aba | src/components/ConnectedSpeechStudio.tsx:266 | — |
| connectedSpeech.originalEnUs | Original EN-US · | src/components/ConnectedSpeechStudio.tsx:199 | — |
| connectedSpeech.originalPx | Original (px) | src/components/ConnectedSpeechStudio.tsx:175 | — |
| connectedSpeech.placeTheCursorBetweenWordsAndClickLinkingToInsert | Posicione o cursor entre palavras e clique em ‿ Linking para inserir a ligação. Selecione um trecho para aplicar cor, marca-texto, negrito ou sublinhado. Os dois tamanhos de fonte são independentes. O texto original nunca é alterado. | src/components/ConnectedSpeechStudio.tsx:194 | — |
| connectedSpeech.placeTheCursorInTheConnectedSpeechTextBeforeInserting | Posicione o cursor no texto de Connected Speech antes de inserir ‿. | src/components/ConnectedSpeechStudio.tsx:88 | — |
| connectedSpeech.plainTextCopied | Texto puro copiado. | src/components/ConnectedSpeechStudio.tsx:153 | — |
| connectedSpeech.resetEdits | Restaurar edição | src/components/ConnectedSpeechStudio.tsx:192 | — |
| connectedSpeech.selectedTextColor | Cor do texto selecionado | src/components/ConnectedSpeechStudio.tsx:185 | — |
| connectedSpeech.selectedTextHighlight | Realce do texto selecionado | src/components/ConnectedSpeechStudio.tsx:188 | — |
| connectedSpeech.text | Texto | src/components/ConnectedSpeechStudio.tsx:185 | — |
| connectedSpeech.underline | Sublinhar | src/components/ConnectedSpeechStudio.tsx:183 | — |
| connectedSpeech.yourBrowserBlockedTheNewTabAllowPopUpsFor | O navegador bloqueou a nova aba. Permita pop-ups para este site. | src/components/ConnectedSpeechStudio.tsx:254 | — |
| details.authorMode | Modo Autor | src/components/IntentionDetails.tsx:1412 | — |
| details.closeTagsAndSearchTerms | Fechar tags e termos de busca | src/components/IntentionDetails.tsx:1407 | — |
| details.comicIntention | HQ - {{intention}} | src/components/IntentionDetails.tsx:490<br>src/components/IntentionDetails.tsx:500<br>src/components/IntentionDetails.tsx:746 | intention |
| details.comicPreview | Visualização da HQ | src/components/IntentionDetails.tsx:1456 | — |
| details.comicPromptCopied | Prompt da HQ copiado | src/components/IntentionDetails.tsx:1246 | — |
| details.comicPromptForExampleNumberCopied | Prompt da HQ do exemplo {{number}} copiado | src/components/IntentionDetails.tsx:1251 | number |
| details.comicRelatedToTheIntentionIntention | HQ relacionada à intenção: {{intention}} | src/components/IntentionDetails.tsx:798<br>src/components/IntentionDetails.tsx:1521 | intention |
| details.copyExampleNumberInTargetlanguage | Copiar exemplo {{number}} em {{targetLanguage}} | src/components/IntentionDetails.tsx:1194 | number, targetLanguage |
| details.copyExamplesInSourcelanguageAndTargetlanguage | Copiar exemplos em {{sourceLanguage}} e {{targetLanguage}} | src/components/IntentionDetails.tsx:1059<br>src/components/IntentionDetails.tsx:1060 | sourceLanguage, targetLanguage |
| details.copyPattern | Copiar Pattern | src/components/IntentionDetails.tsx:1006<br>src/components/IntentionDetails.tsx:1007 | — |
| details.copyPromptToCreateAComic | Copiar prompt para criar HQ | src/components/IntentionDetails.tsx:1247 | — |
| details.copyPromptToCreateAComicForExampleNumber | Copiar prompt para criar HQ do exemplo {{number}} | src/components/IntentionDetails.tsx:1252 | number |
| details.copySentenceInTargetlanguage | Copiar frase em {{targetLanguage}} | src/components/IntentionDetails.tsx:1189 | targetLanguage |
| details.couldNotCopyTheComicPrompt | Não foi possível copiar o prompt da HQ. | src/components/IntentionDetails.tsx:436 | — |
| details.couldNotCopyTheContentTryAgain | Não foi possível copiar o conteúdo. Tente novamente. | src/components/IntentionDetails.tsx:350 | — |
| details.couldNotCopyTheExample | Não foi possível copiar o exemplo. | src/components/IntentionDetails.tsx:380 | — |
| details.couldNotCopyThisIntentionSId | Não foi possível copiar o ID desta intenção. | src/components/IntentionDetails.tsx:286 | — |
| details.couldNotPlayTheExample | Não foi possível reproduzir o exemplo. | src/components/IntentionDetails.tsx:262 | — |
| details.description | Descrição | src/components/IntentionDetails.tsx:1046 | — |
| details.detailsForIntention | Detalhes de {{intention}} | src/components/IntentionDetails.tsx:839 | intention |
| details.exampleNumber | Exemplo {{number}} | src/components/IntentionDetails.tsx:566 | number |
| details.exampleNumberCopied | Exemplo {{number}} copiado | src/components/IntentionDetails.tsx:1193 | number |
| details.examples | Exemplos | src/components/IntentionDetails.tsx:1054 | — |
| details.examplesCopied | Exemplos copiados | src/components/IntentionDetails.tsx:1060 | — |
| details.examplesIntention | Exemplos - {{intention}} | src/components/IntentionDetails.tsx:522<br>src/components/IntentionDetails.tsx:540 | intention |
| details.failedToCopyText | Falha ao copiar o texto. | src/components/IntentionDetails.tsx:336 | — |
| details.intentionExampleNumber | {{intention}} — Exemplo {{number}} | src/components/IntentionDetails.tsx:1177 | intention, number |
| details.listenToExampleNumberInTargetlanguage | Ouvir exemplo {{number}} em {{targetLanguage}} | src/components/IntentionDetails.tsx:1160 | number, targetLanguage |
| details.listenToThisExampleInTargetlanguage | Ouvir este exemplo em {{targetLanguage}} | src/components/IntentionDetails.tsx:1159 | targetLanguage |
| details.noSearchTermsAdded | Nenhum termo de busca cadastrado. | src/components/IntentionDetails.tsx:1424 | — |
| details.noTagsAdded | Nenhuma tag cadastrada. | src/components/IntentionDetails.tsx:1436 | — |
| details.openShortOnYoutubeInANewTab | Abrir Short no YouTube em nova aba | src/components/IntentionDetails.tsx:909 | — |
| details.openVideoOnYoutubeInANewTab | Abrir vídeo no YouTube em nova aba | src/components/IntentionDetails.tsx:888 | — |
| details.pattern | Padrão | src/components/IntentionDetails.tsx:1001 | — |
| details.patternCopied | Pattern copiado | src/components/IntentionDetails.tsx:1007 | — |
| details.printExamplesInSourcelanguageAndTargetlanguage | Imprimir exemplos em {{sourceLanguage}} e {{targetLanguage}} | src/components/IntentionDetails.tsx:1096<br>src/components/IntentionDetails.tsx:1097 | sourceLanguage, targetLanguage |
| details.printThisIntention | Imprimir esta intenção | src/components/IntentionDetails.tsx:955<br>src/components/IntentionDetails.tsx:956 | — |
| details.related | Relacionados | src/components/IntentionDetails.tsx:1351 | — |
| details.tagsAndSearchTerms | Tags e termos de busca | src/components/IntentionDetails.tsx:1372<br>src/components/IntentionDetails.tsx:1413 | — |
| details.tagsAndTerms | Tags e termos | src/components/IntentionDetails.tsx:986 | — |
| details.thereIsNoTextToPlay | Não há texto para reproduzir. | src/components/IntentionDetails.tsx:221 | — |
| details.viewComicForExampleNumber | Ver HQ do exemplo {{number}} | src/components/IntentionDetails.tsx:1304 | number |
| details.viewComicForThisExample | Ver HQ deste exemplo | src/components/IntentionDetails.tsx:1303 | — |
| details.viewTagsAndSearchTerms | Ver tags e termos de busca | src/components/IntentionDetails.tsx:983 | — |
| details.viewTagsAndSearchtermsForThisIntention | Visualizar tags e searchTerms desta intenção | src/components/IntentionDetails.tsx:982 | — |
| details.viewThisIntentionSShortOnYoutubeNewTab | Ver Short desta intenção no YouTube (nova aba) | src/components/IntentionDetails.tsx:910 | — |
| details.viewThisIntentionSVideoOnYoutubeNewTab | Ver vídeo desta intenção no YouTube (nova aba) | src/components/IntentionDetails.tsx:889 | — |
| document.mentalHashmapWebApplication | Aplicativo Web Mental Hashmap | index.html:7 | — |
| evaluation.aiDidNotReturnAValidEvaluation | A IA não retornou uma avaliação válida. | src/services/aiEvaluationService.ts:264 | — |
| evaluation.blockedWithReason | A avaliação foi bloqueada pela IA: {{reason}}. | src/services/aiEvaluationService.ts:251 | reason |
| evaluation.writeASentenceBeforeRequestingAnEvaluation | Escreva uma frase antes de solicitar a avaliação. | src/services/aiEvaluationService.ts:208 | — |
| exercises.addExamplesToTheJsonToUseTheExercisesArea | Adicione exemplos ao JSON para utilizar a área de exercícios. | src/components/ExercisePanel.tsx:304 | — |
| exercises.advancedPracticeLevelCategorysuffix | Treino avançado · {{level}}{{categorySuffix}} | src/components/ExercisePanel.tsx:427 | categorySuffix, level |
| exercises.availableAtLevel_many | {{count}} intenções com exemplos no nível {{level}} | src/components/ExercisePanel.tsx:294 | count, level |
| exercises.availableAtLevel_one | {{count}} intenção com exemplos no nível {{level}} | src/components/ExercisePanel.tsx:294 | count, level |
| exercises.availableAtLevel_other | {{count}} intenções com exemplos no nível {{level}} | src/components/ExercisePanel.tsx:294 | count, level |
| exercises.basicPracticeLevelCategorysuffix | Treino básico · {{level}}{{categorySuffix}} | src/components/ExercisePanel.tsx:424 | categorySuffix, level |
| exercises.chooseThePracticeTypeAndHowManyIntentionsToStudy | Escolha o tipo de treino e quantas intenções você quer praticar. O aplicativo vai sortear as intenções e você poderá iniciar o treino de cada uma delas. | src/components/ExercisePanel.tsx:285 | — |
| exercises.drawnIntentions_many | {{count}} intenções sorteadas | src/components/ExercisePanel.tsx:435<br>src/components/ExercisePanel.tsx:436 | count |
| exercises.drawnIntentions_one | {{count}} intenção sorteada | src/components/ExercisePanel.tsx:435<br>src/components/ExercisePanel.tsx:436 | count |
| exercises.drawnIntentions_other | {{count}} intenções sorteadas | src/components/ExercisePanel.tsx:435<br>src/components/ExercisePanel.tsx:436 | count |
| exercises.format1Verb1Adjective1Noun | 1 verbo + 1 adjetivo + 1 noun | src/components/ExercisePanel.tsx:323 | — |
| exercises.format2Verbs2Adjectives2Nouns4Connectors | 2 verbos + 2 adjetivos + 2 nouns + 4 conectores | src/components/ExercisePanel.tsx:337 | — |
| exercises.generatePractice | Gerar treino | src/components/ExercisePanel.tsx:415 | — |
| exercises.hashmapExample | Exemplo do Hashmap | src/components/ExercisePanel.tsx:470 | — |
| exercises.howManyIntentionsWouldYouLikeToPractice | Quantas intenções você quer treinar? | src/components/ExercisePanel.tsx:393 | — |
| exercises.intentionPractice | Treino de intenções | src/components/ExercisePanel.tsx:282 | — |
| exercises.noIntentionsWithExamplesAvailable | Nenhuma intenção com exemplo disponível. | src/components/ExercisePanel.tsx:302 | — |
| exercises.openPracticeHint | Clique em Treinar para abrir o exercício completo daquela intenção. | src/components/ExercisePanel.tsx:440 | — |
| exercises.practice | Treinar | src/components/ExercisePanel.tsx:440<br>src/components/ExercisePanel.tsx:502 | — |
| exercises.practiceType | Tipo de treino | src/components/ExercisePanel.tsx:310 | — |
| filters.all | Todas | src/components/SearchPanel.tsx:234 | — |
| filters.allCategoriesCount | Todas ({{count}}) | src/components/ExercisePanel.tsx:376 | count |
| filters.allTodos | Todos | src/components/SearchPanel.tsx:220<br>src/components/SearchPanel.tsx:244<br>src/components/SearchPanel.tsx:256<br>src/components/SearchPanel.tsx:266 | — |
| filters.applyWithCount | Aplicar filtros ({{count}}) | src/components/SearchPanel.tsx:377 | count |
| filters.cancel | Cancelar | src/components/SearchPanel.tsx:373 | — |
| filters.clearCategory | Limpar categoria | src/components/SearchPanel.tsx:204 | — |
| filters.clearFilters | Limpar filtros | src/components/SearchPanel.tsx:295 | — |
| filters.clearSourceLanguageSearch | Limpar pesquisa no idioma de origem | src/components/SearchPanel.tsx:168 | — |
| filters.clearStudyLanguageSearch | Limpar pesquisa no idioma de estudo | src/components/SearchPanel.tsx:186 | — |
| filters.closeTagSelection | Fechar seleção de tags | src/components/SearchPanel.tsx:331 | — |
| filters.deselectAll | Desmarcar todas | src/components/SearchPanel.tsx:368 | — |
| filters.eGQuestionsHabitsConditions | Ex.: questions, habits, conditions... | src/components/SearchPanel.tsx:200 | — |
| filters.filterByTags | Filtrar por tags | src/components/SearchPanel.tsx:326 | — |
| filters.noSimilarTagsFoundTryAnotherWord | Nenhuma tag semelhante encontrada. Tente outra palavra. | src/components/SearchPanel.tsx:351 | — |
| filters.removeTagTag | Remover tag {{tag}} | src/components/SearchPanel.tsx:286 | tag |
| filters.searchAndSelectTags | Pesquisar e selecionar tags... | src/components/SearchPanel.tsx:280 | — |
| filters.searchByNameOrPartOfAWordAndSelect | Pesquise por nome ou parte da palavra e marque as tags desejadas. | src/components/SearchPanel.tsx:328 | — |
| filters.searchIntentionsOrExamplesInSourcelanguage | Buscar intenção ou exemplo em {{sourceLanguage}}... | src/components/SearchPanel.tsx:164 | sourceLanguage |
| filters.searchIntentionsStructuresOrExamplesInTargetlanguage | Buscar intenção, estrutura ou exemplo em {{targetLanguage}}... | src/components/SearchPanel.tsx:182 | targetLanguage |
| filters.searchTags | Pesquisar tags | src/components/SearchPanel.tsx:339 | — |
| filters.searchTagsEGHabitConversaGrammar | Pesquisar tags... Ex.: habit, conversa, grammar | src/components/SearchPanel.tsx:338 | — |
| filters.selectedCountEditTags | Selecionadas: {{count}} — editar tags | src/components/SearchPanel.tsx:280 | count |
| filters.sourceCaption | Intenção — {{sourceLanguage}} | src/components/SearchPanel.tsx:162 | sourceLanguage |
| filters.tags | Tags | src/components/SearchPanel.tsx:275 | — |
| filters.tagsFound_many | {{count}} tags encontradas | src/components/SearchPanel.tsx:343 | count |
| filters.tagsFound_one | {{count}} tag encontrada | src/components/SearchPanel.tsx:343 | count |
| filters.tagsFound_other | {{count}} tags encontradas | src/components/SearchPanel.tsx:343 | count |
| filters.tagsSelected_many | {{count}} selecionadas | src/components/SearchPanel.tsx:344 | count |
| filters.tagsSelected_one | {{count}} selecionada | src/components/SearchPanel.tsx:344 | count |
| filters.tagsSelected_other | {{count}} selecionadas | src/components/SearchPanel.tsx:344 | count |
| filters.targetCaption | Intenção / estrutura — {{targetLanguage}} | src/components/SearchPanel.tsx:180 | targetLanguage |
| filters.withChunk | Com Chunk | src/components/SearchPanel.tsx:245 | — |
| filters.withComic | Com HQ | src/components/SearchPanel.tsx:235 | — |
| filters.withoutChunk | Sem Chunk | src/components/SearchPanel.tsx:246 | — |
| filters.withoutComic | Sem HQ | src/components/SearchPanel.tsx:236 | — |
| filters.withoutShort | Sem Short | src/components/SearchPanel.tsx:268 | — |
| filters.withoutVideo | Sem vídeo | src/components/SearchPanel.tsx:258 | — |
| filters.withShort | Com Short | src/components/SearchPanel.tsx:267 | — |
| filters.withVideo | Com vídeo | src/components/SearchPanel.tsx:257 | — |
| filters.youtubeVideo | YouTube Vídeo | src/components/SearchPanel.tsx:253 | — |
| flashcards.availableChunks_many | {{count}} chunks disponíveis | src/components/ChunkFlashcards.tsx:417 | count |
| flashcards.availableChunks_one | {{count}} chunk disponível | src/components/ChunkFlashcards.tsx:417 | count |
| flashcards.availableChunks_other | {{count}} chunks disponíveis | src/components/ChunkFlashcards.tsx:417 | count |
| flashcards.cefrLevel | Nível CEFR | src/components/ChunkLevelSelect.tsx:9 | — |
| flashcards.chunkCopied | Chunk copiado | src/components/ChunkFlashcards.tsx:313 | — |
| flashcards.chunksPresentedInThisRound | Chunks apresentados nesta rodada | src/components/ChunkFlashcards.tsx:518 | — |
| flashcards.clickStartToDrawTheFirstChunk | Clique em Começar para sortear o primeiro chunk. | src/components/ChunkFlashcards.tsx:367 | — |
| flashcards.completeExpressionPractice | Prática de expressões completas | src/components/ChunkFlashcards.tsx:412 | — |
| flashcards.copyChunkInTheStudyLanguage | Copiar chunk no idioma de estudo | src/components/ChunkFlashcards.tsx:314 | — |
| flashcards.copyFailed | Falha ao copiar. | src/components/ChunkFlashcards.tsx:209 | — |
| flashcards.copyIntentionIdAuthorMode | Copiar ID da intenção (Modo Autor) | src/components/ChunkFlashcards.tsx:333 | — |
| flashcards.copyTextToTheClipboard | Copiar {{text}} para a área de transferência | src/components/ChunkFlashcards.tsx:313 | text |
| flashcards.couldNotCopyTheChunkInThisBrowser | Não foi possível copiar o chunk neste navegador. | src/components/ChunkFlashcards.tsx:227 | — |
| flashcards.couldNotCopyTheIntentionIdInThisBrowser | Não foi possível copiar o ID da intenção neste navegador. | src/components/ChunkFlashcards.tsx:240 | — |
| flashcards.couldNotPlayTheAudioInThisBrowser | Não foi possível reproduzir o áudio neste navegador. | src/components/ChunkFlashcards.tsx:262 | — |
| flashcards.englishChunkCopied | Chunk em inglês copiado! | src/components/ChunkFlashcards.tsx:385 | — |
| flashcards.hideStudyTime | Ocultar tempo de estudo | src/components/ChunkFlashcards.tsx:428 | — |
| flashcards.hideTimeKeepsCounting | Ocultar tempo (continua contando) | src/components/ChunkFlashcards.tsx:430 | — |
| flashcards.intentionIdCopied | ID da intenção copiado! | src/components/ChunkFlashcards.tsx:385 | — |
| flashcards.inTheMentalHashmapJsonToPracticeThemHere | no JSON do Mental Hashmap para praticá-las aqui. | src/components/ChunkFlashcards.tsx:506 | — |
| flashcards.listenToPronunciationTargetlanguage | Ouvir pronúncia · {{targetLanguage}} | src/components/ChunkFlashcards.tsx:289 | targetLanguage |
| flashcards.listenToThePronunciationOfText | Ouvir pronúncia de {{text}} | src/components/ChunkFlashcards.tsx:288 | text |
| flashcards.markCompleteIntentionsWith | Marque intenções completas com | src/components/ChunkFlashcards.tsx:505 | — |
| flashcards.newRound | Nova rodada | src/components/ChunkFlashcards.tsx:540 | — |
| flashcards.noChunksEnabled | Nenhum chunk habilitado | src/components/ChunkFlashcards.tsx:503 | — |
| flashcards.openAdvancedPracticeForText | Abrir treino avançado de {{text}} | src/components/ChunkFlashcards.tsx:353 | text |
| flashcards.openBasicPracticeForText | Abrir treino básico de {{text}} | src/components/ChunkFlashcards.tsx:344 | text |
| flashcards.pauseStudyTime | Pausar tempo de estudo | src/components/ChunkFlashcards.tsx:453 | — |
| flashcards.pauseTimer | Pausar cronômetro | src/components/ChunkFlashcards.tsx:455 | — |
| flashcards.readListenAndRepeatEachExpressionAloud | Leia, ouça e repita cada expressão em voz alta. | src/components/ChunkFlashcards.tsx:414 | — |
| flashcards.readyToPractice | Pronto para praticar? | src/components/ChunkFlashcards.tsx:366 | — |
| flashcards.resumeStudyTime | Continuar tempo de estudo | src/components/ChunkFlashcards.tsx:453 | — |
| flashcards.resumeTimer | Continuar cronômetro | src/components/ChunkFlashcards.tsx:455 | — |
| flashcards.roundNumber | Rodada {{round}} | src/components/ChunkFlashcards.tsx:512<br>src/components/WalkingMode.tsx:147 | round |
| flashcards.roundPracticed_many | Você praticou todos os {{count}} chunks desta rodada! | src/components/ChunkFlashcards.tsx:529 | count |
| flashcards.roundPracticed_one | Você praticou {{count}} chunk nesta rodada! | src/components/ChunkFlashcards.tsx:529 | count |
| flashcards.roundPracticed_other | Você praticou todos os {{count}} chunks desta rodada! | src/components/ChunkFlashcards.tsx:529 | count |
| flashcards.showStudyTime | Mostrar tempo de estudo | src/components/ChunkFlashcards.tsx:428 | — |
| flashcards.showStudyTimer | Mostrar cronômetro de estudo | src/components/ChunkFlashcards.tsx:430 | — |
| flashcards.start | Começar | src/components/ChunkFlashcards.tsx:540 | — |
| flashcards.startStudyingToEnablePause | Comece a estudar para habilitar a pausa | src/components/ChunkFlashcards.tsx:455 | — |
| flashcards.studyPaused | ESTUDO PAUSADO | src/components/ChunkFlashcards.tsx:493 | — |
| flashcards.studyTimeTime | Tempo de estudo: {{time}} | src/components/ChunkFlashcards.tsx:419 | time |
| flashcards.timerPaused | Cronômetro parado em {{time}}. Clique em ▶ Continuar para retomar. | src/components/ChunkFlashcards.tsx:496 | time |
| flashcards.viewDetailsAndExamplesOfText | Ver detalhes e exemplos de {{text}} | src/components/ChunkFlashcards.tsx:301 | text |
| flashcards.viewDetailsAndMoreExamples | Ver detalhes e mais exemplos | src/components/ChunkFlashcards.tsx:302 | — |
| flashcards.yourBrowserDoesNotSupportSpeechPlayback | Seu navegador não oferece reprodução de voz. | src/components/ChunkFlashcards.tsx:247 | — |
| hashmap.contentPublishedOnYoutube | Conteúdos publicados no YouTube | src/components/IntentionCard.tsx:89 | — |
| hashmap.couldNotCopyTheIdTryAgain | Não foi possível copiar o ID. Tente novamente. | src/components/IntentionCard.tsx:181 | — |
| hashmap.emptyHint | Experimente outros termos em {{sourceLanguage}} ou {{targetLanguage}}, ou limpe os filtros. | src/components/IntentionList.tsx:17 | sourceLanguage, targetLanguage |
| hashmap.noIntentionsFound | Nenhuma intenção encontrada. | src/components/IntentionList.tsx:16 | — |
| hashmap.results_many | {{count}} intenções | src/App.tsx:377 | count |
| hashmap.results_one | {{count}} intenção | src/App.tsx:377 | count |
| hashmap.results_other | {{count}} intenções | src/App.tsx:377 | count |
| hashmap.shortPublishedOnYoutube | Short publicado no YouTube | src/components/IntentionCard.tsx:105<br>src/components/IntentionCard.tsx:106 | — |
| hashmap.sourceTags | Tags de origem | src/components/IntentionCard.tsx:165 | — |
| hashmap.studyLanguageTags | Tags de estudo | src/components/IntentionCard.tsx:166 | — |
| hashmap.totalAvailable | Total disponível: {{count}} | src/App.tsx:382 | count |
| hashmap.videoPublishedOnYoutube | Vídeo publicado no YouTube | src/components/IntentionCard.tsx:95<br>src/components/IntentionCard.tsx:96 | — |
| header.studyIntentionsFromOneLanguageToAnother | Estude intenções de um idioma para outro. | src/components/Header.tsx:15 | — |
| languages.americanEnglish | Inglês americano | src/config/languages.ts:11 | — |
| languages.brazilianPortuguese | Português brasileiro | src/config/languages.ts:10 | — |
| languages.french | Francês | src/config/languages.ts:13 | — |
| languages.spanish | Espanhol | src/config/languages.ts:12 | — |
| memory.advanced | Avançado | src/components/MemoryFlashcards.tsx:16 | — |
| memory.answerHidden | Resposta oculta | src/components/MemoryFlashcards.tsx:138 | — |
| memory.beginner | Iniciante | src/components/MemoryFlashcards.tsx:16 | — |
| memory.chunkRecordedYouCanMoveOn | Chunk registrado. Você pode avançar. | src/components/MemoryFlashcards.tsx:151 | — |
| memory.chunksStudied | Chunks estudados | src/components/MemoryFlashcards.tsx:123 | — |
| memory.drawNextChunk | Sortear próximo chunk | src/components/MemoryFlashcards.tsx:149 | — |
| memory.elementary | Básico | src/components/MemoryFlashcards.tsx:16 | — |
| memory.flipFlashcard | Virar flashcard | src/components/MemoryFlashcards.tsx:142 | — |
| memory.intermediate | Intermediário | src/components/MemoryFlashcards.tsx:16 | — |
| memory.memory | Memória | src/components/MemoryFlashcards.tsx:111 | — |
| memory.noChunksAvailableForThisLevelAndLanguagePair | Nenhum chunk disponível para este nível e par de idiomas. | src/components/MemoryFlashcards.tsx:131 | — |
| memory.proficient | Proficiente | src/components/MemoryFlashcards.tsx:16 | — |
| memory.progress | Progresso | src/components/MemoryFlashcards.tsx:120 | — |
| memory.recallHint | Tente lembrar como dizer isso em {{targetLanguage}}. | src/components/MemoryFlashcards.tsx:137 | targetLanguage |
| memory.remainingChunks_many | {{count}} restantes | src/components/MemoryFlashcards.tsx:126 | count |
| memory.remainingChunks_one | {{count}} restante | src/components/MemoryFlashcards.tsx:126 | count |
| memory.remainingChunks_other | {{count}} restantes | src/components/MemoryFlashcards.tsx:126 | count |
| memory.revealTheBackToRecordYourStudy | Revele o verso para registrar seu estudo. | src/components/MemoryFlashcards.tsx:151 | — |
| memory.roundComplete | Rodada concluída! | src/components/MemoryFlashcards.tsx:151 | — |
| memory.startANewRound | Iniciar nova rodada | src/components/MemoryFlashcards.tsx:149 | — |
| memory.studied | Estudados | src/components/MemoryFlashcards.tsx:119 | — |
| memory.studiedChunks_many | {{count}} chunks estudados | src/components/MemoryFlashcards.tsx:123<br>src/components/MemoryFlashcards.tsx:126 | count |
| memory.studiedChunks_one | {{count}} chunk estudado | src/components/MemoryFlashcards.tsx:123<br>src/components/MemoryFlashcards.tsx:126 | count |
| memory.studiedChunks_other | {{count}} chunks estudados | src/components/MemoryFlashcards.tsx:123<br>src/components/MemoryFlashcards.tsx:126 | count |
| memory.studyLevel | Nível de estudo | src/components/MemoryFlashcards.tsx:112 | — |
| memory.upperIntermediate | Intermediário avançado | src/components/MemoryFlashcards.tsx:16 | — |
| memory.viewFront | Ver frente | src/components/MemoryFlashcards.tsx:142 | — |
| navigation.backToTop | Ir para o topo | src/components/ScrollToTopButton.tsx:25 | — |
| navigation.languages | Idiomas | src/components/Sidebar.tsx:90 | — |
| navigation.mainMenu | Menu principal | src/components/Sidebar.tsx:69 | — |
| navigation.openMenu | Abrir menu | src/components/Sidebar.tsx:62 | — |
| reviewTraining.brazilianEnglishJourneyReview | BRAZILIAN ENGLISH JOURNEY · REVISÃO | src/components/ReviewTraining.tsx:1477<br>src/components/ReviewTraining.tsx:385 (template de impressão) | — |
| reviewTraining.createSentencesInEnglishUsingTheCommunicativeIntention | Crie frases em inglês usando a intenção mental. | src/components/ReviewTraining.tsx:1506 | — |
| reviewTraining.createYourOwnSentenceInEnglishUsingTheCommunicativeIntention | Crie uma frase livre em inglês usando a intenção mental. Você pode escrever ou ditar sua resposta. | src/components/ReviewTraining.tsx:668 | — |
| reviewTraining.printReviewWorksheet | Imprimir folha de revisão | src/components/ReviewTraining.tsx:862 | — |
| settings.choosingTheOtherLanguageSwapsTheSourceAndStudyLanguages | Ao escolher o outro idioma, origem e estudo serão invertidos. As alterações são salvas automaticamente. | src/components/AppSettingsDialog.tsx:61 | — |
| settings.closeDialog | Fechar modal | src/components/AppSettingsDialog.tsx:40 | — |
| settings.exitWalkingModeToChangeLanguages | Encerre o Modo Caminhada para trocar os idiomas. | src/components/AppSettingsDialog.tsx:60 | — |
| settings.lastUpdated | Última atualização | src/components/AppSettingsDialog.tsx:67 | — |
| settings.localCache | cache local | src/components/AppSettingsDialog.tsx:69 | — |
| settings.metadataIsCurrentlyUnavailable | Metadados indisponíveis no momento. | src/components/AppSettingsDialog.tsx:68 | — |
| settings.name | Nome | src/components/AppSettingsDialog.tsx:65 | — |
| settings.sourceLanguageSource | Idioma de origem (Source) | src/components/AppSettingsDialog.tsx:45 | — |
| settings.studyLanguage | Idioma de estudo | src/components/AppSettingsDialog.tsx:53 | — |
| settings.studyLanguageTarget | Idioma de estudo (Target) | src/components/AppSettingsDialog.tsx:52 | — |
| settings.version | Versão | src/components/AppSettingsDialog.tsx:66 | — |
| shadowing.automaticallyAdvanceBetweenParagraphs | Avanço automático entre parágrafos | src/components/StoryShadowing.tsx:21 | — |
| shadowing.availableStories_many | {{count}} histórias disponíveis | src/components/StoryShadowing.tsx:121 | count |
| shadowing.availableStories_one | {{count}} história disponível | src/components/StoryShadowing.tsx:121 | count |
| shadowing.availableStories_other | {{count}} histórias disponíveis | src/components/StoryShadowing.tsx:121 | count |
| shadowing.backToMainMenu | Voltar ao menu principal | src/components/StoryShadowing.tsx:60 | — |
| shadowing.backToSelection | Voltar à seleção | src/components/StoryShadowing.tsx:116 | — |
| shadowing.byParagraph | Por parágrafo | src/components/StoryShadowing.tsx:14 | — |
| shadowing.chooseAnotherStory | Escolher outra história | src/components/StoryShadowing.tsx:44<br>src/components/StoryShadowing.tsx:60 | — |
| shadowing.chooseAStory | Escolha uma história | src/components/StoryShadowing.tsx:120 | — |
| shadowing.completedParagraphs | Parágrafos concluídos | src/components/StoryShadowing.tsx:52 | — |
| shadowing.completedParagraphs_many | {{count}} parágrafos concluídos de {{total}} | src/components/StoryShadowing.tsx:53 | count, total |
| shadowing.completedParagraphs_one | {{count}} parágrafo concluído de {{total}} | src/components/StoryShadowing.tsx:53 | count, total |
| shadowing.completedParagraphs_other | {{count}} parágrafos concluídos de {{total}} | src/components/StoryShadowing.tsx:53 | count, total |
| shadowing.completionSummary_many | {{count}} parágrafos concluídos · {{time}} | src/components/StoryShadowing.tsx:59 | count, time |
| shadowing.completionSummary_one | {{count}} parágrafo concluído · {{time}} | src/components/StoryShadowing.tsx:59 | count, time |
| shadowing.completionSummary_other | {{count}} parágrafos concluídos · {{time}} | src/components/StoryShadowing.tsx:59 | count, time |
| shadowing.control | Controle | src/components/StoryShadowing.tsx:15 | — |
| shadowing.couldNotPlayTheVoiceCheckYourInstalledVoicesAnd | Não foi possível reproduzir a voz. Verifique as vozes instaladas e toque em Play para tentar novamente. | src/hooks/useStoryShadowing.ts:90 | — |
| shadowing.everyMinuteCounts | Cada minuto conta | src/components/StoryShadowing.tsx:48 | — |
| shadowing.findATopicThatSparksYourCuriosityAndPracticeAt | Encontre um tema que desperte sua curiosidade e pratique no seu ritmo. | src/components/StoryShadowing.tsx:120 | — |
| shadowing.fullParagraph | Parágrafo completo | src/components/StoryShadowing.tsx:17 | — |
| shadowing.fullStory | História inteira | src/components/StoryShadowing.tsx:14 | — |
| shadowing.individualSentence | Frase individual | src/components/StoryShadowing.tsx:17 | — |
| shadowing.intervalBetweenPlaybacksSeconds | Intervalo entre reproduções (segundos) | src/components/StoryShadowing.tsx:20 | — |
| shadowing.keepScreenAwakeIfSupported | Manter tela ativa, se suportado | src/components/StoryShadowing.tsx:23 | — |
| shadowing.listen | Escutar | src/components/StoryShadowing.tsx:10 | — |
| shadowing.listenPlaysOnceTheConfiguredRepetitionsApplyToRepeatAfter | Listen toca uma vez. As repetições configuradas se aplicam a Repeat after me e Shadowing. A pausa de resposta é estimada pelo tamanho do trecho, além do intervalo escolhido. | src/components/StoryShadowing.tsx:24 | — |
| shadowing.listenToTheFullParagraph | Ouvir parágrafo completo | src/components/StoryShadowing.tsx:86 | — |
| shadowing.mobilePlaybackControls | Controles de reprodução mobile | src/components/StoryShadowing.tsx:77 | — |
| shadowing.noCompatibleVoiceAvailableEnableAVoiceForThisLanguage | Nenhuma voz compatível disponível. Habilite uma voz deste idioma no navegador ou sistema e tente novamente. O texto permanece disponível para leitura. | src/hooks/useStoryShadowing.ts:66 | — |
| shadowing.noStoriesAreAvailableInThisLanguageYetSelectAnother | Ainda não há histórias disponíveis neste idioma. Selecione outro idioma no cabeçalho para consultar sua biblioteca. | src/components/StoryShadowing.tsx:128 | — |
| shadowing.noStoriesMatchTheFiltersTryAnotherLevelOrTitle | Nenhuma história corresponde aos filtros. Experimente outro nível ou título. | src/components/StoryShadowing.tsx:128 | — |
| shadowing.noVoiceForLanguage | Nenhuma voz compatível disponível. Habilite uma voz de {{targetLanguage}} no sistema ou navegador. A lista será atualizada quando as vozes carregarem; o texto continua disponível para leitura. | src/components/StoryShadowing.tsx:87 | targetLanguage |
| shadowing.paragraph | Parágrafo | src/components/StoryShadowing.tsx:114 | — |
| shadowing.paragraphCompleted | Parágrafo concluído! | src/components/StoryShadowing.tsx:58 | — |
| shadowing.paragraphPosition | {{current}} / {{total}} parágrafos | src/components/StoryShadowing.tsx:51<br>src/components/StoryShadowing.tsx:112<br>src/components/StoryShadowing.tsx:130 | current, total |
| shadowing.play | Reproduzir | src/components/StoryShadowing.tsx:70 | — |
| shadowing.playbackControls | Controles de reprodução | src/components/StoryShadowing.tsx:68 | — |
| shadowing.practice | Praticar | src/components/StoryShadowing.tsx:133 | — |
| shadowing.practiceAgain | Praticar novamente | src/components/StoryShadowing.tsx:60 | — |
| shadowing.practiceComplete | Prática concluída! | src/components/StoryShadowing.tsx:58 | — |
| shadowing.practicePause | Pausa para praticar | src/components/StoryShadowing.tsx:66 | — |
| shadowing.practiceSummary | Resumo da prática | src/components/StoryShadowing.tsx:45 | — |
| shadowing.practiceTime | Tempo de prática | src/components/StoryShadowing.tsx:48 | — |
| shadowing.readTheFullParagraphAloud | Leitura completa do parágrafo | src/components/StoryShadowing.tsx:66 | — |
| shadowing.repeat | Repetir | src/components/StoryShadowing.tsx:73<br>src/components/StoryShadowing.tsx:81 | — |
| shadowing.repeatAfterMe | Repetir após a voz | src/components/StoryShadowing.tsx:10 | — |
| shadowing.repetition | · Repetição | src/components/StoryShadowing.tsx:66 | — |
| shadowing.repetitions | Repetições | src/components/StoryShadowing.tsx:19 | — |
| shadowing.resumingPausedSpeechRestartsTheCurrentPassageScheduledPausesResume | Ao continuar uma fala pausada, o trecho atual recomeça. Pausas programadas retomam o tempo restante. Mantenha a página aberta: áudio em segundo plano ou com a tela bloqueada depende do navegador e do sistema. | src/components/StoryShadowing.tsx:95 | — |
| shadowing.scope | Escopo | src/components/StoryShadowing.tsx:14 | — |
| shadowing.screenWakeLockWasReleasedKeepThePageVisibleTo | O bloqueio de tela foi liberado. Mantenha a página visível para continuar. | src/hooks/useStoryShadowing.ts:142 | — |
| shadowing.searchStoriesForShadowing | Pesquisar histórias para Shadowing | src/components/StoryShadowing.tsx:123 | — |
| shadowing.selectParagraph | Selecionar parágrafo | src/components/StoryShadowing.tsx:114 | — |
| shadowing.sentence | Frase | src/components/StoryShadowing.tsx:67 | — |
| shadowing.settings | Configurações | src/components/StoryShadowing.tsx:75<br>src/components/StoryShadowing.tsx:83 | — |
| shadowing.shadowingSpeakAlongWithTheVoice | Shadowing — Acompanhar a voz | src/components/StoryShadowing.tsx:10 | — |
| shadowing.showPtBrTranslation | Mostrar tradução PT-BR | src/components/StoryShadowing.tsx:22 | — |
| shadowing.speed | Velocidade | src/components/StoryShadowing.tsx:18 | — |
| shadowing.startPractice | Iniciar prática | src/components/StoryShadowing.tsx:116 | — |
| shadowing.storyComplete | História concluída! | src/components/StoryShadowing.tsx:58 | — |
| shadowing.technique | Técnica | src/components/StoryShadowing.tsx:16 | — |
| shadowing.typePartOfTheTitleOrATopic | Digite parte do título ou um tema | src/components/StoryShadowing.tsx:125 | — |
| shadowing.unavailable | (indisponível) | src/components/StoryShadowing.tsx:17 | — |
| shadowing.unit | Unidade | src/components/StoryShadowing.tsx:17 | — |
| shadowing.waitingForPlay | Aguardando Play | src/components/StoryShadowing.tsx:66 | — |
| shadowing.yourNextPractice | Sua próxima prática | src/components/StoryShadowing.tsx:120 | — |
| shadowing.yourParagraph | Seu parágrafo | src/components/StoryShadowing.tsx:50 | — |
| shadowing.yourStoryJourney | Sua jornada na história | src/components/StoryShadowing.tsx:50 | — |
| speaking.automaticSecondsS | Automático — {{seconds}}s | src/components/SpeakingGameReadyStep.tsx:25 | seconds |
| speaking.beforeAVowel | Antes de vogal: | src/components/SpeakingGamePlayStep.tsx:223 | — |
| speaking.couldNotContinue | Não foi possível continuar. | src/components/SpeakingGame.tsx:135 | — |
| speaking.couldNotLoadChunksForThisLanguage | Não foi possível carregar os chunks deste idioma. | src/components/SpeakingGamePlayStep.tsx:135 | — |
| speaking.couldNotLoadVocabularyForTheSelectedLanguage | Não foi possível carregar o vocabulário do idioma selecionado. | src/components/SpeakingGame.tsx:85 | — |
| speaking.decreaseByOneSecond | Diminuir um segundo | src/components/SpeakingGameSetupStep.tsx:92 | — |
| speaking.drawAnotherVerbUsingTheSameVerbForm | Sortear outro verbo mantendo a mesma forma verbal | src/components/SpeakingGamePlayStep.tsx:285<br>src/components/SpeakingGamePlayStep.tsx:286 | — |
| speaking.everythingIsReadyToStart | Tudo pronto para começar. | src/components/SpeakingGameReadyStep.tsx:43 | — |
| speaking.feminine | Feminino: | src/components/SpeakingGamePlayStep.tsx:239<br>src/components/SpeakingGamePlayStep.tsx:237 | — |
| speaking.forms | Formas | src/components/SpeakingGameReadyStep.tsx:65 | — |
| speaking.gerund | Gerúndio | src/components/SpeakingGamePlayStep.tsx:106<br>src/components/SpeakingGamePlayStep.tsx:109 | — |
| speaking.goToTheNextChallengeWithoutWaitingForTheCountdown | Ir para o próximo desafio sem esperar o contador | src/components/SpeakingGamePlayStep.tsx:311 | — |
| speaking.hideVerbForms | Ocultar formas do verbo | src/components/SpeakingGamePlayStep.tsx:339 | — |
| speaking.imperfect | Imperfeito | src/components/SpeakingGamePlayStep.tsx:106 | — |
| speaking.increaseByOneSecond | Aumentar um segundo | src/components/SpeakingGameSetupStep.tsx:107 | — |
| speaking.masculine | Masculino | src/components/SpeakingGamePlayStep.tsx:237 | — |
| speaking.newVerb | Novo verbo | src/components/SpeakingGamePlayStep.tsx:289 | — |
| speaking.next | Próxima | src/components/SpeakingGameSetupStep.tsx:163 | — |
| speaking.nextChallenge | Próximo desafio | src/components/SpeakingGamePlayStep.tsx:312 | — |
| speaking.nextRoundCountdown | Próxima rodada em {{seconds}}s | src/components/SpeakingGamePlayStep.tsx:296<br>src/components/SpeakingGamePlayStep.tsx:301 | seconds |
| speaking.noVerbsSupportThisStructureInTheSelectedLanguage | Não há verbos compatíveis com esta estrutura no idioma selecionado. | src/components/SpeakingGame.tsx:68 | — |
| speaking.openGoogleTranslate | Abrir Google Tradutor | src/components/SpeakingGamePlayStep.tsx:359 | — |
| speaking.openGoogleTranslateTargetlanguageToSourcelanguage | Abrir Google Tradutor: {{targetLanguage}} para {{sourceLanguage}} | src/components/SpeakingGamePlayStep.tsx:355<br>src/components/SpeakingGamePlayStep.tsx:356 | sourceLanguage, targetLanguage |
| speaking.pastFeminine | Passado · feminino | src/components/SpeakingGamePlayStep.tsx:105 | — |
| speaking.practice | Treino | src/components/SpeakingGameReadyStep.tsx:60<br>src/components/SpeakingGameSetupStep.tsx:116 | — |
| speaking.preparingTheGame | Preparando o jogo... | src/components/SpeakingGame.tsx:127 | — |
| speaking.random | Aleatório | src/components/SpeakingGameReadyStep.tsx:29<br>src/components/SpeakingGameSetupStep.tsx:144 | — |
| speaking.randomChunkFromMentalHashmap | Chunk aleatório do Mental Hashmap | src/components/SpeakingGamePlayStep.tsx:245 | — |
| speaking.randomChunkIntention | 🃏 Chunk / intenção aleatória | src/components/SpeakingGamePlayStep.tsx:246 | — |
| speaking.sayASentenceAloudUsingThisForm | Fale em voz alta uma frase na forma: | src/components/SpeakingGamePlayStep.tsx:254 | — |
| speaking.sec | seg | src/components/SpeakingGameSetupStep.tsx:100 | — |
| speaking.sequential | Sequencial | src/components/SpeakingGameSetupStep.tsx:130 | — |
| speaking.settingsSummary | Resumo da configuração | src/components/SpeakingGameReadyStep.tsx:53 | — |
| speaking.setUpYourPracticeBeforeStarting | Configure o treino antes de começar. | src/components/SpeakingGameSetupStep.tsx:45 | — |
| speaking.showVerbForms | Mostrar formas do verbo | src/components/SpeakingGamePlayStep.tsx:339 | — |
| speaking.startGame | Começar o jogo | src/components/SpeakingGameReadyStep.tsx:83 | — |
| speaking.step1Of2 | Etapa 1 de 2 | src/components/SpeakingGameSetupStep.tsx:40 | — |
| speaking.step2Of2 | Etapa 2 de 2 | src/components/SpeakingGameReadyStep.tsx:37 | — |
| speaking.time | Tempo | src/components/SpeakingGameReadyStep.tsx:55<br>src/components/SpeakingGameSetupStep.tsx:50 | — |
| speaking.using | usando: | src/components/SpeakingGamePlayStep.tsx:261 | — |
| speaking.whenReadyTapTheButtonAndSayEachSentenceAloud | Quando estiver pronto, toque no botão e fale cada frase em voz alta. | src/components/SpeakingGameReadyStep.tsx:74 | — |
| stories.answerPtBrTargetlanguage | Solução · PT-BR + {{targetLanguage}} | src/components/InterpretationPanel.tsx:1141 (template de impressão) | targetLanguage |
| stories.availableIntentions_many | {{count}} intenções disponíveis no nível {{level}} | src/components/InterpretationPanel.tsx:1342 | count, level |
| stories.availableIntentions_one | {{count}} intenção disponível no nível {{level}} | src/components/InterpretationPanel.tsx:1342 | count, level |
| stories.availableIntentions_other | {{count}} intenções disponíveis no nível {{level}} | src/components/InterpretationPanel.tsx:1342 | count, level |
| stories.chooseALevelTheNumberOfIntentionsAndATopic | Escolha um nível, a quantidade de intenções e um tema. O aplicativo vai sortear as estruturas e gerar uma história curta para você interpretar antes de revelar o inglês. | src/components/InterpretationPanel.tsx:1334 | — |
| stories.comicForStoryTitle | HQ da história {{title}} | src/components/InterpretationPanel.tsx:1963 | title |
| stories.comicTitle | HQ - {{title}} | src/components/InterpretationPanel.tsx:925<br>src/components/InterpretationPanel.tsx:935<br>src/components/InterpretationPanel.tsx:965 | title |
| stories.copied | Copiado | src/components/InterpretationPanel.tsx:857 | — |
| stories.copyFailedTryAgain | Falha ao copiar. Tentar novamente | src/components/InterpretationPanel.tsx:1920 | — |
| stories.copyFullStoryAsPlainText | Copiar história completa em texto puro | src/components/InterpretationPanel.tsx:1679<br>src/components/InterpretationPanel.tsx:1680 | — |
| stories.copyJson | Copiar JSON | src/components/InterpretationPanel.tsx:178<br>src/components/InterpretationPanel.tsx:701 | — |
| stories.copyParagraphNumberInTargetlanguage | Copiar parágrafo {{number}} em {{targetLanguage}} | src/components/InterpretationPanel.tsx:1923 | number, targetLanguage |
| stories.copyStoryAndPromptToGenerateAComic | Copiar história e prompt para gerar HQ | src/components/InterpretationPanel.tsx:1718<br>src/components/InterpretationPanel.tsx:1719 | — |
| stories.copyThisParagraphInTargetlanguage | Copiar este parágrafo em {{targetLanguage}} | src/components/InterpretationPanel.tsx:1921 | targetLanguage |
| stories.couldNotCopy | Não foi possível copiar | src/components/InterpretationPanel.tsx:753 | — |
| stories.couldNotCopyTheParagraph | Não foi possível copiar o parágrafo. | src/components/InterpretationPanel.tsx:591 | — |
| stories.couldNotCopyTheStory | Não foi possível copiar a história. | src/components/InterpretationPanel.tsx:1087 | — |
| stories.couldNotGenerateTheStory | Não foi possível gerar a história. | src/components/InterpretationPanel.tsx:487<br>src/components/InterpretationPanel.tsx:1590 | — |
| stories.couldNotPlayTheStoryInTargetlanguage | Não foi possível reproduzir a história em {{targetLanguage}}. | src/components/InterpretationPanel.tsx:571 | targetLanguage |
| stories.couldNotPlayThisParagraphInTargetlanguage | Não foi possível reproduzir este parágrafo em {{targetLanguage}}. | src/components/InterpretationPanel.tsx:655 | targetLanguage |
| stories.couldNotPrepareTheStoryJsonForExport | Não foi possível preparar o JSON da história para exportação. | src/components/InterpretationPanel.tsx:709 | — |
| stories.creatingAStoryWithYourIntentions | Criando uma história com suas intenções... | src/components/InterpretationPanel.tsx:1599 | — |
| stories.downloadJson | Baixar JSON | src/components/InterpretationPanel.tsx:2425 | — |
| stories.exportAiGeneratedStory | Exportar história gerada pela IA | src/components/InterpretationPanel.tsx:1774 | — |
| stories.failedToCopyStory | Falha ao copiar história | src/components/InterpretationPanel.tsx:1679 | — |
| stories.fullStoryLanguage | HISTÓRIA COMPLETA - {{language}} | src/components/InterpretationPanel.tsx:1069 | language |
| stories.fullStoryPtBr | HISTÓRIA COMPLETA - PT-BR | src/components/InterpretationPanel.tsx:1067 | — |
| stories.generateStory | Gerar história | src/components/InterpretationPanel.tsx:1441 | — |
| stories.generatingStory | Gerando história... | src/components/InterpretationPanel.tsx:1440 | — |
| stories.hideTargetlanguageVersion | Ocultar versão em {{targetLanguage}} | src/components/InterpretationPanel.tsx:1803 | targetLanguage |
| stories.howManyIntentionsShouldBeUsed | Quantas intenções usar? | src/components/InterpretationPanel.tsx:1373 | — |
| stories.intentionsUsed | Intenções utilizadas | src/components/InterpretationPanel.tsx:2460 | — |
| stories.intentionUnavailableInThisCatalog | Intenção não disponível neste catálogo | src/components/InterpretationPanel.tsx:2483 | — |
| stories.levelLevelInterpretationExercise | Nível {{level}} · Exercício de interpretação | src/components/InterpretationPanel.tsx:1141 (template de impressão) | level |
| stories.listenToParagraphNumberInTargetlanguage | Ouvir parágrafo {{number}} em {{targetLanguage}} | src/components/InterpretationPanel.tsx:1894 | number, targetLanguage |
| stories.listenToTheFullStoryInTargetlanguage | Ouvir a história completa em {{targetLanguage}} | src/components/InterpretationPanel.tsx:1787 | targetLanguage |
| stories.listenToThisParagraphInTargetlanguage | Ouvir este parágrafo em {{targetLanguage}} | src/components/InterpretationPanel.tsx:1889 | targetLanguage |
| stories.load | Carregar | src/components/InterpretationPanel.tsx:1576 | — |
| stories.localLibrary | Biblioteca local | src/components/InterpretationPanel.tsx:1503 | — |
| stories.noIntentionsAvailableForLevelLevel | Não há intenções disponíveis para o nível {{level}}. | src/components/InterpretationPanel.tsx:445 | level |
| stories.noSearchResults | Nenhuma história encontrada em {{targetLanguage}} para o nível {{level}}. | src/components/InterpretationPanel.tsx:1530 | level, targetLanguage |
| stories.noTitleResults | Nenhuma história encontrada em {{targetLanguage}} para o nível {{level}} com o título "{{title}}". | src/components/InterpretationPanel.tsx:1530<br>src/components/InterpretationPanel.tsx:1532 | level, targetLanguage, title |
| stories.paragraphInTargetlanguageCopied | Parágrafo em {{targetLanguage}} copiado | src/components/InterpretationPanel.tsx:1918 | targetLanguage |
| stories.playingParagraphNumber | Reproduzindo parágrafo {{number}} | src/components/InterpretationPanel.tsx:1893 | number |
| stories.playingThisParagraph | Reproduzindo este parágrafo | src/components/InterpretationPanel.tsx:1888 | — |
| stories.printExerciseAndSolution | Imprimir exercício e solução | src/components/InterpretationPanel.tsx:1654<br>src/components/InterpretationPanel.tsx:1655 | — |
| stories.readTheStoryInPortugueseAndWriteYourInterpretationIn | Leia a história em português e escreva sua interpretação em {{targetLanguage}} nos espaços abaixo. A solução está na página 2. | src/components/InterpretationPanel.tsx:1141 (template de impressão) | targetLanguage |
| stories.readyToAddToTheLocalLibrary | Pronto para alimentar a biblioteca local | src/components/InterpretationPanel.tsx:2377 | — |
| stories.searchForAStory | Pesquisar história | src/components/InterpretationPanel.tsx:1504 | — |
| stories.searchLibraryStories | Pesquisar histórias da biblioteca | src/components/InterpretationPanel.tsx:1446 | — |
| stories.searchLibraryStoriesByLevelAndTitleReadAndInterpret | Pesquise histórias da biblioteca por nível e título. Leia e interprete antes de revelar o {{targetLanguage}}. | src/components/InterpretationPanel.tsx:1335 | targetLanguage |
| stories.searchResults_many | {{count}} histórias encontradas | src/components/InterpretationPanel.tsx:1525<br>src/components/InterpretationPanel.tsx:1524 | count |
| stories.searchResults_one | {{count}} história encontrada | src/components/InterpretationPanel.tsx:1525<br>src/components/InterpretationPanel.tsx:1524 | count |
| stories.searchResults_other | {{count}} histórias encontradas | src/components/InterpretationPanel.tsx:1525<br>src/components/InterpretationPanel.tsx:1524 | count |
| stories.selectedIntentions | Intenções sorteadas | src/components/InterpretationPanel.tsx:1609 | — |
| stories.showTargetlanguageVersion | Mostrar versão em {{targetLanguage}} | src/components/InterpretationPanel.tsx:1804 | targetLanguage |
| stories.story | História | src/components/InterpretationPanel.tsx:1629 | — |
| stories.storyComicTitle | HQ da história: {{title}} | src/components/InterpretationPanel.tsx:1017<br>src/components/InterpretationPanel.tsx:2028 | title |
| stories.storyCopied | História copiada | src/components/InterpretationPanel.tsx:1679<br>src/components/InterpretationPanel.tsx:1680 | — |
| stories.storyFromIntentions | História por intenções | src/components/InterpretationPanel.tsx:1330 | — |
| stories.storyFromTheLocalLibrary | História da biblioteca local | src/components/InterpretationPanel.tsx:2450 | — |
| stories.storyJson | JSON da história | src/components/InterpretationPanel.tsx:2343<br>src/components/InterpretationPanel.tsx:2376 | — |
| stories.storyTitle | Título da história | src/components/InterpretationPanel.tsx:1467 | — |
| stories.storyTitleHistoriaTitle | História: {{title}} | src/components/InterpretationPanel.tsx:1708 | title |
| stories.thereIsNoTextInTargetlanguageToPlay | Não há texto em {{targetLanguage}} para reproduzir. | src/components/InterpretationPanel.tsx:526 | targetLanguage |
| stories.thereIsNoTextInTargetlanguageToPlayInThis | Não há texto em {{targetLanguage}} para reproduzir neste parágrafo. | src/components/InterpretationPanel.tsx:610 | targetLanguage |
| stories.thisStoryIsNotAvailableInTargetlanguageYetChooseAnother | Esta história ainda não está disponível em {{targetLanguage}}. Escolha outra história. | src/components/InterpretationPanel.tsx:214 | targetLanguage |
| stories.thisStoryWasLoadedFromTheMentalHashmapStoryLibrary | Esta história foi carregada da biblioteca de histórias do Mental Hashmap. | src/components/InterpretationPanel.tsx:2452 | — |
| stories.titleParagraphNumber | {{title}} — Parágrafo {{number}} | src/components/InterpretationPanel.tsx:1834<br>src/components/InterpretationPanel.tsx:1874 | number, title |
| stories.topic | Tema | src/components/InterpretationPanel.tsx:1389 | — |
| stories.typePartOfTheTitleInPortugueseOrTargetlanguage | Digite parte do título em português ou {{targetLanguage}}... | src/components/InterpretationPanel.tsx:1474 | targetLanguage |
| stories.viewDetailsForIntention | Ver detalhes de {{intention}} | src/components/InterpretationPanel.tsx:2474 | intention |
| stories.viewStoryComic | Ver HQ da história | src/components/InterpretationPanel.tsx:1747<br>src/components/InterpretationPanel.tsx:1748 | — |
| stories.yourBrowserBlockedThePrintWindowAllowPopUpsTo | O navegador bloqueou a janela de impressão. Permita pop-ups para imprimir a história. | src/components/InterpretationPanel.tsx:1136 | — |
| stories.yourBrowserDidNotAllowCopyingTheComicJson | O navegador não permitiu copiar o JSON da HQ. | src/components/InterpretationPanel.tsx:853 | — |
| stories.yourBrowserDidNotAllowCopyingTheJson | O navegador não permitiu copiar o JSON. | src/components/InterpretationPanel.tsx:742 | — |
| storyGeneration.aiDidNotMarkAllRequestedIntentionsInTheText | A IA não marcou no texto todas as intenções solicitadas: {{intentions}} | src/services/storyGenerationService.ts:254 | intentions |
| storyGeneration.aiDidNotReturnAValidStory | A IA não retornou uma história válida. | src/services/storyGenerationService.ts:361 | — |
| storyGeneration.aiDidNotUseAllRequestedIntentionsIntentions | A IA não utilizou todas as intenções solicitadas: {{intentions}} | src/services/storyGenerationService.ts:192 | intentions |
| storyGeneration.aiHighlightedAnIntentionThatWasNotRequestedIntention | A IA destacou uma intenção não solicitada: {{intention}} | src/services/storyGenerationService.ts:222 | intention |
| storyGeneration.aiReturnedAnIncompleteHighlightForIntentionIntention | A IA retornou um destaque incompleto para a intenção {{intention}}. | src/services/storyGenerationService.ts:228 | intention |
| storyGeneration.aiReturnedAnIncompleteParagraph | A IA retornou um parágrafo incompleto. | src/services/storyGenerationService.ts:210 | — |
| storyGeneration.aiReturnedAParagraphWithoutAnIntentionsArray | A IA retornou um parágrafo sem o array de intenções. | src/services/storyGenerationService.ts:215 | — |
| storyGeneration.aiReturnedAStoryOutsideThe610ParagraphLimit | A IA retornou uma história fora do limite de 6 a 10 parágrafos. | src/services/storyGenerationService.ts:179 | — |
| storyGeneration.aiReturnedAStoryWithoutACompleteTitle | A IA retornou uma história sem título completo. | src/services/storyGenerationService.ts:259 | — |
| storyGeneration.aiReturnedIntentionIdsThatWereNotRequestedIntentions | A IA retornou IDs de intenções não solicitadas: {{intentions}} | src/services/storyGenerationService.ts:202 | intentions |
| storyGeneration.generationCanceledWhenLeavingAuthorMode | Geração cancelada ao sair do Modo Author. | src/services/storyGenerationService.ts:321 | — |
| storyGeneration.generationWasBlockedByAiReason | A geração foi bloqueada pela IA: {{reason}}. | src/services/storyGenerationService.ts:350 | reason |
| storyGeneration.selectAtLeastOneIntentionToGenerateTheStory | Selecione pelo menos uma intenção para gerar a história. | src/services/storyGenerationService.ts:293 | — |
| storyGeneration.storyGenerationIsOnlyAvailableInAuthorModeWithAi | A geração de histórias está disponível somente no Modo Author com IA habilitada. | src/services/storyGenerationService.ts:270 | — |
| storyGeneration.theEnUsHighlightForIntentionIntentionIsNotAn | O destaque EN-US da intenção {{intention}} não existe literalmente no parágrafo. | src/services/storyGenerationService.ts:240 | intention |
| storyGeneration.thePtBrHighlightForIntentionIntentionIsNotAn | O destaque PT-BR da intenção {{intention}} não existe literalmente no parágrafo. | src/services/storyGenerationService.ts:234 | intention |
| translation.couldNotTranslateWithGoogle | Não foi possível traduzir com o Google. | src/services/googleTranslateService.ts:71 | — |
| translation.enterASentenceBeforeRequestingATranslation | Digite uma frase antes de solicitar a tradução. | src/services/googleTranslateService.ts:42 | — |
| translation.googleDidNotReturnATranslation | O Google não retornou uma tradução. | src/services/googleTranslateService.ts:91 | — |
| translation.googleTranslateRejectedTheRequestCheckTheApiKeyAnd | A chamada ao Google Translate foi recusada. Verifique a API key e suas restrições. {{apiMessage}} | src/services/googleTranslateService.ts:81 | apiMessage |
| translation.theGoogleTranslationLimitHasBeenReachedTryAgainLater | O limite de traduções do Google foi atingido. Tente novamente mais tarde. | src/services/googleTranslateService.ts:75 | — |
| translation.viteGoogleTranslateApiKeyIsNotConfigured | A variável VITE_GOOGLE_TRANSLATE_API_KEY não foi configurada. | src/services/googleTranslateService.ts:49 | — |
| vocabulary.couldNotLoadCategoryStatus | Não foi possível carregar {{category}} ({{status}}). | src/services/englishVerbService.ts:32 | category, status |
| vocabulary.incompleteEnglishForms | Formas inglesas incompletas. | src/services/englishVerbService.ts:45 | — |
| vocabulary.incompleteVerbForms | Formas verbais incompletas. | src/services/englishVerbService.ts:47 | — |
| vocabulary.invalidAdjective | Adjetivo inválido. | src/services/englishVerbService.ts:49 | — |
| vocabulary.invalidNoun | Substantivo inválido. | src/services/englishVerbService.ts:50 | — |
| vocabulary.invalidOrDuplicateVocabularyEntry | Registro de vocabulário inválido ou duplicado. | src/services/englishVerbService.ts:40 | — |
| vocabulary.invalidVocabularyCatalog | Catálogo de vocabulário inválido. | src/services/englishVerbService.ts:34 | — |
| vocabulary.theCatalogLanguageDoesNotMatchTheStudyLanguage | O idioma do catálogo não corresponde ao idioma de estudo. | src/services/englishVerbService.ts:35 | — |
| vocabulary.theVocabularyCatalogIsEmpty | O catálogo de vocabulário está vazio. | src/services/englishVerbService.ts:37 | — |
| vocabulary.verbMissingItsMainForm | Verbo sem forma principal. | src/services/englishVerbService.ts:43 | — |
| walking.autoAdvance | Avanço automático | src/components/WalkingMode.tsx:178 | — |
| walking.chooseAnotherLevelInSettings | Escolha outro nível nas configurações. | src/components/WalkingMode.tsx:152 | — |
| walking.couldNotPlayTheAudioTapResumeToTryAgain | Não foi possível reproduzir o áudio. Toque em Continuar para tentar novamente. | src/components/WalkingMode.tsx:81 | — |
| walking.keepScreenAwake | Manter tela ativa | src/components/WalkingMode.tsx:179 | — |
| walking.keepThisPageOpenAndYourPhoneUnlockedYourBrowser | Mantenha esta página aberta e o celular desbloqueado. O navegador pode suspender o áudio em segundo plano. Para trocar o idioma, encerre a caminhada. | src/components/WalkingMode.tsx:183 | — |
| walking.listenAndRepeat | Ouça e repita | src/components/WalkingMode.tsx:153 | — |
| walking.nextChunk | Próximo chunk | src/components/WalkingMode.tsx:159 | — |
| walking.noChunksAvailable | Nenhum chunk disponível. | src/components/WalkingMode.tsx:152 | — |
| walking.pauseBetweenPlaybacks | Pausa entre reproduções | src/components/WalkingMode.tsx:172 | — |
| walking.playbackSettings | Configurações de reprodução | src/components/WalkingMode.tsx:162 | — |
| walking.previousChunk | Chunk anterior | src/components/WalkingMode.tsx:157 | — |
| walking.repetitionsCompleted | Repetições concluídas | src/components/WalkingMode.tsx:154 | — |
| walking.repetitionsPerChunk | Repetições por chunk | src/components/WalkingMode.tsx:169 | — |
| walking.seconds | segundos | src/components/WalkingMode.tsx:173 | — |
| walking.theScreenMayTurnOffKeepThePageOpenTo | A tela pode apagar. Mantenha a página aberta para continuar. | src/components/WalkingMode.tsx:116 | — |
| walking.voiceSpeed | Velocidade da voz | src/components/WalkingMode.tsx:175 | — |
| walking.waitingForLevelSelection | Aguardando seleção de nível | src/components/WalkingMode.tsx:153 | — |
| walking.waitingForTheNextChunk | Aguardando próximo chunk | src/components/WalkingMode.tsx:153 | — |


---

## Fase 2 — integração da interface (16/10/2026)

A partir do projeto ZIP recebido, a integração i18next/react-i18next já estava parcialmente executada. Esta entrega preserva a integração e complementa os captions remanescentes identificados por varredura de JSX e atributos acessíveis.

- O idioma Source é a fonte única do idioma da interface; Target continua controlando o conteúdo pedagógico.
- Os componentes React usam `useTranslation()`; serviços e handlers fora de componentes usam a instância central.
- Traduções complementadas: título de Memory Flashcards, mensagem de atualização, contagem de parágrafos, controles mobile de Shadowing, rótulo de substantivos e contador da próxima rodada.
- Correções de textos residuais em português na busca de histórias, resultados, contagem de intenções, mensagens de voz e acessibilidade.
- Corrigida a interpolação de `shadowing.completionSummary` para `{{technique}}` (antes estava incorretamente `{{time}}`).
- Nomes de idiomas nas mensagens da tela de histórias agora seguem o idioma Source.
- Adicionado `npm run validate:i18n` para validar chaves, interpolações e referências literais.

### Verificações nesta entrega

- `node node_modules/typescript/bin/tsc -b --pretty false`: **aprovado**.
- `npm run validate:i18n`: **aprovado**.
- Teste direto do i18next para os quatro idiomas, incluindo plurais: **aprovado**.
- `npm run build`: a compilação TypeScript passou, mas o empacotamento Vite **não pôde ser validado neste ambiente Linux**, porque o `node_modules` fornecido era de Windows e não continha o pacote opcional `@rollup/rollup-linux-x64-gnu`. Execute `npm ci` e `npm run build` no Windows/VS Code.
- Os testes legados com carregador TypeScript próprio ainda precisam ser adaptados para os novos imports do i18n; não foram considerados aprovados nesta entrega.

Os campos dos JSONs pedagógicos não foram alterados. O relatório da Fase 1 permanece acima como registro histórico.
