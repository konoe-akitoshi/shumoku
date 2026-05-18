// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Subgraph-block tidy-tree layout.
 *
 * Each subgraph collapses into one (or more) "blocks" that the
 * outer tidy-tree operates on. The split rule:
 *
 *   - 1 emitter (member with a tree-child outside the subgraph)
 *     → one block for the whole subgraph. The typical leaf
 *     subgraph (switches + APs, only the switches face up).
 *
 *   - N > 1 emitters → one block per emitter. Non-emitter
 *     members get assigned to the block of their nearest tree-
 *     parent emitter inside the same subgraph. This lets the
 *     outer tidy-tree place children emitted from the top of
 *     the subgraph at a shallower depth than children emitted
 *     from the bottom — e.g. New Group with eps-sw01 → eps-sw02
 *     internal chain becomes two blocks {eps-sw01} and
 *     {eps-sw02}, with HALL/FOYER/RECEPTION as children of
 *     eps-sw01 and LOBBY/ROOM2/etc as children of eps-sw02.
 *
 * Same-subgraph parent-child blocks (eps-sw01 → eps-sw02) get
 * spine-aligned to share an x column after the outer layout
 * settles, so the visual New Group rectangle reads as a narrow
 * vertical chain instead of a wide horizontal one.
 *
 * Block internal layout (for multi-member blocks):
 *   - Pick intra-subgraph roots (members whose tree-parent is
 *     outside the subgraph or absent).
 *   - Each root sits at the top, descendants wrap into rows of
 *     up to `SUBGRAPH_ROW_WRAP` to keep block shape compact.
 *   - Multiple roots sit side-by-side.
 *
 * Subgraph hulls are computed as a post-process bounding box
 * over each subgraph's member positions, after the outer
 * tidy-tree and spine alignment.
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

/** Horizontal gap between members inside a subgraph block. */
const INTERNAL_NODE_GAP = 12
/** Vertical gap between layers inside a subgraph block. */
const INTERNAL_LAYER_GAP = 28
/** Horizontal gap between sibling subtrees inside a multi-root subgraph block. */
const INTERNAL_ROOT_GAP = 8

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
 * Lay out a subtree (one intra-subgraph root + its descendants
 * inside the subgraph). The root sits at the top, its direct
 * children sit in a single row beneath, and deeper descendants
 * follow recursively. No row wrapping — subgraph hulls grow
 * horizontally with fan-out, matching how a network engineer
 * usually reads "this switch has N APs" left-to-right.
 */
function layoutWrappedSubtree(
  rootId: string,
  childrenOf: Map<string, string[]>,
  sizeById: Map<string, { width: number; height: number }>,
): {
  positions: Map<string, { x: number; y: number }>
  width: number
  height: number
} {
  const positions = new Map<string, { x: number; y: number }>()
  const rootSize = sizeById.get(rootId) ?? { width: 80, height: 60 }

  const kids = childrenOf.get(rootId) ?? []
  const childLayouts = kids.map((c) => ({
    id: c,
    layout: layoutWrappedSubtree(c, childrenOf, sizeById),
  }))

  if (childLayouts.length === 0) {
    positions.set(rootId, { x: rootSize.width / 2, y: rootSize.height / 2 })
    return { positions, width: rootSize.width, height: rootSize.height }
  }

  const bandWidth = childLayouts.reduce(
    (sum, c, idx) => sum + c.layout.width + (idx > 0 ? INTERNAL_NODE_GAP : 0),
    0,
  )
  const rowHeight = childLayouts.reduce((m, c) => Math.max(m, c.layout.height), 0)
  const subtreeWidth = Math.max(rootSize.width, bandWidth)
  positions.set(rootId, { x: subtreeWidth / 2, y: rootSize.height / 2 })

  const cursorY = rootSize.height + INTERNAL_LAYER_GAP
  let cursorX = (subtreeWidth - bandWidth) / 2
  for (const c of childLayouts) {
    for (const [id, pos] of c.layout.positions) {
      positions.set(id, { x: pos.x + cursorX, y: pos.y + cursorY })
    }
    cursorX += c.layout.width + INTERNAL_NODE_GAP
  }

  return { positions, width: subtreeWidth, height: cursorY + rowHeight }
}

/**
 * Lay out a block (set of member nodes belonging to one
 * subgraph-block) in a compact 2D arrangement. Roots within
 * the block (members whose tree-parent is not inside this
 * block) sit at the top; their descendants wrap into rows.
 */
function layoutBlockInternal(
  memberIds: readonly string[],
  parents: Map<string, string>,
  sizeById: Map<string, { width: number; height: number }>,
  /**
   * When true, the block's intra-root member emits a tree-edge
   * to a node outside the block (typical for the upstream
   * switch of an access subgraph linking to a core router
   * below). Internal layout then places the root at the top
   * centre of the block with the in-subgraph chain hanging off
   * to one side, so the root's bottom column stays free for
   * the external downlink to leave straight down without
   * having to detour around the chain.
   */
  rootIsExternalEmitter = false,
): {
  positions: Map<string, { x: number; y: number }>
  width: number
  height: number
} {
  if (memberIds.length === 1) {
    const id = memberIds[0]
    if (id === undefined) {
      return { positions: new Map(), width: 0, height: 0 }
    }
    const sz = sizeById.get(id) ?? { width: 80, height: 60 }
    const positions = new Map<string, { x: number; y: number }>()
    positions.set(id, { x: sz.width / 2, y: sz.height / 2 })
    return { positions, width: sz.width, height: sz.height }
  }

  const memberSet = new Set(memberIds)
  const intraChildren = new Map<string, string[]>()
  for (const id of memberIds) intraChildren.set(id, [])
  for (const id of memberIds) {
    const p = parents.get(id)
    if (p && memberSet.has(p)) intraChildren.get(p)?.push(id)
  }

  const intraRoots: string[] = []
  for (const id of memberIds) {
    const p = parents.get(id)
    if (!p || !memberSet.has(p)) intraRoots.push(id)
  }
  intraRoots.sort((a, b) => a.localeCompare(b))

  if (rootIsExternalEmitter && intraRoots.length === 1) {
    const rootId = intraRoots[0]
    if (rootId) return layoutEmitterWithSideChain(rootId, intraChildren, sizeById)
  }

  const positions = new Map<string, { x: number; y: number }>()
  let cursorX = 0
  let totalHeight = 0
  for (const root of intraRoots) {
    const sub = layoutWrappedSubtree(root, intraChildren, sizeById)
    for (const [id, pos] of sub.positions) {
      positions.set(id, { x: pos.x + cursorX, y: pos.y })
    }
    cursorX += sub.width
    cursorX += INTERNAL_ROOT_GAP
    if (sub.height > totalHeight) totalHeight = sub.height
  }
  if (intraRoots.length > 0) cursorX -= INTERNAL_ROOT_GAP
  return { positions, width: Math.max(0, cursorX), height: totalHeight }
}

/**
 * Internal layout for a block whose intra-root sends a tree
 * edge outside the block. The root sits at the top centre, its
 * in-block descendants hang off to the right, and the block is
 * padded symmetrically on the left so the root lands at the
 * block's horizontal centre — that way the outer tidy-tree (and
 * any external child placed under this block) lines up with the
 * root, not with the chain. The transit wire from the root to
 * that external child then runs straight down through the empty
 * left side of the block.
 *
 * Block dimensions include the in-block chain width, so the
 * outer tidy-tree's spacing reserves room for the side branch
 * — no subgraph-hull overlap with neighbouring subgraphs.
 */
function layoutEmitterWithSideChain(
  rootId: string,
  intraChildren: Map<string, string[]>,
  sizeById: Map<string, { width: number; height: number }>,
): {
  positions: Map<string, { x: number; y: number }>
  width: number
  height: number
} {
  const rootSize = sizeById.get(rootId) ?? { width: 80, height: 60 }
  // Walk the in-block chain (first-child each step).
  const chain: string[] = []
  let cur: string | undefined = (intraChildren.get(rootId) ?? [])[0]
  while (cur !== undefined) {
    chain.push(cur)
    cur = (intraChildren.get(cur) ?? [])[0]
  }

  const positions = new Map<string, { x: number; y: number }>()
  // Root local: at (rootSize.width / 2, rootSize.height / 2).
  const rootLocalX = rootSize.width / 2
  positions.set(rootId, { x: rootLocalX, y: rootSize.height / 2 })

  // Chain column to the right of root.
  let cursorY = rootSize.height + INTERNAL_LAYER_GAP
  const chainColumnLeft = rootSize.width + INTERNAL_ROOT_GAP
  let chainMaxRight = chainColumnLeft
  for (const m of chain) {
    const ms = sizeById.get(m) ?? { width: 80, height: 60 }
    positions.set(m, { x: chainColumnLeft + ms.width / 2, y: cursorY + ms.height / 2 })
    cursorY += ms.height + INTERNAL_LAYER_GAP
    chainMaxRight = Math.max(chainMaxRight, chainColumnLeft + ms.width)
  }
  if (chain.length > 0) cursorY -= INTERNAL_LAYER_GAP

  // Pad left so root sits at block centre — outer tidy-tree
  // places downstream children under the centre, so the
  // transit wire from root.bottom lands on the downstream
  // child's top.
  const rightExtent = chainMaxRight - rootLocalX
  const halfWidth = Math.max(rightExtent, rootLocalX)
  const blockWidth = halfWidth * 2
  const shiftX = halfWidth - rootLocalX
  if (shiftX > 0) {
    for (const [id, pos] of positions) {
      positions.set(id, { x: pos.x + shiftX, y: pos.y })
    }
  }
  const blockHeight = Math.max(rootSize.height, cursorY)
  return { positions, width: blockWidth, height: blockHeight }
}

/**
 * Build the block partition of the node set. See file-level
 * comment for the split rule.
 */
function buildBlocks(
  graph: NetworkGraph,
  parents: Map<string, string>,
): {
  blockOfNode: Map<string, string>
  blockMembers: Map<string, string[]>
} {
  const subgraphMembers = new Map<string, string[]>()
  for (const n of graph.nodes) {
    if (!n.parent) continue
    const list = subgraphMembers.get(n.parent) ?? []
    list.push(n.id)
    subgraphMembers.set(n.parent, list)
  }
  const childrenOfNode = new Map<string, string[]>()
  for (const [child, par] of parents) {
    const list = childrenOfNode.get(par) ?? []
    list.push(child)
    childrenOfNode.set(par, list)
  }
  const isEmitter = new Set<string>()
  for (const [, members] of subgraphMembers) {
    const memberSet = new Set(members)
    for (const m of members) {
      for (const c of childrenOfNode.get(m) ?? []) {
        if (!memberSet.has(c)) {
          isEmitter.add(m)
          break
        }
      }
    }
  }
  const blockOfNode = new Map<string, string>()
  const blockMembers = new Map<string, string[]>()
  for (const n of graph.nodes) {
    if (!n.parent) {
      blockOfNode.set(n.id, n.id)
      blockMembers.set(n.id, [n.id])
    }
  }
  // 1-emitter subgraphs collapse into one block (the full
  // subgraph member set). Multi-emitter subgraphs split into
  // one block per emitter, with non-emitter members grouped
  // by their nearest tree-parent emitter inside the same
  // subgraph. This keeps each subgraph's members positioned
  // as a single cluster — tidy-tree's block-level spacing
  // then guarantees subgraph hulls don't overlap.
  for (const [sg, members] of subgraphMembers) {
    const memberSet = new Set(members)
    const emitters = members.filter((m) => isEmitter.has(m))
    if (emitters.length <= 1) {
      const blockId = sg
      for (const m of members) blockOfNode.set(m, blockId)
      blockMembers.set(blockId, [...members])
    } else {
      for (const e of emitters) {
        blockOfNode.set(e, e)
        blockMembers.set(e, [e])
      }
      for (const m of members) {
        if (isEmitter.has(m)) continue
        let cur: string | undefined = parents.get(m)
        while (cur !== undefined && memberSet.has(cur) && !isEmitter.has(cur)) {
          cur = parents.get(cur)
        }
        if (cur !== undefined && memberSet.has(cur) && isEmitter.has(cur)) {
          blockOfNode.set(m, cur)
          blockMembers.get(cur)?.push(m)
        } else {
          blockOfNode.set(m, m)
          blockMembers.set(m, [m])
        }
      }
    }
  }
  return { blockOfNode, blockMembers }
}

/**
 * Sort sibling blocks by the source-port label of the link
 * from their parent block. When the parent's downlinks have
 * labels like `Gi1/0/1`, `Gi1/0/2`, …, sorting children by the
 * source port means port placement (which orders ports along
 * the side by peer x-coord) ends up emitting ports in the same
 * sequence as their label numbering — no zig-zag crossings AND
 * no surprising label order.
 *
 * Tie-breakers: same subgraph stays clustered, then id.
 */
function sortBlocksBySourcePort(
  blockIds: readonly string[],
  parentBlockId: string,
  blockMembers: Map<string, string[]>,
  links: readonly Link[],
  nodesById: Map<string, Node>,
  shouldFlip: (link: Link) => boolean,
): string[] {
  const parentMembers = new Set(blockMembers.get(parentBlockId) ?? [])
  const portLabelOf = (nodeId: string, portId: string): string => {
    const port = nodesById.get(nodeId)?.ports?.find((p) => p.id === portId)
    return port?.label ?? portId
  }
  const keyOf = (block: string): string => {
    const members = new Set(blockMembers.get(block) ?? [])
    let best: string | null = null
    for (const link of links) {
      if (link.redundancy) continue
      const flip = shouldFlip(link)
      const from = flip ? link.to : link.from
      const to = flip ? link.from : link.to
      if (!parentMembers.has(from.node) || !members.has(to.node)) continue
      const label = portLabelOf(from.node, from.port)
      if (best === null || label.localeCompare(best, undefined, { numeric: true }) < 0) {
        best = label
      }
    }
    return best ?? '~~~'
  }
  const subgraphOf = (block: string): string => {
    const primary = blockMembers.get(block)?.[0] ?? block
    return nodesById.get(primary)?.parent ?? ''
  }
  return [...blockIds].sort((a, b) => {
    const portCmp = keyOf(a).localeCompare(keyOf(b), undefined, { numeric: true })
    if (portCmp !== 0) return portCmp
    const sgCmp = subgraphOf(a).localeCompare(subgraphOf(b))
    if (sgCmp !== 0) return sgCmp
    return a.localeCompare(b)
  })
}

/**
 * Shift sibling clusters so any same-subgraph parent-child
 * block pair shares an x column. Whole-cluster pan preserves
 * the relative positions among siblings, so tidy-tree's
 * inter-block spacing is preserved everywhere along the
 * cluster.
 */
function alignSameSubgraphSpine(
  positions: Map<string, { x: number; y: number }>,
  blockChildren: Map<string, string[]>,
  blockMembers: Map<string, string[]>,
  nodesById: Map<string, Node>,
): void {
  const subgraphOf = (block: string): string | null => {
    const primary = blockMembers.get(block)?.[0]
    return primary ? (nodesById.get(primary)?.parent ?? null) : null
  }
  const queue: string[] = []
  for (const b of blockMembers.keys()) {
    let isChild = false
    for (const kids of blockChildren.values()) {
      if (kids.includes(b)) {
        isChild = true
        break
      }
    }
    if (!isChild) queue.push(b)
  }
  const visited = new Set<string>()
  while (queue.length > 0) {
    const block = queue.shift()
    if (block === undefined || visited.has(block)) continue
    visited.add(block)
    const parentSg = subgraphOf(block)
    const kids = blockChildren.get(block) ?? []
    let spine: string | null = null
    if (parentSg) {
      for (const c of kids) {
        if (subgraphOf(c) === parentSg) {
          spine = c
          break
        }
      }
    }
    if (spine) {
      const parentX = positions.get(block)?.x
      const spineX = positions.get(spine)?.x
      if (parentX !== undefined && spineX !== undefined && parentX !== spineX) {
        const dx = parentX - spineX
        const stack: string[] = [...kids]
        while (stack.length > 0) {
          const cur = stack.pop()
          if (cur === undefined) break
          const p = positions.get(cur)
          if (p) positions.set(cur, { x: p.x + dx, y: p.y })
          for (const cc of blockChildren.get(cur) ?? []) stack.push(cc)
        }
      }
    }
    for (const c of kids) queue.push(c)
  }
}

export function layoutFlatTree(
  graph: NetworkGraph,
  nodesById: Map<string, Node>,
  _subgraphsById: Map<string, Subgraph>,
  sizeById: Map<string, { width: number; height: number }>,
  shouldFlip: (link: Link) => boolean,
  options: FlatTreeLayoutOptions = {},
): FlatTreeLayoutResult {
  const nodeGap = options.nodeGap ?? 40
  const layerGap = options.layerGap ?? 80
  const padding = options.subgraphPadding ?? 20
  const labelHeight = options.subgraphLabelHeight ?? 28

  const parents = buildPrimaryParents(graph.links, nodesById, shouldFlip)
  breakCycles(parents)

  const { blockOfNode, blockMembers } = buildBlocks(graph, parents)

  // Internal layout per block.
  // Pre-compute: does this block's intra-root member emit an
  // outgoing tree-edge outside the block? Used to switch the
  // internal layout to "emitter on top, chain on the side" so
  // the root's downlink column stays clear.
  const blockEmitsExternal = new Set<string>()
  for (const [blockId, members] of blockMembers) {
    if (members.length < 2) continue
    const memberSet = new Set(members)
    const intraRoot = members.find((m) => {
      const p = parents.get(m)
      return !p || !memberSet.has(p)
    })
    if (!intraRoot) continue
    let hasExternal = false
    for (const [child, par] of parents) {
      if (par !== intraRoot) continue
      if (!memberSet.has(child)) {
        hasExternal = true
        break
      }
    }
    if (hasExternal) blockEmitsExternal.add(blockId)
  }

  const internal = new Map<
    string,
    {
      positions: Map<string, { x: number; y: number }>
      width: number
      height: number
    }
  >()
  for (const [block, members] of blockMembers) {
    internal.set(
      block,
      layoutBlockInternal(members, parents, sizeById, blockEmitsExternal.has(block)),
    )
  }

  // Outer block-level parent-of map. The parent of a block is
  // the block containing the cross-block primary parent of the
  // block's "entry" member (any member whose primary parent
  // sits outside this block).
  const blockParent = new Map<string, string>()
  for (const [block, members] of blockMembers) {
    let entry: string | null = null
    for (const m of members) {
      const p = parents.get(m)
      if (!p) continue
      const pBlock = blockOfNode.get(p)
      if (pBlock && pBlock !== block) {
        entry = m
        break
      }
    }
    if (!entry) continue
    const externalParent = parents.get(entry)
    if (!externalParent) continue
    const parentBlock = blockOfNode.get(externalParent)
    if (parentBlock && parentBlock !== block) {
      blockParent.set(block, parentBlock)
    }
  }
  const blockChildren = new Map<string, string[]>()
  for (const [block, par] of blockParent) {
    const list = blockChildren.get(par) ?? []
    list.push(block)
    blockChildren.set(par, list)
  }
  for (const [par, kids] of blockChildren) {
    blockChildren.set(
      par,
      sortBlocksBySourcePort(kids, par, blockMembers, graph.links, nodesById, shouldFlip),
    )
  }

  // Pad each block by the subgraph-hull padding (and label
  // height on the top) when reporting its size to tidy-tree.
  // The hull rectangle drawn later extends `padding` beyond the
  // member bbox on every side, plus `labelHeight` at the top;
  // without inflating here, tidy-tree's nodeGap would be the
  // gap between member bboxes — leaving the hulls themselves
  // overlapping by 2*padding minus nodeGap.
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

  // Spine alignment: when a same-subgraph parent-child block
  // pair exists (e.g. New Group's eps-sw01 above eps-sw02),
  // pull the child onto the parent's x column so the
  // subgraph's hull stays a narrow vertical strip instead of
  // spreading across the canvas. The cluster shifts together
  // — non-spine siblings move by the same delta — so
  // tidy-tree's relative spacing between siblings is
  // preserved.
  const blockPositions = new Map(tree.positions)
  alignSameSubgraphSpine(blockPositions, blockChildren, blockMembers, nodesById)

  // Expand block positions to member positions.
  const nodePositions = new Map<string, { x: number; y: number }>()
  for (const [block, layout] of internal) {
    const center = blockPositions.get(block)
    if (!center) continue
    const left = center.x - layout.width / 2
    const top = center.y - layout.height / 2
    for (const [id, pos] of layout.positions) {
      nodePositions.set(id, { x: left + pos.x, y: top + pos.y })
    }
  }

  const subgraphBounds = computeSubgraphHulls(graph, nodePositions, sizeById, padding, labelHeight)

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
