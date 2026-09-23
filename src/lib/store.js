// Client-side persistence for PosRonda. The server stores NOTHING, so the
// browser keeps what is needed to continue a conversation after a return:
//
// - Username        → localStorage (tiny, synchronous, needed before first render)
// - Message history → IndexedDB  (async, larger quota, never blocks the UI)
// - Online users    → NOT persisted (presence is live; stale lists would lie)
//
// Backends are injectable parameters so `npm test` can pass fakes
// (see test/store.test.js). All functions degrade gracefully when storage
// is unavailable (e.g. private mode): chat keeps working, history just
// doesn't survive a reload.

export const USERNAME_KEY = 'posronda.username';
export const HISTORY_MAX = 200; // cap of stored messages per browser
const DB_NAME = 'posronda';
const DB_STORE = 'messages';

// --- Username (localStorage) -----------------------------------------------

export function getStoredUsername(storage = globalThis.localStorage) {
  try {
    return storage.getItem(USERNAME_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredUsername(name, storage = globalThis.localStorage) {
  try {
    storage.setItem(USERNAME_KEY, String(name));
  } catch {
    /* storage unavailable — ignore */
  }
}

export function clearStoredUsername(storage = globalThis.localStorage) {
  try {
    storage.removeItem(USERNAME_KEY);
  } catch {
    /* ignore */
  }
}

// --- Message history (IndexedDB) --------------------------------------------

export function openHistoryDB(idb = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    if (!idb) return reject(new Error('IndexedDB unavailable'));
    try {
      const req = idb.open(DB_NAME, 1);
      req.onupgradeneeded = () =>
        req.result.createObjectStore(DB_STORE, { keyPath: 'id', autoIncrement: true });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('open failed'));
    } catch (e) {
      reject(e);
    }
  });
}

/** Oldest-first array of { id, kind, username, text, time }. */
export function loadHistory(db) {
  return new Promise((resolve, reject) => {
    try {
      const req = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error || new Error('load failed'));
    } catch (e) {
      reject(e);
    }
  });
}

/** Append one chat/system message; prunes oldest beyond HISTORY_MAX. */
export function saveMessage(db, msg) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(DB_STORE, 'readwrite');
      const store = tx.objectStore(DB_STORE);
      store.add({
        kind: msg.kind,
        username: msg.username ?? null,
        text: msg.text,
        time: msg.time ?? Date.now()
      });
      const keys = store.getAllKeys();
      keys.onsuccess = () => {
        const excess = keys.result.length - HISTORY_MAX;
        if (excess > 0) {
          let remaining = excess;
          const cursor = store.openCursor();
          cursor.onsuccess = () => {
            const c = cursor.result;
            if (c && remaining > 0) {
              remaining -= 1;
              c.delete();
              c.continue();
            }
          };
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('save failed'));
    } catch (e) {
      reject(e);
    }
  });
}

/** Wipe local history (the "clear history" button). Username is kept. */
export function clearHistory(db) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('clear failed'));
    } catch (e) {
      reject(e);
    }
  });
}
