// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Subgraph hull computation.
 *
 * Each subgraph rectangle is computed as a post-process bbox
 * around its member nodes (and the hulls of any nested
 * subgraphs). Subgraphs aren't layout containers in this
 * engine — they're visual groupings that emerge from the
 * member positions chosen by the outer tidy-tree.
 *
 * The hull extends `padding` beyond the tight member bbox on
 * every side, plus `labelHeight` on the top for the subgraph
 * label. Nested subgraphs are computed bottom-up so an outer
 * subgraph's hull covers its child hulls plus its directly-
 * owned member nodes.
 */

import type { Bounds, NetworkGraph } from '../../models/types.js'
import type { Position, Size } from './types.js'

/**
 * Compute one `Bounds` rectangle per subgraph. Recursive:
 * nested subgraphs are computed first, then the outer subgraph
 * sees both its direct members and the child hulls.
 *
 * Empty subgraphs (no member nodes and no nested subgraphs)
 * are omitted from the result.
 */
export function computeSubgraphHulls(
  graph: NetworkGraph,
  nodePositions: Map<string, Position>,
  sizeById: Map<string, Size>,
  padding: number,
  labelHeight: number,
): Map<string, Bounds> {
  const memberNodes = groupMemberNodes(graph)
  const memberSubgraphs = groupMemberSubgraphs(graph)

  const hulls = new Map<string, Bounds>()
  const compute = (sgId: string): Bounds | null => {
    const cached = hulls.get(sgId)
    if (cached) return cached
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    let any = false

    for (const nodeId of memberNodes.get(sgId) ?? []) {
      const pos = nodePositions.get(nodeId)
      const size = sizeById.get(nodeId)
      if (!pos || !size) continue
      any = true
      minX = Math.min(minX, pos.x - size.width / 2)
      minY = Math.min(minY, pos.y - size.height / 2)
      maxX = Math.max(maxX, pos.x + size.width / 2)
      maxY = Math.max(maxY, pos.y + size.height / 2)
    }

    for (const childSgId of memberSubgraphs.get(sgId) ?? []) {
      const inner = compute(childSgId)
      if (!inner) continue
      any = true
      minX = Math.min(minX, inner.x)
      minY = Math.min(minY, inner.y)
      maxX = Math.max(maxX, inner.x + inner.width)
      maxY = Math.max(maxY, inner.y + inner.height)
    }

    if (!any) return null
    const bounds: Bounds = {
      x: minX - padding,
      y: minY - padding - labelHeight,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2 + labelHeight,
    }
    hulls.set(sgId, bounds)
    return bounds
  }

  for (const s of graph.subgraphs ?? []) compute(s.id)
  return hulls
}

function groupMemberNodes(graph: NetworkGraph): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const n of graph.nodes) {
    if (!n.parent) continue
    const list = out.get(n.parent) ?? []
    list.push(n.id)
    out.set(n.parent, list)
  }
  return out
}

function groupMemberSubgraphs(graph: NetworkGraph): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const s of graph.subgraphs ?? []) {
    if (!s.parent) continue
    const list = out.get(s.parent) ?? []
    list.push(s.id)
    out.set(s.parent, list)
  }
  return out
}
