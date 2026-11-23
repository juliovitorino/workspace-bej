import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const sync = fs.readFileSync('src/features/study/studyDriveSync.ts', 'utf8');
const module = fs.readFileSync('src/features/study/smallTalkDriveSync.ts', 'utf8');
const panel = fs.readFileSync('src/features/study/StudyGoogleDrivePanel.tsx', 'utf8');
test('Small Talk is included in Drive export, import, merge, baseline and apply', () => {
  for (const expression of [
    'smallTalk: readSmallTalkSync()', 'validateSmallTalkSync(v.smallTalk)',
    'mergeSmallTalkSync(smallTalk, remote.smallTalk)',
    'smallTalk: JSON.stringify(readSmallTalkSync())',
    'writeSmallTalkSync(merged.smallTalk)'
  ]) assert.ok(sync.includes(expression), expression);
});
test('Legacy Drive files without Small Talk remain supported', () => {
  assert.ok(sync.includes('v.smallTalk === undefined ? undefined'));
  assert.ok(sync.includes('if (remote.smallTalk)'));
});
test('Merge uses timestamps and preserves personal answer revisions', () => {
  assert.ok(module.includes('Date.parse(record.updatedAt) > Date.parse(merged[id].updatedAt)'));
  assert.ok(module.includes('mergeCustomItems('));
  assert.ok(module.includes('planSmallTalkPersonalImport('));
  assert.ok(module.includes('validateSmallTalkSync('));
});
test('Preview and confirmation guard against concurrent Small Talk edits', () => {
  assert.ok(panel.includes('JSON.stringify(local.smallTalk) !== baseline.smallTalk'));
  assert.ok(sync.includes('JSON.stringify(readSmallTalkSync()) === baseline.smallTalk'));
});

test('Drive synchronizes per-topic card order, including legacy snapshots', () => {
  const order = fs.readFileSync('src/features/small-talk/smallTalkCardOrderStorage.ts', 'utf8');
  assert.ok(module.includes('cardOrders: readCardOrders(storage)'));
  assert.ok(module.includes('cardOrders: validateCardOrders(value.cardOrders)'));
  assert.ok(module.includes('mergeCardOrders(a.cardOrders ?? {}, b.cardOrders ?? {})'));
  assert.ok(module.includes('[SMALL_TALK_CARD_ORDER_KEY, valid.cardOrders ?? {}]'));
  assert.ok(module.includes('window.dispatchEvent(new StorageEvent("storage", { key }))'));
  assert.ok(order.includes('const legacy = Array.isArray(raw)'));
  assert.ok(order.includes('JSON.stringify(record.ids) > JSON.stringify(previous.ids)'));
});
