import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function loadPureTs(path) {
  const source = readFileSync(path, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  });
  const module = { exports: {} };
  const context = { module, exports: module.exports, crypto: globalThis.crypto, Uint8Array, Math, Date, JSON, Object, String, Number };
  vm.runInNewContext(outputText, context, { filename: path });
  return module.exports;
}
function memoryStorage() {
  const entries = new Map();
  return {
    getItem(key) { return entries.get(key) ?? null; },
    setItem(key, value) { entries.set(key, value); },
    removeItem(key) { entries.delete(key); }
  };
}
const cards = loadPureTs('src/features/small-talk/smallTalkCustomItems.ts');
const print = loadPureTs('src/features/small-talk/smallTalkPrintOrder.ts');
const page = readFileSync('src/features/small-talk/SmallTalkPage.tsx', 'utf8');
const walking = readFileSync('src/features/small-talk/SmallTalkWalking.tsx', 'utf8');

function card(id, order, enabled = true, question = 'Original question?') {
  return {
    id, type: 'question-answer', order, enabled, level: 'b1',
    question: { text: question, audio: 'old.mp3' },
    answer: { text: 'Original answer.', audio: 'old-answer.mp3' },
    context: null,
    followUps: [{ id: 'followup-original', text: 'Why?', audio: 'followup.mp3' }],
    linkedIntentionIds: ['chunk-1'], tags: ['speaking'],
    source: { document: 'source', section: 'topic', paragraphIndex: 3 },
    reviewStatus: 'approved'
  };
}
test('duplicates a published card with independent ID and effective edits', () => {
  const storage = memoryStorage();
  const source = card('published', 2);
  const { id, items } = cards.duplicateCustomItem('travel', source, 'Edited question?', 'My current answer.', 7, storage);
  assert.notEqual(id, source.id);
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(items[id].item.question.text, 'Edited question?');
  assert.equal(items[id].item.answer.text, 'My current answer.');
  assert.equal(items[id].item.question.audio, null);
  assert.equal(items[id].item.answer.audio, null);
  assert.equal(items[id].item.order, 7);
  assert.equal(items[id].item.level, 'b1');
  assert.equal(items[id].item.reviewStatus, 'pending');
  assert.equal(items[id].item.followUps[0].text, 'Why?');
  assert.notEqual(items[id].item.followUps[0].id, 'followup-original');
  assert.equal(items[id].item.followUps[0].audio, null);
  assert.equal(source.question.text, 'Original question?');
  assert.equal(source.followUps[0].id, 'followup-original');
  assert.equal(cards.isCustomItems(items), true);
  assert.equal(cards.readCustomItems(storage)[id].item.answer.text, 'My current answer.');
});
test('duplicate of a personal card remains independent and merges through Drive records', () => {
  const storage = memoryStorage();
  const original = cards.createCustomItem('travel', 'My question?', 'My answer.', 'a2', 4, storage);
  const originalId = Object.keys(original)[0];
  const { id, items } = cards.duplicateCustomItem('travel', original[originalId].item, 'My question?', 'My answer.', 5, storage);
  assert.notEqual(id, originalId);
  assert.equal(Object.keys(items).length, 2);
  const remote = cards.mergeCustomItems({}, items);
  assert.equal(Object.keys(remote).length, 2);
  assert.equal(remote[id].item.answer.text, 'My answer.');
});
test('print numbering is stable when walking filters or shuffles', () => {
  const ordered = [card('a', 1), card('disabled', 2, false), card('b', 3), card('blank', 4, true, '  '), card('c', 5)];
  const printable = print.printableSmallTalkItems(ordered, item => item.question.text);
  assert.deepEqual(printable.map(item => item.id).join(','), 'a,b,c');
  const numbers = print.smallTalkPrintNumbers(printable);
  assert.equal(numbers.a, 1);
  assert.equal(numbers.b, 2);
  assert.equal(numbers.c, 3);
  assert.equal(numbers.disabled, undefined);
  const shuffled = [printable[2], printable[0]];
  assert.deepEqual(shuffled.map(item => numbers[item.id]).join(','), '3,1');
});
test('duplicate receives N+1 at the end without changing existing print numbers', () => {
  const items = [card('a', 1), card('b', 2), card('c', 3)];
  const originalNumbers = print.smallTalkPrintNumbers(items);
  const order = print.nextSmallTalkCardOrder(items);
  assert.equal(order, 4);
  const storage = memoryStorage();
  const { items: copies, id } = cards.duplicateCustomItem('travel', items[1], 'B?', 'B answer', order, storage);
  const printed = print.printableSmallTalkItems([...items, copies[id].item].sort((a, b) => a.order - b.order), item => item.question.text);
  assert.equal(printed.map(item => item.id).join(','), 'a,b,c,' + id);
  const nextNumbers = print.smallTalkPrintNumbers(printed);
  for (const item of items) assert.equal(nextNumbers[item.id], originalNumbers[item.id]);
  assert.equal(nextNumbers[id], 4);
  assert.match(page, /orderedIds\.push\(id\)/);
  assert.doesNotMatch(page, /orderedIds\.splice\(position \+ 1, 0, id\)/);
});
test('duplicate goes after all existing cards even when catalog order has gaps', () => {
  const items = [card('a', 10), card('b', 20), card('c', 30)];
  const order = print.nextSmallTalkCardOrder(items);
  assert.equal(order, 31);
  const storage = memoryStorage();
  const { items: copies, id } = cards.duplicateCustomItem('travel', items[0], 'A?', 'A answer', order, storage);
  const printed = [...items, copies[id].item].sort((a, b) => a.order - b.order);
  assert.equal(printed[3].id, id);
  assert.equal(print.smallTalkPrintNumbers(printed)[id], 4);
});
test('walking shows printed number but does not speak it', () => {
  assert.match(page, /questionNumbers=\{printNumbers\}/);
  assert.match(walking, /questionNumbers\[current\.id\]/);
  assert.match(walking, /speak\(current\.question\?\.text \?\? ''/);
  assert.match(page, /const items = printableSmallTalkItems\(orderedTopicItems, questionFor\)/);
});
test('duplicate action and card icons use SVG; brand assets stay intact', () => {
  assert.match(page, /aria-label="Duplicar card"[^>]*onClick=\{\(\) => duplicateCard\(item\)\}/);
  assert.match(page, /<SmallTalkIcon name="duplicate"\/>/);
  const actions = page.slice(page.indexOf('aria-label={favorites.includes(item.id)'), page.indexOf('{modified && <button type="button" className="small-talk-restore-button"'));
  for (const icon of ['star', 'edit', 'trash', 'printer', 'clipboard', 'globe']) {
    assert.ok(actions.includes('name="' + icon + '"'), icon);
  }
  assert.match(actions, /<img src=\{aiAssetPath\(aiProvider\)\}/);
});
