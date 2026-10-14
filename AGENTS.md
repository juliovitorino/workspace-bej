
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

## Quality
- Validate JSON syntax.
- Detect duplicate IDs.
- Check missing intentions across languages.
- Report inconsistencies before modifying unrelated entries.
- Do not change files outside the requested scope.
- Show a summary of changes after completion.

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
