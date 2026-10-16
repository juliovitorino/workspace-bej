import { isStudentLanguage, type StudentLanguage } from "../../config/languages";

export interface PersonalFlashcard {
  id: string;
  sourceLanguage: StudentLanguage;
  targetLanguage: StudentLanguage;
  front: string;
  back: string;
  context: string;
  image?: Blob;
  createdAt: string;
  updatedAt: string;
}

export type PersonalFlashcardInput = Pick<PersonalFlashcard, "sourceLanguage" | "targetLanguage" | "front" | "back" | "context" | "image">;

const DB_NAME = "bej-personal-flashcards-v1";
const STORE_NAME = "cards";
const DB_VERSION = 1;
export const PERSONAL_CARDS_CHANGED = "bej:personal-flashcards-changed";
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMPORT_CARDS = 1000;

/**
 * randomUUID() requires a secure context (HTTPS or localhost) in many browsers.
 * getRandomValues() remains available on ordinary HTTP LAN addresses.
 * Generate IDs without coupling local flashcard storage to HTTPS.
 */
function newCardId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  // Last resort for browsers with neither API; IDs remain scoped to this device.
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) { reject(new Error("IndexedDB unavailable")); return; }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onblocked = () => reject(new Error("IndexedDB blocked"));
  });
}

async function operation<T>(mode: IDBTransactionMode, perform: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    let result: T;
    const tx = db.transaction(STORE_NAME, mode);
    const request = perform(tx.objectStore(STORE_NAME));
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error("IndexedDB transaction failed")); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error("IndexedDB transaction aborted")); };
  });
}

function notify(): void { window.dispatchEvent(new Event(PERSONAL_CARDS_CHANGED)); }

function validate(input: PersonalFlashcardInput): void {
  if (!isStudentLanguage(input.sourceLanguage) || !isStudentLanguage(input.targetLanguage) ||
      input.sourceLanguage === input.targetLanguage || !input.front.trim() || !input.back.trim() ||
      input.front.length > 500 || input.back.length > 500 || input.context.length > 1500) {
    throw new Error("Invalid flashcard");
  }
  if (input.image && (input.image.size > MAX_IMAGE_BYTES || !ALLOWED_IMAGE_TYPES.includes(input.image.type))) {
    throw new Error("Invalid image");
  }
}

export async function listPersonalFlashcards(): Promise<PersonalFlashcard[]> {
  const cards = await operation<PersonalFlashcard[]>("readonly", store => store.getAll());
  return cards.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function countPersonalFlashcards(): Promise<number> {
  return operation<number>("readonly", store => store.count());
}

export async function savePersonalFlashcard(input: PersonalFlashcardInput, original?: PersonalFlashcard): Promise<void> {
  validate(input);
  const now = new Date().toISOString();
  const card: PersonalFlashcard = {
    ...input, front: input.front.trim(), back: input.back.trim(), context: input.context.trim(),
    id: original?.id ?? newCardId(), createdAt: original?.createdAt ?? now, updatedAt: now
  };
  await operation<IDBValidKey>("readwrite", store => store.put(card));
  notify();
}

export async function deletePersonalFlashcard(id: string): Promise<void> {
  await operation<undefined>("readwrite", store => store.delete(id));
  notify();
}

interface BackupCard extends Omit<PersonalFlashcard, "image"> { imageDataUrl?: string; }
interface Backup { format: "bej-personal-flashcards"; version: 1; cards: BackupCard[]; }

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(value: string): Promise<Blob> {
  if (!/^data:image\/(png|jpeg|webp);base64,/i.test(value)) throw new Error("Invalid backup image");
  const blob = await (await fetch(value)).blob();
  if (!ALLOWED_IMAGE_TYPES.includes(blob.type) || blob.size > MAX_IMAGE_BYTES) throw new Error("Invalid backup image");
  return blob;
}

export async function exportPersonalFlashcards(): Promise<void> {
  const cards = await listPersonalFlashcards();
  const backup: Backup = {
    format: "bej-personal-flashcards", version: 1,
    cards: await Promise.all(cards.map(async ({ image, ...card }) =>
      ({ ...card, ...(image ? { imageDataUrl: await blobToDataUrl(image) } : {}) })))
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "bej-meus-flashcards.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function importPersonalFlashcards(file: File): Promise<number> {
  // Validate the whole file before writing anything.
  if (file.size > 60 * 1024 * 1024) throw new Error("Backup too large");
  const parsed: unknown = JSON.parse(await file.text());
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid backup");
  const backup = parsed as Partial<Backup>;
  if (backup.format !== "bej-personal-flashcards" || backup.version !== 1 ||
      !Array.isArray(backup.cards) || backup.cards.length > MAX_IMPORT_CARDS) throw new Error("Invalid backup");
  const now = new Date().toISOString();
  const imported: PersonalFlashcard[] = [];
  for (const entry of backup.cards) {
    if (!entry || typeof entry !== "object" || typeof entry.front !== "string" ||
        typeof entry.back !== "string" || typeof entry.context !== "string" ||
        !isStudentLanguage(entry.sourceLanguage) || !isStudentLanguage(entry.targetLanguage) ||
        (entry.imageDataUrl !== undefined && typeof entry.imageDataUrl !== "string")) {
      throw new Error("Invalid backup card");
    }
    const image = entry.imageDataUrl ? await dataUrlToBlob(entry.imageDataUrl) : undefined;
    const input: PersonalFlashcardInput = {
      sourceLanguage: entry.sourceLanguage, targetLanguage: entry.targetLanguage,
      front: entry.front, back: entry.back, context: entry.context, image
    };
    validate(input);
    imported.push({ ...input, id: newCardId(), createdAt: now, updatedAt: now });
  }
  if (!imported.length) return 0;
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    imported.forEach(card => store.put(card));
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error("Import failed")); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error("Import aborted")); };
  });
  notify();
  return imported.length;
}
