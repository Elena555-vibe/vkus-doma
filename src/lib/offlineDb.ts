import type { Recipe } from '../data/types';

export type OfflineState = { recipes: Recipe[]; favorites: string[]; notes: Record<string, string>; cloudSynced?: boolean };
export type PendingChange = { id?: number; type: 'recipe.create' | 'recipe.update' | 'recipe.delete' | 'note.save' | 'favorite.set'; payload: unknown; createdAt: number };

const databaseName = 'vkus-doma-offline';
const version = 1;
let stateWriteQueue = Promise.resolve();

const open = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(databaseName, version);
  request.onerror = () => reject(request.error);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains('state')) db.createObjectStore('state', { keyPath: 'key' });
    if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
  };
  request.onsuccess = () => resolve(request.result);
});

const requestResult = <T>(request: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
const transactionDone = (transaction: IDBTransaction): Promise<void> => new Promise((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error);
  transaction.onabort = () => reject(transaction.error || new Error('Операция с локальной книгой прервана'));
});

export async function readOfflineState(): Promise<OfflineState | null> {
  const db = await open();
  try {
    const transaction = db.transaction('state', 'readonly');
    const record = await requestResult(transaction.objectStore('state').get('current')) as { state?: OfflineState } | undefined;
    return record?.state || null;
  } finally { db.close(); }
}

export async function writeOfflineState(state: OfflineState): Promise<void> {
  // IndexedDB writes are asynchronous. Serialising them prevents an older
  // save from finishing after a newer one and overwriting the local book.
  const snapshot = structuredClone(state);
  stateWriteQueue = stateWriteQueue.catch(() => undefined).then(async () => {
    const db = await open();
    try {
      const transaction = db.transaction('state', 'readwrite');
      transaction.objectStore('state').put({ key: 'current', state: snapshot, updatedAt: Date.now() });
      await transactionDone(transaction);
    } finally { db.close(); }
  });
  return stateWriteQueue;
}

export async function addPendingChange(change: PendingChange): Promise<void> {
  const db = await open();
  try { const transaction = db.transaction('queue', 'readwrite'); transaction.objectStore('queue').add(change); await transactionDone(transaction); } finally { db.close(); }
}

export async function pendingChanges(): Promise<PendingChange[]> {
  const db = await open();
  try { const transaction = db.transaction('queue', 'readonly'); return await requestResult(transaction.objectStore('queue').getAll()) as PendingChange[]; } finally { db.close(); }
}

export async function removePendingChange(id: number): Promise<void> {
  const db = await open();
  try { const transaction = db.transaction('queue', 'readwrite'); transaction.objectStore('queue').delete(id); await transactionDone(transaction); } finally { db.close(); }
}
