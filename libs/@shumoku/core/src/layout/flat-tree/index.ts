// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Flat-tree layout engine.
 *
 * See `./README.md` for the algorithm specification and
 * terminology. The public entry is {@link layoutFlatTree}; the
 * pipeline phases live in sibling modules and are exported here
 * for tests and advanced callers.
 */

import type { Bounds, Direction, Link, NetworkGraph, Node, Subgraph } from '../../models/types.js'
import { layoutTree, type TreeLayoutEdge, type TreeLayoutNode } from '../tree-layout.js'
import { buildBlocks, findExternalEmitterBlocks } from './blocks.js'
import { computeSubgraphHulls } from './hulls.js'
import { layoutBlockInternal } from './internal.js'
import { buildBlockChildren, buildBlockParents } from './outer.js'
import { breakCycles, buildPrimaryParents } from './parents.js'
import { alignSameSubgraphSpine } from './spine.js'
import type { FlatTreeLayoutResult, InternalLayout, Position, Size } from './types.js'

export interface FlatTreeLayoutOptions {
  direction?: Direction
  /** Horizontal gap between sibling blocks in the outer tidy-tree. */
  nodeGap?: number
  /** Vertical gap between layers in the outer tidy-tree. */
  layerGap?: number
  /** Padding inside a subgraph hull, between the contents and the rectangle edge. */
  subgraphPadding?: number
  /** Reserved vertical space at the top of a subgraph hull for the label. */
  subgraphLabelHeight?: number
}

export type { FlatTreeLayoutResult } from './types.js'

/**
 * Lay out the network with the flat-tree engine.
 *
 * Pipeline:
 *
 *   1. **Parents** — extract a primary tree-parent for each node
 *      from the link topology, break cycles.
 *   2. **Blocks** — partition nodes into blocks (one per
 *      single-emitter subgraph or per emitter for multi-emitter
 *      subgraphs, plus singleton blocks for top-level nodes).
 *   3. **Internal layout** — each block's members get local
 *      positions (single member, multi-root row, or emitter-
 *      with-side-chain).
 *   4. **Outer tree** — build block-level parent/child map,
 *      sort siblings by source-port label, run Buchheim tidy-
 *      tree on the blocks.
 *   5. **Spine alignment** — pull same-subgraph parent-child
 *      block pairs onto a shared x column so multi-emitter
 *      subgraphs read as narrow vertical strips.
 *   6. **Expand** — translate each block's local member
 *      positions to absolute positions.
 *   7. **Hulls** — compute each subgraph's bbox from its member
 *      positions.
 *
 * Result includes node positions, subgraph hulls and the root
 * bounding box.
 */
export function layoutFlatTree(
  graph: NetworkGraph,
  nodesById: Map<string, Node>,
  _subgraphsById: Map<string, Subgraph>,
  sizeById: Map<string, Size>,
  shouldFlip: (link: Link) => boolean,
  options: FlatTreeLayoutOptions = {},
): FlatTreeLayoutResult {
  const nodeGap = options.nodeGap ?? 40
  const layerGap = options.layerGap ?? 80
  const padding = options.subgraphPadding ?? 20
  const labelHeight = options.subgraphLabelHeight ?? 28

  // 1. Parents.
  const parents = buildPrimaryParents(graph.links, nodesById, shouldFlip)
  breakCycles(parents)

  // 2. Blocks.
  const { blockOfNode, blockMembers } = buildBlocks(graph, parents)
  const blockEmitsExternal = findExternalEmitterBlocks(blockMembers, parents)

  // 3. Internal layout per block.
  const internal = new Map<string, InternalLayout>()
  for (const [block, members] of blockMembers) {
    internal.set(
      block,
      layoutBlockInternal(members, parents, sizeById, blockEmitsExternal.has(block)),
    )
  }

  // 4. Outer block tree.
  const blockParents = buildBlockParents(blockMembers, blockOfNode, parents)
  const blockChildren = buildBlockChildren(
    blockParents,
    blockMembers,
    graph.links,
    nodesById,
    shouldFlip,
  )

  // Block size for tidy-tree includes the hull padding + label
  // height so adjacent hulls don't overlap.
  const treeNodes: TreeLayoutNode[] = []
  for (const [block, layout] of internal) {
    treeNodes.push({
      id: block,
      size: {
        width: layout.width + padding * 2,
        height: layout.height + padding * 2 + labelHeight,
      },
    })
  }
  const treeEdges: TreeLayoutEdge[] = []
  for (const [par, kids] of blockChildren) {
    for (const c of kids) treeEdges.push({ parent: par, child: c })
  }
  const tree = layoutTree(treeNodes, treeEdges, {
    direction: options.direction,
    nodeGap,
    layerGap,
  })

  // 5. Spine alignment.
  const blockPositions = new Map(tree.positions)
  alignSameSubgraphSpine(blockPositions, blockChildren, blockMembers, nodesById)

  // 6. Expand to absolute node positions.
  const nodePositions = new Map<string, Position>()
  for (const [block, layout] of internal) {
    const center = blockPositions.get(block)
    if (!center) continue
    const left = center.x - layout.width / 2
    const top = center.y - layout.height / 2
    for (const [id, pos] of layout.positions) {
      nodePositions.set(id, { x: left + pos.x, y: top + pos.y })
    }
  }

  // 7. Subgraph hulls + root bbox.
  const subgraphBounds = computeSubgraphHulls(graph, nodePositions, sizeById, padding, labelHeight)
  const rootBounds = computeRootBounds(nodePositions, sizeById, subgraphBounds)

  return { nodePositions, subgraphBounds, rootBounds }
}

/** Bbox covering every node footprint and every subgraph hull. */
function computeRootBounds(
  nodePositions: Map<string, Position>,
  sizeById: Map<string, Size>,
  subgraphBounds: Map<string, Bounds>,
): Bounds {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const [id, pos] of nodePositions) {
    const size = sizeById.get(id) ?? { width: 0, height: 0 }
    minX = Math.min(minX, pos.x - size.width / 2)
    minY = Math.min(minY, pos.y - size.height / 2)
    maxX = Math.max(maxX, pos.x + size.width / 2)
    maxY = Math.max(maxY, pos.y + size.height / 2)
  }
  for (const b of subgraphBounds.values()) {
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.width)
    maxY = Math.max(maxY, b.y + b.height)
  }
  return Number.isFinite(minX)
    ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    : { x: 0, y: 0, width: 0, height: 0 }
}

// Re-export helpers for tests and advanced callers.
export { buildBlocks, findExternalEmitterBlocks } from './blocks.js'
export { computeSubgraphHulls } from './hulls.js'
export {
  layoutBlockInternal,
  layoutEmitterWithSideChain,
  layoutWrappedSubtree,
} from './internal.js'
export { buildBlockChildren, buildBlockParents } from './outer.js'
export { breakCycles, buildChildrenOf, buildPrimaryParents } from './parents.js'
export { sortBlocksBySourcePort } from './sort.js'
export { alignSameSubgraphSpine } from './spine.js'
