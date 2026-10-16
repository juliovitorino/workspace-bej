# Mental Hashmap 4.0 — Codex orchestration instructions

## Activation
When the user asks to **sincronizar hashmap**, **sync hashmap**, or to run the Mental Hashmap multilingual agents, act as the **ROOT ORCHESTRATOR** in this Codex session. Do not spawn `hashmap_orchestrator` as a child. Its TOML is a reference for the root role.

The only source of truth is `public/sample-hashmap-pt-BR.json`. The targets are `public/sample-hashmap-en-US.json`, `public/sample-hashmap-es-ES.json` and `public/sample-hashmap-fr-FR.json`.

## Required delegation
Spawn three independent custom subagents **in parallel**, named `hashmap_en_us`, `hashmap_es_es`, `hashmap_fr_fr`. Give each agent only its corresponding target file as write scope. Wait for all three. If delegation is unavailable, explicitly report it rather than silently pretending multi-agent execution.

## Required preliminary checks
1. Inspect `git status` and do not revert or overwrite unrelated user changes.
2. Read source and targets, detect duplicate IDs and invalid JSON; stop on invalid source.
3. Discover current integrity-hash computation and validationPatterns runtime in the existing project. Never invent hash algorithms or assume JavaScript regex flags.
4. Determine change baseline: use a user-specified Git base when supplied. Otherwise use a reliable Git history baseline for the pt-BR file and report which commit was used. If no reliable baseline, do not assume existing translated entries need retranslation; fill missing entries only and flag discrepancies for review.
5. Send affected intention IDs and example IDs to each agent when known. Do not use array indices for identity.

## Invariants
- `intention` and `description` MUST be localized to the file's language, as must `pattern`, `structure`, `searchTerms`, `validationPatterns`, `examples[].exampleItem`, `examples[].intent`.
- IDs, `category`, `tags`, `related`, `level`, and `allowLanguageChunkPractice` (if present) are language-independent structural fields.
- `hqImage` is **locale-private**: never sync, copy, overwrite, remove or fabricate it. New target examples omit it; existing target examples keep their exact previous value.
- No automatic deletion of intentions or examples. Flag orphans for manual review.
- No edits to `public/sample-hashmap-pt-BR.json` or `public/images/hq/**`.
- Preserve unknown fields and untouched translations. No databases, backends, cache or new infrastructure.

## Final validation
Parse all four JSONs; compare sets of intention IDs and per-intention example IDs; verify locale metadata and counts; validate hashes with the **existing implementation**; verify relevant regex in the actual JavaScript runtime; confirm target-local hqImage preservation; run `git diff --check` and review changed paths. If a check cannot be performed, mark it **NOT VERIFIED**, never PASS.

## Final report
For each locale: new intentions, new examples, modified intentions/examples, unchanged, orphaned, validation errors and file status. Clearly distinguish complete, partial and blocked outcomes.
