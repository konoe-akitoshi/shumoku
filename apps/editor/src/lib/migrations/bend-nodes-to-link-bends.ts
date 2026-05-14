// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Lift drawing-only bend waypoints out of `NetworkGraph.nodes` and
 * `Link.via` into `Link.bends`.
 *
 * Historical context: bends were first modelled as anonymous control
 * points on `Scene.wireRoutes`. A prior migration moved them into
 * `Link.via` as full `Node` entries (with `termination.role = 'bend'`)
 * to reuse the Svelte Flow node infrastructure for drag / select /
 * undo. That worked but leaked the abstraction: bends — pure visual
 * waypoints with no logical meaning — started polluting BOM, JSON
 * export, Connections view, and every consumer that filtered `nodes`.
 *
 * This migration finishes the journey: bends move to a dedicated
 * `Link.bends` array on the link record itself, the bend Nodes are
 * deleted from `nodes`, and `via` becomes a terminations-only chain
 * (EPS / Outlet / Panel) again. The scene canvas re-synthesizes
 * draggable bend handles from `Link.bends` at render time so the
 * UX is unchanged.
 *
 * Idempotent — calling it on an already-migrated graph is a no-op.
 */

import type { Link, NetworkGraph, Node } from '@shumoku/core'

export interface BendMigrationStats {
  /** Bend Nodes removed from `nodes`. */
  nodesRemoved: number
  /** Links whose `via` chain had bends extracted. */
  linksTouched: number
  /** Bend entries written to `Link.bends` (= nodesRemoved when no orphans). */
  bendsAdded: number
}

/**
 * Apply the migration in-place. Accepts the runtime store shape
 * (Map<id, Node> + mutable Link[]) so it can run after the load
 * pipeline has already populated `diagram.nodes` / `diagram.links`
 * — including after `migrateLegacyWireRoutes`, which still produces
 * bend Nodes for ancient projects. Returns stats so the caller can
 * log how much it did.
 *
 * Mutations:
 *   - Removes every bend Node from `nodes`
 *   - For each link with bend ids in `via`: rewrites `via` to the
 *     terminations-only subset and appends extracted bends to
 *     `link.bends`
 */
export function migrateBendNodesToLinkBends(args: {
  nodes: Map<string, Node>
  links: Link[]
}): BendMigrationStats {
  const { nodes, links } = args
  const stats: BendMigrationStats = {
    nodesRemoved: 0,
    linksTouched: 0,
    bendsAdded: 0,
  }

  // Build a quick lookup of bend Nodes so the per-link walk avoids
  // repeating the termination probe.
  const bendNodeById = new Map<string, Node>()
  for (const [, node] of nodes) {
    if (node.termination?.role === 'bend') bendNodeById.set(node.id, node)
  }
  if (bendNodeById.size === 0) return stats

  const usedBendIds = new Set<string>()

  for (let i = 0; i < links.length; i++) {
    const link = links[i]
    if (!link?.via || link.via.length === 0) continue

    const nextVia: string[] = []
    const nextBends: NonNullable<Link['bends']> = link.bends ? [...link.bends] : []
    let extracted = false

    for (const id of link.via) {
      const bendNode = bendNodeById.get(id)
      if (!bendNode) {
        nextVia.push(id)
        continue
      }
      // `afterIndex` is the count of terminations that preceded this
      // bend in the original via — equal to the current length of
      // `nextVia` minus 1 (-1 means "before the first termination").
      const afterIndex = nextVia.length - 1
      const pos = bendNode.position ?? { x: 0, y: 0 }
      nextBends.push({ id: bendNode.id, x: pos.x, y: pos.y, afterIndex })
      usedBendIds.add(bendNode.id)
      extracted = true
    }

    if (extracted) {
      links[i] = {
        ...link,
        via: nextVia.length > 0 ? nextVia : undefined,
        bends: nextBends,
      }
      stats.linksTouched++
    }
  }
  stats.bendsAdded = usedBendIds.size

  // Drop every bend Node — even orphans not referenced by any link.
  // They were never legitimate logical entities; carrying them
  // forward is just clutter that other consumers have to filter.
  for (const [id] of bendNodeById) {
    nodes.delete(id)
    stats.nodesRemoved++
  }

  return stats
}

// Re-export NetworkGraph so the type lives at the module boundary —
// keeps consumers from reaching into core just for one type.
export type { NetworkGraph }
