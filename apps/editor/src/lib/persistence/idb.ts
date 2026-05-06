// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

// IndexedDB-backed project cache (beta).
//
// One row per project; the `blob` is the byte-identical `.neted.zip`
// from `writeProjectZip`. Storing the zip whole (instead of split
// JSON + assets) keeps the DB schema trivial — there's nothing to
// migrate when the in-zip layout changes, only `formatVersion` to
// bump.
//
// Format v1 maps to `formatVersion: 1`. A future v2 reader will
// reject older rows and ask the user to wipe the cache (no in-place
// migration during beta).

const DB_NAME = 'shumoku'
const DB_VERSION = 1
const STORE = 'projects'

export interface ProjectMeta {
  id: string
  name: string
  updatedAt: number
  createdAt: number
  formatVersion: number
  size: number
}

interface ProjectRow extends ProjectMeta {
  blob: Blob
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('updatedAt', 'updatedAt')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return openDb().then((db) => db.transaction(STORE, mode).objectStore(STORE))
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Whether IndexedDB is usable in this environment (private mode etc. can disable it). */
export function isAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined'
  } catch {
    return false
  }
}

export const projectsDb = {
  /**
   * List every cached project, sorted newest-first. Excludes the
   * blob to keep the home-page query cheap — call `load(id)` to
   * fetch the bytes when actually opening one.
   */
  async list(): Promise<ProjectMeta[]> {
    if (!isAvailable()) return []
    try {
      const store = await tx('readonly')
      const rows = (await reqToPromise(store.getAll())) as ProjectRow[]
      return rows.map(({ blob: _blob, ...meta }) => meta).sort((a, b) => b.updatedAt - a.updatedAt)
    } catch {
      return []
    }
  },
  async get(id: string): Promise<ProjectMeta | null> {
    if (!isAvailable()) return null
    const store = await tx('readonly')
    const row = (await reqToPromise(store.get(id))) as ProjectRow | undefined
    if (!row) return null
    const { blob: _blob, ...meta } = row
    return meta
  },
  /** Load the zip blob for a project, or null if not cached. */
  async load(id: string): Promise<{ blob: Blob; meta: ProjectMeta } | null> {
    if (!isAvailable()) return null
    const store = await tx('readonly')
    const row = (await reqToPromise(store.get(id))) as ProjectRow | undefined
    if (!row) return null
    const { blob, ...meta } = row
    return { blob, meta }
  },
  /**
   * Upsert a project. `createdAt` is preserved if the row already
   * exists — only the caller's `name` / `blob` and `updatedAt`
   * change.
   */
  async save(id: string, name: string, blob: Blob, formatVersion = 1): Promise<void> {
    if (!isAvailable()) return
    const writeStore = await tx('readwrite')
    const existing = (await reqToPromise(writeStore.get(id))) as ProjectRow | undefined
    const now = Date.now()
    const row: ProjectRow = {
      id,
      name,
      blob,
      updatedAt: now,
      createdAt: existing?.createdAt ?? now,
      formatVersion,
      size: blob.size,
    }
    await reqToPromise(writeStore.put(row))
  },
  async rename(id: string, name: string): Promise<void> {
    if (!isAvailable()) return
    const store = await tx('readwrite')
    const row = (await reqToPromise(store.get(id))) as ProjectRow | undefined
    if (!row) return
    row.name = name
    row.updatedAt = Date.now()
    await reqToPromise(store.put(row))
  },
  async delete(id: string): Promise<void> {
    if (!isAvailable()) return
    const store = await tx('readwrite')
    await reqToPromise(store.delete(id))
  },
  async clearAll(): Promise<void> {
    if (!isAvailable()) return
    const store = await tx('readwrite')
    await reqToPromise(store.clear())
  },
  /** Total bytes used by this DB (best-effort via storage estimate). */
  async storageEstimate(): Promise<{ usage: number; quota: number } | null> {
    if (!isAvailable() || !navigator.storage?.estimate) return null
    const est = await navigator.storage.estimate()
    return { usage: est.usage ?? 0, quota: est.quota ?? 0 }
  },
}
