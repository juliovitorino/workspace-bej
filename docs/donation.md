# Doações no Brazilian English Journey

A seção **Doação** e o convite no rodapé dos módulos são configurados em `public/config/donation.json`. Não há necessidade de backend ou banco de dados.

## Exemplo de configuração

```json
{
  "donation": {
    "enabled": true,
    "footer": { "visible": true },
    "pix": {
      "enabled": true,
      "key": "SUA_CHAVE_PIX",
      "holderName": "NOME_DO_BENEFICIARIO"
    },
    "bitcoin": {
      "enabled": true,
      "network": "bitcoin",
      "address": "SEU_ENDERECO_PUBLICO_BTC"
    },
    "content": {
      "title": "",
      "description": "",
      "footerMessage": "",
      "buttonLabel": ""
    }
  }
}
```

- `donation.enabled: false`: oculta a opção Doação no menu e o convite no rodapé.
- `donation.footer.visible: false`: mantém a página Doação no menu, mas oculta o convite no final dos módulos.
- `pix.enabled` e `bitcoin.enabled`: controlam cada método individualmente.
- `pix.key` e `bitcoin.address`: campos públicos copiados para a área de transferência. Se vazios, os botões Copiar ficam desabilitados.
- `bitcoin.network`: usar **somente** `bitcoin` (rede principal BTC). Outros valores desabilitam a opção Bitcoin para evitar instruções incompatíveis.
- `content`: valores vazios utilizam os textos traduzidos do aplicativo (pt-BR, en-US, es-ES e fr-FR). Valores preenchidos substituem os textos em todos os idiomas.

O arquivo é servido publicamente pelo Cloudflare Pages. **Nunca inclua senha, chave privada de Bitcoin, seed phrase ou credenciais de carteira nesse JSON.** Utilize apenas o endereço público de recebimento. A chave Pix também será pública: avalie a privacidade dos dados que ela expõe antes de publicar.

Depois de alterar o arquivo, publique uma nova versão do aplicativo. A configuração é carregada quando a página abre, sem persistência no localStorage nem interferência no sincronismo dos estudos.

## Testes manuais sugeridos

1. Habilitar Doação e conferir o coração no menu desktop e no hambúrguer mobile.
2. Conferir Pix e Bitcoin com endereços válidos; copiar cada um e colar em outro campo.
3. Deixar uma chave vazia e verificar que o respectivo botão fica desabilitado.
4. Definir `footer.visible: false` e verificar que os convites desaparecem, mas a página continua acessível.
5. Definir `donation.enabled: false` e verificar que a opção desaparece do menu e dos rodapés.
6. Abrir Dashboard, Small Talk, WRG, Hashmap e demais módulos; conferir que o convite fica **após o conteúdo**, não flutuando sobre os exercícios.
