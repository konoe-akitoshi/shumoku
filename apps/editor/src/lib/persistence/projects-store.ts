// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Link, Node, Subgraph } from '@shumoku/core'
import { rehydrateEntity, serializeEntity } from '../state/assets.svelte'
import type { Product, Scene } from '../types'
import type { ProjectSnapshot } from '../undo.svelte'
import { ENTITY_STORES, getAllByProject, isAvailable, reqToPromise, STORES, withTxn } from './idb'

// Project metadata + per-project entity CRUD. The whole-zip-blob
// row is gone (v1 schema); each entity now has its own row keyed
// by [projectId, id]. Loads are one ranged getAll per kind; commit
// sync writes only the entities that actually changed (see sync.ts).

export interface ProjectMeta {
  id: string
  name: string
  settings?: Record<string, unknown>
  formatVersion: number
  createdAt: number
  updatedAt: number
}

export interface ProjectSummary extends ProjectMeta {
  /** Best-effort byte estimate based on JSON serialization of rows. */
  size: number
  entityCount: number
}

interface NodeRow {
  projectId: string
  id: string
  data: Node
}
interface SubgraphRow {
  projectId: string
  id: string
  data: Subgraph
}
interface LinkRow {
  projectId: string
  id: string
  data: Link
}
interface ProductRow {
  projectId: string
  id: string
  data: Product
}
interface SceneRow {
  projectId: string
  id: string
  data: Scene
}
export interface AssetRow {
  projectId: string
  hash: string
  ext: string
  blob: Blob
}

export const projectsDb = {
  async list(): Promise<ProjectSummary[]> {
    if (!isAvailable()) return []
    try {
      const allStores = [STORES.projects, ...ENTITY_STORES.map((k) => STORES[k])]
      return await withTxn(allStores, 'readonly', async (txn) => {
        const projects = (await reqToPromise(
          txn.objectStore(STORES.projects).getAll(),
        )) as ProjectMeta[]
        // Cheap-ish entity count + JSON size estimate per project
        // by iterating each kind once.
        const tallies = new Map<string, { count: number; size: number }>()
        for (const meta of projects) tallies.set(meta.id, { count: 0, size: 0 })
        for (const kind of ENTITY_STORES) {
          const store = txn.objectStore(STORES[kind])
          const rows = (await reqToPromise(store.getAll())) as Array<{
            projectId: string
            data: unknown
          }>
          for (const row of rows) {
            const t = tallies.get(row.projectId)
            if (!t) continue
            t.count++
            t.size += JSON.stringify(row.data).length
          }
        }
        return projects
          .map((p) => {
            const t = tallies.get(p.id) ?? { count: 0, size: 0 }
            return { ...p, size: t.size, entityCount: t.count }
          })
          .sort((a, b) => b.updatedAt - a.updatedAt)
      })
    } catch {
      return []
    }
  },

  async getMeta(id: string): Promise<ProjectMeta | null> {
    if (!isAvailable()) return null
    return await withTxn([STORES.projects], 'readonly', async (txn) => {
      const store = txn.objectStore(STORES.projects)
      const row = (await reqToPromise(store.get(id))) as ProjectMeta | undefined
      return row ?? null
    })
  },

  async upsertMeta(meta: ProjectMeta): Promise<void> {
    if (!isAvailable()) return
    await withTxn([STORES.projects], 'readwrite', (txn) => {
      txn.objectStore(STORES.projects).put(meta)
    })
  },

  async rename(id: string, name: string): Promise<void> {
    if (!isAvailable()) return
    await withTxn([STORES.projects], 'readwrite', async (txn) => {
      const store = txn.objectStore(STORES.projects)
      const row = (await reqToPromise(store.get(id))) as ProjectMeta | undefined
      if (!row) return
      row.name = name
      row.updatedAt = Date.now()
      store.put(row)
    })
  },

  /**
   * Load a project's entities into a ProjectSnapshot. Returns null
   * if the project isn't cached. One transaction across all entity
   * stores, one ranged getAll per kind.
   */
  async loadSnapshot(
    projectId: string,
  ): Promise<{ meta: ProjectMeta; snapshot: ProjectSnapshot } | null> {
    if (!isAvailable()) return null
    return await withTxn(
      [STORES.projects, ...ENTITY_STORES.map((k) => STORES[k])],
      'readonly',
      async (txn) => {
        const meta = (await reqToPromise(txn.objectStore(STORES.projects).get(projectId))) as
          | ProjectMeta
          | undefined
        if (!meta) return null
        const [nodes, subgraphs, links, products, scenes] = await Promise.all([
          getAllByProject<NodeRow>(txn.objectStore(STORES.nodes), projectId),
          getAllByProject<SubgraphRow>(txn.objectStore(STORES.subgraphs), projectId),
          getAllByProject<LinkRow>(txn.objectStore(STORES.links), projectId),
          getAllByProject<ProductRow>(txn.objectStore(STORES.products), projectId),
          getAllByProject<SceneRow>(txn.objectStore(STORES.scenes), projectId),
        ])
        // Rehydrate `asset:` refs back to live blob URLs (caller
        // must have populated AssetStore from per-project asset
        // rows first).
        return {
          meta,
          snapshot: {
            nodes: nodes.map((r) => [r.id, rehydrateEntity(r.data)] as [string, Node]),
            subgraphs: subgraphs.map((r) => [r.id, rehydrateEntity(r.data)] as [string, Subgraph]),
            links: links.map((r) => rehydrateEntity(r.data)),
            products: products.map((r) => rehydrateEntity(r.data)),
            scenes: scenes.map((r) => rehydrateEntity(r.data)),
          },
        }
      },
    )
  },

  /**
   * Replace every entity row for `projectId` with the given snapshot.
   * Used on import (where the whole project lands at once) and as a
   * fallback if commit-time sync ever falls behind.
   */
  async writeSnapshot(meta: ProjectMeta, snapshot: ProjectSnapshot): Promise<void> {
    if (!isAvailable()) return
    await withTxn(
      [STORES.projects, ...ENTITY_STORES.map((k) => STORES[k])],
      'readwrite',
      async (txn) => {
        txn.objectStore(STORES.projects).put(meta)
        for (const kind of ENTITY_STORES) {
          await clearByProject(txn.objectStore(STORES[kind]), meta.id)
        }
        // Serialize blob URLs → `asset:` refs so rows survive a
        // page reload (in-memory blob URLs die with the session).
        for (const [id, n] of snapshot.nodes)
          txn.objectStore(STORES.nodes).put({ projectId: meta.id, id, data: serializeEntity(n) })
        for (const [id, sg] of snapshot.subgraphs)
          txn
            .objectStore(STORES.subgraphs)
            .put({ projectId: meta.id, id, data: serializeEntity(sg) })
        for (const link of snapshot.links) {
          // Idless legacy links aren't persistable; the composer
          // always assigns an id when creating them, so this only
          // skips degenerate input.
          if (!link.id) continue
          txn
            .objectStore(STORES.links)
            .put({ projectId: meta.id, id: link.id, data: serializeEntity(link) })
        }
        for (const product of snapshot.products)
          txn
            .objectStore(STORES.products)
            .put({ projectId: meta.id, id: product.id, data: serializeEntity(product) })
        for (const scene of snapshot.scenes)
          txn
            .objectStore(STORES.scenes)
            .put({ projectId: meta.id, id: scene.id, data: serializeEntity(scene) })
      },
    )
  },

  async deleteProject(id: string): Promise<void> {
    if (!isAvailable()) return
    await withTxn(
      [STORES.projects, ...ENTITY_STORES.map((k) => STORES[k]), STORES.assets],
      'readwrite',
      async (txn) => {
        txn.objectStore(STORES.projects).delete(id)
        for (const kind of ENTITY_STORES) {
          await clearByProject(txn.objectStore(STORES[kind]), id)
        }
        await clearByProject(txn.objectStore(STORES.assets), id)
      },
    )
  },

  async clearAll(): Promise<void> {
    if (!isAvailable()) return
    await withTxn(
      [STORES.projects, ...ENTITY_STORES.map((k) => STORES[k]), STORES.assets],
      'readwrite',
      (txn) => {
        txn.objectStore(STORES.projects).clear()
        for (const kind of ENTITY_STORES) txn.objectStore(STORES[kind]).clear()
        txn.objectStore(STORES.assets).clear()
      },
    )
  },

  // ----- assets -----------------------------------------------------------

  async putAsset(projectId: string, hash: string, ext: string, blob: Blob): Promise<void> {
    if (!isAvailable()) return
    await withTxn([STORES.assets], 'readwrite', (txn) => {
      txn.objectStore(STORES.assets).put({ projectId, hash, ext, blob })
    })
  },

  async getAssets(projectId: string): Promise<AssetRow[]> {
    if (!isAvailable()) return []
    return await withTxn([STORES.assets], 'readonly', async (txn) => {
      return await getAllByProject<AssetRow>(txn.objectStore(STORES.assets), projectId)
    })
  },

  async storageEstimate(): Promise<{ usage: number; quota: number } | null> {
    if (!isAvailable() || !navigator.storage?.estimate) return null
    const est = await navigator.storage.estimate()
    return { usage: est.usage ?? 0, quota: est.quota ?? 0 }
  },
}

async function clearByProject(store: IDBObjectStore, projectId: string): Promise<void> {
  const idx = store.index('projectId')
  // Use a cursor over the index so we get the composite primary key
  // — IDB has no "delete by index value" shortcut.
  await new Promise<void>((resolve, reject) => {
    const cursorReq = idx.openCursor(IDBKeyRange.only(projectId))
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result
      if (!cursor) return resolve()
      store.delete(cursor.primaryKey)
      cursor.continue()
    }
    cursorReq.onerror = () => reject(cursorReq.error)
  })
}
