import {
    DB_NAME,
    DB_VERSION,
    STORE
} from "./state.js";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
        store.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbAction(mode, action) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const result = action(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  }).finally(() => db.close());
}

async function getAllPoems() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

function savePoem(poem) {
  return dbAction('readwrite', (store) => store.put(poem));
}

function deletePoem(id) {
  return dbAction('readwrite', (store) => store.delete(id));
}

async function deleteMany(ids) {
  if (!ids.length) return;
  await dbAction('readwrite', (store) => ids.forEach((id) => store.delete(id)));
}

async function saveMany(poems) {
  if (!poems.length) return;
  await dbAction('readwrite', (store) => poems.forEach((poem) => store.put(poem)));
}

export {
    openDb,
    dbAction,
    getAllPoems,
    savePoem,
    deletePoem,
    deleteMany,
    saveMany
}