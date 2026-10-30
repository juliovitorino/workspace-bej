import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Generate both Cedar and Marin MP3s for "A Different Saturday".
// node scripts/tts/generate-story-remaining.mjs --dry-run
// node scripts/tts/generate-story-remaining.mjs
// The previously approved first Cedar MP3 is never modified.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const jsonPath = path.join(root, "src/data/stories/stories-a1.json");
const storyId = "a1-daily-life-537eaab2-c43e-4157-bfb9-f3eff1702a3f";
const approvedParagraphId = "5aa0ac9c-9d3e-417b-8c8e-5935f0b1f252";
const voices = ["cedar", "marin"];
const locale = "en-US";
const dryRun = process.argv.includes("--dry-run");

if (process.argv.some(arg => arg.startsWith("--") && arg !== "--dry-run")) {
  throw new Error("Argumento inválido. Use --dry-run ou nenhum argumento.");
}

const source = await readFile(jsonPath, "utf8");
const data = JSON.parse(source);
const story = data.stories?.find(item => item.id === storyId);
if (!story || !Array.isArray(story.paragraphs) || story.paragraphs.length !== 8) {
  throw new Error("História não encontrada ou número de parágrafos diferente de 8. Interrompido.");
}
if (story.paragraphs[0]?.id !== approvedParagraphId) {
  throw new Error("O primeiro parágrafo aprovado mudou. Interrompido.");
}
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const ids = new Set();
const paragraphs = story.paragraphs;
for (const paragraph of story.paragraphs) {
  if (!UUID.test(paragraph?.id ?? "") || typeof paragraph.en !== "string" || !paragraph.en.trim()) {
    throw new Error("Parágrafo com UUID inválido ou sem texto em inglês.");
  }
  if (ids.has(paragraph.id)) throw new Error(`UUID duplicado: ${paragraph.id}`);
  ids.add(paragraph.id);
}

function target(paragraph, voice) {
  const url = `/audio/stories/${locale}/${voice}/${paragraph.id}.mp3`;
  return { url, file: path.join(root, "public", url.slice(1)) };
}
function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
async function fileInfo(file) {
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error(`Não é um arquivo: ${file}`);
    return info;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
async function atomicWrite(file, bytes) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, bytes, { flag: "wx" });
    await rename(temp, file);
  } finally {
    await rm(temp, { force: true });
  }
}
function isMp3(bytes) {
  return bytes.length > 128 && (
    bytes.toString("latin1", 0, 3) === "ID3" ||
    (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
  );
}

const tasks = [];
for (const [index, paragraph] of paragraphs.entries()) {
  for (const voice of voices) {
  const { url, file } = target(paragraph, voice);
  const hash = sha256(paragraph.en);
  const registeredUrl = paragraph.mp3?.[locale]?.[voice];
  const registeredHash = paragraph.hashmp3?.[locale]?.[voice];
  const existing = await fileInfo(file);

  // Never silently replace a registered MP3 or a file with unknown provenance.
  if (registeredUrl && registeredUrl !== url || registeredHash && registeredHash !== hash) {
    throw new Error(`Parágrafo ${index + 1}: URL ou hash divergente. Revisão manual necessária.`);
  }
  if (existing && existing.size === 0) {
    throw new Error(`Parágrafo ${index + 2}: MP3 vazio em ${file}.`);
  }
  if (existing && (!registeredUrl || !registeredHash)) {
    throw new Error(`Parágrafo ${index + 2}: MP3 existente sem metadados completos. Não sobrescrever: ${file}`);
  }
  if (!existing && (registeredUrl || registeredHash)) {
    throw new Error(`Parágrafo ${index + 2}: JSON aponta para MP3 ausente: ${file}`);
  }
  tasks.push({ index: index + 1, paragraph, voice, url, file, hash, done: Boolean(existing) });
  }
}

console.log(`BEJ — A Different Saturday | en-US / Cedar + Marin | 8 parágrafos | dry-run=${dryRun}`);
for (const task of tasks) {
  console.log(`${task.index}/8 ${task.voice} [${task.done ? "PRONTO" : "PENDENTE"}] ${task.paragraph.id} | ${task.paragraph.en}`);
}
const pending = tasks.filter(task => !task.done);
console.log(`Resumo: ${tasks.length - pending.length} já registrado(s), ${pending.length} pendente(s) de ${tasks.length}. Cedar aprovado não será sobrescrito.`);
if (dryRun || !pending.length) process.exit(0);
if (!process.env.OPENAI_API_KEY) throw new Error("Configure OPENAI_API_KEY no ambiente.");

let completed = 0;
for (const task of pending) {
  console.log(`Gerando parágrafo ${task.index}/8 — ${task.voice}: ${task.paragraph.id}`);
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice: task.voice,
      input: task.paragraph.en,
      response_format: "mp3",
      instructions: [
        "Speak naturally in conversational American English with smooth connected speech.",
        "Use a friendly, authentic storytelling rhythm appropriate for A1 learners.",
        "Do not add, omit, repeat, or change any words."
      ].join(" ")
    })
  });
  if (!response.ok) {
    throw new Error(`Parágrafo ${task.index}: API HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!isMp3(bytes)) throw new Error(`Parágrafo ${task.index}: resposta não é um MP3 válido.`);
  // The JSON is updated after each successful file, so interrupted runs can resume.
  await atomicWrite(task.file, bytes);
  task.paragraph.mp3 = {
    ...task.paragraph.mp3,
    [locale]: { ...task.paragraph.mp3?.[locale], [task.voice]: task.url }
  };
  task.paragraph.hashmp3 = {
    ...task.paragraph.hashmp3,
    [locale]: { ...task.paragraph.hashmp3?.[locale], [task.voice]: task.hash }
  };
  await atomicWrite(jsonPath, JSON.stringify(data, null, 2) + "\n");
  completed++;
  console.log(`OK ${task.index}/8 ${task.voice} — ${task.url} (${bytes.length} bytes)`);
}
console.log(`Concluído: ${completed} novos MP3s Cedar/Marin. Áudios anteriores e demais histórias preservados.`);
