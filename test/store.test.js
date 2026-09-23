// Unit tests for client-side persistence (src/lib/store.js).
// Browser APIs don't exist in Node, so we inject minimal in-memory fakes.
// Run: npm test
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  USERNAME_KEY, HISTORY_MAX,
  getStoredUsername, setStoredUsername, clearStoredUsername,
  openHistoryDB, loadHistory, saveMessage, clearHistory
} from '../src/lib/store.js';

// --- Fakes ---------------------------------------------------------------

function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); }
  };
}

/** Minimal IndexedDB fake: open, add/getAll/getAllKeys/openCursor/clear. */
function fakeIndexedDB() {
  const dbs = new Map();
  const asyncFire = (req, value) =>
    queueMicrotask(() => { req.result = value; req.onsuccess?.({ target: req }); });

  function makeStore(coll, txDone) {
    return {
      add(record) {
        const saved = { ...record, id: coll.nextId++ };
        coll.records.push(saved);
        const req = { result: saved.id, onsuccess: null, onerror: null };
        asyncFire(req, saved.id);
        txDone();
        return req;
      },
      getAll() {
        const req = { result: null, onsuccess: null, onerror: null };
        asyncFire(req, coll.records.map((r) => ({ ...r })));
        return req;
      },
      getAllKeys() {
        const req = { result: null, onsuccess: null, onerror: null };
        asyncFire(req, coll.records.map((r) => r.id));
        return req;
      },
      openCursor() {
        const snapshot = [...coll.records];
        let i = 0;
        const req = { result: undefined, onsuccess: null, onerror: null };
        const step = () => {
          req.result = i < snapshot.length ? cursorFor(snapshot[i++]) : undefined;
          req.onsuccess?.({ target: req });
        };
        queueMicrotask(step);
        txDone();
        return req;
        function cursorFor(rec) {
          return {
            delete() {
              const at = coll.records.indexOf(rec);
              if (at >= 0) coll.records.splice(at, 1);
            },
            continue() { queueMicrotask(step); }
          };
        }
      },
      clear() {
        coll.records.length = 0;
        const req = { result: undefined, onsuccess: null, onerror: null };
        asyncFire(req, undefined);
        txDone();
        return req;
      }
    };
  }

  return {
    open(name, version) {
      const req = { result: null, onsuccess: null, onerror: null, onupgradeneeded: null };
      queueMicrotask(() => {
        if (!dbs.has(name)) {
          const db = { stores: new Map() };
          dbs.set(name, db);
          req.result = api(db);
          req.onupgradeneeded?.({ target: req, oldVersion: 0, newVersion: version });
        } else {
          req.result = api(dbs.get(name));
        }
        req.onsuccess?.({ target: req });
      });
      return req;

      function api(db) {
        return {
          createObjectStore(storeName) {
            if (!db.stores.has(storeName)) db.stores.set(storeName, { records: [], nextId: 1 });
          },
          transaction(storeName) {
            if (!db.stores.has(storeName)) db.stores.set(storeName, { records: [], nextId: 1 });
            // Like a real IDBTransaction, the returned object carries
            // objectStore() AND the oncomplete/onerror handlers.
            const tx = {
              oncomplete: null,
              onerror: null,
              error: null,
              objectStore: () => makeStore(db.stores.get(storeName), txDone)
            };
            // Complete on a macrotask so cursor chains (microtasks) finish first.
            const txDone = () => setTimeout(() => tx.oncomplete?.({ target: tx }), 0);
            return tx;
          },
          close() {}
        };
      }
    }
  };
}

const chat = (username, text, time = 1700000000000) => ({ kind: 'chat', username, text, time });
const sys = (text) => ({ kind: 'system', text, time: 1700000000000 });

// --- Tests ---------------------------------------------------------------

describe('username storage', () => {
  it('round-trips through localStorage', () => {
    const ls = fakeStorage();
    assert.equal(getStoredUsername(ls), '');
    setStoredUsername('alice', ls);
    assert.equal(ls.getItem(USERNAME_KEY), 'alice');
    assert.equal(getStoredUsername(ls), 'alice');
    clearStoredUsername(ls);
    assert.equal(getStoredUsername(ls), '');
  });
  it('degrades to empty string when storage is missing/broken', () => {
    assert.equal(getStoredUsername(undefined), '');
    assert.equal(getStoredUsername(null), '');
    assert.equal(getStoredUsername({ getItem() { throw new Error('denied'); } }), '');
    assert.doesNotThrow(() => setStoredUsername('x', null));
  });
});

describe('message history', () => {
  it('opens the DB and loads empty history', async () => {
    const db = await openHistoryDB(fakeIndexedDB());
    assert.deepEqual(await loadHistory(db), []);
  });
  it('rejects when IndexedDB is unavailable', async () => {
    await assert.rejects(openHistoryDB(null), /unavailable/);
    await assert.rejects(openHistoryDB(undefined), /unavailable/);
  });
  it('saves and reloads chat + system messages in order', async () => {
    const db = await openHistoryDB(fakeIndexedDB());
    await saveMessage(db, chat('alice', 'hi'));
    await saveMessage(db, sys('bob joined'));
    await saveMessage(db, chat('bob', 'hey'));
    const all = await loadHistory(db);
    assert.equal(all.length, 3);
    assert.equal(all[0].username, 'alice');
    assert.equal(all[0].text, 'hi');
    assert.equal(all[1].kind, 'system');
    assert.equal(all[2].username, 'bob');
    assert.ok(all.every((r) => typeof r.time === 'number'));
  });
  it('prunes oldest messages beyond HISTORY_MAX', async () => {
    const db = await openHistoryDB(fakeIndexedDB());
    for (let i = 0; i < HISTORY_MAX + 5; i++) {
      await saveMessage(db, chat('alice', `msg-${i}`));
    }
    const all = await loadHistory(db);
    assert.equal(all.length, HISTORY_MAX);
    assert.equal(all[0].text, 'msg-5'); // msg-0..msg-4 pruned
    assert.equal(all[all.length - 1].text, `msg-${HISTORY_MAX + 4}`);
  });
  it('clearHistory wipes messages but keeps the DB usable', async () => {
    const db = await openHistoryDB(fakeIndexedDB());
    await saveMessage(db, chat('alice', 'hi'));
    await clearHistory(db);
    assert.deepEqual(await loadHistory(db), []);
    await saveMessage(db, chat('alice', 'again'));
    assert.equal((await loadHistory(db)).length, 1);
  });
});
