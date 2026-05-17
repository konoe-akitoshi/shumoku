// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Flat-tree network layout.
 *
 * Lays out the entire node graph as a single Buchheim tidy-tree
 * driven by the link topology. Subgraphs are *not* layout
 * containers in this pass — they are computed as post-process
 * hulls around their member nodes (see `computeSubgraphHulls`).
 *
 * Why: the previous compound layout treated each subgraph as an
 * independent placement box, which forced sibling subgraphs into a
 * single horizontal row regardless of how much downstream subtree
 * each contained. A core switch fanning out to many subgraphs
 * couldn't naturally route some children "to the side" — every
 * subgraph had to fit on the same row, so the layout produced
 * long wide rows even when a different topology shape was a
 * better fit.
 *
 * Treating node and subgraph as the same "block" via flat-tree
 * placement lets a switch's subtree expand wherever the topology
 * needs it: shallow subtrees take less width, deep subtrees take
 * more depth, the parent sits naturally above the centroid of its
 * subtree. Subgraph rectangles get drawn around their members as
 * a visual hull and don't constrain the layout.
 *
 * Sibling order is biased by subgraph membership so members of
 * the same subgraph stay contiguous in the layout — without this
 * the hull rectangles would interleave and overlap.
 */

import type { Bounds, Direction, Link, NetworkGraph, Node, Subgraph } from '../models/types.js'
import { layoutTree, type TreeLayoutEdge, type TreeLayoutNode } from './tree-layout.js'

export interface FlatTreeLayoutOptions {
  direction?: Direction
  nodeGap?: number
  layerGap?: number
  /** Padding inside a subgraph hull, between the contents and the rectangle edge. */
  subgraphPadding?: number
  /** Reserved vertical space at the top of a subgraph hull for the label. */
  subgraphLabelHeight?: number
}

export interface FlatTreeLayoutResult {
  nodePositions: Map<string, { x: number; y: number }>
  subgraphBounds: Map<string, Bounds>
  rootBounds: Bounds
}

/**
 * Build the parent map (node → its tree parent in the layout
 * sense). Reuses the same link-direction normalisation as the
 * compound layout: leaf-type devices (AP, server) end up at the
 * downstream side regardless of how the link was authored.
 */
function buildPrimaryParents(
  links: readonly Link[],
  nodesById: Map<string, Node>,
  shouldFlip: (link: Link) => boolean,
): Map<string, string> {
  const primary = new Map<string, string>()
  for (const link of links) {
    if (link.redundancy) continue
    const flip = shouldFlip(link)
    const from = flip ? link.to : link.from
    const to = flip ? link.from : link.to
    if (from.node === to.node) continue
    if (!nodesById.has(from.node) || !nodesById.has(to.node)) continue
    if (primary.has(to.node)) continue
    primary.set(to.node, from.node)
  }
  return primary
}

/**
 * Stable sort siblings so members of the same subgraph stay
 * contiguous in the tidy-tree. Walks the subgraph hierarchy from
 * deepest ancestor down to the immediate parent so two siblings
 * end up adjacent iff they share the *innermost* subgraph
 * ancestor possible — preserves nesting in the visual hull.
 *
 * Tiebreaker by node id keeps the result deterministic across
 * runs even when the input order differs (important for tests).
 */
function sortChildrenBySubgraphMembership(
  childIds: string[],
  nodesById: Map<string, Node>,
  subgraphsById: Map<string, Subgraph>,
): string[] {
  const ancestry = (id: string): string[] => {
    const chain: string[] = []
    let cur: string | undefined = nodesById.get(id)?.parent
    while (cur) {
      chain.push(cur)
      cur = subgraphsById.get(cur)?.parent
    }
    return chain.reverse() // deepest ancestor last; root container first
  }
  const cmpChain = (a: string[], b: string[]): number => {
    const n = Math.min(a.length, b.length)
    for (let i = 0; i < n; i++) {
      const ai = a[i]
      const bi = b[i]
      if (ai === bi) continue
      return (ai ?? '').localeCompare(bi ?? '')
    }
    return a.length - b.length
  }
  const decorated = childIds.map((id) => ({ id, chain: ancestry(id) }))
  decorated.sort((a, b) => cmpChain(a.chain, b.chain) || a.id.localeCompare(b.id))
  return decorated.map((d) => d.id)
}

/**
 * Detect cycles in the primary-parent map and break them by
 * dropping the offending edge. Buchheim requires an acyclic input
 * — multi-parent (redundant uplink) graphs need their secondary
 * uplinks treated as overlays before this point.
 */
function breakCycles(parents: Map<string, string>): void {
  for (const start of [...parents.keys()]) {
    const seen = new Set<string>()
    let cur: string | undefined = start
    while (cur !== undefined) {
      if (seen.has(cur)) {
        parents.delete(start)
        break
      }
      seen.add(cur)
      cur = parents.get(cur)
    }
  }
}

/**
 * Walk each parent and, if any of its tree-children sits inside
 * the same subgraph, shift the *entire* sibling cluster so that
 * the same-subgraph child lands at the parent's x. The other
 * siblings (and their subtrees) move uniformly by the same delta
 * so their internal layout is preserved; only the cluster as a
 * whole pans sideways.
 *
 * Why: tidy-tree centres a parent over the centroid of its
 * subtree, which means a heavy child (large downstream subtree)
 * sits far to the side of the parent's column. When the parent
 * and that heavy child share a subgraph, the user expects the
 * pair to form a vertical chain with the heavy child's subtree
 * spreading below; aligning the columns delivers exactly that
 * without disturbing the relative arrangement of the other
 * siblings.
 *
 * Side effect: the parent no longer sits over the centroid of
 * *all* its children — it sits over the same-subgraph child
 * column. The cluster's overall extent grows (or stays the same)
 * but the visual reading is cleaner.
 */
function alignSameSubgraphSpine(
  positions: Map<string, { x: number; y: number }>,
  parents: Map<string, string>,
  nodesById: Map<string, Node>,
): void {
  const childrenOf = new Map<string, string[]>()
  for (const [c, p] of parents) {
    const list = childrenOf.get(p) ?? []
    list.push(c)
    childrenOf.set(p, list)
  }
  // Process top-down so a shifted parent has already been moved
  // before we adjust its own children.
  const visited = new Set<string>()
  const queue: string[] = []
  for (const n of nodesById.values()) if (!parents.has(n.id)) queue.push(n.id)
  while (queue.length > 0) {
    const id = queue.shift()
    if (id === undefined || visited.has(id)) continue
    visited.add(id)
    const parentSg = nodesById.get(id)?.parent
    const kids = childrenOf.get(id) ?? []
    let spine: string | null = null
    if (parentSg) {
      for (const c of kids) {
        if (nodesById.get(c)?.parent === parentSg) {
          spine = c
          break
        }
      }
    }
    if (spine) {
      const parentX = positions.get(id)?.x
      const spineX = positions.get(spine)?.x
      if (parentX !== undefined && spineX !== undefined && parentX !== spineX) {
        const dx = parentX - spineX
        // Shift every descendant (children + their subtrees) by dx.
        const stack: string[] = [...kids]
        while (stack.length > 0) {
          const cur = stack.pop()
          if (cur === undefined) break
          const p = positions.get(cur)
          if (p) positions.set(cur, { x: p.x + dx, y: p.y })
          for (const cc of childrenOf.get(cur) ?? []) stack.push(cc)
        }
      }
    }
    for (const c of kids) queue.push(c)
  }
}

/**
 * Lay out every node in the graph as one tidy-tree using
 * link-derived parent pointers. Subgraph membership only
 * influences sibling order so hulls stay non-overlapping.
 */
export function layoutFlatTree(
  graph: NetworkGraph,
  nodesById: Map<string, Node>,
  subgraphsById: Map<string, Subgraph>,
  sizeById: Map<string, { width: number; height: number }>,
  shouldFlip: (link: Link) => boolean,
  options: FlatTreeLayoutOptions = {},
): FlatTreeLayoutResult {
  const nodeGap = options.nodeGap ?? 40
  const layerGap = options.layerGap ?? 60
  const padding = options.subgraphPadding ?? 20
  const labelHeight = options.subgraphLabelHeight ?? 28

  const parents = buildPrimaryParents(graph.links, nodesById, shouldFlip)
  breakCycles(parents)

  // Group nodes by parent (or null for roots) so we can sort each
  // sibling cluster by subgraph membership before feeding edges
  // into layoutTree in that order.
  const childrenOf = new Map<string | null, string[]>()
  for (const n of graph.nodes) {
    const p = parents.get(n.id) ?? null
    const list = childrenOf.get(p) ?? []
    list.push(n.id)
    childrenOf.set(p, list)
  }
  for (const [p, list] of childrenOf) {
    childrenOf.set(p, sortChildrenBySubgraphMembership(list, nodesById, subgraphsById))
  }

  const treeNodes: TreeLayoutNode[] = graph.nodes.map((n) => ({
    id: n.id,
    size: sizeById.get(n.id) ?? { width: 80, height: 60 },
  }))
  const treeEdges: TreeLayoutEdge[] = []
  for (const [parent, kids] of childrenOf) {
    if (parent === null) continue
    for (const c of kids) treeEdges.push({ parent, child: c })
  }

  const tree = layoutTree(treeNodes, treeEdges, {
    direction: options.direction,
    nodeGap,
    layerGap,
  })

  const nodePositions = new Map(tree.positions)
  alignSameSubgraphSpine(nodePositions, parents, nodesById)

  const subgraphBounds = computeSubgraphHulls(graph, nodePositions, sizeById, padding, labelHeight)

  // Root bounds: union of node positions and subgraph hulls.
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
  const rootBounds: Bounds = Number.isFinite(minX)
    ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    : { x: 0, y: 0, width: 0, height: 0 }

  return { nodePositions, subgraphBounds, rootBounds }
}

/**
 * Compute each subgraph's bounding rectangle from the positions
 * of its member nodes (and the hulls of any nested subgraphs).
 * Recursive depth-first so an outer subgraph correctly contains
 * all of its inner hulls plus its directly-owned nodes.
 *
 * The top of every hull reserves `labelHeight` for the subgraph
 * label, matching the renderer's expectation (label is drawn
 * just inside the top edge).
 */
export function computeSubgraphHulls(
  graph: NetworkGraph,
  nodePositions: Map<string, { x: number; y: number }>,
  sizeById: Map<string, { width: number; height: number }>,
  padding: number,
  labelHeight: number,
): Map<string, Bounds> {
  const subgraphById = new Map((graph.subgraphs ?? []).map((s) => [s.id, s] as const))
  const memberNodes = new Map<string, string[]>()
  const memberSubgraphs = new Map<string, string[]>()
  for (const n of graph.nodes) {
    if (!n.parent) continue
    const list = memberNodes.get(n.parent) ?? []
    list.push(n.id)
    memberNodes.set(n.parent, list)
  }
  for (const s of graph.subgraphs ?? []) {
    if (!s.parent) continue
    const list = memberSubgraphs.get(s.parent) ?? []
    list.push(s.id)
    memberSubgraphs.set(s.parent, list)
  }

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
  for (const s of subgraphById.values()) compute(s.id)
  return hulls
}
