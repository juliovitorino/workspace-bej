# BEJ — Especificação técnica dos avatares 3D Cedar e Marin

**Projeto:** Brazilian English Journey (BEJ)  
**Status:** especificação de produção e aceite — **não representa modelos 3D já criados**  
**Data:** 28/10/2026  
**Branch de integração futura:** `feature/avatar` (não modificar a branch durante esta etapa)  
**Referência obrigatória:** `referencia-cedar-marin.png` (imagem fornecida pelo proprietário do BEJ)

## 1. Objetivo

Criar dois personagens **3D cartoon reais, animáveis, da cintura para cima**, que reproduzam os MP3 já existentes no BEJ e apresentem movimentos de boca coerentes com a fala em inglês. A referência visual aprovada deve ser seguida de maneira muito próxima. O resultado não pode ser um conjunto de formas geométricas básicas, uma fotografia recortada ou um plano 2D com boca sobreposta.

O projeto será considerado aprovado somente após: **(a)** aceite da aparência dos dois modelos; **(b)** demonstração em vídeo de frases completas com áudio original; **(c)** teste no navegador em desktop e celular.

## 2. Identidade visual obrigatória

### Cedar — professor

- Adulto jovem, cartoon 3D com acabamento de filme de animação.
- Cabelo castanho-escuro penteado para cima e para o lado; sobrancelhas expressivas.
- Olhos castanhos grandes, sorriso natural e feições amistosas.
- Camisa polo azul-clara, gola e botões; pequeno emblema no peito, se viável sem copiar marca de terceiros.
- Calça azul-escura/cinto visíveis no enquadramento da cintura.
- Tablet cinza nas mãos; deve ser um objeto separado ou associado a ossos das mãos, para não impedir gestos.
- Não trocar roupas, penteado, faixa etária aparente ou paleta sem aprovação.

### Marin — professora

- Adulta, cartoon 3D no mesmo universo visual do Cedar.
- Cabelo castanho, curto e volumoso, penteado lateralmente.
- Óculos de armação escura azul-esverdeada, mantendo proporção e identidade.
- Olhos expressivos, sorriso acolhedor e aparência profissional.
- Camisa social azul-clara com gola branca; calça azul-escura e cinto.
- Mãos visíveis, postura aberta, gestos discretos de explicação.
- Não trocar óculos, roupas, penteado, faixa etária aparente ou paleta sem aprovação.

### Direção de arte comum

- Estilo cartoon 3D de alta qualidade: superfícies suaves, olhos vivos, pele com sombreamento delicado e cabelos modelados.
- Fundo transparente ou neutro; iluminação de estúdio suave.
- Enquadramento frontal ou 3/4 leve, da cintura para cima; a boca precisa permanecer visível.
- Evitar aparência infantil, realismo fotográfico, uncanny valley, boca de fantoche, olhos sem vida, movimentos bruscos ou exagerados.
- A imagem fornecida é referência frontal; lados, nuca e regiões ocultas deverão ser interpretados pelo artista e aprovados por prévias de 3 ângulos.

## 3. Entregáveis obrigatórios de modelagem

Para **cada personagem**:

1. `cedar.glb` ou `marin.glb`: glTF 2.0 válido, com malha 3D, materiais PBR, texturas e rig de corpo/rosto.
2. Arquivo-fonte editável `.blend` com organização de objetos, nomes de morph targets e materiais.
3. Prévia de frente, 3/4 e perfil (imagens) e um vídeo curto de expressões faciais.
4. Malhas e controles faciais preparados para fala; olhos com piscar independente; rig simples para pescoço, ombros, braços e mãos.
5. Documentação dos nomes dos blendshapes e de qualquer limitação técnica.
6. Licença/autorização escrita de uso, modificação e distribuição no BEJ, inclusive em uma versão comercial futura. Declarar a procedência de todos os recursos de terceiros.

**Orçamento inicial de performance (meta, não regra inflexível):** idealmente até ~50 mil triângulos visíveis por personagem, GLB comprimido de até ~10 MB por personagem e texturas de 1K–2K. O desempenho real no iPhone e no tablet prevalece sobre o número isolado de polígonos. Otimizar apenas depois de preservar a aparência aprovada.

### Morph targets faciais mínimos

Preferência por nomes compatíveis com o conjunto de visemas Oculus/Ready Player Me (ou fornecer tabela de equivalência documentada):

`viseme_sil`, `viseme_PP`, `viseme_FF`, `viseme_TH`, `viseme_DD`, `viseme_kk`, `viseme_CH`, `viseme_SS`, `viseme_nn`, `viseme_RR`, `viseme_aa`, `viseme_E`, `viseme_I`, `viseme_O`, `viseme_U`.

Também são desejáveis: `eyeBlinkLeft`, `eyeBlinkRight`, `jawOpen`, `mouthSmile` e movimento de sobrancelhas. Os nomes exatos podem ser adaptados, **desde que os controles sejam efetivos e documentados**. Um GLB sem formas faciais animáveis **não atende** ao MVP.

## 4. Lip-sync — substituir a animação por volume

A animação anterior, baseada no volume RMS do MP3, deve ser removida do caminho principal. Ela abre/fecha a boca sem representar os sons e produziu resultado visual inadequado.

### Pipeline offline

1. Ler o texto exato do exemplo em inglês e o caminho do MP3 da voz (`cedar` ou `marin`) já presentes no BEJ.
2. Gerar **cues temporizados** de boca por processamento offline do áudio (por exemplo, Rhubarb Lip Sync, que fornece formas de boca A–H/X). Se necessário, converter o MP3 temporariamente para WAV mono com FFmpeg antes da análise.
3. Quando houver exigência de maior precisão, usar alinhamento fonético/forçado com texto e áudio e converter fonemas para os visemas suportados pelo rig. Não pressupor que análise por volume produz fonemas.
4. Salvar os cues em **arquivos JSON auxiliares**, sem alterar o contrato canônico das intenções e dos exemplos.
5. No navegador, reproduzir o MP3 **original** e usar `HTMLAudioElement.currentTime` como relógio para os cues, com interpolação suave entre visemas.
6. Ao pausar, terminar, pular ou trocar de voz/exemplo, encerrar a animação correspondente e retornar à expressão neutra. Não deixar movimentos residuais.

### Exemplo de contrato auxiliar (proposta)

Local: `public/avatar/lipsync/en-US/<voz>/<exampleId>.json`.

```json
{
  "schemaVersion": 1,
  "exampleId": "00000000-0000-0000-0000-000000000000",
  "voice": "cedar",
  "audioPath": "/audio/en-US/cedar/00000000-0000-0000-0000-000000000000.mp3",
  "mouthCues": [
    { "start": 0.00, "end": 0.12, "value": "X" },
    { "start": 0.12, "end": 0.28, "value": "B" },
    { "start": 0.28, "end": 0.45, "value": "C" },
    { "start": 0.45, "end": 0.60, "value": "X" }
  ]
}
```

O exemplo acima é **ilustrativo**; os tempos e o `audioPath` precisam ser gerados dos arquivos reais. Os códigos A–H/X de um gerador de cues **não são** automaticamente os mesmos 15 morph targets do avatar: será necessário um **mapeamento explícito e testado**, ou um pipeline fonema→visema compatível com o rig.

Se não houver dados de lip-sync para um MP3, preservar o áudio normal e manter a boca em estado neutro, com indicação de indisponibilidade no desenvolvimento. **Não** voltar ao movimento aleatório por amplitude como substituto silencioso.

## 5. Integração futura com BEJ

**Não implementar nesta fase de especificação.** Quando os GLBs e a demonstração forem aprovados:

- Reutilizar a preferência de voz existente (`bej.tts.voice`), sem criar uma segunda preferência conflitante.
- Cedar é associado à voz `cedar`; Marin, à voz `marin`.
- Reutilizar a reprodução dos MP3 já cadastrados e o controle de áudio existente (`neuralExampleAudio.ts` / `useExampleAudio.ts`), sem duplicar áudio.
- Integrar primeiro à tela `IntentionDetails.tsx`, apenas na experiência de estudo em inglês em que faça sentido.
- Não alterar `sample-hashmap-*.json`, IDs de exemplos, contrato multilíngue, favoritos, dashboard, localStorage, sincronização Google Drive ou contabilização de estudo.
- Carregar GLBs e cues sob demanda; evitar carregar os dois modelos e toda a base de lip-sync na inicialização.
- Preservar funcionamento do botão de áudio mesmo se WebGL falhar ou o modelo não carregar.
- Acessibilidade: opção de desativar animações, suporte a `prefers-reduced-motion` e áudio funcional sem avatar.
- No mobile, observar consumo de memória, fluidez, gestos de rolagem e mudança de orientação.

## 6. Critérios de aceite visual

- [ ] Cedar reconhecivelmente fiel à referência: cabelo, rosto, camisa azul e tablet.
- [ ] Marin reconhecivelmente fiel à referência: cabelo curto, óculos, camisa azul e gestos.
- [ ] Mesmo estilo de renderização nos dois personagens.
- [ ] Boca modelada com volume e contorno naturais, sem parecer um retângulo ou abertura colada.
- [ ] Piscadas naturais, cabeça e ombros com movimentos discretos; sem trepidação.
- [ ] Prévia de frente, perfil e 3/4 aprovada antes de começar integração.
- [ ] Tablet e óculos não atravessam mãos, rosto ou roupa durante a animação.

## 7. Critérios de aceite de fala

Usar **MP3s reais do BEJ**, para Cedar e Marin. Escolher pelo menos três exemplos que cubram vogais, bilabiais (P/B/M), sons F/V e TH, pausas e diferentes velocidades. Sugestões de frases para localizar/gravar como teste, caso estejam disponíveis no acervo:

1. “I've got this. You can relax.”
2. “Think about the three things.”
3. “We should move on to the next point.”

Essas frases são **candidatas**, não afirmação de que os MP3 já existem.

- [ ] Lábios fecham adequadamente em sons bilabiais e repousos.
- [ ] Abertura, arredondamento e articulação variam conforme os sons; não é apenas abre/fecha.
- [ ] Boca não continua falando após o áudio terminar.
- [ ] Troca Cedar↔Marin usa o modelo e MP3 corretos.
- [ ] Pausa, repetição, troca de exemplo e interrupção não causam dessintonia ou áudio duplo.
- [ ] Aceite humano por inspeção de vídeo com áudio; não apenas build TypeScript bem-sucedido.

## 8. Etapas e pontos de aprovação (gates)

**Gate 1 — Arte:** entregar vistas dos dois personagens e comparar lado a lado com `referencia-cedar-marin.png`. Sem aprovação, não criar rig definitivo.

**Gate 2 — Modelo animável:** entregar dois `.glb`, fontes `.blend` e demonstração de piscadas, sorriso e 5+ formas de boca distintas. Validar os nomes dos morph targets.

**Gate 3 — Fala isolada:** demonstrar, fora do BEJ, pelo menos uma frase completa de Cedar e uma de Marin, usando MP3 real e cues temporizados; corrigir a boca antes da integração.

**Gate 4 — BEJ:** integrar em `feature/avatar`, rodar `npm run build`, validar desktop/iPhone/tablet e confirmar que estudo/áudio continuam normais.

**Gate 5 — Entrega:** fornecer ZIP de arquivos para cópia manual, instruções de instalação e lista de arquivos alterados. **Não** mudar branch nem fazer commit no repositório do usuário.

## 9. Riscos e decisões

- Uma única imagem frontal **não contém** topologia, rig, profundidade nem informações de perfil. O modelo precisa ser criado e revisado por vistas adicionais.
- Conversão automática de imagem para 3D pode servir de rascunho, mas **não garante** fidelidade nem blendshapes úteis.
- A qualidade do lip-sync depende tanto da qualidade dos cues quanto da geometria e das expressões faciais; geração automática exige revisão.
- Modelos comprados/gerados podem ter licenças que impedem redistribuição; verificar antes de integrá-los.
- **Não considerar o projeto concluído** com apenas imagens bonitas, arquivos GLB estáticos ou build aprovado.

## 10. Próxima ação concreta

Produzir **prévias de modelagem** de Cedar e Marin (frente, perfil, 3/4) com fidelidade à referência. Somente após o aceite, produzir os arquivos `.glb` e `.blend` com controles faciais. Depois validar um teste de fala isolado com os MP3 reais, antes de tocar no código BEJ.
