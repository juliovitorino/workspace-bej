# Mental Hashmap 4.0 — Codex orchestration instructions

## Activation
When the user asks to **sincronizar hashmap**, **sync hashmap**, or to run the Mental Hashmap multilingual agents, act as the **ROOT ORCHESTRATOR** in this Codex session. Do not spawn `hashmap_orchestrator` as a child. Its TOML is a reference for the root role.

The only source of truth is `public/sample-hashmap-pt-BR.json`. The targets are `public/sample-hashmap-en-US.json`, `public/sample-hashmap-es-ES.json` and `public/sample-hashmap-fr-FR.json`.

## Required delegation
Spawn three independent custom subagents **in parallel**, named `hashmap_en_us`, `hashmap_es_es`, `hashmap_fr_fr`. Give each agent only its corresponding target file as write scope. Wait for all three. If delegation is unavailable, explicitly report it rather than silently pretending multi-agent execution.

## Required preliminary checks
1. Inspect `git status` and do not revert or overwrite unrelated user changes.
2. Read source and targets, detect duplicate intention IDs, duplicate example IDs within an intention, and invalid JSON; stop on invalid source or a structural ambiguity that prevents safe edits.
3. Inspect the existing `validationPatterns` runtime and relevant JSON contract. **SHA-256 integrity hashes are out of scope**: do not investigate, recompute, copy, repair, or change `metadata.integrity` hashes, and do not treat mismatches as failures.
4. Determine change baseline: use a user-specified Git base when supplied. Otherwise use a reliable Git history baseline for the pt-BR file and report which commit was used. If no reliable baseline, do not assume existing translated entries need retranslation; fill missing intentions only and flag possible discrepancies for review.
5. Send affected intention IDs and, when relevant, example IDs to each agent. Never use array positions as identity.

## Invariants
- `public/sample-hashmap-pt-BR.json` is canonical and **must never be modified**.
- `mentalMap[].id` is a stable, language-independent identity. Match intentions by ID, never by array index; do not invent, translate, normalize, or replace existing IDs.
- Example IDs are also stable identities. **Do not change existing example IDs to force equality**. Missing or extra example IDs in target locales are accepted, nonblocking differences in this MVP. Do not reconcile them automatically.
- **Extra target examples must be ignored and preserved**, even when absent from pt-BR. Do not delete, rewrite, or re-ID them merely to match source counts. Missing examples in existing target intentions can be recovered later and must not block synchronization. For newly created intentions, create localized examples with the canonical source example IDs.
- Localize `intention`, `description`, `pattern`, `structure`, `searchTerms`, `validationPatterns`, `examples[].exampleItem` and `examples[].intent` semantically into the target locale. Never use untranslated pt-BR as a shortcut. Existing translations should not be overwritten without a demonstrated change or correction. Imperfections in `description` and `examples[].intent` are nonblocking for the MVP and should be reported, not used to stop otherwise safe synchronization.
- **`tags` are localized linguistic fields, NOT language-independent structural fields**. Translate their meaning to each target locale, rather than copying the pt-BR string or requiring literal equality. Example: pt-BR `diversão` → en-US `fun`, es-ES `diversión`, fr-FR `divertissement`. Preserve valid existing localized tags; update only when necessary.
- Structural fields such as `category`, `related`, `level`, and `allowLanguageChunkPractice` (including its absence) follow the canonical pt-BR values. Preserve unknown target-only fields unless explicitly authorized otherwise.
- `hqImage` is **locale-private**: never sync, copy, overwrite, remove, or fabricate it. New target examples omit it; existing target examples keep their exact previous value. Do not edit `public/images/hq/**`.
- Never automatically delete intentions or examples. Report orphaned intentions without removing them; ignore surplus examples for synchronization purposes.
- Preserve untouched translations and formatting where feasible. No databases, backends, cache, new infrastructure, or permanent scripts. Do not commit automatically.

## Incremental synchronization
1. Work only on IDs demonstrably new or changed since the reliable baseline; without a baseline, add missing intentions only and report possible stale translations.
2. Delegate one destination file to each specialist; no specialist may write to pt-BR or another locale's file.
3. Translate new/changed linguistic content naturally for each locale, including `tags`; preserve target-specific examples, `hqImage`, and unknown properties.
4. Do not attempt to equalize example counts or rewrite examples solely because their IDs differ from pt-BR.
5. If a safe update cannot be determined, report it as pending instead of guessing or overwriting.

## Final validation
Parse all four JSONs; validate schema structure, intention ID uniqueness and intended intention ID coverage, `metadata.language`, `metadata.totalIntentions` against each file's actual intention count, and relevant regex using the project's actual JavaScript runtime. Confirm preservation of target-local `hqImage`, surplus examples, and untouched fields. Run `git diff --check` and review changed paths. Compare example ID sets **for diagnostic reporting only**: missing and extra target examples are **nonblocking**. Ignore SHA-256 hash values entirely; do not validate, recalculate, or modify them. If a pre-existing validation script reports only SHA-256 or accepted example-count/ID mismatches, classify those findings as **IGNORED BY POLICY**, not synchronization failure. If a required check cannot be performed, mark it **NOT VERIFIED**, never PASS.

## Final report
For each locale: new intentions, new examples introduced with new intentions, modified intentions/examples, unchanged, orphaned intentions, nonblocking example discrepancies (summary counts only), validation errors, and file status. Distinguish complete, partial, blocked, and nonblocking pending outcomes. Do not print hundreds of example UUIDs. State explicitly that SHA-256 was excluded by policy, and whether any files outside the three target JSONs changed.
