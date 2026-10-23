import { FAVORITE_CHUNKS_KEY, parseFavoriteChunks, readFavoriteChunks, type FavoriteChunk } from "../../utils/favoriteChunks";
import { backupOf, mergeStudyData, parseStudyBackup, readStudyStore, updateStudyStore, STUDY_CHANGED, type StudyBackup, type StudyData } from "./studyStorage";
import { studyTracker } from "./studyTrackingService";

const DEVICE_KEY = "bej-sync-device-v1";
const FOLDER_KEY = "bej-sync-folder-v1";
const API = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const SCOPE = "https://www.googleapis.com/auth/drive.file";
export type SyncFile = { schemaVersion: 1; kind: "bej-study-sync"; deviceId: string; exportedAt: string; study: StudyBackup; favorites: FavoriteChunk[] };
export type DriveFile = { id: string; name: string };
export function deviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(DEVICE_KEY, id); }
  return id;
}
export function folderId(): string { return localStorage.getItem(FOLDER_KEY) ?? ""; }
export function saveFolder(input: string): string {
  const value = input.trim();
  const match = value.match(/(?:drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/)([A-Za-z0-9_-]+)/);
  const id = match?.[1] ?? (/^[A-Za-z0-9_-]{15,}$/.test(value) ? value : "");
  if (!id) throw new Error("Invalid Google Drive folder link or ID.");
  localStorage.setItem(FOLDER_KEY, id);
  return id;
}
type TokenResponse = { access_token?: string; error?: string };
type TokenClient = { requestAccessToken: (options?: { prompt?: string }) => void };
type GoogleIdentity = { accounts: { oauth2: { initTokenClient: (options: { client_id: string; scope: string; callback: (response: TokenResponse) => void }) => TokenClient } } };
declare global { interface Window { google?: GoogleIdentity } }
let scriptPromise: Promise<void> | undefined;
async function loadGoogle(): Promise<void> {
  if (window.google) return;
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client"; script.async = true;
    script.onload = () => window.google ? resolve() : reject(new Error("Google Identity Services unavailable."));
    script.onerror = () => reject(new Error("Could not load Google sign-in."));
    document.head.appendChild(script);
  });
  return scriptPromise;
}
/** Called only by a user click; OAuth token stays in memory, never localStorage. */
export async function authorizeDrive(): Promise<string> {
  if (!GOOGLE_CLIENT_ID) throw new Error("Configure VITE_GOOGLE_CLIENT_ID before using Drive Sync.");
  await loadGoogle();
  return new Promise((resolve, reject) => {
    window.google!.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID!, scope: SCOPE,
      callback: response => response.access_token ? resolve(response.access_token) : reject(new Error(response.error || "Google authorization cancelled."))
    }).requestAccessToken({ prompt: "consent" });
  });
}
async function request(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers } });
  if (!response.ok) throw new Error(`Google Drive HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return response;
}
export async function listSyncFiles(token: string, folder: string): Promise<DriveFile[]> {
  const result: DriveFile[] = []; let pageToken = "";
  do {
    const params = new URLSearchParams({ q: `'${folder}' in parents and trashed = false and mimeType = 'application/json'`, fields: "nextPageToken,files(id,name)", pageSize: "100" });
    if (pageToken) params.set("pageToken", pageToken);
    const body = await (await request(token, `${API}?${params}`)).json() as { files?: DriveFile[]; nextPageToken?: string };
    result.push(...(body.files ?? []).filter(f => /^bej-study-[a-f0-9-]+\.json$/.test(f.name)));
    pageToken = body.nextPageToken ?? "";
  } while (pageToken);
  return result;
}
export async function readSyncFile(token: string, file: DriveFile): Promise<SyncFile> {
  const response = await request(token, `${API}/${encodeURIComponent(file.id)}?alt=media`);
  const text = await response.text();
  if (new Blob([text]).size > 6 * 1024 * 1024) throw new Error("Sync file too large.");
  const data: unknown = JSON.parse(text);
  if (!data || typeof data !== "object") throw new Error("Invalid sync file.");
  const v = data as Partial<SyncFile>;
  if (v.schemaVersion !== 1 || v.kind !== "bej-study-sync" || typeof v.deviceId !== "string" ||
      !Array.isArray(v.favorites) || !v.study) throw new Error(`Invalid BEJ sync file: ${file.name}`);
  const study = parseStudyBackup(JSON.stringify(v.study));
  // Reject malformed favorites instead of silently dropping entries.
  const favorites = parseFavoriteChunks(JSON.stringify(v.favorites));
  if (favorites.length !== v.favorites.length) throw new Error(`Invalid favorites in ${file.name}`);
  return { schemaVersion: 1, kind: "bej-study-sync", deviceId: v.deviceId, exportedAt: String(v.exportedAt), study, favorites };
}
export async function createSnapshot(): Promise<SyncFile> {
  await studyTracker.seal();
  return { schemaVersion: 1, kind: "bej-study-sync", deviceId: deviceId(),
    exportedAt: new Date().toISOString(), study: backupOf(readStudyStore()), favorites: readFavoriteChunks() };
}
export async function uploadSnapshot(token: string, folder: string, files: DriveFile[], snapshot: SyncFile): Promise<void> {
  const name = `bej-study-${snapshot.deviceId}.json`;
  const matches = files.filter(f => f.name === name);
  if (matches.length > 1) throw new Error("Duplicate device files in Drive. Resolve before exporting.");
  const content = JSON.stringify(snapshot);
  const metadata = matches.length ? { name } : { name, parents: [folder], mimeType: "application/json" };
  const boundary = "bej_sync_boundary";
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
  const url = matches.length ? `${UPLOAD}/${encodeURIComponent(matches[0].id)}?uploadType=multipart` : `${UPLOAD}?uploadType=multipart`;
  await request(token, url, { method: matches.length ? "PATCH" : "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body });
}
export function combineSyncFiles(local: SyncFile, incoming: SyncFile[]): { study: StudyData; favorites: FavoriteChunk[]; newSessions: number; newAdjustments: number; conflicts: string[] } {
  let study = local.study.studyData;
  let newSessions = 0, newAdjustments = 0;
  const conflicts: string[] = [];
  const favoriteMap = new Map<string, FavoriteChunk>();
  for (const favorite of local.favorites) favoriteMap.set(`${favorite.language}:${favorite.type ?? "chunk"}:${favorite.id}`, favorite);
  for (const remote of incoming) {
    const merged = mergeStudyData(study, remote.study.studyData);
    study = { ...merged.studyData, goals: local.study.studyData.goals, monthlyGoals: local.study.studyData.monthlyGoals };
    newSessions += merged.newSessions; newAdjustments += merged.newAdjustments;
    conflicts.push(...merged.conflicts.map(c => `${remote.deviceId}: ${c}`));
    for (const favorite of remote.favorites) favoriteMap.set(`${favorite.language}:${favorite.type ?? "chunk"}:${favorite.id}`, favorite);
  }
  return { study, favorites: [...favoriteMap.values()], newSessions, newAdjustments, conflicts };
}
export async function applySync(merged: ReturnType<typeof combineSyncFiles>, baseline: string): Promise<void> {
  if (merged.conflicts.length) throw new Error("Conflicting records: synchronization cancelled.");
  const store = readStudyStore();
  if (JSON.stringify(store) !== baseline || store.extraActivity || store.activeSession) throw new Error("Study data changed or an activity is running. Retry Sync.");
  // Existing import logic enforces storage locks and validation.
  await updateStudyStore(current => {
    if (JSON.stringify(current) !== baseline) throw new Error("Study data changed. Retry Sync.");
    return { ...current, studyData: merged.study };
  });
  localStorage.setItem(FAVORITE_CHUNKS_KEY, JSON.stringify(merged.favorites));
  window.dispatchEvent(new Event(STUDY_CHANGED));
  window.dispatchEvent(new StorageEvent("storage", { key: FAVORITE_CHUNKS_KEY }));
}
