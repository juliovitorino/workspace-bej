import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

// Compile the same TypeScript module used by the React page, without a test runner.
const source = await readFile(new URL("../src/features/donation/donationQr.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { createPixPayload, createBitcoinUri, pickNextBitcoinAddress } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

const key = "f06c084e-a719-4abc-8376-310ccf8cc6cd";
const payload = createPixPayload(key, "JOAO DA SILVA", "SAO PAULO");
assert.ok(payload, "Pix BR Code must be generated with complete merchant details");
assert.ok(payload.startsWith("00020126"), "Pix EMV header");
assert.ok(payload.includes("0014br.gov.bcb.pix"), "Pix GUI");
assert.ok(payload.includes("53039865802BR"), "BRL and country code");
assert.ok(payload.includes("62070503***"), "Open-amount static QR transaction ID");
assert.match(payload, /6304[0-9A-F]{4}$/, "CRC16 trailer");

function crc16(bytes) {
  let crc = 0xffff;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
assert.equal(payload.slice(-4), crc16(Buffer.from(payload.slice(0, -4))), "CRC16-CCITT must match");
assert.equal(createPixPayload(key, "J*** S****", "SAO PAULO"), null, "Masked merchant name must be rejected");
assert.equal(createPixPayload(key, "JOAO DA SILVA", ""), null, "Missing merchant city must be rejected");
assert.equal(createPixPayload("", "JOAO DA SILVA", "SAO PAULO"), null, "Missing key must be rejected");
assert.equal(createBitcoinUri("3JauYEHdJfTgJ2ogX75ueZ6C1waktjFrvw"), "bitcoin:3JauYEHdJfTgJ2ogX75ueZ6C1waktjFrvw");
assert.equal(createBitcoinUri("not-a-bitcoin-address"), null);
// Rotating Bitcoin addresses must not repeat the current one when alternatives exist.
const btcA = "3JauYEHdJfTgJ2ogX75ueZ6C1waktjFrvw";
const btcB = "1BoatSLRHtKNngkdXEeobR76b53LETtpyT";
const btcC = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa";
assert.equal(pickNextBitcoinAddress([], btcA, () => 0), null);
assert.equal(pickNextBitcoinAddress([btcA], btcA, () => 0), btcA);
assert.equal(pickNextBitcoinAddress([btcA, btcB], btcA, () => 0), btcB);
assert.equal(pickNextBitcoinAddress([btcA, btcB, btcC], btcA, () => 0), btcB);
assert.equal(pickNextBitcoinAddress([btcA, btcB, btcC], btcA, () => 0.999), btcC);
assert.equal(pickNextBitcoinAddress([btcA, btcA, btcB], btcA, () => 0), btcB);
assert.equal(createBitcoinUri(btcB), `bitcoin:${btcB}`);

// Legacy string configurations remain supported and duplicate/empty entries are ignored.
const configSource = await readFile(new URL("../src/features/donation/donationConfig.ts", import.meta.url), "utf8");
const configJs = ts.transpileModule(configSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { parseDonationConfig } = await import("data:text/javascript;base64," + Buffer.from(configJs).toString("base64"));
assert.deepEqual(parseDonationConfig({ donation: { bitcoin: { enabled: true, address: btcA } } }).bitcoin.address, [btcA]);
assert.deepEqual(
  parseDonationConfig({ donation: { bitcoin: { enabled: true, address: [btcA, " ", btcB, btcA, null] } } }).bitcoin.address,
  [btcA, btcB],
);
assert.deepEqual(parseDonationConfig({ donation: { bitcoin: { address: [] } } }).bitcoin.address, []);
assert.deepEqual(parseDonationConfig({ donation: { bitcoin: { address: null } } }).bitcoin.address, []);

console.log("BEJ donation Pix, Bitcoin rotation and configuration tests passed.");
