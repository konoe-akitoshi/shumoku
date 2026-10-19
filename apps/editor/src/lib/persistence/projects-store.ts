// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import {
  fromNetworkGraph,
  type NetworkGraph,
  type NetworkModel,
  type Termination,
} from '@shumoku/core'
import { rehydrateEntity, serializeEntity } from '../state/assets.svelte'
import type { Product, Scene } from '../types'
import { type GraphPresentation, parseGraphPresentation } from './graph-presentation'
import { ENTITY_STORES, getAllByProject, isAvailable, reqToPromise, STORES, withTxn } from './idb'
import { decodeNodeRow, type NodeRow } from './node-row'
import { decodeLinkRow, decodeSubgraphRow, type LinkRow, type SubgraphRow } from './style-rows'

// Project metadata, and each project as one document in the shape its
// file has: the network model with the products and scenes beside it.
// A commit writes the whole document; editor projects are small enough
// that this costs less than keeping rows of a second shape in step.

export interface ProjectMeta {
  /** Graph settings of the one-row-per-entity layout; read only to move a project. */
  diagramPresentation?: GraphPresentation
  id: string
  name: string
  settings?: Record<string, unknown>
  formatVersion: number
  createdAt: number
  updatedAt: number
}

/** A project as kept: its network, and the products and scenes beside it. */
export interface ProjectDocument {
  model: NetworkModel
  products: Product[]
  scenes: Scene[]
}

export interface ProjectSummary extends ProjectMeta {
  /** Best-effort byte estimate based on JSON serialization of the document. */
  size: number
  entityCount: number
}

interface DocumentRow extends ProjectDocument {
  projectId: string
}

export interface AssetRow {
  projectId: string
  hash: string
  ext: string
  blob: Blob
}

const LEGACY_STORES = ENTITY_STORES.map((k) => STORES[k])

export const projectsDb = {
  async list(): Promise<ProjectSummary[]> {
    if (!isAvailable()) return []
    try {
      return await withTxn([STORES.projects, STORES.documents], 'readonly', async (txn) => {
        const projects = (await reqToPromise(
          txn.objectStore(STORES.projects).getAll(),
        )) as ProjectMeta[]
        const documents = (await reqToPromise(
          txn.objectStore(STORES.documents).getAll(),
        )) as DocumentRow[]
        const byProject = new Map(documents.map((d) => [d.projectId, d]))
        return projects
          .map((p) => {
            const doc = byProject.get(p.id)
            const config = doc?.model.config
            return {
              ...p,
              size: doc ? JSON.stringify(doc).length : 0,
              entityCount: (config?.nodes.length ?? 0) + (config?.links.length ?? 0),
            }
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
   * Load a project's document, with `asset:` refs turned back into live blob URLs (the
   * caller must have put the project's assets into the AssetStore first). A project still
   * in the one-row-per-entity layout is moved into its document here.
   */
  async loadDocument(
    projectId: string,
  ): Promise<{ meta: ProjectMeta; document: ProjectDocument } | null> {
    if (!isAvailable()) return null
    const stored = await withTxn(
      [STORES.projects, STORES.documents, ...LEGACY_STORES],
      'readwrite',
      async (txn) => {
        const meta = (await reqToPromise(txn.objectStore(STORES.projects).get(projectId))) as
          | ProjectMeta
          | undefined
        if (!meta) return null
        const row = (await reqToPromise(txn.objectStore(STORES.documents).get(projectId))) as
          | DocumentRow
          | undefined
        if (row) return { meta, document: row as ProjectDocument }
        const document = await readEntityRows(txn, meta)
        const { diagramPresentation: _, ...current } = meta
        txn.objectStore(STORES.projects).put(current)
        txn.objectStore(STORES.documents).put({ projectId, ...document })
        for (const store of LEGACY_STORES) await clearByProject(txn.objectStore(store), projectId)
        return { meta: current, document }
      },
    )
    if (!stored) return null
    const { model, products, scenes } = stored.document
    return {
      meta: stored.meta,
      document: {
        model: rehydrateEntity(model),
        products: products.map((p) => rehydrateEntity(p)),
        scenes: scenes.map((s) => rehydrateEntity(s)),
      },
    }
  },

  /** Write a project's document, and its metadata when given. */
  async saveDocument(projectId: string, document: ProjectDocument, meta?: ProjectMeta) {
    if (!isAvailable()) return
    // Serialize blob URLs → `asset:` refs so the row survives a page reload.
    const row: DocumentRow = {
      projectId,
      model: serializeEntity(document.model),
      products: document.products.map((p) => serializeEntity(p)),
      scenes: document.scenes.map((s) => serializeEntity(s)),
    }
    await withTxn([STORES.projects, STORES.documents], 'readwrite', async (txn) => {
      const projects = txn.objectStore(STORES.projects)
      const current =
        meta ?? ((await reqToPromise(projects.get(projectId))) as ProjectMeta | undefined)
      if (current) projects.put({ ...current, updatedAt: Date.now() })
      txn.objectStore(STORES.documents).put(row)
    })
  },

  async deleteProject(id: string): Promise<void> {
    if (!isAvailable()) return
    await withTxn(
      [STORES.projects, STORES.documents, ...LEGACY_STORES, STORES.assets],
      'readwrite',
      async (txn) => {
        txn.objectStore(STORES.projects).delete(id)
        txn.objectStore(STORES.documents).delete(id)
        for (const store of LEGACY_STORES) await clearByProject(txn.objectStore(store), id)
        await clearByProject(txn.objectStore(STORES.assets), id)
      },
    )
  },

  async clearAll(): Promise<void> {
    if (!isAvailable()) return
    const stores = [STORES.projects, STORES.documents, ...LEGACY_STORES, STORES.assets]
    await withTxn(stores, 'readwrite', (txn) => {
      for (const store of stores) txn.objectStore(store).clear()
    })
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

/** A project kept one row per graph entity (DB v2-v6), as the document it becomes. */
async function readEntityRows(txn: IDBTransaction, meta: ProjectMeta): Promise<ProjectDocument> {
  const [nodes, subgraphs, links, products, scenes, terminations] = await Promise.all([
    getAllByProject<NodeRow>(txn.objectStore(STORES.nodes), meta.id),
    getAllByProject<SubgraphRow>(txn.objectStore(STORES.subgraphs), meta.id),
    getAllByProject<LinkRow>(txn.objectStore(STORES.links), meta.id),
    getAllByProject<{ data: Product }>(txn.objectStore(STORES.products), meta.id),
    getAllByProject<{ data: Scene }>(txn.objectStore(STORES.scenes), meta.id),
    getAllByProject<{ data: Termination }>(txn.objectStore(STORES.terminations), meta.id),
  ])
  const settings = parseGraphPresentation(meta.diagramPresentation).settings
  const graph: NetworkGraph = {
    version: '1',
    nodes: nodes.map(decodeNodeRow),
    links: links.map(decodeLinkRow),
    subgraphs: subgraphs.map(decodeSubgraphRow),
    ...(terminations.length > 0 && { terminations: terminations.map((r) => r.data) }),
    ...(settings && { settings }),
  }
  return {
    model: fromNetworkGraph(graph),
    products: products.map((r) => r.data),
    scenes: scenes.map((r) => r.data),
  }
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
