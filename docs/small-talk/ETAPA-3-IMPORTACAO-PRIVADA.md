# BEJ Small Talk — Etapa 3 (feature/smalltalk)

## Objetivo

Adicionar a importação **privada** do arquivo `small-talk-personal-answers.json` para `localStorage`, com prévia, backup local obrigatório, preservação de originais e revisões, bloqueio de conflitos e ponto de entrada em **Configurações > Dados**.

O ZIP **não contém nenhuma resposta pessoal**. Não coloque o JSON privado em `public/`, `src/`, `docs/` nem em qualquer pasta do repositório.

## Instalação PowerShell

```powershell
$repo = 'C:\Users\julio.vitorino\Documents\workspaces\mental-hashmap-app-mvp\mental-hashmap-app'
$pkg = 'C:\Users\julio.vitorino\Downloads\BEJ-SmallTalk-Etapa3-feature-smalltalk\BEJ-SmallTalk-Etapa3-feature-smalltalk'
Set-Location $repo
if ((git branch --show-current) -ne 'feature/smalltalk') { throw 'Branch incorreta.' }
Copy-Item "$pkg\src\services\smallTalkPersonalAnswersService.ts" "$repo\src\services\" -ErrorAction Stop
Copy-Item "$pkg\src\components\SmallTalkPersonalImport.tsx" "$repo\src\components\" -ErrorAction Stop
Copy-Item "$pkg\scripts\install-small-talk-step3.mjs" "$repo\scripts\" -ErrorAction Stop
Copy-Item "$pkg\scripts\test-small-talk-private.mjs" "$repo\scripts\" -ErrorAction Stop
Copy-Item "$pkg\scripts\check-small-talk-private-fixture.mjs" "$repo\scripts\" -ErrorAction Stop
Copy-Item "$pkg\docs\small-talk\ETAPA-3-IMPORTACAO-PRIVADA.md" "$repo\docs\small-talk\" -ErrorAction Stop
node .\scripts\install-small-talk-step3.mjs
node --experimental-strip-types --test .\scripts\test-small-talk-private.mjs
node .\scripts\validate-small-talk.mjs
npm run build
```

## Como importar

1. Abra o BEJ na branch feature/smalltalk (`npm run dev`).
2. Vá para **Configurações > Dados > Small Talk — respostas pessoais**.
3. Selecione **o arquivo privado** `small-talk-personal-answers.json` que ficou na pasta `LOCAL-PRIVADO-NAO-COPIAR-PARA-O-REPO` da Etapa 1.
4. Revise a prévia. Se houver conflitos, a importação fica bloqueada.
5. Clique em **Baixar backup atual do Small Talk**. Confirme que o download foi salvo.
6. Clique em **Confirmar importação privada**.
7. Confira a contagem. A reimportação do mesmo arquivo deve resultar em registros já existentes, sem duplicação.

**Atenção:** a sincronização Google Drive atual **ainda não inclui** a chave `bej:small-talk:personal-answers:v1`. O backup desta etapa é específico do Small Talk e não substitui o backup completo do BEJ. Antes de limpar dados ou trocar de dispositivo, salve o backup do Small Talk.

## Commit

```powershell
git add src/services/smallTalkPersonalAnswersService.ts src/components/SmallTalkPersonalImport.tsx src/components/AppSettingsPage.tsx scripts/install-small-talk-step3.mjs scripts/test-small-talk-private.mjs scripts/check-small-talk-private-fixture.mjs docs/small-talk/ETAPA-3-IMPORTACAO-PRIVADA.md
git diff --cached --check
git commit -m "feat(small-talk): adiciona importacao privada de respostas com backup e merge seguro"
```

## Limites conhecidos

- Não há ainda player de caminhada Small Talk.
- Não há sincronização Google Drive das respostas do Small Talk nesta etapa.
- Não há gravação ou envio das respostas a servidor.
- A validação aceita somente `en-US` na importação original do DOCX; outros idiomas serão tratados em etapa posterior.
- O backup é disparado pelo navegador, mas o app não consegue comprovar que o arquivo foi salvo; o usuário confirma.
- Se uma importação encontrar divergência de original, ela é bloqueada integralmente e exige resolução manual.
