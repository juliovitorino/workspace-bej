# BEJ Small Talk — Etapa 2 — Validação e leitura do catálogo

## Instalação
Copiar **somente** `src/`, `scripts/` e `docs/` deste pacote para a raiz da branch local `feature/smalltalk`.
**Não copiar dados privados para o repositório.** O pacote não contém respostas pessoais.

## Arquivos adicionados
- `src/types/smallTalk.ts`: interfaces de catálogo, respostas pessoais, revisões e configuração de caminhada.
- `src/services/smallTalkCatalogService.ts`: leitor público com `loadSmallTalkIndex`, `loadSmallTalkTopic` e `loadSmallTalkItems`. Não persiste dados.
- `scripts/validate-small-talk.mjs`: validador não destrutivo; somente relata erros e avisos.
- `scripts/test-small-talk-data.mjs`: testes com `node:test`.

## Validação (PowerShell)
```powershell
node .\scripts\validate-small-talk.mjs
node --test .\scripts\test-small-talk-data.mjs
npm run build
```
O validador deve terminar com **zero erros** e avisos de `staging`/nível CEFR pendente.
**Não execute `--strict` ainda**: os 603 níveis não foram revisados e o catálogo ainda não está aprovado.

### Validação privada opcional (fora do Git)
Se o arquivo de respostas pessoais estiver guardado fora do projeto:
```powershell
node .\scripts\validate-small-talk.mjs --private 'C:\CAMINHO-FORA-DO-REPO\small-talk-personal-answers.json'
```
O comando mostra contadores e códigos de inconsistência, **não imprime textos pessoais**. Ele não importa dados para o BEJ.

## Uso no React (quando a tela for implementada)
```ts
import { loadSmallTalkIndex, loadSmallTalkTopic } from '../services/smallTalkCatalogService';
const index = await loadSmallTalkIndex();
const greetings = await loadSmallTalkTopic('greetings', 'en-US');
```
O serviço rejeita `pt-BR`, `es-ES` e `fr-FR` enquanto não houver catálogos publicados; não traduz automaticamente e não mistura idiomas silenciosamente.

## Limites desta etapa
- **Não** modifica o conteúdo dos 55 JSONs da Etapa 1.
- **Não** implementa tela, importador pessoal, armazenamento local, merge Google Drive ou player de caminhada.
- O contrato do Modo Caminhada permanece: `playDefaultAnswer: false` = responder livremente; `true` = reproduzir `original` do DOCX, não revisão.
- `level: null` e `reviewStatus: pending` são válidos apenas enquanto os dados estiverem em staging.
- A validação estrutural **não substitui** a revisão editorial nem de privacidade dos textos públicos.

## Próxima etapa recomendada
Importação privada via seleção de arquivo no navegador com prévia, backup obrigatório antes de mesclar, persistência local e testes de idempotência; depois conectar o Modo Caminhada.
