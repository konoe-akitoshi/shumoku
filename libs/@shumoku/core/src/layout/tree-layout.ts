// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Tree layout using Buchheim et al.'s linear-time tidy-tree algorithm.
 *
 * For network topologies that are tree-dominant (one structural parent
 * per node, occasional overlay edges for HA / redundancy), the
 * Sugiyama pipeline produces avoidable distortions: barycenter
 * crossing reduction interleaves siblings, and Brandes-Köpf 4-
 * alignment centres each parent over its (now-distorted) subtree
 * centroid. The result is a layout where:
 *
 *   - siblings of the same parent are split apart by intruders from
 *     other subtrees,
 *   - peer nodes at the same layer end up far apart because their
 *     subtrees have very different widths,
 *   - upper layers spread out to cover the widest descendant row.
 *
 * Buchheim's algorithm preserves subtree contiguity by construction.
 * Each parent's children occupy a contiguous interval, the parent
 * sits at the midpoint of its first/last children, and apportion
 * shifts subtrees as compact rigid units to avoid contour overlap.
 *
 * Reference:
 *   Buchheim, C., Jünger, M., Leipert, S.
 *   "Improving Walker's Algorithm to Run in Linear Time"
 *   Graph Drawing 2002, LNCS 2528, pp. 344-353
 *   DOI: 10.1007/3-540-36151-0_32
 *
 * Extension: variable node widths via per-pair distance in apportion,
 * matching the d3-flextree behaviour (van der Ploeg 2014).
 *
 * Y assignment is depth-based with each layer's height = max(node
 * heights at that depth) + layerGap. Forest inputs are wrapped in a
 * virtual root for the layout pass and unwrapped before output.
 */

import type { Direction, Position } from '../models/types.js'

export interface TreeLayoutNode {
  id: string
  /** Pixel size of the rendered node. */
  size: { width: number; height: number }
}

export interface TreeLayoutEdge {
  parent: string
  child: string
}

export interface TreeLayoutOptions {
  /** Flow direction. Defaults to TB. The algorithm always lays out
   *  in TB internally; LR / BT / RL are produced by rotating the
   *  final coordinates. */
  direction?: Direction
  /** Minimum horizontal gap between sibling nodes (px). */
  nodeGap?: number
  /** Minimum vertical gap between layers (px). */
  layerGap?: number
}

export interface TreeLayoutResult {
  /** Centre position per node. */
  positions: Map<string, Position>
  /** Tight bounding box covering all nodes. */
  bounds: { x: number; y: number; width: number; height: number }
}

/**
 * Lay out a rooted tree (or forest) using Buchheim's linear-time
 * tidy-tree algorithm.
 *
 * Roots are nodes that don't appear as the child in any edge.
 * Multiple roots are supported via an implicit virtual root that
 * does not appear in the output.
 *
 * Edges must form a tree (each node has at most one parent). If you
 * have multi-parent or cyclic structure, run the spanning-tree
 * extraction in `structural-edge.ts` before calling this.
 */
export function layoutTree(
  nodes: TreeLayoutNode[],
  edges: TreeLayoutEdge[],
  options: TreeLayoutOptions = {},
): TreeLayoutResult {
  // Fallback gap values for callers that don't pass any. The
  // flat-tree engine — the main consumer — always supplies
  // these from `deriveSpacing`, so these literals only matter
  // for direct-callers / tests. Kept as plain literals because
  // they're a UX-density baseline, not a layout invariant.
  const nodeGap = options.nodeGap ?? 40
  const layerGap = options.layerGap ?? 60
  const direction: Direction = options.direction ?? 'TB'

  if (nodes.length === 0) {
    return { positions: new Map(), bounds: { x: 0, y: 0, width: 0, height: 0 } }
  }

  // Index nodes by id.
  const nodeById = new Map<string, TreeLayoutNode>()
  for (const n of nodes) nodeById.set(n.id, n)

  // Build child lists and detect roots.
  const childrenOf = new Map<string, string[]>()
  const parentOf = new Map<string, string>()
  for (const n of nodes) childrenOf.set(n.id, [])
  for (const e of edges) {
    if (!nodeById.has(e.parent) || !nodeById.has(e.child)) continue
    if (parentOf.has(e.child)) {
      // Multi-parent — shouldn't happen if classification ran first.
      // Keep the first edge, drop the rest.
      continue
    }
    parentOf.set(e.child, e.parent)
    childrenOf.get(e.parent)?.push(e.child)
  }
  const roots: string[] = []
  for (const n of nodes) {
    if (!parentOf.has(n.id)) roots.push(n.id)
  }

  // Build BNode tree. A virtual root joins multiple component roots
  // so the algorithm can run once over the whole forest.
  const VIRTUAL_ID = '__tree_layout_virtual_root__'
  const wantsVirtualRoot = roots.length !== 1
  const realRoot = wantsVirtualRoot ? VIRTUAL_ID : (roots[0] ?? VIRTUAL_ID)

  const buildBNode = (id: string, depth: number): BNode => {
    const real = nodeById.get(id)
    const size = real?.size ?? { width: 0, height: 0 }
    const bnode: BNode = {
      id,
      depth,
      size,
      parent: null,
      children: [],
      prelim: 0,
      modifier: 0,
      shift: 0,
      change: 0,
      thread: null,
      ancestor: null as unknown as BNode, // patched right below
      number: 0,
    }
    bnode.ancestor = bnode
    return bnode
  }

  const root = buildBNode(realRoot, 0)
  // BFS construct child nodes.
  const queue: BNode[] = []
  if (wantsVirtualRoot) {
    for (const r of roots) {
      const child = buildBNode(r, 1)
      child.parent = root
      child.number = root.children.length
      root.children.push(child)
      queue.push(child)
    }
  } else {
    queue.push(root)
  }
  while (queue.length > 0) {
    const v = queue.shift()
    if (!v) break
    const childIds = childrenOf.get(v.id) ?? []
    for (const cid of childIds) {
      const c = buildBNode(cid, v.depth + 1)
      c.parent = v
      c.number = v.children.length
      v.children.push(c)
      queue.push(c)
    }
  }

  // Per-depth layer height — the tallest node at that depth sets the
  // layer's thickness. Pre-compute so secondWalk can stack them.
  const depthHeight = new Map<number, number>()
  let maxDepth = 0
  const visitDepth = (v: BNode) => {
    if (v.id !== VIRTUAL_ID) {
      const cur = depthHeight.get(v.depth) ?? 0
      if (v.size.height > cur) depthHeight.set(v.depth, v.size.height)
      if (v.depth > maxDepth) maxDepth = v.depth
    }
    for (const c of v.children) visitDepth(c)
  }
  visitDepth(root)
  const layerYCenter: number[] = []
  let yCursor = 0
  // The virtual root sits at depth 0 with zero height; real nodes
  // start at depth 1 only when there's a virtual root. Iterate
  // through all real depths to build cumulative y.
  const minRealDepth = wantsVirtualRoot ? 1 : 0
  for (let d = minRealDepth; d <= maxDepth; d++) {
    const h = depthHeight.get(d) ?? 0
    layerYCenter[d] = yCursor + h / 2
    yCursor += h + layerGap
  }

  // ── Buchheim main passes ──────────────────────────────────────────
  firstWalk(root, nodeGap)
  // Second walk: convert (prelim, modifier) → absolute x. Start with
  // modifier offset of -root.prelim so the root sits at x = 0.
  const positions = new Map<string, Position>()
  secondWalk(root, -root.prelim, positions, layerYCenter, VIRTUAL_ID)

  // Translate so the tightest extents start at (0, 0) — keeps the
  // downstream bounds calculation simple.
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const [id, pos] of positions) {
    const real = nodeById.get(id)
    if (!real) continue
    const halfW = real.size.width / 2
    const halfH = real.size.height / 2
    if (pos.x - halfW < minX) minX = pos.x - halfW
    if (pos.y - halfH < minY) minY = pos.y - halfH
    if (pos.x + halfW > maxX) maxX = pos.x + halfW
    if (pos.y + halfH > maxY) maxY = pos.y + halfH
  }
  if (!Number.isFinite(minX)) {
    minX = minY = maxX = maxY = 0
  }

  // Rotate / flip for non-TB directions. The TB algorithm gives us
  // (x, y); other directions transpose / negate.
  const rotated = new Map<string, Position>()
  for (const [id, pos] of positions) {
    rotated.set(id, rotatePosition(pos, direction))
  }
  const rotatedBounds = rotateBounds({ minX, minY, maxX, maxY }, direction)

  return {
    positions: rotated,
    bounds: {
      x: rotatedBounds.minX,
      y: rotatedBounds.minY,
      width: rotatedBounds.maxX - rotatedBounds.minX,
      height: rotatedBounds.maxY - rotatedBounds.minY,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────
// Buchheim implementation
// ─────────────────────────────────────────────────────────────────────

interface BNode {
  id: string
  depth: number
  size: { width: number; height: number }
  parent: BNode | null
  children: BNode[]
  /** Tentative x relative to parent. */
  prelim: number
  /** Shift accumulator for the subtree rooted at this node. */
  modifier: number
  /** Change/shift propagation across siblings. */
  shift: number
  change: number
  /** Contour traversal helper (Buchheim §3.2). */
  thread: BNode | null
  /** Default ancestor used by apportion. */
  ancestor: BNode
  /** Index among parent's children, 0-based. */
  number: number
}

function firstWalk(v: BNode, nodeGap: number): void {
  if (v.children.length === 0) {
    const ls = leftSibling(v)
    v.prelim = ls ? ls.prelim + distance(ls, v, nodeGap) : 0
    return
  }
  let defaultAncestor = v.children[0] as BNode
  for (const child of v.children) {
    firstWalk(child, nodeGap)
    defaultAncestor = apportion(child, defaultAncestor, nodeGap)
  }
  executeShifts(v)
  const first = v.children[0]
  const last = v.children[v.children.length - 1]
  if (!first || !last) return
  const midpoint = (first.prelim + last.prelim) / 2
  const ls = leftSibling(v)
  if (ls) {
    v.prelim = ls.prelim + distance(ls, v, nodeGap)
    v.modifier = v.prelim - midpoint
  } else {
    v.prelim = midpoint
  }
}

function secondWalk(
  v: BNode,
  m: number,
  out: Map<string, Position>,
  layerYCenter: number[],
  virtualId: string,
): void {
  if (v.id !== virtualId) {
    out.set(v.id, { x: v.prelim + m, y: layerYCenter[v.depth] ?? 0 })
  }
  for (const c of v.children) {
    secondWalk(c, m + v.modifier, out, layerYCenter, virtualId)
  }
}

function leftSibling(v: BNode): BNode | null {
  if (!v.parent) return null
  if (v.number === 0) return null
  return v.parent.children[v.number - 1] ?? null
}

function distance(a: BNode, b: BNode, nodeGap: number): number {
  // Centre-to-centre separation needed so the boxes don't touch.
  return a.size.width / 2 + b.size.width / 2 + nodeGap
}

function executeShifts(v: BNode): void {
  let shift = 0
  let change = 0
  for (let i = v.children.length - 1; i >= 0; i--) {
    const w = v.children[i]
    if (!w) continue
    w.prelim += shift
    w.modifier += shift
    change += w.change
    shift += w.shift + change
  }
}

function apportion(v: BNode, defaultAncestor: BNode, nodeGap: number): BNode {
  const w = leftSibling(v)
  if (!w) return defaultAncestor
  // 4 contour walkers — inside-right (ip), inside-left (im), outside-right (op), outside-left (om).
  let vip: BNode = v
  let vop: BNode = v
  let vim: BNode = w
  // vom must be the leftmost sibling of v (children[0] of v.parent).
  // v has a parent because leftSibling returned non-null.
  const parent = v.parent
  if (!parent) return defaultAncestor
  const firstSibling = parent.children[0]
  if (!firstSibling) return defaultAncestor
  let vom: BNode = firstSibling

  let sip = vip.modifier
  let sop = vop.modifier
  let sim = vim.modifier
  let som = vom.modifier

  while (true) {
    const nVim = nextRight(vim)
    const nVip = nextLeft(vip)
    if (!nVim || !nVip) break
    vim = nVim
    vip = nVip
    const nVom = nextLeft(vom)
    const nVop = nextRight(vop)
    if (!nVom || !nVop) break
    vom = nVom
    vop = nVop
    vop.ancestor = v

    const shift = vim.prelim + sim - (vip.prelim + sip) + distance(vim, vip, nodeGap)
    if (shift > 0) {
      moveSubtree(ancestorOf(vim, v, defaultAncestor), v, shift)
      sip += shift
      sop += shift
    }
    sim += vim.modifier
    sip += vip.modifier
    som += vom.modifier
    sop += vop.modifier
  }

  if (nextRight(vim) && !nextRight(vop)) {
    vop.thread = nextRight(vim)
    vop.modifier += sim - sop
  }
  if (nextLeft(vip) && !nextLeft(vom)) {
    vom.thread = nextLeft(vip)
    vom.modifier += sip - som
    defaultAncestor = v
  }
  return defaultAncestor
}

function nextLeft(v: BNode): BNode | null {
  return v.children.length > 0 ? (v.children[0] ?? null) : v.thread
}

function nextRight(v: BNode): BNode | null {
  return v.children.length > 0 ? (v.children[v.children.length - 1] ?? null) : v.thread
}

function moveSubtree(wm: BNode, wp: BNode, shift: number): void {
  const subtrees = wp.number - wm.number
  if (subtrees === 0) return
  wp.change -= shift / subtrees
  wp.shift += shift
  wm.change += shift / subtrees
  wp.prelim += shift
  wp.modifier += shift
}

function ancestorOf(vim: BNode, v: BNode, defaultAncestor: BNode): BNode {
  // If vim.ancestor is a sibling of v (same parent), it's a valid
  // ancestor for the shift; otherwise fall back.
  if (v.parent && vim.ancestor.parent === v.parent) return vim.ancestor
  return defaultAncestor
}

// ─────────────────────────────────────────────────────────────────────
// Direction rotation
// ─────────────────────────────────────────────────────────────────────

function rotatePosition(p: Position, direction: Direction): Position {
  switch (direction) {
    case 'TB':
      return p
    case 'BT':
      return { x: p.x, y: -p.y }
    case 'LR':
      return { x: p.y, y: p.x }
    case 'RL':
      return { x: -p.y, y: p.x }
  }
}

function rotateBounds(
  b: { minX: number; minY: number; maxX: number; maxY: number },
  direction: Direction,
): { minX: number; minY: number; maxX: number; maxY: number } {
  switch (direction) {
    case 'TB':
      return b
    case 'BT':
      return { minX: b.minX, minY: -b.maxY, maxX: b.maxX, maxY: -b.minY }
    case 'LR':
      return { minX: b.minY, minY: b.minX, maxX: b.maxY, maxY: b.maxX }
    case 'RL':
      return { minX: -b.maxY, minY: b.minX, maxX: -b.minY, maxY: b.maxX }
  }
}
