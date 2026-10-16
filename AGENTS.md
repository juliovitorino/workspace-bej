# Mental Hashmap 4.0 — Codex orchestration instructions

## Activation
When the user asks to **sincronizar hashmap**, **sync hashmap**, or to run the Mental Hashmap multilingual agents, act as the **ROOT ORCHESTRATOR** in this Codex session. Do not spawn `hashmap_orchestrator` as a child. Its TOML is a reference for the root role.

The canonical source is `public/sample-hashmap-pt-BR.json`. The targets are `public/sample-hashmap-en-US.json`, `public/sample-hashmap-es-ES.json` and `public/sample-hashmap-fr-FR.json`.

## Required delegation
Spawn three independent custom subagents **in parallel**, named `hashmap_en_us`, `hashmap_es_es`, `hashmap_fr_fr`. Give each agent only its corresponding target file as write scope. Wait for all three. If delegation is unavailable, explicitly report it rather than silently pretending multi-agent execution.

## Required preliminary checks
1. Inspect `git status` and do not revert or overwrite unrelated user changes.
2. Read source and targets, detect duplicate intention IDs, duplicate example IDs within an intention, and invalid JSON; stop on invalid source or a structural ambiguity that prevents safe edits.
3. Inspect the existing `validationPatterns` runtime and relevant JSON contract. **SHA-256 integrity hashes are out of scope**: do not investigate, recompute, copy, repair, or change `metadata.integrity` hashes, and do not treat mismatches as failures.
4. Determine change baseline: use a user-specified Git base when supplied. Otherwise use a reliable Git history baseline for the pt-BR file and report which commit was used. If no reliable baseline, do not assume existing translated entries need retranslation; fill missing intentions only and flag possible discrepancies for review.
5. BEFORE delegating, scan every pt-BR intention for an explicitly empty `examples: []`. For each, the ROOT ORCHESTRATOR must generate exactly three natural pt-BR examples, each with a new unique UUID example ID, `exampleItem` and an `intent` span literally present in `exampleItem`. Follow the existing example schema and any required fields; do not add `hqImage`. Save ONLY those empty arrays in the canonical pt-BR JSON, preserving all other intentions, examples and fields. Do not modify nonempty arrays or repair unrelated source content. Update non-hash count metadata only if the existing schema requires it; never touch SHA-256 hashes. Validate the updated source before proceeding. If safe generation/validation fails, stop before delegation and report the issue. Do not generate examples in any other case.
6. Record the intention IDs and exact three newly generated example IDs. Wait for the pt-BR write to complete, then send the affected intention IDs, generated example IDs, and baseline information to all three agents. Never use array positions as identity.

## Invariants
- `public/sample-hashmap-pt-BR.json` is canonical. **Only the ROOT ORCHESTRATOR may edit it, and only to replace an explicitly empty `examples: []` with exactly three valid pt-BR examples before delegation.** No other source edits are authorized; locale specialists remain read-only on pt-BR.
- `mentalMap[].id` is a stable, language-independent identity. Match intentions by ID, never by array index; do not invent, translate, normalize, or replace existing IDs.
- Example IDs are also stable identities. **Do not change existing example IDs to force equality**. Missing or extra example IDs in target locales are accepted, nonblocking differences in this MVP. Do not reconcile them automatically.
- **Extra target examples must be ignored and preserved**, even when absent from pt-BR. Do not delete, rewrite, or re-ID them merely to match source counts. Missing historical examples in existing target intentions can be recovered later and must not block synchronization. **Exception: examples freshly generated in pt-BR by this run must be propagated to all three targets, even when the intention already exists there**, with the same newly generated IDs. For newly created intentions, create localized examples with the canonical source example IDs.
- Localize `intention`, `description`, `pattern`, `structure`, `searchTerms`, `validationPatterns`, `examples[].exampleItem` and `examples[].intent` semantically into the target locale. Never use untranslated pt-BR as a shortcut. Existing translations should not be overwritten without a demonstrated change or correction. Imperfections in `description` and `examples[].intent` are nonblocking for the MVP and should be reported, not used to stop otherwise safe synchronization.
- **`tags` are localized linguistic fields, NOT language-independent structural fields**. Translate their meaning to each target locale, rather than copying the pt-BR string or requiring literal equality. Example: pt-BR `diversão` → en-US `fun`, es-ES `diversión`, fr-FR `divertissement`. Preserve valid existing localized tags; update only when necessary.
- Structural fields such as `category`, `related`, `level`, and `allowLanguageChunkPractice` (including its absence) follow the canonical pt-BR values. Preserve unknown target-only fields unless explicitly authorized otherwise.
- `hqImage` is **locale-private**: never sync, copy, overwrite, remove, or fabricate it. New target examples omit it; existing target examples keep their exact previous value. Do not edit `public/images/hq/**`.
- Never automatically delete intentions or examples. Report orphaned intentions without removing them; ignore surplus examples for synchronization purposes.
- Preserve untouched translations and formatting where feasible. No databases, backends, cache, new infrastructure, or permanent scripts. Do not commit automatically.

## Required sequence for empty pt-BR examples
1. The root scans ALL canonical intentions for `examples: []` before starting any specialist; this applies to existing and new intentions. If none are empty, leave pt-BR untouched.
2. For each empty array, create exactly three distinct, meaningful Brazilian Portuguese example sentences that illustrate the intention; give each example a unique UUID, valid `exampleItem`, and an exact `intent` substring. Preserve the intention and all other fields. Never add examples to an array that already contains one or more examples.
3. Persist and validate pt-BR first. Pass a manifest of `{intentionId, generatedExampleIds}` to the three locale agents, and have them translate all three new examples into their own file with the same IDs. A source edit without the corresponding three locale updates is **PARTIAL**, not complete.
4. Do not reinterpret previously missing or extra target examples as part of this manifest. Preserve them under the existing nonblocking policy. Never copy `hqImage`.

## Incremental synchronization
1. Work only on IDs demonstrably new or changed since the reliable baseline; without a baseline, add missing intentions only and report possible stale translations.
2. After the source pre-pass, delegate one destination file to each specialist; no specialist may write to pt-BR or another locale's file.
3. Translate new/changed linguistic content naturally for each locale, including `tags`; preserve target-specific examples, `hqImage`, and unknown properties.
4. Do not attempt to equalize historical example counts or rewrite examples solely because their IDs differ from pt-BR. Add the three newly generated canonical examples to each target by ID, including existing intentions; do not duplicate them on retries.
5. If a safe update cannot be determined, report it as pending instead of guessing or overwriting.

## Final validation
Parse all four JSONs after the source pre-pass; verify that every formerly empty pt-BR array now contains exactly three valid examples with unique UUID IDs and that all three target locales contain localized versions with those same IDs. Validate schema structure, intention ID uniqueness and intended intention ID coverage, `metadata.language`, `metadata.totalIntentions` against each file's actual intention count, and relevant regex using the project's actual JavaScript runtime. Confirm preservation of target-local `hqImage`, surplus examples, and untouched fields. Run `git diff --check` and review changed paths. Compare example ID sets **for diagnostic reporting only**: missing and extra target examples are **nonblocking**. Ignore SHA-256 hash values entirely; do not validate, recalculate, or modify them. If a pre-existing validation script reports only SHA-256 or accepted example-count/ID mismatches, classify those findings as **IGNORED BY POLICY**, not synchronization failure. If a required check cannot be performed, mark it **NOT VERIFIED**, never PASS.

## Final report
Report how many empty pt-BR intentions were filled, their IDs, the three generated examples per intention, and whether each was propagated to all locales. For each locale: new intentions, new examples introduced with new intentions or through the authorized source pre-pass, modified intentions/examples, unchanged, orphaned intentions, nonblocking example discrepancies (summary counts only), validation errors, and file status. Distinguish complete, partial, blocked, and nonblocking pending outcomes. Do not print hundreds of example UUIDs. State explicitly that SHA-256 was excluded by policy, and whether pt-BR changed exclusively through the authorized empty-array pre-pass; list any other changed files as unexpected.
