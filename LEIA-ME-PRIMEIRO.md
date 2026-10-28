# BEJ — MVP Avatar 3D (Cedar e Marin)

Base consultada: branch `master`, versão do package.json `4.37.0.20261027.1226` (28/10/2026).
Destino: **somente arquivos locais** da branch `feature/avatar`.

## O que entrega

- Dois avatares **3D procedurais reais** (Three.js), cartoon, da cintura para cima.
- Cedar (professor, camiseta azul) e Marin (professora, roupa amarela).
- Seleção automática por `bej.tts.voice` / `getNeuralVoice` (sem criar nova preferência).
- Integração na tela `IntentionDetails` para o idioma `en-US`.
- Movimento da boca por envelope RMS do MP3 associado ao exemplo, amostrado em 40 Hz e sincronizado com `HTMLAudioElement.currentTime`.
- Fallback de movimento aproximado para SpeechSynthesis ou enquanto o envelope não está disponível.
- Não altera contrato JSON, nem MP3, nem lógica de tracking de estudo.

**Limitação técnica:** o MVP não produz visemas fonéticos nem movimentos labiais anatomicamente precisos. RMS representa volume, não fonemas. A qualidade visual é um protótipo 3D cartoon gerado por geometria; modelos GLB profissionais e rig facial ficam para uma evolução.

## Instalação (PowerShell, Windows)

1. Entre no repositório e confirme `git branch --show-current` = `feature/avatar`.
2. Extraia o ZIP na **raiz do repositório**, preservando `src/features/avatar/` e `scripts/`.
3. Execute `node scripts/install-avatar-mvp.mjs`.
4. Execute `npm install three` e `npm install -D @types/three`.
5. Execute `npm run build` e `npm run dev`.
6. Abra uma intenção com exemplos em `en-US`, clique no botão de áudio de um exemplo. Troque a voz Cedar/Marin na preferência já existente do BEJ.

O instalador não faz checkout, commit, push ou alteração remota. Ele cria backups `.pre-avatar.bak` dos dois arquivos existentes antes da primeira modificação. **Não rode na master.**

## Arquivos novos

- `src/features/avatar/AvatarStage.tsx`
- `src/features/avatar/avatar.css`
- `scripts/install-avatar-mvp.mjs`

## Alterações pontuais nos arquivos existentes

O instalador faz apenas estas 3 inserções:

1. `src/features/study/neuralExampleAudio.ts`: adiciona `getActiveNeuralAudio()` após a declaração `let audio`.
2. `src/components/IntentionDetails.tsx`: importa `AvatarStage`.
3. `src/components/IntentionDetails.tsx`: renderiza `<AvatarStage>` abaixo do título em inglês.

Se preferir fazer tudo manualmente, os trechos exatos estão em `ALTERACOES-MANUAIS.md`.

## Verificação e rollback

- `git diff -- src/components/IntentionDetails.tsx src/features/study/neuralExampleAudio.ts package.json package-lock.json`
- `npm run build`
- Teste: iniciar, terminar, interromper, trocar exemplo e trocar voz durante a reprodução.
- Rollback local: restaure os dois arquivos a partir dos `.pre-avatar.bak`, apague `src/features/avatar` e remova as dependências Three.js se desejar.

## Observações

- Os modelos não usam câmera nem microfone, apenas o MP3 do exemplo.
- A decodificação do MP3 faz uma leitura adicional do mesmo URL (cache HTTP pode evitar novo download).
- Se WebGL não estiver disponível, a tela apresenta uma mensagem; a reprodução de áudio continua independente.
- A tela de detalhes não é responsável pelo controle global de todas as reproduções do app. Este MVP integra somente `IntentionDetails`.
- Em dispositivos modestos, pode haver custo de GPU; validar iPhone e tablet Samsung antes de expandir para modo caminhada.
