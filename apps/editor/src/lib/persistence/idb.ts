// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

// IndexedDB low-level layer.
//
// Schema (v2) is normalized so each entity is its own row, keyed by
// [projectId, id]. This shape maps 1:1 to a future Supabase
// (Postgres) schema where every entity table has a `project_id`
// foreign key — when we migrate, the only structural change is
// "replace IDB ops with PostgREST/RPC calls", not the schema itself.
//
// Stores:
//   projects   keyPath: 'id'
//   nodes      keyPath: ['projectId', 'id']
//   subgraphs  keyPath: ['projectId', 'id']
//   links      keyPath: ['projectId', 'id']
//   products   keyPath: ['projectId', 'id']
//   scenes     keyPath: ['projectId', 'id']
//   assets     keyPath: ['projectId', 'hash']
//
// All entity stores carry a `projectId` index so per-project loads
// are a single ranged getAll.
//
// Format v1 = zip-blob-per-row (gone). v2 = normalized rows.
// No in-place migration: v1 rows are abandoned on upgrade.

const DB_NAME = 'shumoku'
const DB_VERSION = 3

export const STORES = {
  projects: 'projects',
  nodes: 'nodes',
  subgraphs: 'subgraphs',
  links: 'links',
  products: 'products',
  scenes: 'scenes',
  terminations: 'terminations',
  assets: 'assets',
} as const

export type EntityStore = Exclude<keyof typeof STORES, 'projects' | 'assets'>

export const ENTITY_STORES: EntityStore[] = [
  'nodes',
  'subgraphs',
  'links',
  'products',
  'scenes',
  'terminations',
]

let dbPromise: Promise<IDBDatabase> | null = null

export function isAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined'
  } catch {
    return false
  }
}

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (event) => {
      const db = req.result
      const oldVersion = event.oldVersion
      // v1 used a single `projects` store with a `blob` column. We
      // dump it: the user already understands the cache as ephemeral
      // (export is the source of truth) and "no legacy" was the
      // explicit policy when v1 shipped.
      if (oldVersion < 2) {
        for (const name of Array.from(db.objectStoreNames)) db.deleteObjectStore(name)
      }
      // From v2 → v3 we just need to add the `terminations` store —
      // existing data stays. The bootstrap below uses `if not exists`
      // semantics by skipping creation when the store already lives
      // on the upgraded DB.
      if (!db.objectStoreNames.contains(STORES.projects)) {
        db.createObjectStore(STORES.projects, { keyPath: 'id' })
      }
      for (const kind of ENTITY_STORES) {
        if (db.objectStoreNames.contains(STORES[kind])) continue
        const store = db.createObjectStore(STORES[kind], { keyPath: ['projectId', 'id'] })
        store.createIndex('projectId', 'projectId')
      }
      if (!db.objectStoreNames.contains(STORES.assets)) {
        const assets = db.createObjectStore(STORES.assets, { keyPath: ['projectId', 'hash'] })
        assets.createIndex('projectId', 'projectId')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

/** Promisify a single IDBRequest. */
export function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Run a transaction over the given stores; resolves when txn commits. */
export async function withTxn<T>(
  stores: readonly string[],
  mode: IDBTransactionMode,
  fn: (txn: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  const db = await openDb()
  const txn = db.transaction(stores, mode)
  const result = await Promise.resolve(fn(txn))
  return new Promise<T>((resolve, reject) => {
    txn.oncomplete = () => resolve(result)
    txn.onerror = () => reject(txn.error)
    txn.onabort = () => reject(txn.error)
  })
}

/** All rows in a store filtered by projectId (uses the index). */
export async function getAllByProject<T>(
  store: IDBObjectStore | IDBIndex,
  projectId: string,
): Promise<T[]> {
  const idx = 'index' in store ? store.index('projectId') : (store as IDBIndex)
  return await reqToPromise(idx.getAll(projectId) as IDBRequest<T[]>)
}
