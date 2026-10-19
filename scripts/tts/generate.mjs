
import { createHash, randomUUID } from "node:crypto";
import { access, copyFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// BEJ 4.0 — Execute: node scripts/tts/generate.mjs [--dry-run] [--recover]
// Requires: npm install --save-dev openai; OPENAI_API_KEY for real generation.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const locale = "en-US";
const jsonPath = path.join(root, "public", `sample-hashmap-${locale}.json`);
const audioRoot = path.join(root, "public", "audio", locale);
const voices = ["cedar", "marin"]; // cedar = default player voice
const MAX_EXAMPLES = 600;
const WRITE_RETRIES = 8;
const RETRY_DELAY_MS = 250;
const dryRun = process.argv.includes("--dry-run");
const recover = process.argv.includes("--recover");

// Recovery is limited to the single audio confirmed by the earlier generation log.
const confirmedRecovery = {
  id: "859598d3-eb12-4ad7-9436-d9843fec1fe4",
  voice: "marin",
  text: "I need him to finish this today."
};

const model = "gpt-4o-mini-tts";
const instructions = [
  "Speak naturally in casual American English, like talking to a close friend.",
  "Use connected speech, smooth linking, natural reductions and conversational rhythm.",
  "Sound spontaneous, not like a teacher or narrator.",
  "Do not add, omit or change any words."
].join(" ");

if (process.argv.some((arg) => arg.startsWith("--") && arg !== "--dry-run" && arg !== "--recover")) {
  throw new Error("Argumento desconhecido. Use --dry-run, --recover, ambos ou nenhum argumento.");
}

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

async function isNonemptyFile(file) {
  try {
    return (await stat(file)).isFile() && (await stat(file)).size > 0;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function exists(file) {
  try { await access(file); return true; }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
}

// Writes to a temp file in the same directory, then renames it into place.
async function atomicWrite(file, bytes) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, bytes, { flag: "wx" });
    for (let attempt = 0; ; attempt++) {
      try {
        await rename(temp, file);
        break;
      } catch (error) {
        if (!["EPERM", "EACCES", "EBUSY"].includes(error.code) || attempt >= WRITE_RETRIES) throw error;
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  } finally {
    await rm(temp, { force: true });
  }
}

const original = await readFile(jsonPath, "utf8");
const data = JSON.parse(original);
if (!Array.isArray(data.mentalMap)) throw new Error("JSON inválido: mentalMap não é array.");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const seen = new Map();
const examples = [];

for (const intention of data.mentalMap) {
  if (!Array.isArray(intention.examples)) continue;
  for (const example of intention.examples) {
    if (!UUID.test(example?.id ?? "") || typeof example.exampleItem !== "string" || !example.exampleItem.trim()) continue;
    if (seen.has(example.id)) {
      if (seen.get(example.id) !== example.exampleItem) {
        throw new Error(`UUID repetido com textos diferentes: ${example.id}`);
      }
      throw new Error(`UUID duplicado: ${example.id}. Corrija o JSON antes de continuar.`);
    }
    seen.set(example.id, example.exampleItem);
    examples.push({
      example,
      intentionId: intention.id,
      text: example.exampleItem,
      hash: sha256(example.exampleItem)
    });
  }
}

function expectedPath(id, voice) {
  return `/audio/${locale}/${voice}/${id}-${voice}.mp3`;
}

// Explicit, narrowly scoped recovery. Never synthesizes or changes an MP3.
if (recover) {
  const item = examples.find((entry) => entry.example.id === confirmedRecovery.id);
  if (!item || item.text !== confirmedRecovery.text) {
    throw new Error("Recuperação recusada: UUID ou frase não corresponde ao incidente confirmado.");
  }

  const voice = confirmedRecovery.voice;
  const url = expectedPath(item.example.id, voice);
  const file = path.join(audioRoot, voice, `${item.example.id}-${voice}.mp3`);

  if (!(await isNonemptyFile(file))) {
    throw new Error(`Recuperação recusada: MP3 ausente ou vazio: ${file}`);
  }

  const currentUrl = item.example.mp3?.[voice];
  const currentHash = item.example.hashmp3?.[voice];

  if ((currentUrl && currentUrl !== url) || (currentHash && currentHash !== item.hash)) {
    throw new Error("Recuperação recusada: metadados existentes divergem; revisão manual necessária.");
  }

  if (currentUrl === url && currentHash === item.hash) {
    console.log("Áudio já registrado corretamente. Nenhuma alteração necessária.");
    process.exit(0);
  }

  console.log(`RECOVER ${item.text} | ${url} | dry-run=${dryRun}`);

  if (dryRun) {
    console.log("Simulação de recuperação: JSON não alterado; nenhuma chamada paga.");
    process.exit(0);
  }

  const backup = `${jsonPath}.recover-${Date.now()}.bak`;
  await copyFile(jsonPath, backup);
  console.log(`Backup de recuperação: ${path.relative(root, backup)}`);

  item.example.mp3 = { ...(item.example.mp3 ?? {}), [voice]: url };
  item.example.hashmp3 = { ...(item.example.hashmp3 ?? {}), [voice]: item.hash };

  await atomicWrite(jsonPath, JSON.stringify(data, null, 2) + "\n");

  console.log("Recuperação concluída: metadados registrados; MP3 preservado; nenhuma chamada paga.");
  process.exit(0);
}

const pending = [];

for (const item of examples) {
  const tasks = [];

  for (const voice of voices) {
    const url = expectedPath(item.example.id, voice);
    const file = path.join(audioRoot, voice, `${item.example.id}-${voice}.mp3`);
    const present = await isNonemptyFile(file);
    const metadataMatches =
      item.example.mp3?.[voice] === url &&
      item.example.hashmp3?.[voice] === item.hash;

    if (!present || !metadataMatches) {
      const recoverable =
        present &&
        !item.example.mp3?.[voice] &&
        !item.example.hashmp3?.[voice];

      tasks.push({
        voice,
        url,
        file,
        recoverable,
        reason: !present
          ? "arquivo ausente"
          : recoverable
            ? "MP3 existente sem metadados (revisão necessária)"
            : "hash/caminho ausente ou divergente"
      });
    }
  }

  if (tasks.length) pending.push({ ...item, tasks });
  if (pending.length >= MAX_EXAMPLES) break;
}

console.log(`BEJ TTS | ${locale} | até ${MAX_EXAMPLES} exemplos | dry-run=${dryRun}`);

for (const [index, item] of pending.entries()) {
  console.log(`${index + 1}. ${item.example.id} | ${item.text}`);
  for (const task of item.tasks) {
    console.log(`   ${task.voice}: ${task.reason} -> ${task.url}`);
  }
}

if (!pending.length) {
  console.log("Nenhum exemplo pendente.");
  process.exit(0);
}

if (dryRun) {
  console.log("Simulação concluída: nenhum MP3 ou JSON foi alterado; nenhuma chamada paga.");
  process.exit(0);
}

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY não configurada.");
}

// Single backup before first change. Never overwrite an earlier backup.
const backupPath = `${jsonPath}.tts-backup.json`;

if (!(await exists(backupPath))) {
  await copyFile(jsonPath, backupPath);
  console.log(`Backup: ${path.relative(root, backupPath)}`);
}

const { default: OpenAI } = await import("openai");
const client = new OpenAI();

let generated = 0;
let metadataUpdates = 0;

for (const item of pending) {
  for (const task of item.tasks) {
    console.log(`Gerando ${task.voice}: ${item.text}`);

    try {
      if (task.recoverable) {
        console.error(
          `MP3 existente sem metadados: ${task.file}. Não é possível verificar o texto de origem. Revise antes de regenerar.`
        );
        continue;
      }

      const response = await client.audio.speech.create({
        model,
        voice: task.voice,
        input: item.text,
        instructions,
        response_format: "mp3"
      });

      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length) throw new Error("API retornou MP3 vazio.");

      await atomicWrite(task.file, bytes);
      generated++;

      // Register each successful voice immediately so an interrupted run can resume.
      item.example.mp3 = {
        ...(item.example.mp3 ?? {}),
        [task.voice]: task.url
      };

      item.example.hashmp3 = {
        ...(item.example.hashmp3 ?? {}),
        [task.voice]: item.hash
      };

      await atomicWrite(jsonPath, JSON.stringify(data, null, 2) + "\n");
      metadataUpdates++;

      console.log(`OK: ${task.url} | sha256=${item.hash}`);
    } catch (error) {
      console.error(`Falha em ${item.example.id}/${task.voice}: ${error.message}`);
      console.error("Processamento interrompido. MP3s anteriores e registros concluídos foram preservados.");
      process.exitCode = 1;
      console.log(`Resumo: ${generated} MP3(s), ${metadataUpdates} atualização(ões) no JSON.`);
      process.exit();
    }
  }
}

console.log(`Concluído: ${generated} MP3(s), ${metadataUpdates} atualização(ões) no JSON.`);
