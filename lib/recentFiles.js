// Local-only "recently opened" storage. Everything here stays in the
// browser's IndexedDB on this device — nothing is ever sent anywhere, same
// promise as the rest of the app. Files above a size cap aren't stored (to
// keep IndexedDB usage sane); they just won't appear in Recent, which is a
// reasonable tradeoff over silently ballooning local storage.

const DB_NAME = 'anyfile-viewer';
const STORE = 'recent-files';
const MAX_ENTRIES = 10;
const MAX_STORED_SIZE = 20 * 1024 * 1024; // 20 MB per file

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addRecentFile(file) {
  if (file.size > MAX_STORED_SIZE) return;
  try {
    const db = await openDb();
    const entry = {
      id: `${file.name}-${file.size}-${file.lastModified || Date.now()}`,
      name: file.name,
      size: file.size,
      type: file.type,
      lastOpened: Date.now(),
      blob: file,
    };
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(entry);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    await pruneOldEntries(db);
    db.close();
  } catch {
    // Best-effort feature — never let recent-file bookkeeping break opening a file.
  }
}

async function pruneOldEntries(db) {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const all = req.result.sort((a, b) => b.lastOpened - a.lastOpened);
      all.slice(MAX_ENTRIES).forEach((entry) => store.delete(entry.id));
      resolve();
    };
    req.onerror = () => resolve();
  });
}

export async function getRecentFiles() {
  try {
    const db = await openDb();
    const result = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result.sort((a, b) => b.lastOpened - a.lastOpened);
  } catch {
    return [];
  }
}

export async function removeRecentFile(id) {
  try {
    const db = await openDb();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = resolve;
    });
    db.close();
  } catch {
    // no-op
  }
}

export async function clearRecentFiles() {
  try {
    const db = await openDb();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = resolve;
    });
    db.close();
  } catch {
    // no-op
  }
}

// Reconstruct a real File object from a stored entry, so it can be fed
// straight back into the normal handleFiles() pipeline.
export function recentEntryToFile(entry) {
  return new window.File([entry.blob], entry.name, { type: entry.type, lastModified: entry.lastOpened });
}
