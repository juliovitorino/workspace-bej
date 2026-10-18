// Web Locks require a secure origin. A SharedWorker provides the same central
// arbitration for HTTP origins without trusting read/write localStorage leases.
export interface StudyLockOptions { ifAvailable?: boolean; controlResource?: string }
export interface StudyLockManager {
  request<T>(name: string, callback: (lock: { name: string } | null) => T | Promise<T>): Promise<T>;
  request<T>(name: string, options: StudyLockOptions, callback: (lock: { name: string } | null) => T | Promise<T>): Promise<T>;
}
type Pending = { grant: (available: boolean) => void; reject: (error: Error) => void };
const unavailable = () => Object.assign(new Error("otherTab"), { code: "otherTab" });
let port: MessagePort | null = null;
let sequence = 0;
const pending = new Map<number, Pending>();
const releases = new Map<number, () => void>();
function connect(): MessagePort {
  if (port) return port;
  const worker = new SharedWorker(new URL("./studyLockWorker.ts", import.meta.url), { type: "module", name: "bej-study-v2" });
  const connection = worker.port;
  connection.onmessage = (event: MessageEvent<{ id: number; available: boolean; type?: string }>) => {
    if (event.data.type === "released") {
      releases.get(event.data.id)?.(); releases.delete(event.data.id);
    } else pending.get(event.data.id)?.grant(event.data.available);
  };
  connection.onmessageerror = () => { if (port === connection) disconnect(Object.assign(new Error("storage"), { code: "storage" })); };
  worker.onerror = () => { if (port === connection) disconnect(Object.assign(new Error("storage"), { code: "storage" })); };
  connection.start();
  port = connection;
  return connection;
}
function disconnect(error = unavailable()) {
  const previous = port;
  port = null;
  // pagehide is delivered between JS tasks, so no synchronous storage commit
  // can still be executing in this document when its controls are released.
  previous?.postMessage({ type: "disconnect" });
  previous?.close();
  for (const request of pending.values()) request.reject(error);
  pending.clear();
  for (const released of releases.values()) released();
  releases.clear();
}
function release(connection: MessagePort, id: number, name: string): Promise<void> {
  if (port !== connection) return Promise.resolve();
  return new Promise(resolve => {
    releases.set(id, resolve);
    connection.postMessage({ type: "release", id, name });
  });
}
// Register only if the HTTP fallback is actually used.
let lifecycleRegistered = false;
const sharedLocks: StudyLockManager = {
  request<T>(name: string, optionsOrCallback: StudyLockOptions | ((lock: { name: string } | null) => T | Promise<T>), callback?: (lock: { name: string } | null) => T | Promise<T>): Promise<T> {
    const options = typeof optionsOrCallback === "function" ? {} : optionsOrCallback;
    const run = typeof optionsOrCallback === "function" ? optionsOrCallback : callback!;
    return new Promise<T>((resolve, reject) => {
      if (!lifecycleRegistered) {
        window.addEventListener("pagehide", () => disconnect()); lifecycleRegistered = true;
      }
      const connection = connect(), id = ++sequence;
      pending.set(id, {
        reject,
        grant: available => {
          // A queued grant for a document that has already left must never write.
          if (port !== connection) { reject(unavailable()); return; }
          pending.delete(id);
          let result: T | Promise<T>;
          try { result = run(available ? { name } : null); }
          catch (error) {
            void release(connection, id, name).then(() => reject(error)); return;
          }
          void Promise.resolve(result).then(
            value => release(connection, id, name).then(() => resolve(value)),
            error => release(connection, id, name).then(() => reject(error))
          );
        }
      });
      connection.postMessage({ type: "request", id, name, ...options });
    });
  }
};
export function getStudyLocks(): StudyLockManager | null {
  if (typeof navigator.locks?.request === "function") return navigator.locks as StudyLockManager;
  return typeof SharedWorker === "function" ? sharedLocks : null;
}
