# BEJ — Checklist de aprovação Cedar/Marin

## Gate 1: fidelidade visual
- [ ] Cedar mantém rosto, cabelo, polo azul e tablet da referência
- [ ] Marin mantém rosto, cabelo, óculos e camisa azul da referência
- [ ] Ambos têm qualidade cartoon 3D coerente
- [ ] Vistas frontal, 3/4 e perfil aprovadas

## Gate 2: modelos animáveis
- [ ] `cedar.glb` e `marin.glb` válidos
- [ ] Fontes `.blend` entregues
- [ ] Rig de cabeça/ombros/braços e controles de piscada
- [ ] Morph targets de boca presentes e testados
- [ ] Licença adequada para BEJ

## Gate 3: áudio + boca
- [ ] MP3 real Cedar reproduz com movimentos coerentes
- [ ] MP3 real Marin reproduz com movimentos coerentes
- [ ] Sons P/B/M fecham os lábios
- [ ] Vogais e TH/F/V produzem formas distintas
- [ ] Pausas e fim do áudio retornam à boca neutra
- [ ] Troca de voz, replay e interrupção sem dessincronização

## Gate 4: integração
- [ ] Somente `feature/avatar`
- [ ] `npm run build` passa
- [ ] Desktop, iPhone e tablet testados
- [ ] Sem mudanças no contrato JSON, favoritos, storage, Drive ou tracking
- [ ] Sem regressão quando WebGL/lip-sync indisponível

**Regra:** não avançar ao próximo gate com o atual reprovado.
