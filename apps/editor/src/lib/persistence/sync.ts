// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Link, Node, Subgraph, Termination } from '@shumoku/core'
import { serializeEntity } from '../state/assets.svelte'
import type { Product, Scene } from '../types'
import type { ProjectSnapshot } from '../undo.svelte'
import { ENTITY_STORES, isAvailable, STORES, withTxn } from './idb'

// Diff a "before" snapshot against an "after" snapshot and write
// only the entities that changed to IndexedDB. Replaces whole-zip
// rewrites with O(changed-rows) writes per commit so growing
// projects don't slow down with size.
//
// Identity check is reference equality. The editor's stores update
// immutably (always `{ ...prev, ...patch }`), so `before === after`
// is a sound "unchanged" predicate. Conservative false-positives
// just cost an idempotent IDB put.

type EntityCollections = {
  nodes: Map<string, Node>
  subgraphs: Map<string, Subgraph>
  links: Map<string, Link>
  products: Map<string, Product>
  scenes: Map<string, Scene>
  terminations: Map<string, Termination>
}

function indexBySnapshot(snap: ProjectSnapshot): EntityCollections {
  return {
    nodes: new Map(snap.nodes),
    subgraphs: new Map(snap.subgraphs),
    // Link.id is optional in core; idless links can't be persisted
    // distinctly so we drop them. The composer always assigns ids
    // through `newId('link')` for links it creates.
    links: new Map(
      snap.links
        .filter((l): l is Link & { id: string } => typeof l.id === 'string')
        .map((l) => [l.id, l] as const),
    ),
    products: new Map(snap.products.map((p) => [p.id, p] as const)),
    scenes: new Map(snap.scenes.map((s) => [s.id, s] as const)),
    terminations: new Map(snap.terminations.map((t) => [t.id, t] as const)),
  }
}

interface KindDiff<T> {
  upserts: Array<{ id: string; data: T }>
  deletes: string[]
}

function diffKind<T>(before: Map<string, T>, after: Map<string, T>): KindDiff<T> {
  const upserts: Array<{ id: string; data: T }> = []
  const deletes: string[] = []
  for (const [id, data] of after) {
    if (before.get(id) !== data) upserts.push({ id, data })
  }
  for (const id of before.keys()) {
    if (!after.has(id)) deletes.push(id)
  }
  return { upserts, deletes }
}

interface SnapshotDiff {
  nodes: KindDiff<Node>
  subgraphs: KindDiff<Subgraph>
  links: KindDiff<Link>
  products: KindDiff<Product>
  scenes: KindDiff<Scene>
  terminations: KindDiff<Termination>
}

export function diffSnapshots(before: ProjectSnapshot, after: ProjectSnapshot): SnapshotDiff {
  const b = indexBySnapshot(before)
  const a = indexBySnapshot(after)
  return {
    nodes: diffKind(b.nodes, a.nodes),
    subgraphs: diffKind(b.subgraphs, a.subgraphs),
    links: diffKind(b.links, a.links),
    products: diffKind(b.products, a.products),
    scenes: diffKind(b.scenes, a.scenes),
    terminations: diffKind(b.terminations, a.terminations),
  }
}

/** Total rows touched by a diff — useful for "is this a no-op?" early outs. */
export function diffSize(diff: SnapshotDiff): number {
  let n = 0
  for (const k of ENTITY_STORES) {
    const d = diff[k]
    n += d.upserts.length + d.deletes.length
  }
  return n
}

export interface SyncResult {
  changed: number
  ms: number
}

/**
 * Apply a diff to IndexedDB. Single transaction across all entity
 * stores so the project's view is atomic on read. The `projects`
 * row's `updatedAt` is bumped in the same txn so the home-page
 * "Recent" sort reflects every sync.
 */
export async function applySync(projectId: string, diff: SnapshotDiff): Promise<SyncResult> {
  if (!isAvailable()) return { changed: 0, ms: 0 }
  const start = performance.now()
  const total = diffSize(diff)
  if (total === 0) {
    // Even no-op commits should refresh updatedAt — but only if a
    // project row exists; sample / detached projects skip.
    return { changed: 0, ms: 0 }
  }
  await withTxn(
    [STORES.projects, ...ENTITY_STORES.map((k) => STORES[k])],
    'readwrite',
    async (txn) => {
      const writers = {
        nodes: txn.objectStore(STORES.nodes),
        subgraphs: txn.objectStore(STORES.subgraphs),
        links: txn.objectStore(STORES.links),
        products: txn.objectStore(STORES.products),
        scenes: txn.objectStore(STORES.scenes),
        terminations: txn.objectStore(STORES.terminations),
      }
      for (const kind of ENTITY_STORES) {
        const store = writers[kind]
        for (const u of diff[kind].upserts) {
          // Serialize blob URLs → `asset:` refs so the row stays
          // valid across reloads (in-memory blob URLs die with the
          // page).
          store.put({ projectId, id: u.id, data: serializeEntity(u.data) })
        }
        for (const id of diff[kind].deletes) {
          store.delete([projectId, id])
        }
      }
      // Bump updatedAt on the project meta row in the same txn.
      const projectsStore = txn.objectStore(STORES.projects)
      const metaReq = projectsStore.get(projectId)
      await new Promise<void>((resolve, reject) => {
        metaReq.onsuccess = () => {
          const meta = metaReq.result as
            | {
                id: string
                name: string
                settings?: Record<string, unknown>
                formatVersion: number
                createdAt: number
                updatedAt: number
              }
            | undefined
          if (meta) {
            meta.updatedAt = Date.now()
            projectsStore.put(meta)
          }
          resolve()
        }
        metaReq.onerror = () => reject(metaReq.error)
      })
    },
  )
  return { changed: total, ms: performance.now() - start }
}
