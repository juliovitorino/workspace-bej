# BEJ 4.0 — Pacote de agentes de sincronização

## Conteúdo
- `AGENTS.md`: instrui o Codex raiz a atuar como orquestrador.
- `.codex/agents/hashmap_orchestrator.toml`: especificação do agente pai (referência, não invocar como subagente).
- `.codex/agents/hashmap_en_us.toml`: especialista em inglês.
- `.codex/agents/hashmap_es_es.toml`: especialista em espanhol.
- `.codex/agents/hashmap_fr_fr.toml`: especialista em francês.
- `.codex/config.toml`: configuração mínima de subagentes.

## Instalação no VS Code
1. Extraia este ZIP na **raiz** do repositório `mental-hashmap-app`, preservando as pastas ocultas `.codex/`.
2. Se já existirem `AGENTS.md` ou `.codex/config.toml`, **não sobrescreva**: faça merge das instruções e da seção `[agents]`.
3. Confirme que seu Codex carrega agentes locais e está atualizado; reinicie a sessão para carregar as novas definições.
4. Faça commit ou crie um ponto de restauração do Git antes da primeira execução.
5. No chat principal do Codex (não em um subagente), envie:
   `Sincronize o Mental Hashmap 4.0. Use os subagentes hashmap_en_us, hashmap_es_es e hashmap_fr_fr em paralelo. Compare as alterações do pt-BR com o último commit confiável, preserve hqImage local, valide integridade e me mostre o relatório final.`

## Limitações e cuidados
- Estes arquivos são **configurações/instruções**, não um processo agendado, observador de arquivos nem execução automática ao salvar. A execução é iniciada pelo comando no Codex.
- O Codex precisa de acesso aos arquivos e suporte a subagentes no cliente instalado.
- Não foi incluído script de hash: a implementação de SHA-256 já existente no projeto deve ser localizada e reutilizada. Se ausente, a validação é bloqueada até inspeção do código.
- Não houve teste sobre os JSONs reais do seu projeto, porque os arquivos completos não foram fornecidos neste pedido.
- Para primeira sincronização, comece com poucos IDs novos; não faça tradução completa das 1.230 intenções sem solicitação explícita.
- `hqImage` nunca é transportado entre idiomas e deve sobreviver a qualquer atualização do exemplo no seu próprio arquivo.
