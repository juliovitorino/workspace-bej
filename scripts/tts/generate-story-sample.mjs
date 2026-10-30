import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// One-paragraph pilot. Usage:
//   node scripts/tts/generate-story-sample.mjs --dry-run
//   OPENAI_API_KEY=... node scripts/tts/generate-story-sample.mjs
// Only Cedar/en-US, one UUID, one MP3. No other story paragraphs are modified.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const jsonPath = path.join(root, "src/data/stories/stories-a1.json");
const storyId = "a1-daily-life-537eaab2-c43e-4157-bfb9-f3eff1702a3f";
const paragraphId = "5aa0ac9c-9d3e-417b-8c8e-5935f0b1f252";
const voice = "cedar";
const url = `/audio/stories/en-US/${voice}/${paragraphId}.mp3`;
const destination = path.join(root, "public", url.slice(1));
const dryRun = process.argv.includes("--dry-run");
if (process.argv.some(arg => arg.startsWith("--") && arg !== "--dry-run")) {
  throw new Error("Use somente --dry-run, ou nenhum argumento.");
}
const source = await readFile(jsonPath, "utf8");
const data = JSON.parse(source);
const story = data.stories?.find(item => item.id === storyId);
const paragraph = story?.paragraphs?.find(item => item.id === paragraphId);
if (!paragraph || typeof paragraph.en !== "string" || !paragraph.en.trim()) {
  throw new Error("História, UUID ou texto do parágrafo não encontrado.");
}
const text = paragraph.en;
const hash = createHash("sha256").update(text, "utf8").digest("hex");
const currentUrl = paragraph.mp3?.["en-US"]?.[voice];
const currentHash = paragraph.hashmp3?.["en-US"]?.[voice];
if (currentUrl && currentUrl !== url || currentHash && currentHash !== hash) {
  throw new Error("Metadados existentes divergentes. Revisão manual necessária.");
}
const exists = async filename => {
  try { return (await stat(filename)).isFile(); }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
};
console.log(JSON.stringify({ storyId, paragraphId, voice, text, url, dryRun }, null, 2));
if (dryRun) process.exit(0);
if (await exists(destination)) {
  throw new Error(`Arquivo já existe; nenhuma sobrescrita permitida: ${destination}`);
}
if (!process.env.OPENAI_API_KEY) throw new Error("Configure OPENAI_API_KEY no ambiente antes de executar.");
const response = await fetch("https://api.openai.com/v1/audio/speech", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "gpt-4o-mini-tts",
    voice,
    input: text,
    response_format: "mp3",
    instructions: [
      "Speak naturally in conversational American English with smooth connected speech.",
      "Use a friendly, authentic storytelling rhythm appropriate for A1 learners.",
      "Do not add, omit, repeat, or change any words."
    ].join(" ")
  })
});
if (!response.ok) {
  const detail = (await response.text()).slice(0, 300);
  throw new Error(`TTS API: HTTP ${response.status}: ${detail}`);
}
const bytes = Buffer.from(await response.arrayBuffer());
if (bytes.length < 128 || bytes.toString("latin1", 0, 3) !== "ID3" && (bytes[0] !== 0xff || (bytes[1] & 0xe0) !== 0xe0)) {
  throw new Error("A API não retornou um MP3 válido.");
}
await mkdir(path.dirname(destination), { recursive: true });
const temporary = `${destination}.${randomUUID()}.tmp`;
try {
  await writeFile(temporary, bytes, { flag: "wx" });
  await rename(temporary, destination);
} finally {
  await rm(temporary, { force: true });
}
paragraph.mp3 = {
  ...paragraph.mp3,
  "en-US": { ...paragraph.mp3?.["en-US"], [voice]: url }
};
paragraph.hashmp3 = {
  ...paragraph.hashmp3,
  "en-US": { ...paragraph.hashmp3?.["en-US"], [voice]: hash }
};
const jsonTemp = `${jsonPath}.${randomUUID()}.tmp`;
try {
  await writeFile(jsonTemp, JSON.stringify(data, null, 2) + "\n", { flag: "wx" });
  await rename(jsonTemp, jsonPath);
} finally {
  await rm(jsonTemp, { force: true });
}
console.log(`Gerado: ${destination} (${bytes.length} bytes). JSON atualizado para Cedar.`);
