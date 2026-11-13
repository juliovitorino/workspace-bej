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
      "holderName": "N*** S*****",
      "qrHolderName": "NOME_COMPLETO_DO_BENEFICIARIO",
      "city": "CIDADE",
      "qrCodeEnabled": true
    },
    "bitcoin": {
      "enabled": true,
      "network": "bitcoin",
      "address": ["SEU_ENDERECO_PUBLICO_BTC", "OUTRO_ENDERECO_PUBLICO_BTC"],
      "qrCodeEnabled": true
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
- `pix.key`: chave pública copiada para a área de transferência. Se vazia, o botão Copiar fica desabilitado.
- `bitcoin.address`: **lista `string[]` de endereços públicos Bitcoin**. O parser também aceita a configuração antiga com uma única string, para compatibilidade. Endereços vazios e duplicados são removidos.
- `pix.qrCodeEnabled` e `bitcoin.qrCodeEnabled`: ativam ou desativam individualmente a exibição dos QR Codes.
- `bitcoin.network`: usar **somente** `bitcoin` (rede principal BTC). Outros valores desabilitam a opção Bitcoin para evitar instruções incompatíveis.
- `content`: valores vazios utilizam os textos traduzidos do aplicativo (pt-BR, en-US, es-ES e fr-FR). Valores preenchidos substituem os textos em todos os idiomas.

### QR Code Pix (BR Code estático)

O QR Code Pix é gerado localmente com payload EMV/BR Code e CRC16, **sem valor fixo**. O pagador informa o valor no aplicativo bancário. O botão **Pix Copia e Cola** copia o payload completo (não apenas a chave Pix).

Para gerar o QR Code Pix, preencha:
- `pix.key`: chave Pix válida (UUID, e-mail, telefone ou chave aleatória).
- `pix.holderName`: **nome mascarado exibido na tela do BEJ** (pode conter asteriscos).
- `pix.qrHolderName`: **nome do recebedor sem máscara**, até 25 caracteres ASCII após remoção de acentos, usado exclusivamente na geração do BR Code.
- `pix.city`: **cidade do recebedor**, até 15 caracteres ASCII após remoção de acentos.

Se `qrHolderName` estiver vazio, contiver asteriscos ou se `city` estiver vazio, o BEJ **não gera o QR Pix** e mostra um aviso de configuração. Isso evita exibir um código de pagamento potencialmente incorreto. A chave Pix continua copiável. O nome exibido no BEJ permanece mascarado mesmo com o QR habilitado. **Atenção:** `qrHolderName` é incorporado ao QR Code e fica no JSON público; a máscara na tela não impede que o nome seja obtido por inspeção do arquivo ou leitura do QR. Verifique os dados do recebedor no aplicativo bancário antes de publicar.

### QR Code Bitcoin

O QR Code Bitcoin codifica uma URI `bitcoin:ENDERECO` (BIP21), sem valor definido, para endereços da rede principal (legado ou SegWit). A tela mostra **um único endereço ativo e seu QR Code**. Ao clicar em **Copiar endereço BTC**, o app sorteia um endereço válido da lista, evitando repetir o endereço ativo quando existem dois ou mais, copia o endereço sorteado e **atualiza o texto e o QR Code para o mesmo endereço**. A modal de confirmação mostra o endereço realmente copiado. Se a cópia falhar, o endereço ativo e o QR Code não mudam. Com apenas um endereço válido, o mesmo endereço é copiado.

A seleção inicial é aleatória e permanece estável até a próxima cópia. Entradas incompatíveis com o formato de endereço Bitcoin mainnet são ignoradas na seleção; se não houver endereço válido, o botão Copiar fica desabilitado. O botão permanece disponível quando `qrCodeEnabled` é `false`. Teste os endereços em uma carteira compatível e confirme o destinatário antes de publicar.

O QR Code é renderizado localmente no navegador usando `qrcode.react`. Não há API externa nem backend.

O arquivo é servido publicamente pelo Cloudflare Pages. **Nunca inclua senha, chave privada de Bitcoin, seed phrase ou credenciais de carteira nesse JSON.** Utilize apenas o endereço público de recebimento. A chave Pix também será pública: avalie a privacidade dos dados que ela expõe antes de publicar.

Depois de alterar o arquivo, publique uma nova versão do aplicativo. A configuração é carregada quando a página abre, sem persistência no localStorage nem interferência no sincronismo dos estudos.

## Testes manuais sugeridos

1. Habilitar Doação e conferir o coração no menu desktop e no hambúrguer mobile.
2. Conferir Pix e Bitcoin com endereços válidos; copiar cada um e colar em outro campo.
3. Deixar uma chave vazia e verificar que o respectivo botão fica desabilitado.
4. Definir `footer.visible: false` e verificar que os convites desaparecem, mas a página continua acessível.
5. Definir `donation.enabled: false` e verificar que a opção desaparece do menu e dos rodapés.
6. Abrir Dashboard, Small Talk, WRG, Hashmap e demais módulos; conferir que o convite fica **após o conteúdo**, não flutuando sobre os exercícios.

7. Testar o Pix QR em um app bancário e verificar beneficiário e CRC; conferir o Pix Copia e Cola.
8. Testar o QR BTC com carteira compatível na rede Bitcoin mainnet, sem realizar transferência de teste obrigatória.
9. Testar `qrCodeEnabled: false` para ambos os métodos e conferir que os botões Copiar originais permanecem disponíveis.
10. Configurar dois ou mais endereços BTC e verificar que cliques consecutivos em Copiar não repetem o endereço anterior; confirmar que o QR Code e a modal mostram exatamente o endereço copiado.
11. Verificar configuração antiga com `bitcoin.address` como string, lista vazia, endereço inválido e falha de acesso à área de transferência.
