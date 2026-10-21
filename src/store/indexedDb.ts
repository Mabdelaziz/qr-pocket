import { StoreError, isSavedCode, type CodeStore, type NewCode, type SavedCode } from './types';
import { normalizeTitle } from './titles';

export const DB_NAME = 'qr-pocket';
const DB_VERSION = 1;
const STORE = 'codes';

export interface StoreOptions {
  /** Defaults to the browser's `indexedDB` (undefined when unavailable). */
  readonly factory?: IDBFactory | undefined;
  readonly dbName?: string;
  readonly now?: () => number;
  readonly newId?: () => string;
}

function defaultNewId(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Maps any thrown value or DOMException to a StoreError by its name. */
export function mapStoreError(error: unknown): StoreError {
  if (error instanceof StoreError) return error;
  const name = typeof error === 'object' && error !== null && 'name' in error ? String((error as { name: unknown }).name) : '';
  switch (name) {
    case 'QuotaExceededError':
      return new StoreError('quota', 'Not enough storage space', error);
    case 'SecurityError':
    case 'InvalidStateError':
    case 'VersionError':
    case 'NotFoundError':
    case 'TransactionInactiveError':
      return new StoreError('unavailable', 'Storage is unavailable', error);
    default:
      return new StoreError('unknown', 'Storage failed', error);
  }
}

interface TxContext<T> {
  readonly store: IDBObjectStore;
  done(value: T): void;
  /** `abort` is false when the failure came from a request error event: the transaction aborts itself then. */
  fail(error: unknown, abort?: boolean): void;
}

/** Reading `indexedDB` can throw (blocked storage, sandboxed frames): treat that as unavailable, never as a crash at load. */
function browserIndexedDb(): IDBFactory | undefined {
  try {
    return globalThis.indexedDB;
  } catch {
    return undefined;
  }
}

export function createIndexedDbStore(options: StoreOptions = {}): CodeStore {
  const factory = 'factory' in options ? options.factory : browserIndexedDb();
  const dbName = options.dbName ?? DB_NAME;
  const now = options.now ?? Date.now;
  const newId = options.newId ?? defaultNewId;
  let lastCreatedAt = 0;
  let dbPromise: Promise<IDBDatabase> | null = null;

  function openDb(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;
    const promise = new Promise<IDBDatabase>((resolve, reject) => {
      if (!factory) {
        reject(new StoreError('unavailable', 'IndexedDB is not available'));
        return;
      }
      let abandoned = false;
      let request: IDBOpenDBRequest;
      try {
        request = factory.open(dbName, DB_VERSION);
      } catch (error) {
        reject(mapStoreError(error));
        return;
      }
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt');
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        if (abandoned) {
          db.close(); // this open was reported as blocked; do not keep a connection nobody owns
          return;
        }
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        db.onclose = () => {
          dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => reject(mapStoreError(request.error));
      request.onblocked = () => {
        abandoned = true;
        reject(new StoreError('unavailable', 'Opening the database was blocked'));
      };
    });
    dbPromise = promise;
    promise.catch(() => {
      if (dbPromise === promise) dbPromise = null; // allow a retry after a failed open
    });
    return promise;
  }

  /** Runs `work` in one transaction; resolves only when the transaction has COMPLETED (durable). */
  async function inTransaction<T>(mode: IDBTransactionMode, work: (ctx: TxContext<T>) => void): Promise<T> {
    const db = await openDb();
    return new Promise<T>((resolve, reject) => {
      let result: T | undefined;
      let hasResult = false;
      let tx: IDBTransaction;
      try {
        tx = db.transaction(STORE, mode);
      } catch (error) {
        reject(mapStoreError(error));
        return;
      }
      tx.oncomplete = () => {
        if (hasResult) resolve(result as T);
        else reject(new StoreError('unknown', 'The operation produced no result'));
      };
      tx.onerror = () => reject(mapStoreError(tx.error));
      tx.onabort = () => reject(mapStoreError(tx.error));
      const fail = (error: unknown, abort = true): void => {
        reject(mapStoreError(error));
        if (!abort) return; // a request error already aborts the transaction; aborting twice is an error
        try {
          tx.abort();
        } catch {
          /* the transaction already finished */
        }
      };
      try {
        work({
          store: tx.objectStore(STORE),
          done: (value) => {
            result = value;
            hasResult = true;
          },
          fail,
        });
      } catch (error) {
        fail(error);
      }
    });
  }

  function nextCreatedAt(): number {
    lastCreatedAt = Math.max(now(), lastCreatedAt + 1); // strictly increasing => stable newest-first order
    return lastCreatedAt;
  }

  return {
    async add(input: NewCode): Promise<SavedCode> {
      if (input.payload.trim() === '') throw new StoreError('invalid', 'The payload is blank');
      const time = nextCreatedAt();
      const record: SavedCode = {
        id: newId(),
        title: normalizeTitle(input.title ?? '', input.payload, new Date(time)),
        payload: input.payload,
        ecc: input.ecc,
        source: input.source ?? 'typed',
        createdAt: time,
        updatedAt: time,
        v: 1,
      };
      return inTransaction<SavedCode>('readwrite', ({ store, done, fail }) => {
        const request = store.add(record); // add, never put: an existing record is never overwritten
        request.onsuccess = () => done(record);
        request.onerror = () => fail(request.error, false);
      });
    },

    async list(): Promise<SavedCode[]> {
      return inTransaction<SavedCode[]>('readonly', ({ store, done, fail }) => {
        const request = store.getAll();
        request.onsuccess = () => {
          const valid = (request.result as unknown[]).filter(isSavedCode);
          valid.sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : -1));
          done(valid);
        };
        request.onerror = () => fail(request.error, false);
      });
    },

    async get(id: string): Promise<SavedCode | undefined> {
      return inTransaction<SavedCode | undefined>('readonly', ({ store, done, fail }) => {
        const request = store.get(id);
        request.onsuccess = () => done(isSavedCode(request.result) ? request.result : undefined);
        request.onerror = () => fail(request.error, false);
      });
    },

    async rename(id: string, title: string): Promise<SavedCode> {
      return inTransaction<SavedCode>('readwrite', ({ store, done, fail }) => {
        const read = store.get(id);
        read.onerror = () => fail(read.error, false);
        read.onsuccess = () => {
          try {
            const current: unknown = read.result;
            if (!isSavedCode(current)) {
              fail(new StoreError('not-found', 'That saved code no longer exists'));
              return;
            }
            const stamp = Math.max(now(), current.updatedAt + 1);
            const updated: SavedCode = { ...current, title: normalizeTitle(title, current.payload, new Date(stamp)), updatedAt: stamp };
            const write = store.put(updated); // the same record id, by design
            write.onsuccess = () => done(updated);
            write.onerror = () => fail(write.error, false);
          } catch (error) {
            fail(error); // an exception thrown inside an event handler would otherwise never settle the promise
          }
        };
      });
    },

    async remove(id: string): Promise<void> {
      return inTransaction<void>('readwrite', ({ store, done, fail }) => {
        const request = store.delete(id);
        request.onsuccess = () => done(undefined);
        request.onerror = () => fail(request.error, false);
      });
    },
  };
}
