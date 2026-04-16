// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Network-aware Hierarchical Layout Engine
 *
 * Tree-based column layout:
 * - Each node owns a column that fits its entire subtree
 * - Children are placed below parent, leaves first then branches
 * - Parent is centered above its children
 * - Subgraphs are containers with recursive internal tree layout
 * - Ports are part of the node box model
 */

import {
  DEFAULT_ICON_SIZE,
  ESTIMATED_CHAR_WIDTH,
  ICON_LABEL_GAP,
  LABEL_LINE_HEIGHT,
  NODE_HORIZONTAL_PADDING,
  NODE_VERTICAL_PADDING,
  SMALL_LABEL_CHAR_WIDTH,
} from '../constants.js'
import { getDeviceIcon } from '../icons/index.js'
import type {
  Bounds,
  LinkEndpoint,
  NetworkGraph,
  Node,
  NodeSpec,
  Subgraph,
} from '../models/types.js'
import type { ResolvedPort } from './resolved-types.js'

// ============================================================================
// Options
// ============================================================================

export interface NetworkLayoutOptions {
  direction?: 'TB' | 'BT' | 'LR' | 'RL'
  gap?: number
  topLevelGap?: number
  subgraphPadding?: number
  subgraphLabelHeight?: number
  nodeWidth?: number
  minPortSpacing?: number
  portSize?: number
  portLabelPadding?: number
}

export interface NetworkLayoutResult {
  nodes: Map<string, Node>
  ports: Map<string, ResolvedPort>
  subgraphs: Map<string, Subgraph>
  bounds: Bounds
}

const DEFAULTS: Required<NetworkLayoutOptions> = {
  direction: 'TB',
  gap: 30,
  topLevelGap: 80,
  subgraphPadding: 20,
  subgraphLabelHeight: 28,
  nodeWidth: 180,
  minPortSpacing: 40,
  portSize: 8,
  portLabelPadding: 8,
}

/**
 * Compute the appropriate size for a node based on its content.
 * Used by both the layout engine and interactive addNewNode.
 */
export function computeNodeSize(
  node: { label?: string | string[]; spec?: NodeSpec },
  portCount = 0,
): { width: number; height: number } {
  const lines = Array.isArray(node.label) ? node.label.length : node.label ? 1 : 0
  const specType = node.spec?.kind !== 'service' ? node.spec?.type : undefined
  const hasIcon = !!(specType && getDeviceIcon(specType))
  const iconH = hasIcon ? DEFAULT_ICON_SIZE : 0
  const gapH = iconH > 0 ? ICON_LABEL_GAP : 0
  const contentH = iconH + gapH + lines * LABEL_LINE_HEIGHT
  const labelLines = Array.isArray(node.label) ? node.label : node.label ? [node.label] : []
  const contentW = Math.max(0, ...labelLines.map((l) => l.length)) * ESTIMATED_CHAR_WIDTH

  const w = Math.max(
    DEFAULTS.nodeWidth,
    contentW + NODE_HORIZONTAL_PADDING * 2,
    portCount * DEFAULTS.minPortSpacing,
  )
  const h = Math.max(60, contentH + NODE_VERTICAL_PADDING, portCount * DEFAULTS.minPortSpacing)

  return { width: w, height: h }
}

// ============================================================================
// Helpers
// ============================================================================

type Side = 'top' | 'bottom' | 'left' | 'right'
interface PortInfo {
  name: string
  side: Side
}

function epId(ep: string | LinkEndpoint) {
  return typeof ep === 'string' ? ep : ep.node
}
function epPort(ep: string | LinkEndpoint) {
  return typeof ep === 'string' ? undefined : ep.port
}

// ============================================================================
// Pre-processing
// ============================================================================

interface PreProcessed {
  graph: NetworkGraph
  parentOf: Map<string, string | null>
  childrenOf: Map<string | null, string[]>
  edgesAt: Map<string | null, Array<[string, string]>>
  portsByNode: Map<string, PortInfo[]>
  nodeMap: Map<string, Node>
  sgMap: Map<string, Subgraph>
}

function preProcess(graph: NetworkGraph, direction: string): PreProcessed {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]))
  const sgMap = new Map(graph.subgraphs?.map((s) => [s.id, s]) ?? [])

  const parentOf = new Map<string, string | null>()
  for (const sg of graph.subgraphs ?? []) parentOf.set(sg.id, sg.parent ?? null)
  for (const n of graph.nodes) parentOf.set(n.id, n.parent ?? null)

  const childrenOf = new Map<string | null, string[]>()
  childrenOf.set(null, [])
  for (const sg of graph.subgraphs ?? []) childrenOf.set(sg.id, [])
  for (const [id, parent] of parentOf) {
    if (!childrenOf.has(parent)) childrenOf.set(parent, [])
    const siblings = childrenOf.get(parent)
    if (siblings) siblings.push(id)
  }

  // Ancestor chain for resolving node→container at each level
  const ancestorChain = new Map<string, string[]>()
  for (const n of graph.nodes) {
    const chain: string[] = [n.id]
    let cur: string | null | undefined = n.parent
    while (cur) {
      chain.push(cur)
      cur = sgMap.get(cur)?.parent
    }
    ancestorChain.set(n.id, chain)
  }

  function resolveAtLevel(nodeId: string, container: string | null): string | null {
    const chain = ancestorChain.get(nodeId)
    if (!chain) return null
    const kids = childrenOf.get(container)
    if (!kids) return null
    const kidSet = new Set(kids)
    for (const id of chain) {
      if (kidSet.has(id)) return id
    }
    return null
  }

  // Build edges at each container level
  const edgesAt = new Map<string | null, Array<[string, string]>>()
  edgesAt.set(null, [])
  for (const sg of graph.subgraphs ?? []) edgesAt.set(sg.id, [])

  const haPairs = new Set<string>()
  for (const link of graph.links) {
    if (link.redundancy) {
      haPairs.add([epId(link.from), epId(link.to)].sort().join(':'))
    }
  }

  for (const container of [null, ...(graph.subgraphs ?? []).map((s) => s.id)]) {
    const edges: Array<[string, string]> = []
    for (const link of graph.links) {
      if (link.redundancy) continue
      const fc = resolveAtLevel(epId(link.from), container)
      const tc = resolveAtLevel(epId(link.to), container)
      if (fc && tc && fc !== tc) edges.push([fc, tc])
    }
    edgesAt.set(container, edges)
  }

  // Port collection
  const portsByNode = new Map<string, PortInfo[]>()
  const { src, dst } =
    direction === 'BT'
      ? { src: 'top' as Side, dst: 'bottom' as Side }
      : direction === 'LR'
        ? { src: 'right' as Side, dst: 'left' as Side }
        : direction === 'RL'
          ? { src: 'left' as Side, dst: 'right' as Side }
          : { src: 'bottom' as Side, dst: 'top' as Side }
  const haSrc: Side = direction === 'LR' || direction === 'RL' ? 'bottom' : 'right'
  const haDst: Side = direction === 'LR' || direction === 'RL' ? 'top' : 'left'
  const seen = new Set<string>()
  for (const link of graph.links) {
    const fId = epId(link.from),
      tId = epId(link.to)
    const fP = epPort(link.from),
      tP = epPort(link.to)
    const isHA = haPairs.has([fId, tId].sort().join(':'))
    if (fP && !seen.has(`${fId}:${fP}`)) {
      seen.add(`${fId}:${fP}`)
      if (!portsByNode.has(fId)) portsByNode.set(fId, [])
      const fPorts = portsByNode.get(fId)
      if (fPorts) fPorts.push({ name: fP, side: isHA ? haSrc : src })
    }
    if (tP && !seen.has(`${tId}:${tP}`)) {
      seen.add(`${tId}:${tP}`)
      if (!portsByNode.has(tId)) portsByNode.set(tId, [])
      const tPorts = portsByNode.get(tId)
      if (tPorts) tPorts.push({ name: tP, side: isHA ? haDst : dst })
    }
  }

  return { graph, parentOf, childrenOf, edgesAt, portsByNode, nodeMap, sgMap }
}

// ============================================================================
// Tree node (internal model for tree layout)
// ============================================================================

interface TreeNode {
  id: string
  kind: 'node' | 'subgraph'
  node?: Node
  subgraph?: Subgraph
  ports: PortInfo[]
  ownWidth: number
  ownHeight: number
  ownMargin: { top: number; right: number; bottom: number; left: number }
  children: TreeNode[]
  columnWidth: number
  columnHeight: number
  childRows: TreeNode[][]
  /** Internal tree for subgraphs (built once during measure, reused in arrange) */
  internalTrees?: TreeNode[]
}

// ============================================================================
// Build tree from connection graph
// ============================================================================

function buildTree(
  containerId: string | null,
  pp: PreProcessed,
  opts: Required<NetworkLayoutOptions>,
): TreeNode[] {
  const childIds = pp.childrenOf.get(containerId) ?? []
  if (childIds.length === 0) return []

  const edges = pp.edgesAt.get(containerId) ?? []
  const idSet = new Set(childIds)

  // Build downstream/upstream within this container
  const downstream = new Map<string, Set<string>>()
  const inDegree = new Map<string, number>()
  for (const id of childIds) {
    downstream.set(id, new Set())
    inDegree.set(id, 0)
  }
  for (const [f, t] of edges) {
    const fDown = downstream.get(f)
    if (idSet.has(f) && idSet.has(t) && fDown && !fDown.has(t)) {
      fDown.add(t)
      inDegree.set(t, (inDegree.get(t) ?? 0) + 1)
    }
  }

  // Find roots (sources)
  const roots = childIds.filter((id) => (inDegree.get(id) ?? 0) === 0)
  // Non-roots that aren't reachable from roots → also become roots
  const visited = new Set<string>()

  function makeTreeNode(id: string): TreeNode {
    visited.add(id)
    const isSubgraph = pp.sgMap.has(id)

    let tn: TreeNode
    if (isSubgraph) {
      tn = measureSubgraphTree(id, pp, opts)
    } else {
      tn = measureNodeTree(id, pp, opts)
    }

    // Get tree children (downstream in this container, not yet visited)
    const downIds = [...(downstream.get(id) ?? [])].filter((d) => !visited.has(d))

    // Sort: leaves first (no further downstream), then branches
    const leaves = downIds.filter(
      (d) => (downstream.get(d)?.size ?? 0) === 0 && !pp.childrenOf.get(d)?.length,
    )
    const branches = downIds.filter((d) => !leaves.includes(d))
    const orderedChildren = [...leaves, ...branches]

    const childTrees = orderedChildren.map(makeTreeNode)

    // Compute child rows: all leaves in one row, each branch in its own row
    // Actually, simpler: leaves as row 0, branches each as individual items below
    // All children in a single row: leaves first (left), then branches (right).
    // Each branch expands its subtree downward independently.
    const leafChildren = childTrees.filter(
      (c) => c.children.length === 0 && c.childRows.length === 0,
    )
    const branchChildren = childTrees.filter((c) => c.children.length > 0 || c.childRows.length > 0)

    const childRows: TreeNode[][] = []
    const singleRow = [...leafChildren, ...branchChildren]
    if (singleRow.length > 0) childRows.push(singleRow)

    tn.children = childTrees
    tn.childRows = childRows

    // Compute column dimensions
    computeColumnSize(tn, opts)

    return tn
  }

  const trees = roots.map(makeTreeNode)

  // Add orphans (unvisited)
  for (const id of childIds) {
    if (!visited.has(id)) trees.push(makeTreeNode(id))
  }

  return trees
}

function measureNodeTree(
  id: string,
  pp: PreProcessed,
  opts: Required<NetworkLayoutOptions>,
): TreeNode {
  const node = pp.nodeMap.get(id)
  if (!node)
    return {
      id,
      kind: 'node',
      node: undefined,
      ports: [],
      ownWidth: 0,
      ownHeight: 0,
      ownMargin: { top: 0, right: 0, bottom: 0, left: 0 },
      children: [],
      childRows: [],
      columnWidth: 0,
      columnHeight: 0,
    }
  const ports = pp.portsByNode.get(id) ?? []

  const lines = Array.isArray(node.label) ? node.label.length : node.label ? 1 : 0
  const specType = node.spec?.kind !== 'service' ? node.spec?.type : undefined
  const hasIcon = !!(specType && getDeviceIcon(specType))
  const iconH = hasIcon ? DEFAULT_ICON_SIZE : 0
  const gapH = iconH > 0 ? ICON_LABEL_GAP : 0
  const contentH = iconH + gapH + lines * LABEL_LINE_HEIGHT
  const labelLines = Array.isArray(node.label) ? node.label : node.label ? [node.label] : []
  const contentW = Math.max(0, ...labelLines.map((l) => l.length)) * ESTIMATED_CHAR_WIDTH

  const ps: Record<Side, number> = { top: 0, bottom: 0, left: 0, right: 0 }
  let maxPL = 0
  for (const p of ports) {
    ps[p.side]++
    maxPL = Math.max(maxPL, p.name.length)
  }
  const portExt = maxPL > 0 ? maxPL * SMALL_LABEL_CHAR_WIDTH + opts.portLabelPadding : 0

  const w = Math.max(
    opts.nodeWidth,
    contentW + NODE_HORIZONTAL_PADDING * 2,
    Math.max(ps.top, ps.bottom) * opts.minPortSpacing,
  )
  const h = Math.max(
    60,
    contentH + NODE_VERTICAL_PADDING,
    Math.max(ps.left, ps.right) * opts.minPortSpacing,
  )

  return {
    id,
    kind: 'node',
    node,
    ports,
    ownWidth: w,
    ownHeight: h,
    ownMargin: {
      top: ps.top > 0 ? portExt : 0,
      bottom: ps.bottom > 0 ? portExt : 0,
      left: ps.left > 0 ? portExt : 0,
      right: ps.right > 0 ? portExt : 0,
    },
    children: [],
    childRows: [],
    columnWidth: w,
    columnHeight: h,
  }
}

function measureSubgraphTree(
  id: string,
  pp: PreProcessed,
  opts: Required<NetworkLayoutOptions>,
): TreeNode {
  const sg = pp.sgMap.get(id)
  if (!sg)
    return {
      id,
      kind: 'subgraph',
      subgraph: undefined,
      ports: [],
      ownWidth: 0,
      ownHeight: 0,
      ownMargin: { top: 0, right: 0, bottom: 0, left: 0 },
      children: [],
      childRows: [],
      columnWidth: 0,
      columnHeight: 0,
    }

  // Recursively build internal tree
  const internalTrees = buildTree(id, pp, opts)

  // Compute internal content size
  let contentW = 0
  let contentH = 0
  for (const [i, t] of internalTrees.entries()) {
    contentW += t.columnWidth
    if (i < internalTrees.length - 1) contentW += opts.gap
    contentH = Math.max(contentH, t.columnHeight)
  }
  if (internalTrees.length === 0) {
    contentW = opts.nodeWidth
    contentH = 40
  }

  const pad = opts.subgraphPadding
  const labelH = opts.subgraphLabelHeight
  const w = contentW + pad * 2
  const h = contentH + pad * 2 + labelH

  return {
    id,
    kind: 'subgraph',
    subgraph: sg,
    ports: [],
    ownWidth: w,
    ownHeight: h,
    ownMargin: { top: 0, right: 0, bottom: 0, left: 0 },
    children: [],
    childRows: [],
    columnWidth: w,
    columnHeight: h,
    internalTrees, // preserve for arrange pass
  }
}

/**
 * Compute column dimensions for a tree node with children.
 * columnWidth = max(ownWidth, sum of children row widths)
 * columnHeight = own + gap + children rows stacked
 */
function computeColumnSize(tn: TreeNode, opts: Required<NetworkLayoutOptions>): void {
  if (tn.childRows.length === 0) {
    tn.columnWidth = tn.ownWidth + tn.ownMargin.left + tn.ownMargin.right
    tn.columnHeight = tn.ownHeight + tn.ownMargin.top + tn.ownMargin.bottom
    return
  }

  // Children row widths and heights
  let maxRowW = 0
  let totalRowH = 0
  for (const [r, row] of tn.childRows.entries()) {
    let rowW = 0
    let rowH = 0
    for (const [c, child] of row.entries()) {
      rowW += child.columnWidth
      if (c < row.length - 1) rowW += opts.gap
      rowH = Math.max(rowH, child.columnHeight)
    }
    maxRowW = Math.max(maxRowW, rowW)
    totalRowH += rowH
    if (r < tn.childRows.length - 1) totalRowH += opts.gap
  }

  const ownOuter = tn.ownWidth + tn.ownMargin.left + tn.ownMargin.right
  tn.columnWidth = Math.max(ownOuter, maxRowW)
  tn.columnHeight =
    tn.ownMargin.top + tn.ownHeight + tn.ownMargin.bottom + opts.topLevelGap + totalRowH
}

// ============================================================================
// Arrange (top-down positioning)
// ============================================================================

function arrangeTrees(
  trees: TreeNode[],
  ox: number,
  oy: number,
  gap: number,
  pp: PreProcessed,
  opts: Required<NetworkLayoutOptions>,
  nodes: Map<string, Node>,
  subgraphs: Map<string, Subgraph>,
  ports: Map<string, ResolvedPort>,
): void {
  // Place trees side by side (top-level roots)
  let x = ox
  for (const tree of trees) {
    arrangeTree(tree, x, oy, pp, opts, nodes, subgraphs, ports)
    x += tree.columnWidth + gap
  }
}

function arrangeTree(
  tn: TreeNode,
  colX: number,
  colY: number,
  pp: PreProcessed,
  opts: Required<NetworkLayoutOptions>,
  nodes: Map<string, Node>,
  subgraphs: Map<string, Subgraph>,
  ports: Map<string, ResolvedPort>,
): void {
  // Center own box within column
  const cx = colX + tn.columnWidth / 2
  const bx = cx - tn.ownWidth / 2
  const by = colY + tn.ownMargin.top

  if (tn.kind === 'node' && tn.node) {
    const nodeCx = bx + tn.ownWidth / 2
    const nodeCy = by + tn.ownHeight / 2
    nodes.set(tn.id, { ...tn.node, position: { x: nodeCx, y: nodeCy } })
    // Ports are placed after children (see below) so connected nodes are available for sorting
  } else if (tn.kind === 'subgraph' && tn.subgraph) {
    subgraphs.set(tn.id, {
      ...tn.subgraph,
      bounds: { x: bx, y: by, width: tn.ownWidth, height: tn.ownHeight },
    })
    // Arrange internal children (reuse trees from measure pass)
    if (tn.internalTrees && tn.internalTrees.length > 0) {
      const innerX = bx + opts.subgraphPadding
      const innerY = by + opts.subgraphPadding + opts.subgraphLabelHeight
      arrangeTrees(tn.internalTrees, innerX, innerY, opts.gap, pp, opts, nodes, subgraphs, ports)
    }
  }

  // Arrange child rows below this node
  let childY = colY + tn.ownMargin.top + tn.ownHeight + tn.ownMargin.bottom + opts.topLevelGap

  for (const row of tn.childRows) {
    // Calculate total row width
    let totalRowW = 0
    for (const [i, item] of row.entries()) {
      totalRowW += item.columnWidth
      if (i < row.length - 1) totalRowW += opts.gap
    }

    // Center row within parent's column
    let childX = colX + (tn.columnWidth - totalRowW) / 2
    let rowH = 0

    for (const child of row) {
      arrangeTree(child, childX, childY, pp, opts, nodes, subgraphs, ports)
      childX += child.columnWidth + opts.gap
      rowH = Math.max(rowH, child.columnHeight)
    }

    childY += rowH + opts.gap
  }

  // Place ports AFTER children are positioned, so we can sort ports
  // by connected node's position to prevent line crossings.
  if (tn.kind === 'node' && tn.node) {
    const nodeCx = bx + tn.ownWidth / 2
    const nodeCy = by + tn.ownHeight / 2
    placeNodePorts(tn, nodeCx, nodeCy, ports, nodes, pp.graph, opts)
  }
}

function placeNodePorts(
  tn: TreeNode,
  cx: number,
  cy: number,
  ports: Map<string, ResolvedPort>,
  allNodes: Map<string, Node>,
  graph: NetworkGraph,
  opts: Required<NetworkLayoutOptions>,
): void {
  const bySide: Record<Side, PortInfo[]> = { top: [], bottom: [], left: [], right: [] }
  for (const p of tn.ports) bySide[p.side].push(p)
  const hw = tn.ownWidth / 2,
    hh = tn.ownHeight / 2

  // Sort ports on horizontal sides (top/bottom) by connected node's X position,
  // and vertical sides (left/right) by connected node's Y position.
  // This prevents line crossings when children are placed left-to-right.
  const portTarget = buildPortTargetMap(tn.id, tn.ports, graph)

  for (const side of ['top', 'bottom', 'left', 'right'] as Side[]) {
    const sp = bySide[side]

    // Sort by connected node's position to match child layout order
    if (side === 'top' || side === 'bottom') {
      sp.sort((a, b) => {
        const ax = allNodes.get(portTarget.get(a.name) ?? '')?.position?.x ?? 0
        const bx = allNodes.get(portTarget.get(b.name) ?? '')?.position?.x ?? 0
        return ax - bx
      })
    } else {
      sp.sort((a, b) => {
        const ay = allNodes.get(portTarget.get(a.name) ?? '')?.position?.y ?? 0
        const by = allNodes.get(portTarget.get(b.name) ?? '')?.position?.y ?? 0
        return ay - by
      })
    }

    for (const [i, p] of sp.entries()) {
      const r = (i + 1) / (sp.length + 1)
      let ax: number, ay: number
      switch (side) {
        case 'top':
          ax = cx - hw + tn.ownWidth * r
          ay = cy - hh
          break
        case 'bottom':
          ax = cx - hw + tn.ownWidth * r
          ay = cy + hh
          break
        case 'left':
          ax = cx - hw
          ay = cy - hh + tn.ownHeight * r
          break
        case 'right':
          ax = cx + hw
          ay = cy - hh + tn.ownHeight * r
          break
      }
      ports.set(`${tn.id}:${p.name}`, {
        id: `${tn.id}:${p.name}`,
        nodeId: tn.id,
        label: p.name,
        absolutePosition: { x: ax, y: ay },
        side,
        size: { width: opts.portSize, height: opts.portSize },
      })
    }
  }
}

/** Map portName → connected nodeId for a given node */
function buildPortTargetMap(
  nodeId: string,
  _portInfos: PortInfo[],
  graph: NetworkGraph,
): Map<string, string> {
  const result = new Map<string, string>()
  for (const link of graph.links) {
    const fId = epId(link.from),
      tId = epId(link.to)
    const fP = epPort(link.from),
      tP = epPort(link.to)
    if (fId === nodeId && fP) result.set(fP, tId)
    if (tId === nodeId && tP) result.set(tP, fId)
  }
  return result
}

// ============================================================================
// Main
// ============================================================================

export function layoutNetwork(
  graph: NetworkGraph,
  options?: NetworkLayoutOptions,
): NetworkLayoutResult {
  const opts = { ...DEFAULTS, ...options }
  const pp = preProcess(graph, opts.direction)

  // Build top-level tree
  const trees = buildTree(null, pp, opts)

  // Arrange
  const nodes = new Map<string, Node>()
  const subgraphs = new Map<string, Subgraph>()
  const ports = new Map<string, ResolvedPort>()
  arrangeTrees(trees, 0, 0, opts.topLevelGap, pp, opts, nodes, subgraphs, ports)

  // Bounds
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const node of nodes.values()) {
    if (!node.position) continue
    const size = computeNodeSize(node)
    minX = Math.min(minX, node.position.x - size.width / 2)
    minY = Math.min(minY, node.position.y - size.height / 2)
    maxX = Math.max(maxX, node.position.x + size.width / 2)
    maxY = Math.max(maxY, node.position.y + size.height / 2)
  }
  for (const sg of subgraphs.values()) {
    if (!sg.bounds) continue
    minX = Math.min(minX, sg.bounds.x)
    minY = Math.min(minY, sg.bounds.y)
    maxX = Math.max(maxX, sg.bounds.x + sg.bounds.width)
    maxY = Math.max(maxY, sg.bounds.y + sg.bounds.height)
  }
  const pad = 50
  return {
    nodes,
    ports,
    subgraphs,
    bounds:
      minX === Infinity
        ? { x: 0, y: 0, width: 400, height: 300 }
        : {
            x: minX - pad,
            y: minY - pad,
            width: maxX - minX + pad * 2,
            height: maxY - minY + pad * 2,
          },
  }
}
