// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Network-aware Hierarchical Layout Engine
 *
 * 1. Pre-process: build container tree + connection graph per level (once)
 * 2. For each container: group children into rows using pre-built connections
 * 3. Measure (bottom-up) + Arrange (top-down), same rules in both
 * 4. Ports are part of the node box model (sticky-attached)
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
import type { Bounds, LinkEndpoint, NetworkGraph, Node, Subgraph } from '../models/types.js'
import type { ResolvedNode, ResolvedPort, ResolvedSubgraph } from './resolved-types.js'

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
  nodes: Map<string, ResolvedNode>
  ports: Map<string, ResolvedPort>
  subgraphs: Map<string, ResolvedSubgraph>
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

// ============================================================================
// Helpers
// ============================================================================

type Side = 'top' | 'bottom' | 'left' | 'right'
interface PortInfo { name: string; side: Side }

function epId(ep: string | LinkEndpoint) { return typeof ep === 'string' ? ep : ep.node }
function epPort(ep: string | LinkEndpoint) { return typeof ep === 'string' ? undefined : ep.port }

// ============================================================================
// Pre-processing (done once)
// ============================================================================

interface PreProcessed {
  /** node/subgraph ID → parent container ID (null = top-level) */
  parentOf: Map<string, string | null>
  /** container ID → direct children IDs */
  childrenOf: Map<string | null, string[]>
  /** container ID → edges between its direct children: [fromChildId, toChildId] */
  edgesAt: Map<string | null, Array<[string, string]>>
  /** node ID → port infos */
  portsByNode: Map<string, PortInfo[]>
  /** node ID → Node */
  nodeMap: Map<string, Node>
  /** subgraph ID → Subgraph */
  sgMap: Map<string, Subgraph>
}

function preProcess(graph: NetworkGraph, direction: string): PreProcessed {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]))
  const sgMap = new Map(graph.subgraphs?.map((s) => [s.id, s]) ?? [])

  // Build parent map for all items
  const parentOf = new Map<string, string | null>()
  for (const sg of graph.subgraphs ?? []) {
    parentOf.set(sg.id, sg.parent ?? null)
  }
  for (const n of graph.nodes) {
    parentOf.set(n.id, n.parent ?? null)
  }

  // Children per container
  const childrenOf = new Map<string | null, string[]>()
  childrenOf.set(null, []) // top-level
  for (const sg of graph.subgraphs ?? []) childrenOf.set(sg.id, [])
  for (const [id, parent] of parentOf) {
    if (!childrenOf.has(parent)) childrenOf.set(parent, [])
    childrenOf.get(parent)!.push(id)
  }

  // Resolve nodeId → nearest ancestor that is a direct child of a given container
  // Pre-compute: nodeId → chain of ancestors up to top
  const ancestorChain = new Map<string, string[]>()
  for (const n of graph.nodes) {
    const chain: string[] = [n.id]
    let current: string | null | undefined = n.parent
    while (current) {
      chain.push(current)
      current = sgMap.get(current)?.parent
    }
    ancestorChain.set(n.id, chain)
  }

  function resolveAtLevel(nodeId: string, container: string | null): string | null {
    const chain = ancestorChain.get(nodeId)
    if (!chain) return null
    const children = childrenOf.get(container)
    if (!children) return null
    const childSet = new Set(children)
    for (const id of chain) {
      if (childSet.has(id)) return id
    }
    return null
  }

  // Build edges at each container level
  const edgesAt = new Map<string | null, Array<[string, string]>>()
  // Initialize
  edgesAt.set(null, [])
  for (const sg of graph.subgraphs ?? []) edgesAt.set(sg.id, [])

  const haPairs = new Set<string>()
  for (const link of graph.links) {
    if (link.redundancy) {
      const a = epId(link.from), b = epId(link.to)
      haPairs.add([a, b].sort().join(':'))
    }
  }

  // For each container, find links that cross between its direct children
  const allContainers: Array<string | null> = [null, ...(graph.subgraphs ?? []).map((s) => s.id)]
  for (const container of allContainers) {
    const edges: Array<[string, string]> = []
    for (const link of graph.links) {
      if (link.redundancy) continue // HA = same level
      const fromNode = epId(link.from)
      const toNode = epId(link.to)
      const fromChild = resolveAtLevel(fromNode, container)
      const toChild = resolveAtLevel(toNode, container)
      if (fromChild && toChild && fromChild !== toChild) {
        edges.push([fromChild, toChild])
      }
    }
    edgesAt.set(container, edges)
  }

  // Port collection
  const portsByNode = new Map<string, PortInfo[]>()
  const { src, dst } = flowSides(direction)
  const { src: haSrc, dst: haDst } = haSidesFor(direction)
  const seenPorts = new Set<string>()

  for (const link of graph.links) {
    const fromId = epId(link.from), toId = epId(link.to)
    const fromPort = epPort(link.from), toPort = epPort(link.to)
    const isHA = haPairs.has([fromId, toId].sort().join(':'))
    if (fromPort && !seenPorts.has(`${fromId}:${fromPort}`)) {
      seenPorts.add(`${fromId}:${fromPort}`)
      if (!portsByNode.has(fromId)) portsByNode.set(fromId, [])
      portsByNode.get(fromId)!.push({ name: fromPort, side: isHA ? haSrc : src })
    }
    if (toPort && !seenPorts.has(`${toId}:${toPort}`)) {
      seenPorts.add(`${toId}:${toPort}`)
      if (!portsByNode.has(toId)) portsByNode.set(toId, [])
      portsByNode.get(toId)!.push({ name: toPort, side: isHA ? haDst : dst })
    }
  }

  return { parentOf, childrenOf, edgesAt, portsByNode, nodeMap, sgMap }
}

function flowSides(d: string) {
  if (d === 'BT') return { src: 'top' as Side, dst: 'bottom' as Side }
  if (d === 'LR') return { src: 'right' as Side, dst: 'left' as Side }
  if (d === 'RL') return { src: 'left' as Side, dst: 'right' as Side }
  return { src: 'bottom' as Side, dst: 'top' as Side }
}
function haSidesFor(d: string) {
  return (d === 'LR' || d === 'RL')
    ? { src: 'bottom' as Side, dst: 'top' as Side }
    : { src: 'right' as Side, dst: 'left' as Side }
}

// ============================================================================
// Row grouping (uses pre-built edges)
// ============================================================================

function groupIntoRows(childIds: string[], edges: Array<[string, string]>): string[][] {
  if (childIds.length === 0) return []
  const idSet = new Set(childIds)

  const downstream = new Map<string, Set<string>>()
  const inDegree = new Map<string, number>()
  for (const id of childIds) { downstream.set(id, new Set()); inDegree.set(id, 0) }

  for (const [from, to] of edges) {
    if (idSet.has(from) && idSet.has(to) && !downstream.get(from)!.has(to)) {
      downstream.get(from)!.add(to)
      inDegree.set(to, (inDegree.get(to) ?? 0) + 1)
    }
  }

  // BFS layering
  const layer = new Map<string, number>()
  const queue: string[] = []
  for (const id of childIds) {
    if ((inDegree.get(id) ?? 0) === 0) { layer.set(id, 0); queue.push(id) }
  }
  while (queue.length > 0) {
    const id = queue.shift()!
    const l = layer.get(id)!
    for (const next of downstream.get(id) ?? []) {
      if (!layer.has(next) || layer.get(next)! < l + 1) {
        layer.set(next, l + 1)
        queue.push(next)
      }
    }
  }
  for (const id of childIds) { if (!layer.has(id)) layer.set(id, 0) }

  const maxL = Math.max(0, ...layer.values())
  const rows: string[][] = Array.from({ length: maxL + 1 }, () => [])
  for (const id of childIds) rows[layer.get(id)!]!.push(id)
  return rows.filter((r) => r.length > 0)
}

// ============================================================================
// Box model
// ============================================================================

interface Edges { top: number; right: number; bottom: number; left: number }

interface Box {
  kind: 'node' | 'subgraph'
  id: string
  node?: Node
  subgraph?: Subgraph
  rows: Box[][]
  padding: Edges
  margin: Edges
  rowGap: number
  colGap: number
  width: number
  height: number
  ports: PortInfo[]
}

function outerW(b: Box) { return b.margin.left + b.width + b.margin.right }
function outerH(b: Box) { return b.margin.top + b.height + b.margin.bottom }

// ============================================================================
// Measure (bottom-up, recursive)
// ============================================================================

function measureNode(id: string, pp: PreProcessed, opts: Required<NetworkLayoutOptions>): Box {
  const node = pp.nodeMap.get(id)!
  const ports = pp.portsByNode.get(id) ?? []

  const lines = Array.isArray(node.label) ? node.label.length : node.label ? 1 : 0
  const hasIcon = !!(node.type && getDeviceIcon(node.type))
  const iconH = hasIcon ? DEFAULT_ICON_SIZE : 0
  const gapH = iconH > 0 ? ICON_LABEL_GAP : 0
  const contentH = iconH + gapH + lines * LABEL_LINE_HEIGHT
  const labelLines = Array.isArray(node.label) ? node.label : node.label ? [node.label] : []
  const contentW = Math.max(0, ...labelLines.map((l) => l.length)) * ESTIMATED_CHAR_WIDTH

  const ps: Record<Side, number> = { top: 0, bottom: 0, left: 0, right: 0 }
  let maxPL = 0
  for (const p of ports) { ps[p.side]++; maxPL = Math.max(maxPL, p.name.length) }
  const portLabelExt = maxPL > 0 ? maxPL * SMALL_LABEL_CHAR_WIDTH + opts.portLabelPadding : 0

  const w = Math.max(opts.nodeWidth, contentW + NODE_HORIZONTAL_PADDING * 2, Math.max(ps.top, ps.bottom) * opts.minPortSpacing)
  const h = Math.max(60, contentH + NODE_VERTICAL_PADDING, Math.max(ps.left, ps.right) * opts.minPortSpacing)

  return {
    kind: 'node', id, node, rows: [], ports,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    margin: {
      top: ps.top > 0 ? portLabelExt : 0,
      bottom: ps.bottom > 0 ? portLabelExt : 0,
      left: ps.left > 0 ? portLabelExt : 0,
      right: ps.right > 0 ? portLabelExt : 0,
    },
    rowGap: 0, colGap: 0, width: w, height: h,
  }
}

function measureSubgraph(id: string, pp: PreProcessed, opts: Required<NetworkLayoutOptions>): Box {
  const sg = pp.sgMap.get(id)!
  const childIds = pp.childrenOf.get(id) ?? []

  // Measure children recursively
  const childBoxes = new Map<string, Box>()
  for (const cid of childIds) {
    if (pp.sgMap.has(cid)) childBoxes.set(cid, measureSubgraph(cid, pp, opts))
    else if (pp.nodeMap.has(cid)) childBoxes.set(cid, measureNode(cid, pp, opts))
  }

  // Group into rows
  const edges = pp.edgesAt.get(id) ?? []
  const rowIds = groupIntoRows(childIds, edges)
  const rows: Box[][] = rowIds.map((ids) => ids.map((cid) => childBoxes.get(cid)!).filter(Boolean))

  const gap = opts.gap
  const pad: Edges = {
    top: opts.subgraphPadding + opts.subgraphLabelHeight,
    right: opts.subgraphPadding,
    bottom: opts.subgraphPadding,
    left: opts.subgraphPadding,
  }

  // Content size from rows
  let contentW = 0, contentH = 0
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]!
    let rowW = 0, rowH = 0
    for (let c = 0; c < row.length; c++) {
      rowW += outerW(row[c]!); if (c < row.length - 1) rowW += gap
      rowH = Math.max(rowH, outerH(row[c]!))
    }
    contentW = Math.max(contentW, rowW)
    contentH += rowH; if (r < rows.length - 1) contentH += gap
  }
  if (rows.length === 0) { contentW = opts.nodeWidth; contentH = 40 }

  return {
    kind: 'subgraph', id, subgraph: sg, rows, ports: [],
    padding: pad,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    rowGap: gap, colGap: gap,
    width: contentW + pad.left + pad.right,
    height: contentH + pad.top + pad.bottom,
  }
}

// ============================================================================
// Arrange (top-down)
// ============================================================================

function arrangeRows(
  rows: Box[][], ox: number, oy: number,
  rowGap: number, colGap: number,
  nodes: Map<string, ResolvedNode>,
  subgraphs: Map<string, ResolvedSubgraph>,
  ports: Map<string, ResolvedPort>,
  opts: Required<NetworkLayoutOptions>,
): void {
  const maxRowW = Math.max(0, ...rows.map((row) => {
    let w = 0
    for (let i = 0; i < row.length; i++) { w += outerW(row[i]!); if (i < row.length - 1) w += colGap }
    return w
  }))

  let y = oy
  for (const row of rows) {
    let rowW = 0
    for (let i = 0; i < row.length; i++) { rowW += outerW(row[i]!); if (i < row.length - 1) rowW += colGap }
    let x = ox + (maxRowW - rowW) / 2
    let rowH = 0

    for (const box of row) {
      const bx = x + box.margin.left
      const by = y + box.margin.top

      if (box.kind === 'node' && box.node) {
        const cx = bx + box.width / 2, cy = by + box.height / 2
        nodes.set(box.id, { id: box.id, position: { x: cx, y: cy }, size: { width: box.width, height: box.height }, node: box.node })
        placeNodePorts(box, cx, cy, ports, opts)
      } else if (box.kind === 'subgraph' && box.subgraph) {
        subgraphs.set(box.id, { id: box.id, bounds: { x: bx, y: by, width: box.width, height: box.height }, subgraph: box.subgraph })
        arrangeRows(box.rows, bx + box.padding.left, by + box.padding.top, box.rowGap, box.colGap, nodes, subgraphs, ports, opts)
      }

      x += outerW(box) + colGap
      rowH = Math.max(rowH, outerH(box))
    }
    y += rowH + rowGap
  }
}

function placeNodePorts(box: Box, cx: number, cy: number, ports: Map<string, ResolvedPort>, opts: Required<NetworkLayoutOptions>): void {
  const bySide: Record<Side, PortInfo[]> = { top: [], bottom: [], left: [], right: [] }
  for (const p of box.ports) bySide[p.side].push(p)
  const hw = box.width / 2, hh = box.height / 2

  for (const side of ['top', 'bottom', 'left', 'right'] as Side[]) {
    const sp = bySide[side]
    for (let i = 0; i < sp.length; i++) {
      const p = sp[i]!
      const r = (i + 1) / (sp.length + 1)
      let ax: number, ay: number
      switch (side) {
        case 'top': ax = cx - hw + box.width * r; ay = cy - hh; break
        case 'bottom': ax = cx - hw + box.width * r; ay = cy + hh; break
        case 'left': ax = cx - hw; ay = cy - hh + box.height * r; break
        case 'right': ax = cx + hw; ay = cy - hh + box.height * r; break
      }
      ports.set(`${box.id}:${p.name}`, {
        id: `${box.id}:${p.name}`, nodeId: box.id, label: p.name,
        absolutePosition: { x: ax, y: ay }, side, size: { width: opts.portSize, height: opts.portSize },
      })
    }
  }
}

// ============================================================================
// Main
// ============================================================================

export function layoutNetwork(graph: NetworkGraph, options?: NetworkLayoutOptions): NetworkLayoutResult {
  const opts = { ...DEFAULTS, ...options }

  // Pre-process (once): container tree + connection graph + ports
  const pp = preProcess(graph, opts.direction)

  // Measure top-level children
  const topChildIds = pp.childrenOf.get(null) ?? []
  const topBoxes = new Map<string, Box>()
  for (const id of topChildIds) {
    if (pp.sgMap.has(id)) topBoxes.set(id, measureSubgraph(id, pp, opts))
    else if (pp.nodeMap.has(id)) topBoxes.set(id, measureNode(id, pp, opts))
  }

  // Group top-level into rows
  const topEdges = pp.edgesAt.get(null) ?? []
  const topRowIds = groupIntoRows(topChildIds, topEdges)
  const topRows: Box[][] = topRowIds.map((ids) => ids.map((id) => topBoxes.get(id)!).filter(Boolean))

  // Arrange
  const nodes = new Map<string, ResolvedNode>()
  const subgraphs = new Map<string, ResolvedSubgraph>()
  const ports = new Map<string, ResolvedPort>()
  arrangeRows(topRows, 0, 0, opts.topLevelGap, opts.gap, nodes, subgraphs, ports, opts)

  // Bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const rn of nodes.values()) {
    minX = Math.min(minX, rn.position.x - rn.size.width / 2); minY = Math.min(minY, rn.position.y - rn.size.height / 2)
    maxX = Math.max(maxX, rn.position.x + rn.size.width / 2); maxY = Math.max(maxY, rn.position.y + rn.size.height / 2)
  }
  for (const sg of subgraphs.values()) {
    minX = Math.min(minX, sg.bounds.x); minY = Math.min(minY, sg.bounds.y)
    maxX = Math.max(maxX, sg.bounds.x + sg.bounds.width); maxY = Math.max(maxY, sg.bounds.y + sg.bounds.height)
  }
  const pad = 50
  return {
    nodes, ports, subgraphs,
    bounds: minX === Infinity
      ? { x: 0, y: 0, width: 400, height: 300 }
      : { x: minX - pad, y: minY - pad, width: maxX - minX + pad * 2, height: maxY - minY + pad * 2 },
  }
}
