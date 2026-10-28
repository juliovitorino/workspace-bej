# Alternativa sem executar o instalador

Copie `src/features/avatar/AvatarStage.tsx` e `src/features/avatar/avatar.css` para os mesmos caminhos no projeto.

## 1. `src/features/study/neuralExampleAudio.ts`

Encontre:

```ts
let audio: HTMLAudioElement | null = null;
```

Adicione logo abaixo:

```ts
/** Somente leitura: relógio real do MP3 para sincronizar a boca. */
export function getActiveNeuralAudio(): HTMLAudioElement | null {
  return audio;
}
```

## 2. `src/components/IntentionDetails.tsx`

Depois do import:

```ts
import { useExampleAudio } from "../features/study/useExampleAudio";
```

Adicione:

```ts
import { AvatarStage } from "../features/avatar/AvatarStage";
```

Logo abaixo de:

```tsx
<p className="detail-english" lang={language}>{item.targetIntention ?? item.english}</p>
```

Adicione:

```tsx
{language === "en-US" && (
  <AvatarStage
    example={item.examples?.find((candidate) => candidate.id === playback?.id) ?? null}
    isPlaying={playback?.state === "playing"}
  />
)}
```

## 3. Instale as dependências

```powershell
npm install three
npm install -D @types/three
npm run build
```

A integração não cria nenhuma nova chave de localStorage, não altera o contrato JSON e não altera a branch do GitHub.
