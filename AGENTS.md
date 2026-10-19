# Mental Hashmap 4.0 — Codex orchestration instructions

## Politica obrigatoria: mp3 e hashmp3 locais por idioma

REGRA INVIOLAVEL - METADADOS DE AUDIO PRIVADOS POR IDIOMA:
- Os campos examples[].mp3 e examples[].hashmp3 pertencem EXCLUSIVAMENTE ao JSON de seu proprio idioma (pt-BR, en-US, es-ES, fr-FR). Sao locais, como hqImage, e NAO sao campos estruturais sincronizaveis.
- NUNCA copie, replique, traduza, sincronize ou propague mp3/hashmp3 de um arquivo de idioma para outro, nem por spread de objetos, clonagem de exemplos ou merge generico.
- Ao criar uma intencao ou exemplo em um idioma destino, OMITA mp3 e hashmp3, mesmo se existirem na origem. Isso vale para os 3 exemplos do pre-pass e para todas as sincronizacoes incrementais.
- Ao atualizar exemplos sobreviventes, preserve EXATAMENTE os mp3/hashmp3 locais preexistentes (inclusive a ausencia), sem apagar, substituir, recalcular ou modificar. Nunca use os valores da origem para preencher campos ausentes.
- Se exampleItem for traduzido ou alterado, preserve os metadados locais existentes; qualquer eventual hash desatualizado deve ser resolvido EXCLUSIVAMENTE pelo processo TTS do proprio idioma, fora da sincronizacao.
- Diferencas ou ausencias de mp3/hashmp3 entre idiomas sao normais, nao bloqueantes e nao devem ser reconciliadas. Nao gere MP3 nem calcule hashmp3 nesta tarefa.
- Unica excecao: a exclusao GLOBAL explicita e validada de um exemplo por deleteItem === true remove o registro JSON inteiro, inclusive os metadados locais; arquivos MP3 fisicos nunca devem ser apagados.
- Na validacao final, verifique que os metadados mp3/hashmp3 dos exemplos sobreviventes ficaram inalterados e que exemplos novos nao herdaram esses campos de outros idiomas.

## Activation
When the user asks to **sincronizar hashmap**, **sync hashmap**, or to run the Mental Hashmap multilingual agents, act as the **ROOT ORCHESTRATOR** in this Codex session. Do not spawn `hashmap_orchestrator` as a child. Its TOML is a reference for the root role.

The canonical source is `public/sample-hashmap-pt-BR.json`. The targets are `public/sample-hashmap-en-US.json`, `public/sample-hashmap-es-ES.json` and `public/sample-hashmap-fr-FR.json`.
Canonical linguistic content comes from pt-BR; explicit deletion requests are the exception and may originate in ANY of the four locales.

## Required delegation
Spawn three independent custom subagents **in parallel**, named `hashmap_en_us`, `hashmap_es_es`, `hashmap_fr_fr`. Give each agent only its corresponding target file as write scope. Wait for all three. If delegation is unavailable, explicitly report it rather than silently pretending multi-agent execution.

## Required preliminary checks
1. Inspect `git status` and do not revert or overwrite unrelated user changes.
2. Read source and targets, detect duplicate intention IDs, duplicate example IDs within an intention, and invalid JSON; stop on invalid source or a structural ambiguity that prevents safe edits.
3. Inspect the existing `validationPatterns` runtime and relevant JSON contract. **SHA-256 integrity hashes are out of scope**: do not investigate, recompute, copy, repair, or change `metadata.integrity` hashes, and do not treat mismatches as failures.
4. Determine change baseline: use a user-specified Git base when supplied. Otherwise use a reliable Git history baseline for the pt-BR file and report which commit was used. If no reliable baseline, do not assume existing translated entries need retranslation; fill missing intentions only and flag possible discrepancies for review.
5. BEFORE the empty-example pre-pass or delegation, execute the global deletion phase below, validate and persist all four results, and retain its deduplicated exclusion manifest for the entire run. Stop before delegation if planning, backup, writing, rollback or validation fails.
6. AFTER successful deletion, scan every surviving pt-BR intention for an explicitly empty `examples: []`. For each, the ROOT ORCHESTRATOR must generate exactly three natural pt-BR examples, each with a new unique UUID example ID, `exampleItem` and an `intent` span literally present in `exampleItem`. Follow the existing example schema and any required fields; do not add `hqImage`. In this example-generation phase, save ONLY those empty arrays in the canonical pt-BR JSON, preserving all other intentions, examples and fields. Do not modify nonempty arrays or repair unrelated source content. Update non-hash count metadata only if the existing schema requires it; never touch SHA-256 hashes. Validate the updated source before proceeding. If safe generation/validation fails, stop before delegation and report the issue. Do not generate examples in any other case.
7. Record the intention IDs and exact three newly generated example IDs. Wait for the pt-BR write to complete, then send the affected intention IDs, generated example IDs, and baseline information to all three agents. Never use array positions as identity.

## Invariants
- `public/sample-hashmap-pt-BR.json` is canonical. **Only the ROOT ORCHESTRATOR may edit it: to apply validated global `deleteItem === true` exclusions, correct `metadata.totalIntentions`, and replace explicitly empty surviving `examples: []` with exactly three valid examples before delegation.** No other source edits are authorized; locale specialists remain read-only on pt-BR.
- `mentalMap[].id` is a stable, language-independent identity. Match intentions by ID, never by array index; do not invent, translate, normalize, or replace existing IDs.
- Example IDs are also stable identities. **Do not change existing example IDs to force equality**. Missing or extra example IDs in target locales are accepted, nonblocking differences in this MVP. Do not reconcile them automatically.
- **Extra target examples must be ignored and preserved**, even when absent from pt-BR. Do not delete, rewrite, or re-ID them merely to match source counts. Missing historical examples in existing target intentions can be recovered later and must not block synchronization. **Exception: examples freshly generated in pt-BR by this run must be propagated to all three targets, even when the intention already exists there**, with the same newly generated IDs. For newly created intentions, create localized examples with the canonical source example IDs.
- Localize `intention`, `description`, `pattern`, `structure`, `searchTerms`, `validationPatterns`, `examples[].exampleItem` and `examples[].intent` semantically into the target locale. Never use untranslated pt-BR as a shortcut. Existing translations should not be overwritten without a demonstrated change or correction. Imperfections in `description` and `examples[].intent` are nonblocking for the MVP and should be reported, not used to stop otherwise safe synchronization.
- **`tags` are localized linguistic fields, NOT language-independent structural fields**. Translate their meaning to each target locale, rather than copying the pt-BR string or requiring literal equality. Example: pt-BR `diversão` → en-US `fun`, es-ES `diversión`, fr-FR `divertissement`. Preserve valid existing localized tags; update only when necessary.
- Structural fields such as `category`, `related`, `level`, and `allowLanguageChunkPractice` (including its absence) follow the canonical pt-BR values. Preserve unknown target-only fields unless explicitly authorized otherwise.
- `hqImage` is **locale-private**: never sync, copy, overwrite, remove, or fabricate it on surviving examples. Deleting an explicitly excluded record removes its JSON fields, including its local hqImage, but NEVER its physical image file. New target examples omit it; existing target examples keep their exact previous value. Do not edit `public/images/hq/**`.
- No record may be automatically deleted except as the result of an explicit boolean `deleteItem === true` marking identified and validated by the root orchestrator. Unmarked orphaned intentions and surplus examples remain preserved. Marked orphans must be deleted even if present in only one locale.
- Preserve untouched translations and formatting where feasible. No databases, backends, cache, new infrastructure, or permanent scripts. Do not commit automatically.

## Required sequence for empty pt-BR examples
1. After global deletions and count corrections, the root scans ALL surviving canonical intentions for `examples: []` before starting any specialist; this applies to existing and new intentions. If none are empty, do not generate examples or rewrite source content in this phase. Global deletion and count correction remain authorized independently.
2. For each empty array, create exactly three distinct, meaningful Brazilian Portuguese example sentences that illustrate the intention; give each example a fresh unique UUID absent from the exclusion manifest, valid `exampleItem`, and an exact `intent` substring. Preserve the intention and all other fields. Never add examples to an array that already contains one or more examples.
3. Persist and validate pt-BR first. Pass a manifest of `{intentionId, generatedExampleIds}` to the three locale agents, and have them translate all three new examples into their own file with the same IDs. A source edit without the corresponding three locale updates is **PARTIAL**, not complete.
4. Do not reinterpret previously missing or extra target examples as part of this manifest. Preserve them under the existing nonblocking policy. Never copy `hqImage`.

## Incremental synchronization
1. Exclude every intention ID and composite example key in the global deletion manifest from all creation/update candidates, baseline comparisons and pre-pass retries. Never recreate them during this run. Then work only on IDs demonstrably new or changed since the reliable baseline; without a baseline, add missing intentions only and report possible stale translations.
2. After the source pre-pass, delegate one destination file to each specialist; no specialist may write to pt-BR or another locale's file.
3. Translate new/changed linguistic content naturally for each locale, including `tags`; preserve target-specific examples, `hqImage`, and unknown properties.
4. Do not attempt to equalize historical example counts or rewrite examples solely because their IDs differ from pt-BR. Add the three newly generated canonical examples to each target by ID, including existing intentions; do not duplicate them on retries.
5. If a safe update cannot be determined, report it as pending instead of guessing or overwriting.

## Final validation
Parse all four JSONs after the source pre-pass; verify that every formerly empty pt-BR array now contains exactly three valid examples with unique UUID IDs and that all three target locales contain localized versions with those same IDs. Validate schema structure, intention ID uniqueness and intended intention ID coverage, `metadata.language`, `metadata.totalIntentions` against each file's actual intention count, and relevant regex using the project's actual JavaScript runtime. Confirm preservation of target-local `hqImage`, surplus examples, and untouched fields. Run `git diff --check` and review changed paths. Compare example ID sets **for diagnostic reporting only**: missing and extra target examples are **nonblocking**. Ignore SHA-256 hash values entirely; do not validate, recalculate, or modify them. If a pre-existing validation script reports only SHA-256 or accepted example-count/ID mismatches, classify those findings as **IGNORED BY POLICY**, not synchronization failure. If a required check cannot be performed, mark it **NOT VERIFIED**, never PASS.

## Final report
Report how many empty pt-BR intentions were filled, their IDs, the three generated examples per intention, and whether each was propagated to all locales. For each locale: new intentions, new examples introduced with new intentions or through the authorized source pre-pass, modified intentions/examples, unchanged, orphaned intentions, nonblocking example discrepancies (summary counts only), validation errors, and file status. Distinguish complete, partial, blocked, and nonblocking pending outcomes. Do not print hundreds of example UUIDs. Per locale also report deleted intentions, deleted examples (including children of deleted intentions, without double counting), orphan markings processed, absent records ignored, corrected counts, and later created/updated records. State explicitly that SHA-256 was excluded by policy and classify source edits as global deletion, count correction or empty-array pre-pass. List unexpected paths and any unrestored files.

## Global deletion protocol

- `deleteItem?: boolean` is optional on intentions and examples in schema 4.0.0. Only the boolean true requests deletion. False and absence preserve records; nonboolean values are invalid input and block all writes.
- Scan ALL four locales, including orphan records. Deduplicate intention IDs and example tuples `{intentionId, exampleId}` globally. Never use text, array positions, or existence in pt-BR to decide deletion. Parent deletion takes precedence over child requests. Absence in any locale is ignored and reported, not an error.
- Plan the four complete results in memory and validate them BEFORE writing. Reject missing/duplicate IDs and ambiguous identities; do not guess IDs or normalize them. Correct non-hash counts. Preserve metadata.integrity unchanged without inspecting/calculating its hash values.
- Use the executable reference below for planning and controlled persistence. Supply exactly the four canonical file paths, keyed by locale, and a NEW backup directory in the OS temporary directory. Back up all four original byte streams, verify backups, stage every changed result beside its target, detect concurrent changes, and only then replace targets. Retain backups after success or failure. Multi-file replacement is not atomic: on any failure, restore every replaced file and verify its bytes, report unrestored paths, STOP, and never delegate. Report the backup directory. Temporary staging files are owned by this phase only.
- Deliver both manifests (global exclusions and fresh generated examples) to all specialists. They must keep the deletion manifest throughout retries and must never recreate an excluded identity. Newly empty surviving PT arrays still receive three NEW IDs, never excluded ones.
- Do not edit surviving related fields implicitly; report references to deleted intentions for review. Physical HQ files are never deleted.
- This is a synchronization protocol, not a runtime UI deletion feature. Do not add a database, backend, cache, dependencies or an automatic app-side deletion listener.

## Vite shutdown

At the end, inspect port 5173, identify its owning processes and stop ONLY Vite servers listening there. Verify no listener remains; do not restart Vite. If another service occupies the port, preserve it and explicitly report that the port could not be freed without affecting another service. Never claim the port is free without verification.

## Executable deletion reference (Node.js, no dependencies)

Execute in an ephemeral module when synchronizing; do not create permanent infrastructure. `commitDeletions` accepts exactly four absolute catalog paths and a new recoverable backup directory. Its result must be retained and passed to the specialists. It performs only deletion/count correction, not translation or generation. Test this exact implementation on temporary fixtures before using it on catalogs. If `stagingLeftovers` is nonempty, report those paths and stop before delegation. Run `assertExclusions` with the retained manifest again after the empty-example phase and after all specialists, so deleted identities cannot reappear.

```javascript
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual as equal } from 'node:util';
export const locales = ['pt-BR', 'en-US', 'es-ES', 'fr-FR'];
function validate(data, locale) {
  if (!data?.metadata || data.metadata.schemaVersion !== '4.0.0' || data.metadata.language !== locale || !Array.isArray(data.mentalMap)) throw Error('Invalid V4 root: ' + locale);
  const ids = new Set();
  const check = (record, seen) => {
    if (typeof record?.id !== 'string' || !record.id || /\s/.test(record.id) || seen.has(record.id)) throw Error('Missing/ambiguous ID: ' + locale);
    seen.add(record.id);
    if (Object.hasOwn(record, 'deleteItem') && typeof record.deleteItem !== 'boolean') throw Error('Nonboolean deleteItem: ' + locale);
  };
  for (const field of ['name', 'version', 'updatedAt']) if (typeof data.metadata[field] !== 'string') throw Error('Invalid metadata: ' + field);
  for (const item of data.mentalMap) {
    check(item, ids);
    if (typeof item.intention !== 'string' || !Array.isArray(item.examples)) throw Error('Invalid intention: ' + item.id);
    for (const field of ['pattern', 'structure', 'description', 'category']) if (Object.hasOwn(item, field) && typeof item[field] !== 'string') throw Error('Invalid intention field: ' + field);
    if (Object.hasOwn(item, 'level') && !['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(item.level)) throw Error('Invalid level');
    if (Object.hasOwn(item, 'allowLanguageChunkPractice') && typeof item.allowLanguageChunkPractice !== 'boolean') throw Error('Invalid practice flag');
    for (const field of ['searchTerms', 'tags', 'related', 'validationPatterns']) if (Object.hasOwn(item, field) && (!Array.isArray(item[field]) || !item[field].every(v => typeof v === 'string'))) throw Error('Invalid intention list: ' + field);
    const examples = new Set();
    for (const example of item.examples) {
      check(example, examples);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(example.id)) throw Error('Invalid example UUID');
      if (typeof example.exampleItem !== 'string' || typeof example.intent !== 'string' || !example.intent || !example.exampleItem.includes(example.intent)) throw Error('Invalid example: ' + example.id);
    }
    for (const pattern of item.validationPatterns ?? []) new RegExp(pattern, locale === 'en-US' ? 'i' : 'iu');
  }
}
export function planDeletions(input) {
  for (const locale of locales) validate(input[locale], locale);
  const intentions = new Set(), pairs = new Map(), marks = [];
  const key = (intentionId, exampleId) => JSON.stringify([intentionId, exampleId]);
  for (const locale of locales) for (const item of input[locale].mentalMap) {
    if (item.deleteItem === true) { intentions.add(item.id); marks.push({ locale, intentionId: item.id }); }
    for (const example of item.examples) if (example.deleteItem === true) {
      pairs.set(key(item.id, example.id), { intentionId: item.id, exampleId: example.id });
      marks.push({ locale, intentionId: item.id, exampleId: example.id });
    }
  }
  const manifest = { intentionIds: [...intentions].sort(), examples: [...pairs.values()].filter(p => !intentions.has(p.intentionId)) };
  const excluded = (id, exampleId) => intentions.has(id) || pairs.has(key(id, exampleId));
  const catalogs = structuredClone(input), report = {};
  for (const locale of locales) {
    const original = input[locale], result = catalogs[locale];
    const stats = { intentionsDeleted: 0, examplesDeleted: 0, orphanMarks: 0, absentIgnored: 0, countCorrected: false };
    for (const id of intentions) if (!original.mentalMap.some(i => i.id === id)) stats.absentIgnored++;
    for (const pair of manifest.examples) if (!original.mentalMap.some(i => i.id === pair.intentionId && i.examples.some(e => e.id === pair.exampleId))) stats.absentIgnored++;
    for (const mark of marks.filter(m => m.locale === locale)) {
      const presence = locales.filter(l => input[l].mentalMap.some(i => i.id === mark.intentionId && (!mark.exampleId || i.examples.some(e => e.id === mark.exampleId)))).length;
      if (presence === 1) stats.orphanMarks++;
    }
    result.mentalMap = result.mentalMap.filter(item => {
      if (intentions.has(item.id)) { stats.intentionsDeleted++; stats.examplesDeleted += item.examples.length; return false; }
      item.examples = item.examples.filter(example => {
        if (excluded(item.id, example.id)) { stats.examplesDeleted++; return false; }
        return true;
      });
      return true;
    });
    stats.countCorrected = result.metadata.totalIntentions !== result.mentalMap.length;
    result.metadata.totalIntentions = result.mentalMap.length;
    validate(result, locale);
    for (const item of result.mentalMap) {
      if (intentions.has(item.id) || item.deleteItem === true || item.examples.some(e => excluded(item.id, e.id) || e.deleteItem === true)) throw Error('Deletion not applied');
    }
    report[locale] = stats;
  }
  return { catalogs, manifest, report };
}
export function assertExclusions(catalogs, manifest) {
  const intentions = new Set(manifest.intentionIds);
  const pairs = new Set(manifest.examples.map(p => JSON.stringify([p.intentionId, p.exampleId])));
  for (const locale of locales) for (const item of catalogs[locale].mentalMap) {
    if (intentions.has(item.id) || item.examples.some(e => pairs.has(JSON.stringify([item.id, e.id])))) throw Error('Excluded identity recreated: ' + locale);
  }
}
export function commitDeletions(files, backupDirectory, io = fs) {
  if (Object.keys(files).length !== 4 || !locales.every(l => typeof files[l] === 'string' && path.isAbsolute(files[l])) || new Set(Object.values(files)).size !== 4) throw Error('Exactly four distinct absolute paths required');
  const originals = {}, input = {}, stages = new Map(), replaced = [];
  for (const locale of locales) { originals[locale] = io.readFileSync(files[locale]); input[locale] = JSON.parse(originals[locale].toString('utf8').replace(/^\uFEFF/, '')); }
  const plan = { ...planDeletions(input), stagingLeftovers: [] };
  assertExclusions(plan.catalogs, plan.manifest);
  const changed = locales.filter(l => !equal(input[l], plan.catalogs[l]));
  if (!changed.length) return { ...plan, changed, backupDirectory: null };
  try {
    io.mkdirSync(backupDirectory); // must be new; never overwrite a previous backup
    for (const locale of locales) {
      const backup = path.join(backupDirectory, locale + '.json');
      io.writeFileSync(backup, originals[locale], { flag: 'wx' });
      if (!io.readFileSync(backup).equals(originals[locale])) throw Error('Backup verification failed');
    }
    for (const locale of changed) {
      const previous = originals[locale].toString('utf8');
      const newline = previous.includes('\r\n') ? '\r\n' : '\n';
      const stage = files[locale] + '.deleteItem-' + randomUUID() + '.tmp';
      stages.set(locale, stage);
      const content = JSON.stringify(plan.catalogs[locale], null, 2).replace(/\n/g, newline) + (previous.endsWith('\n') ? newline : '');
      io.writeFileSync(stage, content, { flag: 'wx' });
      if (!equal(JSON.parse(io.readFileSync(stage, 'utf8')), plan.catalogs[locale])) throw Error('Staging verification failed');
    }
    for (const locale of locales) if (!io.readFileSync(files[locale]).equals(originals[locale])) throw Error('Concurrent catalog edit: ' + locale);
    for (const locale of changed) { io.renameSync(stages.get(locale), files[locale]); replaced.push(locale); }
    for (const locale of locales) {
      const actual = JSON.parse(io.readFileSync(files[locale], 'utf8').replace(/^\uFEFF/, ''));
      validate(actual, locale);
      if (!equal(actual, plan.catalogs[locale])) throw Error('Post-write verification failed');
    }
    return { ...plan, changed, backupDirectory };
  } catch (cause) {
    const unrestoredFiles = [];
    for (const locale of replaced) {
      try {
        io.writeFileSync(files[locale], originals[locale]);
        if (!io.readFileSync(files[locale]).equals(originals[locale])) throw Error('Restore verification failed');
      } catch { unrestoredFiles.push(files[locale]); }
    }
    const error = new Error('Deletion aborted; do not delegate. Backups: ' + backupDirectory, { cause });
    Object.assign(error, { backupDirectory, unrestoredFiles, stagingLeftovers: plan.stagingLeftovers });
    throw error;
  } finally {
    for (const stage of stages.values()) if (io.existsSync(stage)) {
      try { io.unlinkSync(stage); } catch { plan.stagingLeftovers.push(stage); }
    }
  }
}
```
