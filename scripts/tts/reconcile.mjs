
import { createHash } from "node:crypto";
import { readdir, readFile, stat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// BEJ 4.0 — Audio reconciliation. Read-only for source JSON and MP3s.
// node scripts/tts/reconcile.mjs
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const locale = "en-US";
const voices = ["cedar", "marin"];
const jsonPath = path.join(root, "public", `sample-hashmap-${locale}.json`);
const audioRoot = path.join(root, "public", "audio", locale);
const reportDir = path.join(root, "reports", "tts");
const shaPattern = /^[0-9a-f]{64}$/i;
const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");
const expectedUrl = (id, voice) => `/audio/${locale}/${voice}/${id}-${voice}.mp3`;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const filePattern = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(cedar|marin)\.mp3$/i;

const source = JSON.parse(await readFile(jsonPath, "utf8"));
if (!Array.isArray(source.mentalMap)) throw new Error("JSON inválido: mentalMap deve ser um array.");

const examples = new Map();
const issues = [];
const rows = [];
let intentions = 0;
let skipped = 0;

for (const intention of source.mentalMap) {
  intentions++;
  if (!Array.isArray(intention.examples)) continue;

  for (const example of intention.examples) {
    const id = example?.id;

    if (!uuidPattern.test(id ?? "") ||
        typeof example?.exampleItem !== "string" ||
        !example.exampleItem.trim()) {
      skipped++;
      issues.push({
        status: "INVALID_EXAMPLE",
        intentionId: intention.id ?? "",
        id: id ?? "",
        detail: "Exemplo sem UUID válido ou texto"
      });
      continue;
    }

    const key = id.toLowerCase();

    if (examples.has(key)) {
      issues.push({
        status: "DUPLICATE_UUID",
        intentionId: intention.id ?? "",
        id,
        detail: "UUID de exemplo repetido"
      });
      continue;
    }

    examples.set(key, {
      ...example,
      intentionId: intention.id ?? "",
      hash: sha256(example.exampleItem)
    });
  }
}

const physical = new Map();
const dirErrors = [];

for (const voice of voices) {
  const directory = path.join(audioRoot, voice);
  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    dirErrors.push(directory);
    entries = [];
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.toLowerCase().endsWith(".mp3")) continue;

    const fullPath = path.join(directory, entry.name);
    const info = await stat(fullPath);
    const match = filePattern.exec(entry.name);
    const id = match?.[1]?.toLowerCase() ?? null;
    const embeddedVoice = match?.[2]?.toLowerCase() ?? null;

    const item = {
      id,
      voice,
      embeddedVoice,
      filename: entry.name,
      path: fullPath,
      size: info.size
    };

    if (!match || embeddedVoice !== voice) {
      issues.push({
        status: "INVALID_FILENAME",
        id: id ?? "",
        voice,
        path: path.relative(root, fullPath),
        detail: "Nome de arquivo fora do padrão <UUID>-<voz>.mp3"
      });
      continue;
    }

    const key = `${id}:${voice}`;

    if (physical.has(key)) {
      issues.push({
        status: "DUPLICATE_FILE",
        id,
        voice,
        path: path.relative(root, fullPath),
        detail: "Mais de um MP3 para o mesmo UUID e voz"
      });
      continue;
    }

    physical.set(key, item);

    if (!examples.has(id)) {
      issues.push({
        status: "ORPHAN_MP3",
        id,
        voice,
        path: path.relative(root, fullPath),
        detail: "MP3 sem exemplo correspondente no JSON"
      });
    }
  }
}

for (const [id, example] of examples) {
  for (const voice of voices) {
    const file = physical.get(`${id}:${voice}`);
    const url = expectedUrl(id, voice);
    const currentUrl = example.mp3?.[voice];
    const currentHash = example.hashmp3?.[voice];
    const hasUrl = typeof currentUrl === "string" && currentUrl.length > 0;
    const hasHash = typeof currentHash === "string" && currentHash.length > 0;

    let status;

    if (file?.size === 0) status = "EMPTY_MP3";
    else if (!file && (hasUrl || hasHash)) status = "MISSING_MP3";
    else if (!file) status = "PENDING";
    else if (!hasUrl && !hasHash) status = "UNREGISTERED_MP3";
    else if (currentUrl !== url) status = "PATH_MISMATCH";
    else if (!hasHash) status = "MISSING_HASH";
    else if (!shaPattern.test(currentHash) ||
             currentHash.toLowerCase() !== example.hash) status = "HASH_MISMATCH";
    else status = "OK";

    const row = {
      status,
      intentionId: example.intentionId,
      id: example.id,
      voice,
      text: example.exampleItem,
      expectedPath: url,
      jsonPath: currentUrl ?? "",
      jsonHash: currentHash ?? "",
      expectedHash: example.hash,
      fileExists: Boolean(file),
      fileBytes: file?.size ?? 0
    };

    rows.push(row);

    if (status !== "OK" && status !== "PENDING") {
      issues.push(row);
    }
  }
}

const counts = Object.fromEntries(
  [...new Set(rows.map((row) => row.status))]
    .sort()
    .map((status) => [
      status,
      rows.filter((row) => row.status === status).length
    ])
);

const issueCounts = Object.fromEntries(
  [...new Set(issues.map((row) => row.status))]
    .sort()
    .map((status) => [
      status,
      issues.filter((row) => row.status === status).length
    ])
);

const report = {
  generatedAt: new Date().toISOString(),
  locale,
  voices,
  inputJson: path.relative(root, jsonPath),
  totals: {
    intentions,
    examples: examples.size,
    skippedExamples: skipped,
    physicalMp3: physical.size,
    expectedVoiceSlots: examples.size * voices.length,
    ...counts
  },
  issueCounts,
  missingDirectories: dirErrors.map((dir) => path.relative(root, dir)),
  issues,
  records: rows
};

const csvColumns = [
  "status", "intentionId", "id", "voice", "text",
  "expectedPath", "jsonPath", "jsonHash",
  "expectedHash", "fileExists", "fileBytes"
];

const csvEscape = (value) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;

const csv = [
  csvColumns.join(","),
  ...rows.map((row) =>
    csvColumns.map((column) => csvEscape(row[column])).join(",")
  )
].join("\r\n") + "\r\n";

await mkdir(reportDir, { recursive: true });

const outputJson = path.join(reportDir, `reconcile-${locale}.json`);
const outputCsv = path.join(reportDir, `reconcile-${locale}.csv`);

await writeFile(
  outputJson,
  JSON.stringify(report, null, 2) + "\n",
  "utf8"
);

await writeFile(outputCsv, "\uFEFF" + csv, "utf8");

console.log(`BEJ TTS — Conciliação ${locale}`);
console.log(
  `Exemplos: ${examples.size} | ` +
  `MP3 físicos válidos: ${physical.size} | ` +
  `Slots esperados: ${examples.size * voices.length}`
);

for (const [status, count] of Object.entries(counts)) {
  console.log(`${status}: ${count}`);
}

for (const [status, count] of Object.entries(issueCounts)) {
  if (!(status in counts)) console.log(`${status}: ${count}`);
}

console.log(
  `Relatórios: ${path.relative(root, outputJson)} | ` +
  `${path.relative(root, outputCsv)}`
);

if (issues.length || dirErrors.length) process.exitCode = 1;
