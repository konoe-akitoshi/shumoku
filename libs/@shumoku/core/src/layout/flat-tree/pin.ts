// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Pinned-position post-process.
 *
 * After the engine produces a layout, this pass snaps each
 * pinned node to its caller-specified position. To keep the
 * surrounding subgraph hull faithful, we shift every node in
 * the pinned node's subgraph by the same delta — so a pinned
 * member drags its group along with it. Other subgraphs are
 * left alone.
 *
 * This is the simplest faithful approach for the "user drags a
 * node, the rest of the layout stays put" UX. More advanced
 * (per-node shift + neighbour relaxation) isn't worth it until
 * we have a real incremental-edit story.
 */

import type { NetworkGraph } from '../../models/types.js'
import type { Position } from './types.js'

/**
 * Apply pinned positions in place. For each `(nodeId, target)`
 * in `pins`, shift the node's subgraph cluster by
 * `target - currentPosition`. Subgraphs without any pinned
 * member stay put. Pinned nodes outside any subgraph shift
 * only themselves.
 */
export function applyPinnedPositions(
  graph: NetworkGraph,
  pins: ReadonlyMap<string, Position>,
  nodePositions: Map<string, Position>,
): void {
  if (pins.size === 0) return

  // Group every node by its subgraph (or null for top-level).
  const subgraphOf = new Map<string, string | null>()
  for (const n of graph.nodes) subgraphOf.set(n.id, n.parent ?? null)

  const membersBySubgraph = new Map<string | null, string[]>()
  for (const n of graph.nodes) {
    const sg = subgraphOf.get(n.id) ?? null
    const list = membersBySubgraph.get(sg) ?? []
    list.push(n.id)
    membersBySubgraph.set(sg, list)
  }

  // For each pinned subgraph, choose the *first* pin as the
  // anchor (deterministic). Multiple pins in the same subgraph
  // would conflict; we honour the first and surface the rest
  // as diagnostics (caller can detect by checking final
  // positions).
  const subgraphShift = new Map<string, Position>()
  const standaloneShifts: Array<{ id: string; shift: Position }> = []
  for (const [nodeId, target] of pins) {
    const current = nodePositions.get(nodeId)
    if (!current) continue
    const dx = target.x - current.x
    const dy = target.y - current.y
    const sg = subgraphOf.get(nodeId)
    if (sg) {
      if (!subgraphShift.has(sg)) subgraphShift.set(sg, { x: dx, y: dy })
    } else {
      standaloneShifts.push({ id: nodeId, shift: { x: dx, y: dy } })
    }
  }

  for (const [sg, shift] of subgraphShift) {
    for (const memberId of membersBySubgraph.get(sg) ?? []) {
      const p = nodePositions.get(memberId)
      if (!p) continue
      nodePositions.set(memberId, { x: p.x + shift.x, y: p.y + shift.y })
    }
  }
  for (const { id, shift } of standaloneShifts) {
    const p = nodePositions.get(id)
    if (!p) continue
    nodePositions.set(id, { x: p.x + shift.x, y: p.y + shift.y })
  }
}
