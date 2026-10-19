import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { transpileModule } from 'typescript';
import { fixture } from './test-walking-audio-races.mjs';

// Execute the real component effects with deterministic hooks and real WalkingAudio.
function mount(translated) {
  const f = fixture(), slots = [], effects = [];
  let cursor = 0, dirty = false, tree, advances = 0, cycles = 0, presented = 0;
  const props = { chunk: { id: 'one', intention: 'Olá', targetIntention: 'Hello', examples: [
    { id: 'example', exampleItem: 'Hello', pt: 'Olá' }
  ] }, language: 'en-US', sourceLanguage: 'pt-BR', level: 'all', total: 2,
    onPresented() { presented++; }, onCycleComplete() { cycles++; },
    onNext() { advances++; props.chunk = { ...props.chunk, id: 'next-' + advances }; dirty = true; return false; },
    onStop() { assert.fail('unexpected stop'); } };
  const hooks = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], value => { const next = typeof value === 'function' ? value(slots[i]) : value;
        if (!Object.is(slots[i], next)) { slots[i] = next; dirty = true; } }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useEffect(fn, deps) { const i = cursor++, old = slots[i];
      if (!old || deps.some((v,j) => !Object.is(v, old.deps[j]))) {
        effects.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
      }
    }
  };
  const jsx = (type, props) => ({ type, props });
  const context = vm.createContext({ exports: {}, console,
    localStorage: { getItem: () => String(translated), setItem() {} },
    window: { addEventListener() {}, removeEventListener() {} },
    document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} }, navigator: {},
    setInterval() {}, clearInterval() {},
    require(name) {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'react-i18next') return { useTranslation: () => ({ t: key => key }) };
      if (name.includes('walkingAudio')) return { WalkingAudio: class { constructor() { return f.audio; } }, resolveWalkingMp3Url: () => '/audio/en-US/cedar/example.mp3' };
      if (name.includes('mobileDevice')) return { isMobileDevice: () => true };
      if (name.includes('neuralExampleAudio')) return { getNeuralVoice: () => 'cedar' };
      if (name.includes('walkingSession')) return { WalkingSession: class { record() {} summary() { return {}; } } };
      return {};
    }
  });
  vm.runInContext(transpileModule(fs.readFileSync('src/components/WalkingMode.tsx', 'utf8'), {
    compilerOptions: { module: 1, target: 9, jsx: 4 }
  }).outputText, context);
  function flush() { let loops = 0; do {
    assert.ok(++loops < 30, 'render loop'); dirty = false; cursor = 0;
    tree = context.exports.WalkingMode(props); while (effects.length) effects.shift()();
  } while (dirty); }
  function find(node, predicate) {
    if (!node || typeof node !== 'object') return;
    if (predicate(node)) return node;
    const children = node.props?.children;
    for (const child of Array.isArray(children) ? children : [children]) { const found = find(child, predicate); if (found) return found; }
  }
  flush();
  return { f, flush, props, get advances() { return advances; }, get cycles() { return cycles; }, get presented() { return presented; },
    change(type, value) { const input = find(tree, n => n.type === 'input' && n.props.type === type);
      assert.ok(input); input.props.onChange({ target: { checked: value } }); flush(); },
    setting(key, value) {
      const label = find(tree, n => n.type === 'label' && (Array.isArray(n.props.children) ? n.props.children : [n.props.children]).includes(key));
      assert.ok(label, key);
      const input = find(label, n => n.type === 'select' || n.type === 'input');
      input.props.onChange({ target: { checked: value, value: String(value) } }); flush();
    },
    unmount() { for (const s of slots) s?.cleanup?.(); }
  };
}
for (const translated of [false, true]) {
  const m = mount(translated), { f } = m;
  for (let i = 0; i < 5; i++) {
    if (i) { f.speech.at(-1).onend(); f.tick(1000); m.flush(); }
    f.media.at(-1).onplaying(); m.flush();
    f.media.at(-1).onended(); m.flush();
    f.tick(translated ? 1000 : 3000); m.flush();
    if (translated) { assert.equal(f.speech.at(-1).text, 'Olá'); f.speech.at(-1).onend(); m.flush(); f.tick(3000); m.flush(); }
    assert.equal(m.advances, i === 4 ? 1 : 0);
  }
  assert.equal(m.cycles, 1); assert.equal(m.presented, 5);
  m.unmount(); assert.equal(f.timers.size, 0);
}
{
  const m = mount(false), { f } = m;
  f.media.at(-1).onplaying(); f.media.at(-1).onended(); m.flush();
  m.change('checkbox', true); // translation enabled during the inter-repetition pause
  f.tick(3000); m.flush();
  assert.equal(f.speech.at(-1).text, 'Repita comigo');
  f.speech.at(-1).onend(); f.tick(1000);
  f.media.at(-1).onplaying(); f.media.at(-1).onended(); m.flush(); f.tick(1000); m.flush();
  assert.equal(f.speech.at(-1).text, 'Olá');
  m.unmount(); f.tick(30000); assert.equal(m.advances, 0);
}
{
  const m = mount(false), { f } = m;
  m.setting('walking.autoAdvance', false);
  for (let i = 0; i < 5; i++) {
    if (i) { f.speech.at(-1).onend(); f.tick(1000); m.flush(); }
    f.media.at(-1).onplaying(); f.media.at(-1).onended(); m.flush();
    if (!i) {
      const before = f.events.length;
      m.setting('walking.voiceSpeed', .8); m.setting('walking.pauseBetweenPlaybacks', 4);
      assert.equal(f.events.length, before, 'settings must not replay the phrase');
    }
    f.tick(i ? 4000 : 3000); m.flush();
  }
  assert.equal(m.advances, 0); assert.equal(m.cycles, 1);
  m.setting('walking.autoAdvance', true); assert.equal(m.advances, 1);
  m.unmount();
}
console.log('PASS WalkingMode effects: five repetitions, prompts, translation, single automatic advance, configuration change, unmount');
