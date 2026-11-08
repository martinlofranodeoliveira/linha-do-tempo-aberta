import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { createStorage, StorageError } from '../src/storage.js';

// Fresh IndexedDB factories isolate tests and avoid browser/user storage entirely.
const DB = 'lofrano.linha-do-tempo-aberta.v1';
const STORE = 'documents';
const KEY = 'main';
const clone = value => structuredClone(value);
const document = (title = 'Arquivo fictício') => ({
  version: 1, title, description: 'Documento sintético.',
  categories: [{ id: 'grupo', label: 'Grupo imaginário', color: '#2563eb' }],
  events: [{ id: 'inicio', title: 'Primeiro encontro fictício', start: '2024-02-29', end: '2024-03-01', categoryId: 'grupo', notes: 'Dois dias civis.' }],
});
const rejectsCode = (promise, code) => assert.rejects(promise, error => error instanceof StorageError && error.code === code);

async function database(factory) {
  return new Promise((resolve, reject) => {
    const request = factory.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}
async function rawPut(factory, value) {
  const db = await database(factory);
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(value, KEY);
      tx.oncomplete = resolve; tx.onabort = tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}
async function rawRead(factory) {
  const db = await database(factory);
  try {
    return await new Promise((resolve, reject) => {
      let value; const tx = db.transaction(STORE); const request = tx.objectStore(STORE).get(KEY);
      request.onsuccess = () => { value = request.result; };
      tx.oncomplete = () => resolve(value); tx.onabort = tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}

// Inject a transaction abort with the same DOMException used by browser quota failures.
// All other operations continue through a real fake-indexeddb transaction.
function failNextWrite(factory, name) {
  let armed = true;
  return {
    open(...args) {
      const request = factory.open(...args);
      request.addEventListener('success', () => {
        const db = request.result; const transaction = db.transaction.bind(db);
        db.transaction = (...args) => {
          const tx = transaction(...args); const objectStore = tx.objectStore.bind(tx);
          tx.objectStore = (...args) => {
            const store = objectStore(...args); const put = store.put.bind(store);
            store.put = (...args) => {
              if (!armed) return put(...args);
              armed = false;
              tx.abort();
              Object.defineProperty(tx, 'error', { value: new DOMException('Synthetic write failure', name), configurable: true });
              return undefined;
            };
            return store;
          };
          return tx;
        };
      });
      return request;
    },
  };
}

test('empty storage is optional; persisted documents advance revisions and round-trip exactly', async () => {
  const factory = new IDBFactory(); const storage = createStorage(factory); const value = document();
  assert.equal(await storage.read(), null);
  const first = await storage.save(0, value);
  assert.deepEqual(first, { revision: 1, document: value });
  assert.deepEqual(await storage.read(), first);
  const next = document('Uma edição fictícia'); const second = await storage.save(1, next);
  assert.deepEqual(second, { revision: 2, document: next });
  assert.deepEqual(await createStorage(factory).read(), second);
});

test('save snapshots its input before awaiting IndexedDB and every result is an independent clone', async () => {
  const storage = createStorage(new IDBFactory()); const value = document(); const expected = clone(value);
  const pending = storage.save(0, value);
  value.title = 'Mutação após iniciar a gravação'; value.events[0].notes = 'Outro texto'; value.categories.length = 0;
  const result = await pending;
  assert.deepEqual(result.document, expected);
  result.document.events[0].title = 'Mutação do resultado'; result.document.categories[0].label = 'Mudança externa';
  const firstRead = await storage.read(); assert.deepEqual(firstRead.document, expected);
  firstRead.document.events.length = 0; firstRead.document.title = 'Mudança da leitura';
  const [readA, readB] = await Promise.all([storage.read(), storage.read()]);
  assert.deepEqual(readA.document, expected); assert.deepEqual(readB.document, expected);
  assert.notEqual(readA.document, readB.document); assert.notEqual(readA.document.events[0], readB.document.events[0]);
});

test('a stale expected revision is rejected without overwriting the winning document', async () => {
  const factory = new IDBFactory(); const tabA = createStorage(factory); const tabB = createStorage(factory);
  await tabA.save(0, document('Primeira versão'));
  const stale = await tabB.read();
  const winner = await tabA.save(1, document('Versão mais recente'));
  await rejectsCode(tabB.save(stale.revision, document('Edição da aba atrasada')), 'CONFLICT');
  await rejectsCode(tabB.save(0, document('Outra tentativa atrasada')), 'CONFLICT');
  assert.deepEqual(await tabA.read(), winner);
});

test('concurrent transactions with the same expected revision produce exactly one winner', async () => {
  const factory = new IDBFactory(); const tabs = [createStorage(factory), createStorage(factory)];
  for (let revision = 0; revision < 3; revision++) {
    const values = [document(`Documento A ${revision}`), document(`Documento B ${revision}`)];
    const results = await Promise.allSettled(tabs.map((store, i) => store.save(revision, values[i])));
    const winners = results.filter(result => result.status === 'fulfilled');
    const losers = results.filter(result => result.status === 'rejected');
    assert.equal(winners.length, 1); assert.equal(losers.length, 1);
    assert.equal(losers[0].reason.code, 'CONFLICT');
    assert.equal(winners[0].value.revision, revision + 1);
    assert.deepEqual(await tabs[0].read(), winners[0].value);
    assert.deepEqual(await tabs[1].read(), winners[0].value);
  }
});

test('invalid revisions and invalid documents cannot change the saved record', async () => {
  const storage = createStorage(new IDBFactory()); const saved = await storage.save(0, document());
  for (const revision of [-1, 0.5, '1', null, undefined, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    await rejectsCode(storage.save(revision, document('Não pode substituir')), 'OPTION_INVALID');
  }
  const bad = document(); bad.events[0].end = '2024-02-28';
  await assert.rejects(storage.save(1, bad));
  assert.deepEqual(await storage.read(), saved);
});

test('corrupt persisted records are reported and are never silently repaired or overwritten', async t => {
  const badDocument = document(); badDocument.events[0].categoryId = 'ausente';
  const cases = [
    null,
    { revision: 0, document: document() },
    { revision: Number.MAX_SAFE_INTEGER + 1, document: document() },
    { revision: 1 },
    { revision: 1, document: badDocument },
    { revision: 1, document: document(), extra: 'unexpected' },
  ];
  for (const [index, record] of cases.entries()) {
    await t.test(`synthetic corruption ${index + 1}`, async () => {
      const factory = new IDBFactory(); await rawPut(factory, record); const storage = createStorage(factory);
      await rejectsCode(storage.read(), 'CORRUPT');
      await rejectsCode(storage.save(0, document('Não deve reparar')), 'CORRUPT');
      assert.deepEqual(await rawRead(factory), record);
    });
  }
});

test('quota and transaction aborts preserve the last committed revision and allow a later retry', async t => {
  for (const [name, code] of [['QuotaExceededError', 'QUOTA'], ['UnknownError', 'WRITE_FAILED']]) {
    await t.test(name, async () => {
      const factory = new IDBFactory(); const saved = await createStorage(factory).save(0, document('Cópia anterior'));
      const storage = createStorage(failNextWrite(factory, name));
      await rejectsCode(storage.save(1, document('Falha simulada')), code);
      assert.deepEqual(await createStorage(factory).read(), saved);
      const result = await storage.save(1, document('Nova tentativa'));
      assert.equal(result.revision, 2); assert.equal(result.document.title, 'Nova tentativa');
    });
  }
});

test('unavailable, throwing, blocked and failed-open factories reject without hanging', async () => {
  await rejectsCode(createStorage(null).read(), 'UNAVAILABLE');
  await rejectsCode(createStorage({ open() { throw new Error('private injected detail'); } }).read(), 'UNAVAILABLE');
  for (const [event, code] of [['onblocked', 'BLOCKED'], ['onerror', 'READ_FAILED']]) {
    const factory = { open() {
      const request = { error: new DOMException('private injected detail', 'UnknownError') };
      queueMicrotask(() => request[event]()); return request;
    } };
    await assert.rejects(createStorage(factory).read(), error => {
      assert.ok(error instanceof StorageError); assert.equal(error.code, code);
      assert.doesNotMatch(error.message, /private injected detail/); return true;
    });
  }
});
