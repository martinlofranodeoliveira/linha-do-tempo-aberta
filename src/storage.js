import { validateDocument } from "./engine.js";

const DB_NAME = "lofrano.linha-do-tempo-aberta.v1";
const STORE = "documents";
const KEY = "main";
const messages = Object.freeze({
  UNAVAILABLE: "O armazenamento deste navegador não está disponível.",
  BLOCKED: "Outra aba está impedindo a abertura do armazenamento.",
  READ_FAILED: "Não foi possível ler a cópia deste navegador.",
  WRITE_FAILED: "Não foi possível salvar a cópia neste navegador.",
  QUOTA: "O navegador não tem espaço para salvar esta cópia.",
  CONFLICT:
    "Outra aba salvou uma versão diferente. Sua edição continua na memória.",
  CORRUPT: "A cópia deste navegador está inválida. Ela não foi substituída.",
  OPTION_INVALID: "A revisão de armazenamento é inválida.",
});
export class StorageError extends Error {
  constructor(code) {
    super(messages[code] ?? messages.WRITE_FAILED);
    this.name = "StorageError";
    this.code = code;
  }
}
function stored(value) {
  if (value === undefined) return null;
  if (
    !value ||
    Object.keys(value).sort().join(",") !== "document,revision" ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 1
  )
    throw new StorageError("CORRUPT");
  try {
    return {
      revision: value.revision,
      document: validateDocument(value.document),
    };
  } catch {
    throw new StorageError("CORRUPT");
  }
}
function failure(error, fallback) {
  return new StorageError(
    error?.name === "QuotaExceededError" ? "QUOTA" : fallback,
  );
}
export function createStorage(factory = globalThis.indexedDB) {
  async function open() {
    if (!factory || typeof factory.open !== "function")
      throw new StorageError("UNAVAILABLE");
    return new Promise((resolve, reject) => {
      let done = false;
      let req;
      try {
        req = factory.open(DB_NAME, 1);
      } catch {
        reject(new StorageError("UNAVAILABLE"));
        return;
      }
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE))
          req.result.createObjectStore(STORE);
      };
      req.onblocked = () => {
        done = true;
        reject(new StorageError("BLOCKED"));
      };
      req.onerror = () => {
        done = true;
        reject(failure(req.error, "READ_FAILED"));
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => db.close();
        if (done) db.close();
        else {
          done = true;
          resolve(db);
        }
      };
    });
  }
  async function read() {
    const db = await open();
    return new Promise((resolve, reject) => {
      let value = null,
        error;
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => {
        try {
          value = stored(req.result);
        } catch (e) {
          error = e;
          tx.abort();
        }
      };
      tx.oncomplete = () => {
        db.close();
        resolve(value);
      };
      tx.onabort = tx.onerror = () => {
        db.close();
        reject(error ?? failure(tx.error, "READ_FAILED"));
      };
    });
  }
  async function save(expectedRevision, document) {
    if (
      !Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 0 ||
      expectedRevision === Number.MAX_SAFE_INTEGER
    )
      throw new StorageError("OPTION_INVALID");
    const copy = validateDocument(document);
    const db = await open();
    return new Promise((resolve, reject) => {
      let result, error;
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const req = store.get(KEY);
      req.onsuccess = () => {
        try {
          const before = stored(req.result);
          if ((before?.revision ?? 0) !== expectedRevision)
            throw new StorageError("CONFLICT");
          result = { revision: expectedRevision + 1, document: copy };
          store.put(result, KEY);
        } catch (e) {
          error = e;
          tx.abort();
        }
      };
      tx.oncomplete = () => {
        db.close();
        resolve({
          revision: result.revision,
          document: validateDocument(result.document),
        });
      };
      tx.onabort = tx.onerror = () => {
        db.close();
        reject(error ?? failure(tx.error, "WRITE_FAILED"));
      };
    });
  }
  return Object.freeze({ read, save });
}
