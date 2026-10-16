# BEJ 4.0 — Integração i18n

Este ZIP contém o **projeto de código completo** para substituição/mesclagem, com `src`, `public`, `scripts`, `docs`, configurações e `package-lock.json`.

Por segurança, **não inclui** `.git`, `node_modules`, `dist`, `.env`, `.env.local` nem arquivos temporários. Mantenha os seus arquivos de configuração locais e histórico Git.

## Aplicar no projeto atual

1. Faça backup da pasta do projeto ou confirme que suas alterações locais estão protegidas.
2. Extraia este ZIP e copie o conteúdo da pasta `mental-hashmap-app` para a pasta de mesmo nome no seu workspace, **mesclando e substituindo arquivos correspondentes, sem apagar a pasta de destino**.
3. Mantenha os arquivos `.git`, `.env` e `.env.local` já existentes na sua máquina.
4. Abra o terminal do VS Code na pasta `mental-hashmap-app`.
5. Execute:

```bash
npm ci
npm run validate:i18n
npm run build
npm run dev
```

6. Teste Source `pt-BR`, `en-US`, `es-ES` e `fr-FR`, trocando Source sem recarregar a página. Verifique sidebar, filtros, Memory Flashcards, Shadowing e demais módulos.

**Observação:** a integração inicial foi parcialmente feita pelo Codex antes do limite de uso; esta entrega a aproveita e corrige pendências encontradas. A compilação TypeScript foi validada neste ambiente, mas o build completo do Vite deve ser confirmado na sua máquina Windows. Consulte `docs/i18n-audit.md`.
