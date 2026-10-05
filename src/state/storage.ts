// The only place that reads and writes saved data. Everything is one document in IndexedDB;
// if IndexedDB is unavailable (some private modes), it falls back to localStorage.
import { freshDoc, migrate, type StoredDoc } from './schema'

const DB_NAME = 'fuel-and-burn'
const STORE = 'docs'
const DOC_KEY = 'main'
/** Where versions before IndexedDB saved their data. Left in place as a safety copy. */
const LEGACY_KEY = 'fuel-and-burn-v1'
const FALLBACK_KEY = 'fuel-and-burn-v2'

let useFallback = typeof indexedDB === 'undefined'
let dbPromise: Promise<IDBDatabase> | null = null
let writes: Promise<void> = Promise.resolve()

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('IndexedDB blocked'))
  })
  return dbPromise
}

async function readDb(): Promise<unknown> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(DOC_KEY)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function writeDb(doc: StoredDoc): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(doc, DOC_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

function readLocal(key: string): StoredDoc | null {
  try {
    return migrate(JSON.parse(localStorage.getItem(key) ?? 'null'))
  } catch {
    return null
  }
}

/** The saved document, migrated to the current format; a fresh one on first run. */
export async function loadDoc(): Promise<StoredDoc> {
  if (!useFallback) {
    try {
      const saved = migrate(await readDb())
      if (saved) return saved
    } catch {
      useFallback = true
    }
  }
  // First run with IndexedDB: carry over what earlier versions saved in localStorage.
  return readLocal(FALLBACK_KEY) ?? readLocal(LEGACY_KEY) ?? freshDoc()
}

/** Saves the document. Writes run one after another, so the last call always wins. */
export function saveDoc(doc: StoredDoc): Promise<void> {
  writes = writes.then(async () => {
    if (!useFallback) {
      try {
        return await writeDb(doc)
      } catch {
        useFallback = true
      }
    }
    try {
      localStorage.setItem(FALLBACK_KEY, JSON.stringify(doc))
    } catch {
      // Storage full or blocked: the app keeps working for this session.
    }
  })
  return writes
}

/** Asks the browser not to clear this site's data under storage pressure. Granted silently or not at all. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    return (await navigator.storage.persisted()) || (await navigator.storage.persist())
  } catch {
    return false
  }
}
