import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSmallTalkPersonalAnswers, planSmallTalkPersonalImport, commitSmallTalkPersonalImport,
  readSmallTalkPersonalAnswers, getSmallTalkDefaultAnswer, SMALL_TALK_PERSONAL_ANSWERS_KEY
} from '../src/services/smallTalkPersonalAnswersService.ts';

const id = '7dd58de7-a365-4dff-83c6-024a01552094';
const originalId = 'edb7cadd-1685-4d62-a626-e4f44fdd602c';
const segmentId = '0bd71fa9-b913-4708-a711-4ccf56c63c61';
const revisionId = 'c8919d67-643e-4a4e-8b55-220aa3c490e8';
const makeAnswer = () => ({
  itemId: id, locale: 'en-US',
  original: { id: originalId, source: 'docx-import', segments: [{ id: segmentId, text: 'My original response.' }] },
  revisions: [], activeAnswerId: originalId,
  sourceLeadIn: [], sourceAnnotations: [], importReviewStatus: 'pending'
});
const makeDoc = (answer = makeAnswer()) => ({ schemaVersion: '1.0.0', module: 'small-talk', dataType: 'personal-answers', locale: 'en-US', answersByItemId: { [id]: answer } });
const makeStorage = () => {
  const map = new Map();
  return { getItem: key => map.get(key) ?? null, setItem: (key, value) => { map.set(key, value); } };
};
const catalog = new Set([id]);

test('valida e importa original sem sobrescrever outros módulos', () => {
  const storage = makeStorage();
  storage.setItem('bej:other-module', 'safe');
  const incoming = parseSmallTalkPersonalAnswers(JSON.stringify(makeDoc()));
  const plan = planSmallTalkPersonalImport(incoming, readSmallTalkPersonalAnswers(storage), catalog);
  assert.equal(plan.errors.length, 0);
  assert.equal(plan.newRecords, 1);
  commitSmallTalkPersonalImport(plan, storage);
  assert.equal(storage.getItem('bej:other-module'), 'safe');
  assert.equal(getSmallTalkDefaultAnswer(id, storage)?.[0].text, 'My original response.');
});

test('reimportação idempotente mantém original e revisões locais', () => {
  const storage = makeStorage();
  const initial = makeDoc();
  storage.setItem(SMALL_TALK_PERSONAL_ANSWERS_KEY, JSON.stringify(initial));
  const revised = structuredClone(initial);
  revised.answersByItemId[id].revisions.push({ id: revisionId, basedOnAnswerId: originalId, status: 'approved', segments: [{ id: 'f12905f7-034b-4f36-9c08-2b5c7e77939a', text: 'Revised response.' }] });
  revised.answersByItemId[id].activeAnswerId = revisionId;
  storage.setItem(SMALL_TALK_PERSONAL_ANSWERS_KEY, JSON.stringify(revised));
  const plan = planSmallTalkPersonalImport(parseSmallTalkPersonalAnswers(JSON.stringify(initial)), readSmallTalkPersonalAnswers(storage), catalog);
  assert.equal(plan.unchangedRecords, 1);
  commitSmallTalkPersonalImport(plan, storage);
  assert.equal(readSmallTalkPersonalAnswers(storage).answersByItemId[id].revisions.length, 1);
  assert.equal(readSmallTalkPersonalAnswers(storage).answersByItemId[id].activeAnswerId, revisionId);
  assert.equal(getSmallTalkDefaultAnswer(id, storage)?.[0].text, 'My original response.');
});

test('bloqueia divergência do original sem modificar armazenamento', () => {
  const storage = makeStorage();
  const existing = makeDoc();
  storage.setItem(SMALL_TALK_PERSONAL_ANSWERS_KEY, JSON.stringify(existing));
  const incoming = structuredClone(existing);
  incoming.answersByItemId[id].original.segments[0].text = 'Changed without revision.';
  const plan = planSmallTalkPersonalImport(parseSmallTalkPersonalAnswers(JSON.stringify(incoming)), readSmallTalkPersonalAnswers(storage), catalog);
  assert.equal(plan.merged, null);
  assert.match(plan.errors[0], /Original imutável/);
  assert.throws(() => commitSmallTalkPersonalImport(plan, storage));
  assert.deepEqual(readSmallTalkPersonalAnswers(storage), existing);
});

test('bloqueia IDs que não existem no catálogo', () => {
  const plan = planSmallTalkPersonalImport(makeDoc(), makeDoc(), new Set());
  assert.equal(plan.merged, null);
  assert.match(plan.errors[0], /não encontrado/);
});

test('detecta mudança entre prévia e commit', () => {
  const storage = makeStorage();
  const plan = planSmallTalkPersonalImport(makeDoc(), readSmallTalkPersonalAnswers(storage), catalog);
  storage.setItem(SMALL_TALK_PERSONAL_ANSWERS_KEY, JSON.stringify(makeDoc()));
  assert.throws(() => commitSmallTalkPersonalImport(plan, storage), /alterados em outra aba/);
});

test('não aceita revisão ativa ainda não aprovada', () => {
  const doc = makeDoc();
  doc.answersByItemId[id].revisions.push({ id: revisionId, basedOnAnswerId: originalId, status: 'draft', segments: [{ id: 'f12905f7-034b-4f36-9c08-2b5c7e77939a', text: 'Draft' }] });
  doc.answersByItemId[id].activeAnswerId = revisionId;
  assert.throws(() => parseSmallTalkPersonalAnswers(JSON.stringify(doc)), /Registro inválido/);
});
