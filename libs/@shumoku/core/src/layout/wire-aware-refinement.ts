// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Wire-aware refinement.
 *
 * After the geometric layout (positions + initial port sides),
 * sample each edge's bezier path and detect overlaps with
 * non-endpoint nodes / non-endpoint subgraph hulls. For each
 * conflict, pick a new source-port side that gives a clear path
 * out of the source's subgraph; the caller then re-places ports
 * with these overrides and re-routes the affected edges. The
 * caller can iterate (positions are unchanged so the loop is
 * cheap) until no conflicts remain.
 *
 * The classic conflict: a switch inside a vertical-chain
 * subgraph emits a downlink to a node *below* the entire
 * subgraph. With its default bottom port, the bezier passes
 * through the chain's other members. Moving the port to a side
 * (left/right) lets the wire exit laterally and clear the
 * chain.
 */

import type { Bounds, Link, Node, Subgraph } from '../models/types.js'
import type { Side } from './port-placement.js'
import type { ResolvedEdge, ResolvedPort } from './resolved-types.js'

/** Number of points along each bezier we test for obstacle overlap. */
const BEZIER_SAMPLES = 16

/**
 * Sample N points along the cubic bezier that the renderer
 * draws between two ports. We don't have access to the bezier-
 * path helper here without circular imports, so we approximate
 * the renderer's curve: control points sit on the outward
 * normal of each port at a distance proportional to the port-
 * to-port separation.
 */
function sampleBezier(
  from: ResolvedPort,
  to: ResolvedPort,
  count: number,
): Array<{ x: number; y: number }> {
  const fp = from.absolutePosition
  const tp = to.absolutePosition
  const dx = tp.x - fp.x
  const dy = tp.y - fp.y
  const dist = Math.hypot(dx, dy)
  const cpDist = Math.max(40, dist * 0.5)
  const normal = (side: Side): { x: number; y: number } => {
    if (side === 'top') return { x: 0, y: -1 }
    if (side === 'bottom') return { x: 0, y: 1 }
    if (side === 'left') return { x: -1, y: 0 }
    return { x: 1, y: 0 }
  }
  const fn = normal(from.side)
  const tn = normal(to.side)
  const c1 = { x: fp.x + fn.x * cpDist, y: fp.y + fn.y * cpDist }
  const c2 = { x: tp.x + tn.x * cpDist, y: tp.y + tn.y * cpDist }
  const samples: Array<{ x: number; y: number }> = []
  for (let i = 0; i <= count; i++) {
    const t = i / count
    const mt = 1 - t
    const x = mt ** 3 * fp.x + 3 * mt ** 2 * t * c1.x + 3 * mt * t ** 2 * c2.x + t ** 3 * tp.x
    const y = mt ** 3 * fp.y + 3 * mt ** 2 * t * c1.y + 3 * mt * t ** 2 * c2.y + t ** 3 * tp.y
    samples.push({ x, y })
  }
  return samples
}

/** Does `(x, y)` lie strictly inside the rectangle? */
function pointInRect(x: number, y: number, rect: Bounds): boolean {
  return x > rect.x && x < rect.x + rect.width && y > rect.y && y < rect.y + rect.height
}

/** Bounding box of a node at its centre position. */
function nodeBounds(node: Node): Bounds | null {
  if (!node.position || !node.size) return null
  return {
    x: node.position.x - node.size.width / 2,
    y: node.position.y - node.size.height / 2,
    width: node.size.width,
    height: node.size.height,
  }
}

/**
 * Walk the parent chain of `nodeId` (its subgraph and that
 * subgraph's parents, recursively) and return the set.
 */
function nodeAncestorSubgraphs(
  nodeId: string,
  nodes: Map<string, Node>,
  subgraphs: Map<string, Subgraph>,
): Set<string> {
  const out = new Set<string>()
  let cur: string | undefined = nodes.get(nodeId)?.parent
  while (cur) {
    if (out.has(cur)) break
    out.add(cur)
    cur = subgraphs.get(cur)?.parent
  }
  return out
}

export interface WireConflict {
  edgeId: string
  /** The edge's source port id (`nodeId:portId`). */
  sourcePortKey: string
  /** Side currently assigned to the source port. */
  sourceSide: Side
  /** Bounding box of the union of obstacles blocking this wire. */
  blocker: Bounds
  /** Source node (for choosing escape side). */
  sourceNode: Node
}

/**
 * Find edges whose default bezier passes through a node or
 * subgraph hull that is not an endpoint of the link. Returns
 * one conflict per affected edge (multiple blockers per edge
 * get merged into one bounding box for the route decision).
 */
export function detectWireConflicts(
  edges: Map<string, ResolvedEdge>,
  nodes: Map<string, Node>,
  subgraphs: Map<string, Subgraph>,
): WireConflict[] {
  const out: WireConflict[] = []
  for (const edge of edges.values()) {
    if (edge.route) continue // bus routes already explicit
    const samples = sampleBezier(edge.fromPort, edge.toPort, BEZIER_SAMPLES)
    // Allow the segment to enter the source's & target's own
    // subgraph ancestry without flagging it as a conflict.
    const sourceAncestors = nodeAncestorSubgraphs(edge.fromNodeId, nodes, subgraphs)
    const targetAncestors = nodeAncestorSubgraphs(edge.toNodeId, nodes, subgraphs)
    let merged: Bounds | null = null
    const grow = (rect: Bounds) => {
      if (!merged) {
        merged = { ...rect }
      } else {
        const left = Math.min(merged.x, rect.x)
        const top = Math.min(merged.y, rect.y)
        const right = Math.max(merged.x + merged.width, rect.x + rect.width)
        const bottom = Math.max(merged.y + merged.height, rect.y + rect.height)
        merged = { x: left, y: top, width: right - left, height: bottom - top }
      }
    }
    // Non-endpoint node bboxes.
    for (const [nodeId, node] of nodes) {
      if (nodeId === edge.fromNodeId || nodeId === edge.toNodeId) continue
      const bbox = nodeBounds(node)
      if (!bbox) continue
      for (const s of samples) {
        if (pointInRect(s.x, s.y, bbox)) {
          grow(bbox)
          break
        }
      }
    }
    // Non-endpoint subgraph hulls. Exclude ancestors of either
    // endpoint — those *are* legitimately crossed.
    for (const [sgId, sg] of subgraphs) {
      if (sourceAncestors.has(sgId) || targetAncestors.has(sgId)) continue
      if (!sg.bounds) continue
      for (const s of samples) {
        if (pointInRect(s.x, s.y, sg.bounds)) {
          grow(sg.bounds)
          break
        }
      }
    }
    if (merged) {
      const sourceNode = nodes.get(edge.fromNodeId)
      if (!sourceNode) continue
      out.push({
        edgeId: edge.id,
        sourcePortKey: edge.fromPortId,
        sourceSide: edge.fromPort.side,
        blocker: merged,
        sourceNode,
      })
    }
  }
  return out
}

/**
 * For a conflicting edge, pick a new source-port side that
 * gives a clear path to the target. The heuristic:
 *
 *   - If the blocker is roughly aligned along the current
 *     outward axis (current side is bottom / top, blocker
 *     spans the same x), swap to the side (left or right) that
 *     has less obstacle width in the way.
 *   - If the blocker is roughly horizontal (current side is
 *     left/right), swap to top/bottom analogously.
 *
 * Returns null when no clearly better side exists (the caller
 * should leave the original side alone in that case).
 */
export function pickEscapeSide(conflict: WireConflict): Side | null {
  const { sourceNode, blocker, sourceSide } = conflict
  if (!sourceNode.position) return null
  const sx = sourceNode.position.x
  const blockerCenter = blocker.x + blocker.width / 2
  if (sourceSide === 'bottom' || sourceSide === 'top') {
    // Escape sideways. Prefer the side where blocker doesn't
    // extend (or extends less). If the blocker centre sits to
    // the right of the source, go left; vice versa. Mostly
    // symmetric blockers default to right.
    if (blockerCenter > sx) return 'left'
    return 'right'
  }
  // Current is a side port. Try top or bottom — go in the
  // direction that takes us away from the target's row first.
  // Conservative: keep as-is.
  return null
}

/** Build a side-override map from a list of conflicts. */
export function buildSideOverrides(conflicts: readonly WireConflict[]): Map<string, Side> {
  const out = new Map<string, Side>()
  for (const c of conflicts) {
    const next = pickEscapeSide(c)
    if (next && next !== c.sourceSide) out.set(c.sourcePortKey, next)
  }
  return out
}

/** No-op marker for callers that want to skip refinement entirely. */
export function refineNothing(_links: readonly Link[]): Map<string, Side> {
  return new Map()
}
