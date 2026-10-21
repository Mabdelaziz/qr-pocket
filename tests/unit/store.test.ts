// SPEC-002 storage tests against fake-indexeddb (a spec-compliant IndexedDB implementation), with injected faults.
import 'fake-indexeddb/auto';
import { IDBFactory as FakeIDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIndexedDbStore } from '../../src/store/indexedDb';
import { StoreError, type CodeStore } from '../../src/store/types';
import { CASES } from './helpers/cases';

let dbCounter = 0;
function newFactory(): IDBFactory {
  return new FakeIDBFactory() as unknown as IDBFactory;
}
function newStore(factory: IDBFactory = newFactory(), extra: Parameters<typeof createIndexedDbStore>[0] = {}): { store: CodeStore; factory: IDBFactory; dbName: string } {
  const dbName = `qr-pocket-test-${++dbCounter}`;
  return { store: createIndexedDbStore({ factory, dbName, ...extra }), factory, dbName };
}

async function rawRecords(factory: IDBFactory, dbName: string): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const open = factory.open(dbName, 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const request = db.transaction('codes', 'readonly').objectStore('codes').getAll();
      request.onsuccess = () => {
        db.close();
        resolve(request.result as unknown[]);
      };
      request.onerror = () => reject(request.error);
    };
  });
}

async function expectStoreError(promise: Promise<unknown>, kind: StoreError['kind']): Promise<void> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(StoreError);
  expect((error as StoreError).kind).toBe(kind);
}

/** The prototype of the IDBObjectStore objects this test's factory really produces (robust to how the package is loaded). */
async function objectStorePrototype(factory: IDBFactory): Promise<IDBObjectStore> {
  return new Promise((resolve, reject) => {
    const open = factory.open('proto-probe', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('s');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const proto = Object.getPrototypeOf(db.transaction('s').objectStore('s')) as IDBObjectStore;
      db.close();
      resolve(proto);
    };
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SPEC-002 AC1: create, read, update, delete', () => {
  it('adds a record with exactly the documented fields and no image data', async () => {
    const { store, factory, dbName } = newStore();
    const saved = await store.add({ payload: 'https://example.com/menu', ecc: 'M' });
    expect(saved).toMatchObject({ payload: 'https://example.com/menu', ecc: 'M', source: 'typed', v: 1 });
    expect(saved.id.length).toBeGreaterThan(8);
    expect(saved.createdAt).toBe(saved.updatedAt);
    const raw = (await rawRecords(factory, dbName)) as Record<string, unknown>[];
    expect(raw).toHaveLength(1);
    expect(Object.keys(raw[0] ?? {}).sort()).toEqual(['createdAt', 'ecc', 'id', 'payload', 'source', 'title', 'updatedAt', 'v']);
  });

  it('gets, lists, renames and removes', async () => {
    const { store } = newStore();
    const a = await store.add({ payload: 'first', ecc: 'M' });
    const b = await store.add({ payload: 'second', ecc: 'L' });
    expect((await store.get(a.id))?.payload).toBe('first');
    expect(await store.get('missing')).toBeUndefined();
    expect((await store.list()).map((r) => r.payload)).toEqual(['second', 'first']);

    const renamed = await store.rename(a.id, 'My first');
    expect(renamed.title).toBe('My first');
    expect(renamed.updatedAt).toBeGreaterThan(a.updatedAt);
    expect((await store.get(a.id))?.title).toBe('My first');

    await store.remove(b.id);
    expect((await store.list()).map((r) => r.id)).toEqual([a.id]);
  });

  it('stores the ECC level and a reserved scanned source', async () => {
    const { store } = newStore();
    const saved = await store.add({ payload: 'x'.repeat(2400), ecc: 'L', source: 'scanned' });
    expect(saved.ecc).toBe('L');
    expect((await store.get(saved.id))?.source).toBe('scanned');
  });

  it('remove is idempotent', async () => {
    const { store } = newStore();
    await expect(store.remove('never-existed')).resolves.toBeUndefined();
  });

  it('rejects renaming a record that does not exist', async () => {
    const { store } = newStore();
    await expectStoreError(store.rename('nope', 'x'), 'not-found');
  });

  it('rejects a blank payload', async () => {
    const { store } = newStore();
    await expectStoreError(store.add({ payload: '   ', ecc: 'M' }), 'invalid');
  });
});

describe('SPEC-002 AC1: Unicode and Arabic payloads are stored exactly', () => {
  it.each(CASES.map((c) => [c.name, c.text] as const))('%s', async (_name, text) => {
    const { store } = newStore();
    const saved = await store.add({ payload: text, ecc: 'M' });
    const fresh = await store.get(saved.id);
    expect(fresh?.payload).toBe(text);
    expect(Array.from(new TextEncoder().encode(fresh?.payload ?? ''))).toEqual(Array.from(new TextEncoder().encode(text)));
  });

  it('stores the largest payload (2,953 bytes) and keeps lone-surrogate-free text intact', async () => {
    const { store } = newStore();
    const big = 'y'.repeat(2953);
    expect((await store.get((await store.add({ payload: big, ecc: 'L' })).id))?.payload).toBe(big);
  });
});

describe('SPEC-002 AC2: ordering and persistence', () => {
  it('lists newest first by createdAt even when the clock does not advance, and renames do not reorder', async () => {
    const { store } = newStore(newFactory(), { now: () => 1_000 });
    const a = await store.add({ payload: 'a', ecc: 'M' });
    const b = await store.add({ payload: 'b', ecc: 'M' });
    const c = await store.add({ payload: 'c', ecc: 'M' });
    expect(c.createdAt).toBeGreaterThan(b.createdAt);
    expect(b.createdAt).toBeGreaterThan(a.createdAt);
    await store.rename(a.id, 'renamed oldest');
    expect((await store.list()).map((r) => r.payload)).toEqual(['c', 'b', 'a']);
  });

  it('a new store instance on the same database sees the saved records (persistence across reloads)', async () => {
    const factory = newFactory();
    const first = newStore(factory);
    const saved = await first.store.add({ payload: 'مرحبا', ecc: 'M' });
    const second = createIndexedDbStore({ factory, dbName: first.dbName });
    expect((await second.list()).map((r) => r.id)).toEqual([saved.id]);
  });

  it('skips malformed records instead of failing the whole list', async () => {
    const factory = newFactory();
    const { store, dbName } = newStore(factory);
    await store.add({ payload: 'good', ecc: 'M' });
    await new Promise<void>((resolve, reject) => {
      const open = factory.open(dbName, 1);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('codes', 'readwrite');
        tx.objectStore('codes').put({ id: 'broken', title: 5 });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
    expect((await store.list()).map((r) => r.payload)).toEqual(['good']);
  });
});

describe('SPEC-002 AC3/AC11: never silently overwrites; titles', () => {
  it('rejects an id collision and leaves the existing record untouched', async () => {
    const { store } = newStore(newFactory(), { newId: () => 'same-id' });
    const first = await store.add({ payload: 'original', ecc: 'M' });
    await expectStoreError(store.add({ payload: 'intruder', ecc: 'M' }), 'unknown');
    expect(await store.get(first.id)).toEqual(first);
    expect(await store.list()).toHaveLength(1);
  });

  it('twenty concurrent adds create twenty distinct records', async () => {
    const { store } = newStore();
    await Promise.all(Array.from({ length: 20 }, (_, i) => store.add({ payload: `item ${i}`, ecc: 'M' })));
    const list = await store.list();
    expect(new Set(list.map((r) => r.id)).size).toBe(20);
    expect(new Set(list.map((r) => r.createdAt)).size).toBe(20);
  });

  it('uses the first line as the default title and cleans renamed titles', async () => {
    const { store } = newStore();
    const saved = await store.add({ payload: '\n  Wi-Fi poster  \nsecond line', ecc: 'M' });
    expect(saved.title).toBe('Wi-Fi poster');
    expect((await store.rename(saved.id, '  a\tb \n c  ')).title).toBe('a b c');
    expect((await store.rename(saved.id, '   ')).title).toBe('Wi-Fi poster'); // blank -> default
    expect(Array.from((await store.rename(saved.id, '\u{1F600}'.repeat(200))).title)).toHaveLength(80);
  });
});

describe('SPEC-002 AC5/AC6/AC12: storage faults are reported and never leave partial state', () => {
  it('reports unavailable when IndexedDB does not exist', async () => {
    const store = createIndexedDbStore({ factory: undefined });
    await expectStoreError(store.list(), 'unavailable');
    await expectStoreError(store.add({ payload: 'x', ecc: 'M' }), 'unavailable');
  });

  it('reports unavailable when opening throws, and recovers once opening works again', async () => {
    const real = newFactory();
    let broken = true;
    const flaky = {
      open: (name: string, version?: number) => {
        if (broken) throw new DOMException('denied', 'SecurityError');
        return real.open(name, version);
      },
    } as unknown as IDBFactory;
    const store = createIndexedDbStore({ factory: flaky, dbName: 'flaky' });
    await expectStoreError(store.list(), 'unavailable');
    broken = false;
    await expect(store.list()).resolves.toEqual([]);
  });

  it('maps a quota error on add and creates no record', async () => {
    const { store, factory } = newStore();
    const spy = vi.spyOn(await objectStorePrototype(factory), 'add').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    await expectStoreError(store.add({ payload: 'x', ecc: 'M' }), 'quota');
    spy.mockRestore();
    expect(await store.list()).toEqual([]);
  });

  it('keeps the record unchanged when a rename fails, then succeeds after the fault clears', async () => {
    const { store, factory } = newStore();
    const saved = await store.add({ payload: 'keep me', ecc: 'M', title: 'Original' });
    const spy = vi.spyOn(await objectStorePrototype(factory), 'put').mockImplementation(() => {
      throw new DOMException('aborted', 'UnknownError');
    });
    await expectStoreError(store.rename(saved.id, 'Changed'), 'unknown');
    expect((await store.get(saved.id))?.title).toBe('Original');
    spy.mockRestore();
    expect((await store.rename(saved.id, 'Changed')).title).toBe('Changed');
  });

  it('keeps the record when a delete fails, and deletes after the fault clears', async () => {
    const { store, factory } = newStore();
    const saved = await store.add({ payload: 'keep me', ecc: 'M' });
    const spy = vi.spyOn(await objectStorePrototype(factory), 'delete').mockImplementation(() => {
      throw new DOMException('aborted', 'UnknownError');
    });
    await expectStoreError(store.remove(saved.id), 'unknown');
    expect(await store.get(saved.id)).toEqual(saved);
    spy.mockRestore();
    await store.remove(saved.id);
    expect(await store.get(saved.id)).toBeUndefined();
  });
});
