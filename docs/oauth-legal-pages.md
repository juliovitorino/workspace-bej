# Páginas públicas para o consentimento Google OAuth

A página de Termos de Uso é gerada a partir de `src/content/terms-of-use.md`, o mesmo documento exibido dentro do BEJ. A Política de Privacidade é mantida em `src/content/privacy-policy.md`.

O script `scripts/generate-legal-pages.mjs` cria `public/terms.html` e `public/privacy.html` antes de `npm run dev` e `npm run build`. O Vite copia esses arquivos para `dist/` e o Cloudflare Pages disponibiliza páginas HTML sem extensão nas URLs:

- `https://bejapp.com.br/terms`
- `https://bejapp.com.br/privacy`

Essas páginas são HTML estático e não exigem login nem inicialização do React. O conteúdo original dos Termos permanece disponível no BEJ.

## Configuração Google Auth Platform → Branding

- Página inicial: `https://bejapp.com.br`
- Política de Privacidade: `https://bejapp.com.br/privacy`
- Termos de Serviço: `https://bejapp.com.br/terms`
- Domínios autorizados: `bejapp.com.br` e, se ainda utilizado, `workspace-bej.pages.dev`

Antes de preencher os links, **publique a branch após revisão e aprovação do PR** e abra as duas páginas em uma janela anônima para confirmar que são acessíveis publicamente. Caso o Cloudflare Pages use outro comando de build, configure-o para executar `npm run build`, que dispara a geração automática.

## Manutenção e revisão

Edite os arquivos Markdown em `src/content/` para atualizar as páginas. O HTML será regenerado no próximo build.

Os documentos são conteúdo informativo inicial e **devem ser revisados juridicamente antes de serem apresentados como definitivos**, especialmente as informações de identificação do responsável, tratamento de dados e fornecedores externos. O e-mail de suporte é público nessas páginas.

As páginas informativas **não substituem** a configuração das origens OAuth em Google Auth Platform → Clients nem corrigem, por si só, eventuais falhas do Drive Sync.
