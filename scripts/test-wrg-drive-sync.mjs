import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const { transpileModule, ModuleKind, ScriptTarget } = require("typescript");
const source = readFileSync("src/features/would-you-rather/wouldYouRatherStorage.ts", "utf8");
const output = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
vm.runInThisContext("(function(require,module,exports){" + output + "\n})", { filename: "wouldYouRatherStorage.ts" })(require, module, module.exports);
const wyr = module.exports;
const disk = new Map();
const events = [];
globalThis.localStorage = {
  get length() { return disk.size; },
  key: index => [...disk.keys()][index] ?? null,
  getItem: key => disk.get(key) ?? null,
  setItem: (key, value) => { disk.set(key, value); },
  removeItem: key => { disk.delete(key); }
};
globalThis.window = { dispatchEvent: event => { events.push(event.type); return true; } };
const ID1 = "7b04d826-1913-58d8-a077-af586024baf9";
const ID2 = "8b04d826-1913-58d8-a077-af586024baf9";
const copy = value => JSON.parse(JSON.stringify(value));
const reset = () => { disk.clear(); events.length = 0; };

test("old device-local WRG data is included without pretending it was just edited", () => {
  reset();
  localStorage.setItem(wyr.WYR_FAVORITES_KEY, JSON.stringify([ID1]));
  localStorage.setItem(wyr.WYR_PROGRESS_KEY, JSON.stringify({ [ID2]: "B" }));
  const progress = wyr.readWyrProgress();
  assert.equal(progress.favorites[ID1].value, true);
  assert.equal(progress.choices[ID2].value, "B");
  assert.equal(progress.favorites[ID1].updatedAt, "1970-01-01T00:00:00.000Z");
  assert.equal(progress.choices[ID2].updatedAt, "1970-01-01T00:00:00.000Z");
  assert.equal(wyr.writeWyrProgress(progress), true);
  assert.deepEqual(wyr.readWyrStored().favorites, [ID1]);
  assert.deepEqual(wyr.readWyrStored().choices, { [ID2]: "B" });
});

test("favorite removal produces a tombstone that survives repeated and reversed merges", () => {
  reset();
  assert.equal(wyr.saveWyrFavorites([ID1]), true);
  const old = copy(wyr.readWyrProgress());
  assert.equal(wyr.saveWyrFavorites([]), true);
  const removed = copy(wyr.readWyrProgress());
  assert.equal(removed.favorites[ID1].value, false);
  assert.ok(Date.parse(removed.favorites[ID1].updatedAt) > Date.parse(old.favorites[ID1].updatedAt));
  for (const merged of [wyr.mergeWyrProgress(old, removed), wyr.mergeWyrProgress(removed, old)]) {
    assert.equal(merged.favorites[ID1].value, false);
    assert.equal(wyr.writeWyrProgress(merged), true);
    assert.deepEqual(wyr.readWyrStored().favorites, []);
  }
  assert.equal(wyr.readWyrProgress().favorites[ID1].value, false);
});

test("newest A/B selection wins; merge is commutative and idempotent", () => {
  reset();
  const older = { favorites: {}, choices: { [ID1]: { value: "B", updatedAt: "2026-11-20T10:00:00.000Z" } } };
  const newer = { favorites: {}, choices: { [ID1]: { value: "A", updatedAt: "2026-11-21T10:00:00.000Z" } } };
  const a = wyr.mergeWyrProgress(older, newer);
  const b = wyr.mergeWyrProgress(newer, older, older);
  assert.deepEqual(a, b);
  assert.equal(a.choices[ID1].value, "A");
  assert.deepEqual(wyr.mergeWyrProgress(a, a), a);
  assert.equal(wyr.writeWyrProgress(a), true);
  assert.equal(wyr.readWyrStored().choices[ID1], "A");
});

test("simultaneous favorite add and removal favors the removal on both devices", () => {
  const timestamp = "2026-11-24T12:00:00.000Z";
  const added = { favorites: { [ID1]: { value: true, updatedAt: timestamp } }, choices: {} };
  const removed = { favorites: { [ID1]: { value: false, updatedAt: timestamp } }, choices: {} };
  assert.equal(wyr.mergeWyrProgress(added, removed).favorites[ID1].value, false);
  assert.equal(wyr.mergeWyrProgress(removed, added).favorites[ID1].value, false);
});

test("reselecting A/B in the same millisecond advances the revision clock", () => {
  reset();
  assert.equal(wyr.saveWyrChoices({ [ID1]: "A" }), true);
  const first = wyr.readWyrProgress().choices[ID1].updatedAt;
  assert.equal(wyr.saveWyrChoices({ [ID1]: "B" }), true);
  const second = wyr.readWyrProgress().choices[ID1].updatedAt;
  assert.equal(wyr.saveWyrChoices({ [ID1]: "A" }), true);
  const third = wyr.readWyrProgress().choices[ID1].updatedAt;
  assert.ok(first < second && second < third);
  assert.equal(wyr.readWyrStored().choices[ID1], "A");
  assert.ok(events.includes(wyr.WYR_SYNC_CHANGED));
});

test("an older legacy favorite cannot resurrect a removed favorite", () => {
  reset();
  localStorage.setItem(wyr.WYR_FAVORITES_KEY, JSON.stringify([ID1]));
  const older = wyr.readWyrProgress();
  const removed = { favorites: { [ID1]: { value: false, updatedAt: "2026-11-24T12:00:00.000Z" } }, choices: {} };
  const merged = wyr.mergeWyrProgress(older, removed);
  assert.equal(wyr.writeWyrProgress(merged), true);
  assert.deepEqual(wyr.readWyrStored().favorites, []);
  assert.equal(wyr.readWyrProgress().favorites[ID1].value, false);
});

test("single-question edits preserve unrelated synchronized choices and favorites", () => {
  reset();
  assert.equal(wyr.setWyrChoice(ID1, "A"), true);
  assert.equal(wyr.setWyrChoice(ID2, "B"), true);
  assert.equal(wyr.setWyrFavorite(ID1, true), true);
  assert.equal(wyr.setWyrFavorite(ID2, true), true);
  assert.equal(wyr.setWyrChoice(ID1, "B"), true);
  assert.equal(wyr.setWyrFavorite(ID1, false), true);
  assert.equal(wyr.readWyrStored().choices[ID2], "B");
  assert.deepEqual(wyr.readWyrStored().favorites, [ID2]);
  assert.equal(wyr.readWyrProgress().favorites[ID1].value, false);
});

test("invalid IDs, revisions and values are ignored", () => {
  reset();
  const invalid = wyr.validateWyrProgress({
    favorites: { bogus: { value: true, updatedAt: "2026-11-20" }, [ID1]: { value: "yes", updatedAt: "2026-11-20" } },
    choices: { [ID1]: { value: "C", updatedAt: "2026-11-20" }, [ID2]: { value: "B", updatedAt: "not-a-date" } }
  });
  assert.deepEqual(invalid, { favorites: {}, choices: {} });
});

test("Drive snapshot, legacy reader, merge, stale protection, apply and UI refresh are wired", () => {
  const sync = readFileSync("src/features/study/studyDriveSync.ts", "utf8");
  const panel = readFileSync("src/features/study/StudyGoogleDrivePanel.tsx", "utf8");
  const ui = readFileSync("src/features/would-you-rather/WouldYouRather.tsx", "utf8");
  for (const needle of [
    "wyrProgress: readWyrProgress()",
    "v.wyrProgress === undefined ? undefined : validateWyrProgress(v.wyrProgress)",
    "mergeWyrProgress(wyrProgress, remote.wyrProgress)",
    "wyrProgress: JSON.stringify(readWyrProgress())",
    "JSON.stringify(readWyrProgress()) === baseline.wyrProgress",
    "writeWyrProgress(merged.wyrProgress)"
  ]) assert.ok(sync.includes(needle), needle);
  assert.ok(panel.includes("JSON.stringify(local.wyrProgress) !== baseline.wyrProgress"));
  assert.ok(panel.includes("preview.merged.wyrProgress.choices"));
  assert.ok(ui.includes('window.addEventListener(WYR_SYNC_CHANGED, refresh)'));
  assert.ok(ui.includes('setChoices(current.choices)'));
  assert.ok(ui.includes('setFavorites(current.favorites)'));
  assert.ok(ui.includes('setWyrChoice(current.id, choice)'));
  assert.ok(ui.includes('setWyrFavorite(current.id, !favorites.includes(current.id))'));
});
