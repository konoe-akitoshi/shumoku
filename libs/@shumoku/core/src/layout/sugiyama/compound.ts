// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Compound-graph (nested-subgraph) layout.
 *
 * Builds on the flat `layoutFlat` pipeline to handle graphs whose
 * "nodes" are themselves containers holding more nodes. The algorithm
 * runs **bottom-up**:
 *
 *   1. For each leaf-most subgraph, lay out its direct children with
 *      `layoutFlat` and measure the resulting bounds.
 *   2. Bubble up: the parent container treats each child subgraph as
 *      a single compound node with size = its measured bounds +
 *      padding + label height, and lays those out (alongside any leaf
 *      nodes at that level).
 *   3. Convert each compound node's "position" back into a subgraph
 *      bounds record, then shift all of its contents to match.
 *
 * This is the standard recursive-compound pattern from ELK / yFiles.
 * The tradeoff is that cross-container edges only influence layout
 * at the level where both endpoints are visible; edges escaping a
 * subgraph attach to the subgraph's compound node in the parent
 * level's layer graph. Works well when link density is mostly
 * intra-container, which is typical of network topologies.
 *
 * Cross-container edges are **not** laid out per-segment here; the
 * caller is expected to route them with an edge router (libavoid in
 * our stack) after this function returns positioned nodes/subgraphs.
 */

import type { Bounds, Position, Size } from '../../models/types.js'
import { layoutFlat, type SugiyamaOptions } from './compose.js'
import type { Edge, NodeId } from './types.js'

export interface CompoundNode {
  id: NodeId
  /** Parent container id, or undefined/null for the top level. */
  parent?: NodeId | null
  /**
   * Intrinsic size for *leaf* nodes. Ignored for subgraphs, which get
   * their size computed from their children's bounds.
   */
  size?: Size
}

export interface CompoundSubgraph {
  id: NodeId
  parent?: NodeId | null
}

export interface CompoundLayoutResult {
  /** Centre position of every leaf node, keyed by node id. */
  nodePositions: Map<NodeId, Position>
  /** Bounding rectangle of every subgraph, keyed by subgraph id. */
  subgraphBounds: Map<NodeId, Bounds>
  /** Overall bounding rectangle containing every element. */
  rootBounds: Bounds
}

export function layoutCompound(
  nodes: CompoundNode[],
  subgraphs: CompoundSubgraph[],
  edges: Edge[],
  options: SugiyamaOptions = {},
): CompoundLayoutResult {
  const padding = options.subgraphPadding ?? 20
  const labelHeight = options.subgraphLabelHeight ?? 28
  const defaultSize = options.defaultSize ?? { width: 160, height: 60 }

  // Index entities for O(1) lookup.
  const nodeById = new Map<NodeId, CompoundNode>()
  for (const n of nodes) nodeById.set(n.id, n)
  const subgraphById = new Map<NodeId, CompoundSubgraph>()
  for (const s of subgraphs) subgraphById.set(s.id, s)

  // Children lists, keyed by container id (null = top level).
  const childrenOf = new Map<NodeId | null, (CompoundNode | CompoundSubgraph)[]>()
  const push = (parent: NodeId | null, item: CompoundNode | CompoundSubgraph) => {
    const list = childrenOf.get(parent)
    if (list) list.push(item)
    else childrenOf.set(parent, [item])
  }
  for (const n of nodes) push(n.parent ?? null, n)
  for (const s of subgraphs) push(s.parent ?? null, s)

  // Depth of each subgraph, used to process leaves first.
  const depthOf = (id: NodeId, visited = new Set<NodeId>()): number => {
    if (visited.has(id)) return 0
    visited.add(id)
    const sg = subgraphById.get(id)
    if (!sg?.parent) return 0
    return 1 + depthOf(sg.parent, visited)
  }

  // Per-subgraph computed size (starts as a placeholder, filled in
  // bottom-up). Top-level entry keyed by `null` is ignored.
  const subgraphSize = new Map<NodeId, Size>()

  // Filter edges to only those with both endpoints in the given child set.
  const filterEdges = (childIds: Set<NodeId>) =>
    edges.filter((e) => childIds.has(e.source) && childIds.has(e.target) && e.source !== e.target)

  // Absolute node positions (populated after we know each subgraph's
  // origin in the parent's coordinate system) — we first compute
  // positions relative to each container, then shift.
  interface LocalLayout {
    positions: Map<NodeId, Position>
    width: number
    height: number
  }
  const localLayouts = new Map<NodeId | null, LocalLayout>()

  // Run the flat pipeline for a container given the resolved child sizes.
  const runContainer = (containerId: NodeId | null): LocalLayout => {
    const children = childrenOf.get(containerId) ?? []
    if (children.length === 0) {
      return { positions: new Map(), width: 0, height: 0 }
    }
    const childIds = new Set(children.map((c) => c.id))
    const innerEdges = filterEdges(childIds)

    // Size map: leaves use their intrinsic size, subgraphs use
    // previously-computed bounds expanded by padding + label.
    const sizes = new Map<NodeId, Size>()
    for (const c of children) {
      const sg = subgraphById.get(c.id)
      if (sg) {
        const inner = subgraphSize.get(c.id) ?? { width: 0, height: 0 }
        sizes.set(c.id, {
          width: inner.width + padding * 2,
          height: inner.height + padding * 2 + labelHeight,
        })
      } else {
        const n = nodeById.get(c.id)
        sizes.set(c.id, n?.size ?? defaultSize)
      }
    }

    const result = layoutFlat(
      children.map((c) => c.id),
      innerEdges,
      {
        ...options,
        sizes,
        defaultSize,
      },
    )

    // Compute the tight bounding box of `result.positions` with each
    // child's own size so the parent container can budget space.
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const [id, { x, y }] of result.positions) {
      const { width, height } = sizes.get(id) ?? defaultSize
      minX = Math.min(minX, x - width / 2)
      minY = Math.min(minY, y - height / 2)
      maxX = Math.max(maxX, x + width / 2)
      maxY = Math.max(maxY, y + height / 2)
    }
    if (minX === Infinity) {
      return { positions: result.positions, width: 0, height: 0 }
    }

    // Shift so the container's top-left is (0, 0) — callers add their
    // own origin afterwards.
    const shiftX = -minX
    const shiftY = -minY
    const shifted = new Map<NodeId, Position>()
    for (const [id, p] of result.positions) {
      shifted.set(id, { x: p.x + shiftX, y: p.y + shiftY })
    }

    return {
      positions: shifted,
      width: maxX - minX,
      height: maxY - minY,
    }
  }

  // Bottom-up: deepest subgraph first, so by the time we lay out a
  // parent container we already know each child subgraph's size.
  const sortedSubgraphs = [...subgraphs].sort((a, b) => depthOf(b.id) - depthOf(a.id))
  for (const sg of sortedSubgraphs) {
    const layout = runContainer(sg.id)
    localLayouts.set(sg.id, layout)
    subgraphSize.set(sg.id, { width: layout.width, height: layout.height })
  }

  // Finally lay out the top level.
  const top = runContainer(null)
  localLayouts.set(null, top)

  // Flatten: walk from top level downward, translating each node's
  // local coord by the accumulated container origins.
  const nodePositions = new Map<NodeId, Position>()
  const subgraphBounds = new Map<NodeId, Bounds>()

  const flatten = (containerId: NodeId | null, originX: number, originY: number) => {
    const local = localLayouts.get(containerId)
    if (!local) return
    const children = childrenOf.get(containerId) ?? []
    for (const c of children) {
      const localPos = local.positions.get(c.id)
      if (!localPos) continue
      const absX = originX + localPos.x
      const absY = originY + localPos.y
      const sg = subgraphById.get(c.id)
      if (sg) {
        const inner = subgraphSize.get(c.id) ?? { width: 0, height: 0 }
        const width = inner.width + padding * 2
        const height = inner.height + padding * 2 + labelHeight
        const bx = absX - width / 2
        const by = absY - height / 2
        subgraphBounds.set(c.id, { x: bx, y: by, width, height })
        // Children of this subgraph are placed relative to its inner
        // origin, which is below the label row and inside the padding.
        flatten(c.id, bx + padding, by + padding + labelHeight)
      } else {
        nodePositions.set(c.id, { x: absX, y: absY })
      }
    }
  }

  flatten(null, 0, 0)

  // Overall bounding rectangle.
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [id, { x, y }] of nodePositions) {
    const n = nodeById.get(id)
    const size = n?.size ?? defaultSize
    minX = Math.min(minX, x - size.width / 2)
    minY = Math.min(minY, y - size.height / 2)
    maxX = Math.max(maxX, x + size.width / 2)
    maxY = Math.max(maxY, y + size.height / 2)
  }
  for (const bounds of subgraphBounds.values()) {
    minX = Math.min(minX, bounds.x)
    minY = Math.min(minY, bounds.y)
    maxX = Math.max(maxX, bounds.x + bounds.width)
    maxY = Math.max(maxY, bounds.y + bounds.height)
  }
  const rootBounds: Bounds =
    minX === Infinity
      ? { x: 0, y: 0, width: 0, height: 0 }
      : { x: minX, y: minY, width: maxX - minX, height: maxY - minY }

  return { nodePositions, subgraphBounds, rootBounds }
}
