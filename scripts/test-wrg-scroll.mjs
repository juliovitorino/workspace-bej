import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";

const require = createRequire(import.meta.url);
const { transpileModule, ModuleKind, ScriptTarget } = require("typescript");
const code = transpileModule(readFileSync("src/features/would-you-rather/wyrScroll.ts", "utf8"), {
  compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 }
}).outputText;
const module = { exports: {} };
vm.runInThisContext("(function(require,module,exports){" + code + "\n})")(require, module, module.exports);
const { scrollToWyrCard } = module.exports;

test("scrolls the destination card smoothly to the beginning", () => {
  const calls = [];
  scrollToWyrCard({ scrollIntoView: options => calls.push(options) }, false);
  assert.deepEqual(calls, [{ behavior: "smooth", block: "start" }]);
});

test("respects reduced-motion preferences", () => {
  const calls = [];
  scrollToWyrCard({ scrollIntoView: options => calls.push(options) }, true);
  assert.deepEqual(calls, [{ behavior: "auto", block: "start" }]);
});

test("does nothing if a card is not mounted", () => {
  assert.doesNotThrow(() => scrollToWyrCard(null, false));
});

test("navigation and reveal target the correct cards only after React commits", () => {
  const source = readFileSync("src/features/would-you-rather/WouldYouRather.tsx", "utf8");
  const css = readFileSync("src/features/would-you-rather/wouldYouRather.css", "utf8");
  assert.match(source, /ref=\{scrollRef\}/);
  assert.match(source, /key === "question" \? questionCardRef/);
  assert.match(source, /key === "answerA" \? answerACardRef/);
  assert.match(source, /key === "answerB" \? answerBCardRef/);
  assert.match(source, /pendingScrollRef\.current = next > index \? "question" : null/);
  assert.match(source, /pendingScrollRef\.current = revealed\[choice\] \? null : choice === "A" \? "answerA" : "answerB"/);
  assert.match(source, /toggle: \(\) => toggleAnswer\("A"\)/);
  assert.match(source, /toggle: \(\) => toggleAnswer\("B"\)/);
  assert.match(source, /useEffect\(\(\) => \{\s*if \(screen !== "practice" \|\| !pendingScrollRef\.current\) return;/);
  assert.match(source, /scrollToWyrCard\(target, window\.matchMedia\?/);
  assert.match(css, /\.wyr-card--scroll-target \{ scroll-margin-top:/);
});
