import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const page = readFileSync('src/features/small-talk/SmallTalkPage.tsx', 'utf8');
const icons = readFileSync('src/features/small-talk/SmallTalkIcon.tsx', 'utf8');
const historySource = readFileSync('src/features/small-talk/smallTalkAnswerEditHistory.ts', 'utf8');
const functionSource = page.match(/  async function pasteAnswerDraft\(\) \{[\s\S]*?\n  \}\n  function saveEditor\(/)?.[0].replace(/\n  function saveEditor\($/, '');
assert.ok(functionSource, 'pasteAnswerDraft must exist');
const transpile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 } }).outputText;
function harness({ clipboardText = 'Pasted answer', fail = false, available = true } = {}) {
  const history = { past: [], present: 'Original answer', future: [] };
  let current = history, message = '', success = false, focused = false, timeout = null;
  const activeAnswerEditorRef = { current: 'q1' }, answerPasteTimerRef = { current: null };
  const context = {
    activeAnswerEditorRef, answerPasteTimerRef,
    navigator: { clipboard: available ? { async readText() { if (fail) throw Error('denied'); return clipboardText; } } : undefined },
    setAnswerCopyMessage: x => { message = x; }, setEditError() {},
    setAnswerEditHistory: fn => { current = fn(current); },
    setAnswerPasteSuccess: x => { success = x; },
    answerEditorRef: { current: { focus() { focused = true; } } },
    window: { clearTimeout() { timeout = null; }, setTimeout(fn, ms) { timeout = { fn, ms }; return 1; } }
  };
  vm.runInNewContext(transpile(historySource.replace(/export /g, '')) + '\n' + transpile(functionSource) + '\nthis.run = pasteAnswerDraft;', context);
  return { run: () => context.run(), undo: () => { current = context.undoAnswerEdit(current); }, redo: () => { current = context.redoAnswerEdit(current); },
    get current() { return current; }, get message() { return message; }, get success() { return success; }, get timeout() { return timeout; }, get focused() { return focused; } };
}
test('paste replaces entire answer without saving and participates in undo/redo', async () => {
  const app = harness({ clipboardText: 'New entire answer' });
  await app.run();
  assert.equal(app.current.present, 'New entire answer');
  assert.equal(app.current.past[0], 'Original answer');
  assert.equal(app.success, true);
  assert.equal(app.timeout.ms, 2000);
  assert.equal(app.focused, true);
  app.undo();
  assert.equal(app.current.present, 'Original answer');
  app.redo();
  assert.equal(app.current.present, 'New entire answer');
  app.timeout.fn();
  assert.equal(app.success, false);
});
test('empty clipboard preserves draft', async () => {
  const app = harness({ clipboardText: '' });
  await app.run();
  assert.equal(app.current.present, 'Original answer');
  assert.match(app.message, /vazia/);
  assert.equal(app.success, false);
});
test('permission failure preserves draft and shows error', async () => {
  const app = harness({ fail: true });
  await app.run();
  assert.equal(app.current.present, 'Original answer');
  assert.match(app.message, /Não foi possível acessar/);
});
test('unsupported Clipboard API preserves draft and offers manual paste', async () => {
  const app = harness({ available: false });
  await app.run();
  assert.equal(app.current.present, 'Original answer');
  assert.match(app.message, /Ctrl\/Cmd \+ V/);
});
test('paste icon only exists in edit toolbar, beside copy', () => {
  const toolbar = page.slice(page.indexOf('small-talk-edit-toolbar'), page.indexOf('{answerCopyMessage && <span'));
  assert.ok(toolbar.indexOf('Copiar resposta em edição') < toolbar.indexOf('Colar resposta da área de transferência'));
  assert.match(toolbar, /answerPasteSuccess \? 'check' : 'paste'/);
  assert.match(icons, /name === 'paste'/);
});
