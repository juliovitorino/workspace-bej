# Preparação dos dados — contrato 4.0

## Aplicação aos arquivos originais

Após autorização, execute `node scripts/apply-v4.mjs`. O comando verifica os hashes, guarda todos os originais em `original-backups/` antes de substituir qualquer destino e registra a aplicação em `applied-state.json`. Reexecutá-lo não altera arquivos já aplicados. O validador passa a conferir os arquivos aplicados e usa esses backups para verificar a preservação dos dados. Após a aplicação, o gerador não reconverte os originais: apenas informa que a migração já foi aplicada.

Essa aplicação não resolve as pendências linguísticas nem adapta os consumidores React/TypeScript ao contrato 4.0. A compilação isolada não comprova a compatibilidade dos módulos que carregam JSON em tempo de execução.

Esta pasta é uma entrega para revisão, não uma substituição dos catálogos usados pela aplicação. Os componentes e serviços atuais continuam usando o contrato anterior.

Execute na raiz do projeto, pelo terminal do VS Code:

```powershell
node scripts/migrate-v4.mjs
node scripts/validate-v4.mjs
node --test scripts/test-migration-v4.mjs
```

O validador retorna código 1 enquanto houver pendências. Isso não significa que os arquivos originais tenham sido modificados. Não publique os catálogos preparados como uma migração concluída enquanto o relatório indicar `review-required`.

## Estrutura inspecionada

Os quatro catálogos originais têm raiz `metadata`/`mentalMap`, 1.230 intenções por idioma e conjuntos de identificadores iguais. Português e inglês contêm 3.069 exemplos cada; espanhol e francês, 3.328 cada. Todos os exemplos originais estão sem identificador.

Intenções usam `english` e `englishLevel`; exemplos usam `pt`, `en`, `ptIntent` e `enIntent`, inclusive nos arquivos espanhol e francês. Nestes últimos, `en` e `enIntent` contêm o texto do respectivo idioma. A conversão conserva os demais atributos, inclusive desconhecidos e mídias locais, sem transferir mídias entre idiomas. Metadata recebe `schemaVersion`, conserva os valores existentes e perde apenas `targetStudent`. O idioma do conteúdo é identificado pelo nome do arquivo: `metadata.language` é preservado e não deve ser usado isoladamente para deduzi-lo.

As seis coleções de histórias possuem 42 histórias e 312 parágrafos. Cada parágrafo já contém textos compartilhados no mesmo objeto (`pt`, `en`, `es`, `fr`); apenas o identificador é acrescentado, sem separar ou traduzir histórias.

Os nove catálogos localizados de verbos, adjetivos e substantivos são validados no local original e não são regravados. Identificadores de substantivos coincidem; verbos e parte dos adjetivos não possuem correspondência universal confirmada. A metadata de quantidade dos verbos ingleses também diverge do conteúdo. Essas condições preexistentes ficam nos avisos.

## Entregáveis e revisão

- `public/`: quatro catálogos preparados no contrato 4.0.
- `src/data/stories/`: seis coleções com identificadores de parágrafos.
- `identifier-map.json`: manifesto interno persistente; mantenha-o para conservar UUIDs entre execuções. Não é um relatório para exibir identificadores ao aluno.
- `migration-report.json`: hashes dos arquivos de origem e pendências por idioma, nome da intenção e posição do exemplo.
- `validation-report.json`: falhas e avisos detalhados, hashes SHA-256 dos conjuntos ordenados e resultado das comparações diretas.

Somente referências portuguesas **exatamente iguais e únicas dentro de cada intenção** são associadas automaticamente. O destaque português faz parte dessa referência. Essa regra usa a tradução já documentada nos dados; não faz auditoria semântica automática. Exemplos sem correspondência são preservados; referências repetidas recebem identificadores locais e ficam pendentes de revisão, sem associação por posição. Não se criam traduções, exemplos ou regex.

Para resolver as pendências, revise os exemplos indicados nos relatórios. Confirme equivalências e, quando necessário, forneça traduções dos exemplos ausentes. Uma associação manual aprovada pode ser registrada no manifesto interno utilizando o mesmo UUID para referências confirmadas; não una contextos diferentes apenas para igualar os conjuntos. Os relatórios de pendências devem então ser atualizados pelo script para reconhecer essas decisões antes de declarar conformidade. A versão atual conserva deliberadamente todas as pendências não revisadas.

Os campos gramaticais do catálogo português permanecem como na origem, que replica o inglês. Sua localização linguística depende de trabalho separado; esta migração não inventa padrões ou expressões regulares.

## Segurança e repetibilidade

Os originais não são sobrescritos. Se uma saída existente precisar mudar, o script guarda seu conteúdo anterior em uma subpasta `backups`, identificada pelo SHA-256, antes de gravar. Essas cópias e o manifesto são entregáveis permanentes. Arquivos idênticos não são regravados. Se os originais mudarem após a geração, o validador solicita nova execução.

Os hashes de relacionamento usam apenas identificadores canônicos ordenados, nunca traduções ou mídias. As histórias são comparadas por história/parágrafo para cada idioma presente no objeto multilíngue; não são catálogos separados. As divergências de vocabulário são avisos, pois a equivalência dos IDs não foi confirmada e não deve ser inventada.
