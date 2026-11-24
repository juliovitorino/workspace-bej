import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const modules = [
  "src/components/BasicTraining.tsx",
  "src/components/AdvancedTraining.tsx",
  "src/components/ReviewTraining.tsx",
  "src/components/SpeakingGamePlayStep.tsx",
  "src/features/small-talk/SmallTalkPage.tsx",
  "src/features/would-you-rather/WouldYouRather.tsx",
];

test("all Google Translate buttons use the shared SVG component", () => {
  const icon = read("src/components/GoogleTranslateIcon.tsx");
  assert.match(icon, /export function GoogleTranslateIcon/);
  assert.match(icon, /<svg/);
  assert.match(icon, /aria-hidden="true"/);

  for (const path of modules) {
    const source = read(path);
    assert.match(source, /import \{ GoogleTranslateIcon \} from /, path);
    assert.match(source, /<GoogleTranslateIcon\b/, path);
    assert.doesNotMatch(source, /google-translate-icon\.png/, path);
  }
});

test("legacy WRG and Small Talk translator symbols are not used", () => {
  assert.doesNotMatch(read("src/features/would-you-rather/WouldYouRather.tsx"), /<Icon kind="translate"/);
  assert.doesNotMatch(read("src/features/small-talk/SmallTalkPage.tsx"), /<SmallTalkIcon name="globe"/);
});
