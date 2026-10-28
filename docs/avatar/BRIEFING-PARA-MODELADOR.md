# Briefing para artista/modelador 3D — Cedar e Marin (BEJ)

## Pedido

Modelar **dois personagens 3D cartoon**, com fidelidade visual muito alta à imagem `referencia-cedar-marin.png`. Personagens da cintura para cima, para uso em uma aplicação React/Three.js de estudo de inglês.

**Cedar:** homem jovem-adulto, cabelo castanho levantado, polo azul-clara, calça escura, tablet nas mãos, simpático.  
**Marin:** mulher adulta, cabelo castanho curto, óculos escuros azul-esverdeados, camisa azul-clara com gola branca, calça escura, mãos gesticulando.

O estilo deve ser de animação 3D de qualidade, não low-poly geométrico nem fotorealista. Conservar identidade, cores, proporções, roupas e acessórios da referência.

## Entrega em duas fases

**Fase A — aprovação visual:** render frontal, 3/4 e perfil de cada personagem, lado a lado com a referência; uma rodada de revisão de identidade antes de avançar.

**Fase B — rig facial e exportação:** `.blend` editável e `.glb` para cada personagem, com rig simples de corpo e morph targets para fala e expressões. Preferir os 15 visemas Oculus (`viseme_sil`, `viseme_PP`, `viseme_FF`, `viseme_TH`, `viseme_DD`, `viseme_kk`, `viseme_CH`, `viseme_SS`, `viseme_nn`, `viseme_RR`, `viseme_aa`, `viseme_E`, `viseme_I`, `viseme_O`, `viseme_U`) ou entregar mapeamento documentado. Exigir piscadas, sorriso e movimento de cabeça/ombros.

## Critérios de rejeição

- Personagens montados com primitivas (esferas, caixas, cilindros) sem acabamento profissional.
- Rosto plano/2D, boca que apenas abre e fecha, ausência de morph targets.
- GLB estático sem rig de expressão.
- Mudança evidente de cabelo, óculos, roupa ou identidade.
- Arquivo sem licença de uso e redistribuição adequada ao aplicativo.

## Teste obrigatório

Demonstrar **fala com áudio real** de cada voz antes da integração: lábios coerentes com fonemas, pausas naturais, fechamento ao terminar e expressões discretas. Não aprovar somente com imagens estáticas.

Ver `ESPECIFICACAO-AVATARES-3D.md` para detalhes completos de integração e aceite.
