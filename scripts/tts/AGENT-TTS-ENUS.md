# Agente Codex — BEJ 4.0 / Geração e sincronização neural TTS

## Missão
Manter MP3 de exemplos `en-US` sincronizados com o Mental Hashmap, registrando no próprio `examples[]` os atributos `mp3` e `hashmp3`. Implementação local simples em Node.js, sem backend ou banco de dados.

## Arquivos
- Projeto: `C:\Users\julio.vitorino\Documents\workspaces\mental-hashmap-app-mvp\mental-hashmap-app`
- Fonte e destino de metadados: `public/sample-hashmap-en-US.json`
- Script: `scripts/tts/generate.mjs`
- Áudios: `public/audio/en-US/{cedar,marin}/<exampleId>-<voice>.mp3`

## Contrato do JSON
- Percorrer `mentalMap[].examples[]`, na ordem original.
- Usar o `examples[].id` (UUID) para o nome do arquivo e `examples[].exampleItem` **exatamente como armazenado** como texto de síntese e entrada de SHA-256 UTF-8.
- Em cada exemplo processado, registrar somente as chaves correspondentes às vozes geradas, sem apagar outros atributos:
  - `mp3.cedar` e `mp3.marin`: caminhos públicos `/audio/en-US/<voice>/<id>-<voice>.mp3`.
  - `hashmp3.cedar` e `hashmp3.marin`: SHA-256 hexadecimal do texto `exampleItem` (não hash dos bytes do MP3).
- O mesmo texto gera o mesmo hash nas duas vozes. Não alterar a frase para sintetizar, nem remover espaços do valor usado no hash.
- Não tocar em `metadata`, outras intenções, outros idiomas ou arquivos fora do escopo; preservar todos os campos existentes.
- Interromper diante de UUID duplicado, especialmente se houver textos conflitantes.

## Seleção e regeneração
- Limite rígido: **até 3 exemplos por execução**, e **até 6 chamadas/MP3** (Cedar + Marin).
- Escolher os primeiros 3 exemplos com ao menos uma voz pendente.
- Uma voz está atualizada somente se (1) MP3 existe e não está vazio, (2) `mp3[voice]` corresponde ao caminho esperado, (3) `hashmp3[voice]` é igual ao SHA-256 atual da frase.
- Se arquivo ausente, metadados ausentes ou hash divergente: **regenerar a voz**, substituindo o MP3 pelo novo arquivo de mesmo nome. Não reutilizar MP3 cujo texto de origem não possa ser comprovado.
- Se apenas Marin estiver pendente, não regenerar Cedar.
- Cedar é a voz padrão futura; Marin é alternativa. Não implementar seletor na interface nesta tarefa.

## Segurança, custos e persistência
- API OpenAI: `gpt-4o-mini-tts`, saída MP3, instruções de inglês americano natural, fala casual, connected speech.
- `OPENAI_API_KEY` somente por variável de ambiente; não exibir ou gravar segredo.
- Executar primeiro `node scripts/tts/generate.mjs --dry-run`, sem chamadas pagas nem alterações em disco.
- Somente após autorização do usuário executar `node scripts/tts/generate.mjs`.
- Fazer backup único do JSON antes da primeira geração real; não sobrescrever backup já existente.
- Gravar MP3 e JSON por arquivos temporários + rename. Atualizar o JSON **somente após** a geração bem-sucedida do MP3 e registrar cada voz imediatamente para permitir retomada após interrupção.
- Em caso de falha, interromper; preservar os áudios e metadados já concluídos. Se MP3 foi substituído e o JSON falhou, a próxima execução deve detectar divergência e regenerar.
- Não executar geração em massa nem aumentar o limite de 3 sem autorização explícita.

## Validação e entrega
- Validar sintaxe do script (`node --check scripts/tts/generate.mjs`).
- Confirmar `--dry-run` sem modificar arquivos, e verificar estrutura dos caminhos e dos hashes.
- Reportar exemplos selecionados, vozes geradas, falhas e alterações feitas.
- Atenção: a alteração de `examples[]` pode exigir atualização de verificações globais de integridade existentes no projeto; não alterar regras de integridade sem inspecioná-las e obter autorização.
