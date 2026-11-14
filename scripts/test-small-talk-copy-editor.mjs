import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync('src/features/small-talk/SmallTalkPage.tsx', 'utf8');
const functionMatch = source.match(/  async function copyAnswerDraft\(\) \{[\s\S]*?\n  \}\n  function saveEditor\(\)/);
assert.ok(functionMatch, 'copyAnswerDraft function exists');
const implementation = functionMatch[0].replace(/\n  function saveEditor\(\)$/, '');

function createCopyContext({ draft, clipboard, fallback = false }) {
  let copiedText = null;
  let feedback = '';
  const field = {
    value: '',
    style: {},
    setAttribute() {},
    focus() {},
    select() {}
  };
  const document = {
    createElement() { return field; },
    body: { appendChild() {} },
    execCommand(command) {
      assert.equal(command, 'copy');
      copiedText = field.value;
      return fallback;
    }
  };
  field.remove = () => {};
  const context = {
    draft,
    navigator: { clipboard },
    document,
    setAnswerCopyMessage(value) { feedback = value; }
  };
  vm.runInNewContext(implementation + '\nthis.copyAnswerDraft = copyAnswerDraft;', context);
  return {
    run: () => context.copyAnswerDraft(),
    get copiedText() { return copiedText; },
    get feedback() { return feedback; }
  };
}

test('copy icon is beside redo in edit toolbar and disabled for empty draft', () => {
  const toolbar = source.slice(source.indexOf('aria-label="Ferramentas de edição da resposta"'));
  assert.ok(toolbar.indexOf('aria-label="Copiar resposta em edição"') > toolbar.indexOf('aria-label="Refazer alteração desfeita"'));
  assert.match(toolbar, /disabled=\{!draft\} onClick=\{\(\) => void copyAnswerDraft\(\)\}/);
});

test('copies current unsaved draft via Clipboard API', async () => {
  let clipboardText = '';
  const app = createCopyContext({
    draft: 'Unsaved answer\nwith another line.',
    clipboard: { async writeText(value) { clipboardText = value; } }
  });
  await app.run();
  assert.equal(clipboardText, 'Unsaved answer\nwith another line.');
  assert.match(app.feedback, /copiada/);
});

test('uses legacy fallback when Clipboard API is blocked', async () => {
  const app = createCopyContext({
    draft: 'My draft.',
    clipboard: { async writeText() { throw Error('NotAllowedError'); } },
    fallback: true
  });
  await app.run();
  assert.equal(app.copiedText, 'My draft.');
  assert.match(app.feedback, /copiada/);
});

test('reports blocked copy without claiming success', async () => {
  const app = createCopyContext({ draft: 'My draft.', clipboard: undefined, fallback: false });
  await app.run();
  assert.match(app.feedback, /Não foi possível/);
});
