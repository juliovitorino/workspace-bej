# Mental Hashmap — Agent Instructions

## Project
Brazilian English Journey — Mental Hashmap.

## Architecture
- Keep the MVP simple.
- Do not introduce databases, backends or caches.
- Reuse the existing TypeScript structure.

## Languages
- en-US: English
- fr-FR: French
- es-ES: Spanish
- pt-BR: Source language

## JSON synchronization
- Inspect the existing JSON structure before editing.
- Keep equivalent intentions synchronized.
- Preserve existing IDs across languages.
- New intentions must use slug + UUID.
- Preserve the existing schema and field names.
- Do not introduce a mentalMap wrapper where absent.
- Do not translate code identifiers or category values.
- Translate examples naturally, preserving their intention.
- Adapt patterns and validationPatterns to each language.
- Never assume English regex patterns work in French or Spanish.
- Preserve allowLanguageChunkPractice semantics.
- Treat `youtubeVideo`, `youtubeShort`, and `hqImage` as language-local media fields; never synchronize them across language files. See Language-Specific Media Fields below.

## Language-Specific Media Fields (Never Synchronize)

The following fields belong **exclusively to the language JSON file in which they are defined**:

- `youtubeVideo`
- `youtubeShort`
- `hqImage`

Mandatory rules for INCREMENTAL synchronization, FULL AUDIT, new intentions, and new-language initialization:

1. **Never copy, translate, propagate, compare for equality, or overwrite** these fields between `en-US`, `fr-FR`, `es-ES`, or any future language files.
2. A value present in `en-US` does **not** imply that the corresponding field or value should exist in `fr-FR` or `es-ES` (and vice versa). Different values, missing fields, and different availability are valid, not synchronization errors.
3. When creating an intention in a destination language, **do not inherit these fields from the source intention**. Omit them unless the user explicitly supplies media belonging to that destination language. If the destination schema requires a field, follow its existing documented empty/default convention without copying another language's media; otherwise report the constraint.
4. When updating an existing intention, preserve its language-specific media fields **exactly as they are**, including their values and presence or absence. Do not clear, reset, replace, or remove them during synchronization.
5. Do not use these fields when determining missing intentions, semantic equivalence, structural inconsistencies, or cross-language synchronization status.
6. Only modify a language's media fields when the user **explicitly requests a media change for that specific language**. Never infer such authorization from a general synchronization request.
7. Exclude these fields from cross-language equality checks and synchronization diffs. Report only genuine media issues local to an individual file if the user explicitly requests media validation.

These rules override any general instruction to preserve or synchronize all fields. They do **not** authorize changes to unrelated fields or files.

## Quality
- Validate JSON syntax.
- Detect duplicate IDs.
- Check missing intentions across languages.
- Report inconsistencies before modifying unrelated entries.
- Do not change files outside the requested scope.
- Show a summary of changes after completion.

## Synchronization Modes (Token-Efficient)

**Default: INCREMENTAL.** Use FULL AUDIT only when the user explicitly
requests a complete audit, a baseline reconciliation, or a new-language
initial import. Never escalate to FULL AUDIT merely because a small mismatch
was detected; report it instead.

### INCREMENTAL (Default)

For routine additions and synchronization of new intentions:

1. Read `AGENTS.md` and locate the configured language files, normally
   `public/sample-hashmap-en-US.json`, `public/sample-hashmap-fr-FR.json`,
   and `public/sample-hashmap-es-ES.json`.
2. Use `en-US` as the canonical reference for which intentions exist.
   Compare **IDs only** across the language files using a lightweight local
   script or parser. Do not paste or load entire JSON catalogs into the
   model's context merely to compare IDs.
3. Build the list of missing IDs per language. If there are no missing IDs,
   report that synchronization is already complete and stop; do not rewrite
   or reformat any JSON.
4. Retrieve and examine **only the missing intentions**, plus a small number
   of relevant existing entries when needed to preserve schema or detect
   semantic duplicates. Never translate or regenerate synchronized entries.
5. Before writing, report the missing IDs, affected files and planned changes.
   If the user's prompt requires approval, stop and wait for explicit approval.
6. For each approved missing intention, create a natural linguistic equivalent
   in the destination language, respecting all schema, searchTerms, regex,
   example-count and chunk rules in this document, excluding language-local
   `youtubeVideo`, `youtubeShort`, and `hqImage` fields.
7. Modify only the required entries in the destination JSON files; preserve
   all existing intentions and avoid unrelated reformatting or key reordering.
8. Validate JSON syntax, duplicate IDs, required fields, 3–10 examples in
   newly added entries, and ID coverage using local code. Run relevant tests
   when available; do not perform a new full semantic audit.
9. Clean up task-created temporary files under the cleanup rules below.
   Report counts, IDs added, files changed, validation results and unresolved
   issues concisely.

**Efficiency rules:** Prefer a single Codex agent for a small batch of new
intentions. Do not spawn language subagents for one or a few intentions.
Use subagents only when the volume or complexity clearly justifies them.
Do not regenerate searchTerms, examples or validationPatterns for already
synchronized intentions. Prefer targeted edits and targeted tests.

### FULL AUDIT (Explicit Request Only)

When explicitly requested, inspect all configured language catalogs for
missing IDs, schema inconsistencies, duplicates, semantic mismatches and
validation issues. Present a report and a proposed plan before making
changes; wait for authorization when requested. Split work into batches only
if needed, and never overwrite valid translations without approval.

A newly configured language may require a one-time full population; once
synchronized, return to INCREMENTAL mode for subsequent additions.

## Example Generation Rules

For every **new or explicitly updated** intention in each target-language
JSON file:

1. Include **at least 3 and at most 10** natural, idiomatic examples.
2. Default to **3** strong examples; add more only for meaningful differences
   in context, usage, structure or communicative intention.
3. Preserve the existing example schema and field names, including source
   Portuguese and the language-specific target text and highlighted spans.
4. Ensure examples express the same intention, but do not force literal
   translations or English grammar onto French or Spanish.
5. Avoid near-duplicates, artificial examples and padding to reach 10.
6. Validate the example count separately for every newly created or updated
   language entry. Report violations in older entries without modifying them
   unless the user explicitly requests that work.

## New Linguistic Intention Workflow

When the user requests a new intention:

1. Discover the configured language JSON files.
2. Search for an existing equivalent intention.
3. If an equivalent exists, report it and avoid duplicates.
4. Create one canonical intention ID using slug + UUID.
5. Preserve that ID across all language files.
6. Generate natural, idiomatic examples for each language.
7. Adapt patterns and validationPatterns independently.
8. Preserve the existing schema and metadata conventions.
9. Set allowLanguageChunkPractice: true only for
   complete, independently usable language chunks.
10. Validate JSON syntax, IDs and required fields.
11. Report changes and any uncertain translations.

Never perform literal translation when it changes
the linguistic intention.

When a new language is added, include its configured
JSON file in future synchronization tasks.

Do not introduce databases, APIs or new infrastructure.

## SearchTerms Generation Rules

For every new or updated linguistic intention:

1. Never leave searchTerms empty without a reason.

2. Generate search terms based on the linguistic
   intention, not merely on the example sentences.

3. Include useful synonyms and alternative ways
   of expressing the same intention.

4. Include common expressions students may type
   when searching for that intention.

5. Prioritize natural and frequently used expressions.

6. Avoid:
   - Generic isolated words
   - Unrelated meanings
   - Duplicate terms
   - Entire example sentences
   - Artificial or unnatural translations
   - Excessive keyword generation

7. Respect each target language:
   - en-US: natural American English
   - fr-FR: natural French
   - es-ES: natural Spanish

8. Preserve the semantic intention across languages,
   even when grammatical structures differ.

9. Inspect the application's search implementation
   before deciding which languages belong in
   searchTerms.

10. Follow the existing search normalization rules
    for case, accents and punctuation.

11. Prefer 5 to 10 high-quality search terms,
    but never add irrelevant terms to reach a quota.

12. Before adding a new intention, search existing
    intentions using IDs, patterns, examples,
    descriptions and searchTerms.

13. Never overwrite manually curated searchTerms
    without reviewing their meaning.

14. Report search terms that could cause ambiguity
    with existing intentions.

## Temporary Files Cleanup (Mandatory)

After each synchronization or other Codex task, remove **all temporary files and
folders generated for that task that are not part of the original project**.

1. Before making changes, inspect the project structure and `git status` to
   distinguish existing project files from task-generated artifacts.
2. Keep track of every temporary path created by Codex or its subagents,
   including intermediate JSON batches, generated scripts, staging files,
   logs, and temporary directories.
3. Temporary synchronization directories such as `.tmp-sync-es/` and
   `.tmp-sync-fr/` must be removed after their outputs have been applied and
   the final project files have been validated, provided they were created
   by the current task and are not part of the original project.
4. Clean up temporary artifacts at the end of the task, including after an
   unsuccessful attempt when it is safe to do so. Never delete files that
   are still required by a running process.
5. **Never delete original project files, tracked files, pre-existing user
   files, or unrelated untracked files.** An untracked file is not necessarily
   temporary. If ownership or purpose is uncertain, report the path and ask
   for confirmation before deleting it.
6. Never remove source JSON files, project configuration, documentation,
   tests, or user data as part of cleanup. Do not use broad or recursive
   deletion patterns unless every target has been individually verified.
7. Before finishing, run `git status` and confirm that no task-generated
   temporary artifacts remain. Report which temporary paths were deleted
   and which, if any, were retained for safety.
8. Cleanup is part of task completion and must not require a separate user
   prompt for artifacts clearly created by the current task.
