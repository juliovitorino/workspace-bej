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

## Story Files — CEFR Organization and Multilingual Enrichment

These instructions apply to **story catalogs**, not the language-specific
intention catalogs described in the JSON synchronization sections below.
Do not confuse the two workflows.

### Location and organization

- The user's Windows project location is:
  `C:\Users\julio.vitorino\Documents\workspaces\mental-hashmap-app-mvp\mental-hashmap-app\src\data\stories\`.
- Discover the equivalent path in the active workspace instead of assuming the
  Windows absolute path exists in every execution environment.
- The known example is `src/data/stories/stories-a1.json`. Discover other existing
  CEFR files by inspection (e.g., `stories-a2.json`, `stories-b1.json`,
  `stories-b2.json`, `stories-c1.json`, `stories-c2.json`); do not create
  hypothetical files or rename/move existing files without authorization.
- Organize and validate stories according to their existing `englishLevel`
  values: `A1`, `A2`, `B1`, `B2`, `C1`, `C2`. The filename level and each story's
  `englishLevel` must agree; report mismatches before moving anything.
- Preserve the existing root structure (array/object), order, story IDs,
  `topic`, `hqImage`, `intentionsUsed`, and all unrelated properties.

### Required Spanish and French fields

For each story selected for enrichment:

1. Add `titleEs` and `titleFr`, using natural, idiomatic Spanish (`es-ES`)
   and French (`fr-FR`) interpretations of the original `titlePt`.
2. For **each** object in `paragraphs`, add `es` and `fr`, using its `pt` text
   as the authoritative source. These are `paragraphs[].es` and
   `paragraphs[].fr` (NOT fields on the `paragraphs` array itself).
3. For **each** object in `paragraphs[].intentions`, add `esIntent` and
   `frIntent`, interpreting the corresponding `ptIntent` in the context of
   the complete translated paragraph and the same communicative intention.
4. `esIntent` must be an exact contiguous excerpt of its paragraph's `es`
   text; `frIntent` must be an exact contiguous excerpt of its paragraph's
   `fr` text. Choose natural translations that make this possible without
   distorting the intention. Preserve punctuation, capitalization and accents
   consistently with the paragraph text.
5. Preserve the order and number of paragraphs and intention annotations.
   Never modify `intentionId` or `intentionsUsed` when adding translations.
6. Preserve existing `titlePt`, `titleEn`, `paragraphs[].pt`,
   `paragraphs[].en`, `ptIntent`, `enIntent`, `id`, `englishLevel`, `topic`,
   and `hqImage` exactly. Story images are not translation targets.
7. If `titleEs`, `titleFr`, `es`, `fr`, `esIntent` or `frIntent` already exists,
   preserve a valid existing translation. Do not overwrite it merely to
   standardize wording; report substantive issues for approval.
8. Translate meaning and context, not English syntax. Maintain characters,
   chronology, narrative voice, dialogue, tense/aspect where meaningful,
   and the intended CEFR difficulty as far as natural language allows.
   Do not invent or omit story events. If the Portuguese is ambiguous,
   flag the ambiguity rather than silently changing the plot.
9. If the Portuguese highlighted intention cannot be expressed as a
   contiguous excerpt in the natural target paragraph, flag the case for
   manual review rather than inserting an inaccurate or disconnected span.

Example of the required nested shape (illustrative only):

```json
{
  "titlePt": "Um Sábado Diferente",
  "titleEn": "A Different Saturday",
  "titleEs": "Un sábado diferente",
  "titleFr": "Un samedi différent",
  "paragraphs": [
    {
      "pt": "Ontem, eu fiquei em casa e eu não fui para o parque porque estava chovendo.",
      "en": "Yesterday, I stayed at home and I didn't go to the park because it was raining.",
      "es": "Ayer me quedé en casa y no fui al parque porque estaba lloviendo.",
      "fr": "Hier, je suis resté à la maison et je ne suis pas allé au parc parce qu'il pleuvait.",
      "intentions": [
        {
          "intentionId": "momento-passado-com-marcador-de-tempo",
          "ptIntent": "Ontem, eu fiquei",
          "enIntent": "Yesterday, I stayed",
          "esIntent": "Ayer me quedé",
          "frIntent": "Hier, je suis resté"
        }
      ]
    }
  ]
}
```

The example is a partial story excerpt; it does not authorize deleting
unshown fields or other paragraphs. Where French grammatical gender depends
on unknown narrator identity, verify context and flag uncertainty rather
than assume an identity.

### Story enrichment workflow (incremental by default)

1. Inspect `AGENTS.md`, the story loader/schema, the target CEFR file(s),
   and `git status` before proposing changes.
2. Inventory only the requested level(s), counting stories, paragraphs,
   missing translations, and inconsistent annotations using a lightweight
   local parser. Do not dump full catalogs or UUID lists into agent output.
3. Present a concise plan (affected filenames and counts), and **wait for
   explicit user approval before bulk modifications** unless the user has
   already expressly authorized implementation in the current request.
4. Add only missing language fields to approved stories; retain existing
   data and avoid whole-file reformatting or key reordering when feasible.
5. Validate JSON syntax, CEFR/file alignment, unchanged story IDs, unchanged
   existing fields, paragraph counts, intention counts, and the exact
   `esIntent`/`frIntent` substring relationship. Verify that every approved
   story has both titles and every paragraph/intention has both translations.
6. Report concise counts by level, number of enriched stories/paragraphs,
   files modified, validations and unresolved ambiguities. Never print UUIDs.
7. Follow the existing temporary-file cleanup requirements.

**Scope boundary:** Story enrichment must not trigger the intention-catalog
cross-language synchronization workflow, alter `sample-hashmap-*.json`,
regenerate stories with AI, or modify app components unless explicitly
requested. Do not synchronize or replace `hqImage`, `youtubeVideo`, or
`youtubeShort` while enriching story translations.

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

## User-Facing Reports — Never Display UUIDs

- IDs (including slug + UUID) are internal technical identifiers. Keep generating,
  preserving, comparing and validating them as required by this document.
- **Never print or enumerate raw UUIDs or intention IDs in user-facing output**:
  terminal summaries, progress reports, plans, audit results, completion messages,
  tables, or lists. This applies to INCREMENTAL, FULL AUDIT and new-intention tasks.
- Instead, show useful information: intention names or short descriptions,
  counts by language, affected files, validation status and actionable issues.
- Internal scripts, JSON files and validation processes may use IDs normally.
  Do not weaken ID checks or change the JSON schema to hide UUIDs.
- Only show a specific ID or UUID if the user explicitly requests it for
  debugging, tracing or inspection.

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
5. Before writing, report the number of missing intentions per language, affected files and planned changes; do not display raw IDs or UUIDs.
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
   Report counts, intention names or short descriptions when useful, files changed,
   validation results and unresolved issues concisely; never list raw IDs or UUIDs.

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
11. Report changes using intention names or short descriptions, without listing
    raw IDs or UUIDs, and mention any uncertain translations.

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
