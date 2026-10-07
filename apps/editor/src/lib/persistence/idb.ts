// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Link, Node, Position, Size, Subgraph } from '@shumoku/core'
import { encodeNodeRow } from './node-row'
import { encodeLinkRow, encodeSubgraphRow } from './style-rows'

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
// DB v1 = zip-blob-per-row (gone), v2 = normalized rows,
// v3 = terminations, v4 = node geometry separation,
// v5 = node shape and node/link/subgraph style separation.
// Only v1 rows are abandoned; v2/v3/v4 rows migrate atomically in place.

const DB_NAME = 'shumoku'
const DB_VERSION = 5

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
      // Move cached geometry and entity appearance out of the structural payload atomically.
      // The row key and object stores stay the same; no project is discarded.
      if (oldVersion >= 2 && oldVersion < 5 && req.transaction) {
        for (const kind of ['nodes', 'links', 'subgraphs'] as const) {
          const cursorRequest = req.transaction.objectStore(STORES[kind]).openCursor()
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result
            if (!cursor) return
            try {
              if (kind === 'nodes') {
                const row = cursor.value as {
                  projectId: string
                  id: string
                  data: Node
                  presentation?: { nodeId: string; position?: Position; size?: Size }
                }
                if (row.presentation && row.presentation.nodeId !== row.id)
                  throw new Error('Invalid cached node presentation ID')
                const node = {
                  ...row.data,
                  ...(row.presentation?.position ? { position: row.presentation.position } : {}),
                  ...(row.presentation?.size ? { size: row.presentation.size } : {}),
                }
                cursor.update(encodeNodeRow(row.projectId, row.id, node))
              } else if (kind === 'links') {
                const row = cursor.value as { projectId: string; id: string; data: Link }
                cursor.update(encodeLinkRow(row.projectId, row.id, row.data))
              } else {
                const row = cursor.value as { projectId: string; id: string; data: Subgraph }
                cursor.update(encodeSubgraphRow(row.projectId, row.id, row.data))
              }
              cursor.continue()
            } catch {
              req.transaction?.abort()
            }
          }
        }
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
  const completion = new Promise<void>((resolve, reject) => {
    txn.oncomplete = () => resolve()
    txn.onerror = () => reject(txn.error)
    txn.onabort = () => reject(txn.error ?? new DOMException('Transaction aborted', 'AbortError'))
  })
  try {
    const [result] = await Promise.all([fn(txn), completion])
    return result
  } catch (error) {
    try {
      txn.abort()
    } catch {
      // A failed request may already have aborted the transaction.
    }
    await completion.catch(() => {})
    throw error
  }
}

/** All rows in a store filtered by projectId (uses the index). */
export async function getAllByProject<T>(
  store: IDBObjectStore | IDBIndex,
  projectId: string,
): Promise<T[]> {
  const idx = 'index' in store ? store.index('projectId') : (store as IDBIndex)
  return await reqToPromise(idx.getAll(projectId) as IDBRequest<T[]>)
}
