import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';

const source = readFileSync('src/features/small-talk/smallTalkAnswerEditHistory.ts', 'utf8');
const js = transpileModule(source, {
  compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 }
}).outputText;
const module = { exports: {} };
vm.runInNewContext(js, { module, exports: module.exports });
const { beginAnswerEdit, changeAnswerEdit, undoAnswerEdit, redoAnswerEdit, ANSWER_EDIT_HISTORY_LIMIT } = module.exports;

test('borracha limpa só o rascunho e pode ser desfeita e refeita', () => {
  const original = beginAnswerEdit('My personal answer.');
  const cleared = changeAnswerEdit(original, '');
  assert.equal(cleared.present, '');
  assert.equal(original.present, 'My personal answer.', 'original is never mutated');
  const restored = undoAnswerEdit(cleared);
  assert.equal(restored.present, 'My personal answer.');
  assert.equal(redoAnswerEdit(restored).present, '');
});

test('desfazer e refazer várias edições na ordem correta', () => {
  let history = beginAnswerEdit('A');
  history = changeAnswerEdit(history, 'AB');
  history = changeAnswerEdit(history, 'ABC');
  history = undoAnswerEdit(history);
  assert.equal(history.present, 'AB');
  history = undoAnswerEdit(history);
  assert.equal(history.present, 'A');
  history = redoAnswerEdit(history);
  assert.equal(history.present, 'AB');
  history = redoAnswerEdit(history);
  assert.equal(history.present, 'ABC');
  assert.equal(redoAnswerEdit(history), history, 'redo unavailable at end');
});

test('nova edição após desfazer invalida o redo', () => {
  let history = beginAnswerEdit('Original');
  history = changeAnswerEdit(history, 'First');
  history = changeAnswerEdit(history, 'Second');
  history = undoAnswerEdit(history);
  history = changeAnswerEdit(history, 'Alternative');
  assert.equal(history.present, 'Alternative');
  assert.equal(history.future.length, 0);
  assert.equal(redoAnswerEdit(history), history);
});

test('abrir outra resposta começa um histórico isolado', () => {
  const first = changeAnswerEdit(beginAnswerEdit('Answer one'), 'Edited one');
  const second = beginAnswerEdit('Answer two');
  assert.equal(first.past.length, 1);
  assert.equal(second.past.length, 0);
  assert.equal(second.future.length, 0);
  assert.equal(undoAnswerEdit(second), second);
});

test('não duplica alterações idênticas e limita a memória', () => {
  let history = beginAnswerEdit('');
  assert.equal(changeAnswerEdit(history, ''), history);
  for (let i = 0; i < ANSWER_EDIT_HISTORY_LIMIT + 20; i++) {
    history = changeAnswerEdit(history, String(i));
  }
  assert.equal(history.past.length, ANSWER_EDIT_HISTORY_LIMIT);
  assert.equal(history.future.length, 0);
});
