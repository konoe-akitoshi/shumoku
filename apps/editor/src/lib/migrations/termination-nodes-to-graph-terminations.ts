// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Lift EPS / Outlet / Panel waypoints out of `NetworkGraph.nodes`
 * into `NetworkGraph.terminations`.
 *
 * Historical context: physical cabling terminations were modelled
 * as `Node`s with `termination.role` so they could ride Svelte
 * Flow's drag/select machinery alongside real devices. The cost
 * was that every consumer of `nodes` had to either filter them
 * out (BOM "Equipment", JSON export, diagram view) or pretend they
 * were devices.
 *
 * They're not devices — they're passive routing waypoints with
 * identity. Mirroring the bend refactor, this migration moves them
 * to their own collection. `Link.via` keeps referencing them by id.
 * The scene canvas synthesizes draggable sf nodes from the
 * `terminations` array so the user-facing UX is unchanged.
 *
 * Idempotent — calling it on an already-migrated graph is a no-op.
 */

import type { Node, Termination } from '@shumoku/core'
import type { Scene } from '../types'

export interface TerminationMigrationStats {
  /** Termination Nodes removed from `nodes`. */
  nodesRemoved: number
  /** New `Termination` entries pushed into `terminations`. */
  terminationsAdded: number
}

const TERMINATION_ROLES = new Set(['eps', 'outlet', 'panel'])

export function migrateTerminationNodesToGraphTerminations(args: {
  nodes: Map<string, Node>
  terminations: Termination[]
  /**
   * Scenes are consulted to recover the termination's coordinates —
   * `placeNodeInScene` only ever wrote to `scene.nodePlacements`,
   * never to `node.position`, so without this hint every legacy
   * termination would land at (0, 0).
   */
  scenes?: Scene[]
}): TerminationMigrationStats {
  const { nodes, terminations, scenes } = args
  const stats: TerminationMigrationStats = { nodesRemoved: 0, terminationsAdded: 0 }

  const termNodeIds: string[] = []
  for (const [id, node] of nodes) {
    if (node.termination?.role && TERMINATION_ROLES.has(node.termination.role)) {
      termNodeIds.push(id)
    }
  }
  if (termNodeIds.length === 0) return stats

  // First-seen scene placement per node id — terminations placed
  // in multiple scenes collapse to whichever scene appears first.
  const placementById = new Map<string, { x: number; y: number }>()
  for (const scene of scenes ?? []) {
    for (const p of scene.nodePlacements ?? []) {
      if (placementById.has(p.nodeId)) continue
      placementById.set(p.nodeId, p.position)
    }
  }

  const existingIds = new Set(terminations.map((t) => t.id))

  for (const id of termNodeIds) {
    const node = nodes.get(id)
    if (!node) continue
    nodes.delete(id)
    stats.nodesRemoved++
    if (existingIds.has(id)) continue // already migrated
    const role = node.termination?.role
    if (role !== 'eps' && role !== 'outlet' && role !== 'panel') continue
    const label = Array.isArray(node.label)
      ? (node.label[0] ?? id)
      : typeof node.label === 'string'
        ? node.label
        : id
    const pos = placementById.get(id) ?? node.position
    terminations.push({
      id,
      role,
      label,
      position: pos ? { x: pos.x, y: pos.y } : undefined,
    })
    stats.terminationsAdded++
  }

  // Strip the now-orphan scene placements so the next save is clean.
  if (scenes) {
    const ids = new Set(termNodeIds)
    for (const scene of scenes) {
      if (!scene.nodePlacements?.length) continue
      scene.nodePlacements = scene.nodePlacements.filter((p) => !ids.has(p.nodeId))
    }
  }

  return stats
}
