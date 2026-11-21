import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const page = readFileSync('src/features/small-talk/SmallTalkPage.tsx', 'utf8');
const icons = readFileSync('src/features/small-talk/SmallTalkIcon.tsx', 'utf8');
const css = readFileSync('src/features/small-talk/smallTalk.css', 'utf8');
const match = page.match(/  async function copyQuestion\(item: SmallTalkItem\) \{[\s\S]*?\n  \}\n  function openQuestionEditor\(/);
assert.ok(match, 'copyQuestion implementation must exist');
const implementation = match[0].replace(/\n  function openQuestionEditor\($/, '');
const compiled = ts.transpileModule(implementation, {
  compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 }
}).outputText;

function harness({ clipboard, legacySuccess = false, text = 'What do you enjoy studying?' } = {}) {
  let copiedText = null;
  let copiedId = null;
  let error = null;
  let removed = false;
  let timeout = null;
  const timer = { current: null };
  const field = {
    value: '', style: {}, setAttribute() {}, focus() {}, select() {},
    remove() { removed = true; }
  };
  const document = {
    createElement(tag) { assert.equal(tag, 'textarea'); return field; },
    body: { appendChild() {} },
    execCommand(command) {
      assert.equal(command, 'copy');
      copiedText = field.value;
      return legacySuccess;
    }
  };
  const context = {
    navigator: { clipboard }, document, questionCopyTimerRef: timer,
    questionFor: () => text,
    setCopiedQuestionId: value => { copiedId = value; },
    setQuestionCopyError: value => { error = value; },
    window: {
      clearTimeout() { timeout = null; },
      setTimeout(callback, milliseconds) {
        timeout = { callback, milliseconds };
        return 1;
      }
    }
  };
  vm.runInNewContext(compiled + '\nthis.copyQuestion = copyQuestion;', context);
  return {
    run: () => context.copyQuestion({ id: 'question-1' }),
    get copiedId() { return copiedId; },
    get copiedText() { return copiedText; },
    get error() { return error; },
    get timeout() { return timeout; },
    get removed() { return removed; }
  };
}

test('copies only the effective question and shows check for two seconds', async () => {
  let clipboardText = '';
  const app = harness({ clipboard: { async writeText(value) { clipboardText = value; } } });
  await app.run();
  assert.equal(clipboardText, 'What do you enjoy studying?');
  assert.equal(app.copiedId, 'question-1');
  assert.equal(app.timeout.milliseconds, 2000);
  app.timeout.callback();
  assert.equal(app.copiedId, null);
});

test('uses legacy copy on restricted browsers', async () => {
  const app = harness({ clipboard: { async writeText() { throw Error('NotAllowedError'); } }, legacySuccess: true });
  await app.run();
  assert.equal(app.copiedText, 'What do you enjoy studying?');
  assert.equal(app.copiedId, 'question-1');
  assert.equal(app.removed, true);
});

test('does not show success when clipboard permission is denied', async () => {
  const app = harness({ clipboard: undefined, legacySuccess: false });
  await app.run();
  assert.equal(app.copiedId, null);
  assert.match(app.error.message, /Não foi possível copiar/);
  assert.equal(app.timeout, null);
  assert.equal(app.removed, true);
});

test('copy icon is beside the question edit button and toggles to check', () => {
  const heading = page.slice(page.indexOf('<div className="small-talk-question-heading">'), page.indexOf('{questionEditorId === item.id'));
  assert.ok(heading.indexOf('aria-label="Editar pergunta"') < heading.indexOf("'Copiar pergunta'"));
  assert.match(heading, /onClick=\{\(\) => void copyQuestion\(item\)\}/);
  assert.match(heading, /copiedQuestionId === item\.id \? 'check' : 'copy'/);
  assert.match(heading, /disabled=\{!questionFor\(item\)\.trim\(\)\}/);
  assert.match(icons, /name === 'copy'/);
  assert.match(css, /\.small-talk-question-copy-success/);
  assert.match(page, /window\.clearTimeout\(questionCopyTimerRef\.current\)/);
});
