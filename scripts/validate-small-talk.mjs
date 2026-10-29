#!/usr/bin/env node
/** Validação não destrutiva. Nunca imprime textos de respostas pessoais. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedLevels = new Set(['a1', 'a2', 'b1', 'b2', 'c1']);
const allowedTypes = new Set(['question-answer', 'discussion-prompt', 'conversation-expression']);
const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));

export function validateCatalog(root, privatePath) {
  const errors = [], warnings = [];
  const fail = (code, location) => errors.push({ code, location });
  const warn = (code, location) => warnings.push({ code, location });
  const indexFile = path.join(root, 'index.json');
  if (!fs.existsSync(indexFile)) return { errors: [{code:'MISSING_INDEX',location:indexFile}], warnings, summary: {} };
  let index;
  try { index = readJson(indexFile); } catch { return {errors:[{code:'INVALID_INDEX_JSON',location:indexFile}],warnings,summary:{}}; }
  if (index.schemaVersion !== '1.0.0' || index.module !== 'small-talk') fail('INVALID_INDEX_SCHEMA','index.json');
  if (!Array.isArray(index.topics)) return {errors:[{code:'INVALID_TOPICS',location:'index.json'}],warnings,summary:{}};
  const topicIds = new Set(), itemIds = new Set(), normalizedQuestions = new Map();
  let itemCount=0, pendingItems=0, unclassifiedItems=0, duplicateQuestionGroups=0;
  for (const topic of index.topics) {
    const id=topic?.id;
    if (typeof id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {fail('INVALID_TOPIC_ID',String(id));continue;}
    if (topicIds.has(id)) fail('DUPLICATE_TOPIC_ID',id);
    topicIds.add(id);
    const file=path.join(root,'en-US','topics',`${id}.json`);
    if (!fs.existsSync(file)) {fail('MISSING_TOPIC_FILE',id);continue;}
    let data;
    try { data=readJson(file); } catch {fail('INVALID_TOPIC_JSON',id);continue;}
    if (data.schemaVersion !== '1.0.0' || data.module !== 'small-talk' || data.locale !== 'en-US' || data.topicId !== id) fail('TOPIC_METADATA_MISMATCH',id);
    if (!Array.isArray(data.items)) {fail('INVALID_ITEMS',id);continue;}
    const orderSet=new Set();
    for (const item of data.items) {
      itemCount++;
      const loc=`${id}#${item?.order ?? '?'}`;
      if (!uuid.test(item?.id ?? '')) fail('INVALID_ITEM_UUID',loc);
      if (itemIds.has(item?.id)) fail('DUPLICATE_ITEM_ID',loc);
      itemIds.add(item?.id);
      if (!Number.isInteger(item.order) || item.order < 1 || orderSet.has(item.order)) fail('INVALID_ITEM_ORDER',loc);
      orderSet.add(item.order);
      if (!allowedTypes.has(item.type)) fail('INVALID_ITEM_TYPE',loc);
      if (!isObject(item.question) || typeof item.question.text !== 'string' || !item.question.text.trim()) fail('EMPTY_QUESTION',loc);
      if (item.level === null) unclassifiedItems++;
      else if (!allowedLevels.has(item.level)) fail('INVALID_LEVEL',loc);
      if (item.reviewStatus === 'pending') pendingItems++;
      else if (!['approved','rejected'].includes(item.reviewStatus)) fail('INVALID_REVIEW_STATUS',loc);
      if (!Array.isArray(item.followUps) || !Array.isArray(item.tags) || !Array.isArray(item.linkedIntentionIds)) fail('INVALID_ITEM_ARRAY',loc);
      if (!isObject(item.source) || typeof item.source.paragraphIndex !== 'number') fail('MISSING_SOURCE_TRACE',loc);
      const normalized=typeof item.question?.text === 'string' ? item.question.text.trim().toLocaleLowerCase('en-US') : '';
      if (normalized) {
        if (normalizedQuestions.has(normalized)) duplicateQuestionGroups++;
        else normalizedQuestions.set(normalized,loc);
      }
    }
  }
  const localeFiles=fs.readdirSync(path.join(root,'en-US','topics')).filter(n=>n.endsWith('.json'));
  for (const filename of localeFiles) if (!topicIds.has(filename.slice(0,-5))) fail('UNINDEXED_TOPIC_FILE',filename);
  if (!Array.isArray(index.availableLocales) || !index.availableLocales.includes('en-US')) fail('EN_US_NOT_AVAILABLE','index.json');
  if (unclassifiedItems) warn('CEFR_UNCLASSIFIED',String(unclassifiedItems));
  if (pendingItems) warn('ITEMS_PENDING_EDITORIAL_REVIEW',String(pendingItems));
  if (duplicateQuestionGroups) warn('POSSIBLE_DUPLICATE_QUESTIONS',String(duplicateQuestionGroups));
  if (index.importStatus === 'staging-review-required') warn('STAGING_NOT_APPROVED_FOR_DEPLOY','index.json');
  let personalEntries=0, originalAnswers=0, noOriginal=0, orphanAnswers=0, revisions=0;
  if (privatePath) {
    try {
      const personal=readJson(privatePath);
      if (personal.module !== 'small-talk' || personal.dataType !== 'personal-answers' || !isObject(personal.answersByItemId)) {
        fail('INVALID_PERSONAL_ANSWERS_SCHEMA','private-import');
      } else {
        for (const [key, answer] of Object.entries(personal.answersByItemId)) {
          personalEntries++;
          if (!itemIds.has(key)) {orphanAnswers++; fail('ORPHAN_PERSONAL_ANSWER',key);}
          if (answer.itemId !== key) fail('PERSONAL_ITEM_ID_MISMATCH',key);
          if (answer.original !== null) {
            originalAnswers++;
            if (!uuid.test(answer.original?.id ?? '') || !Array.isArray(answer.original?.segments) ||
                !answer.original.segments.every(s => uuid.test(s?.id ?? '') && typeof s.text === 'string' && s.text.trim())) fail('INVALID_ORIGINAL_SEGMENTS',key);
          } else noOriginal++;
          if (!Array.isArray(answer.revisions)) fail('INVALID_REVISIONS',key);
          else {
            revisions+=answer.revisions.length;
            const validIds=new Set([answer.original?.id,...answer.revisions.map(r=>r.id)].filter(Boolean));
            for (const rev of answer.revisions) {
              if (!uuid.test(rev.id) || !validIds.has(rev.basedOnAnswerId) || !Array.isArray(rev.segments) ||
                  !['draft','approved','rejected'].includes(rev.status)) fail('INVALID_REVISION',key);
            }
            if (answer.activeAnswerId !== null && !validIds.has(answer.activeAnswerId)) fail('INVALID_ACTIVE_ANSWER',key);
          }
        }
      }
    } catch {fail('INVALID_PRIVATE_JSON_OR_PATH','private-import');}
  }
  return {
    errors,warnings,
    summary:{topics:topicIds.size,items:itemCount,uniqueItemIds:itemIds.size,unclassifiedItems,pendingItems,
      possibleDuplicateQuestionOccurrences:duplicateQuestionGroups,
      ...(privatePath?{personalEntries,originalAnswers,noOriginal,orphanAnswers,revisions}:{})}
  };
}

const current=fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === current) {
  const args=process.argv.slice(2);
  const opt=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;};
  const root=path.resolve(opt('--root') ?? 'public/small-talk');
  const privatePath=opt('--private');
  const strict=args.includes('--strict');
  const report=validateCatalog(root,privatePath);
  console.log(JSON.stringify(report,null,2));
  process.exitCode=report.errors.length || (strict && report.warnings.length)?1:0;
}
