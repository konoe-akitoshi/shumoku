// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Network-aware Hierarchical Layout Engine
 *
 * Custom layout engine designed specifically for network topology diagrams.
 * Unlike ELK's general-purpose graph layout, this engine:
 * - Reserves routing channels between layers for libavoid
 * - Places HA pairs side-by-side naturally
 * - Understands network hierarchy (sources flow downward)
 *
 * Algorithm:
 * 1. Layer assignment — topological sort from source nodes
 * 2. HA pair detection — merge pairs into same layer
 * 3. Node ordering — minimize crossings (barycenter heuristic)
 * 4. Position assignment — with routing channel gaps
 * 5. Subgraph bounds — bounding boxes around grouped nodes
 */

import {
  DEFAULT_ICON_SIZE,
  ESTIMATED_CHAR_WIDTH,
  ICON_LABEL_GAP,
  LABEL_LINE_HEIGHT,
  NODE_HORIZONTAL_PADDING,
  NODE_VERTICAL_PADDING,
} from '../constants.js'
import { getDeviceIcon } from '../icons/index.js'
import type {
  Bounds,
  Link,
  LinkEndpoint,
  NetworkGraph,
  Node,
} from '../models/types.js'
import type { ResolvedNode, ResolvedSubgraph } from './resolved-types.js'

// ============================================================================
// Types
// ============================================================================

export interface NetworkLayoutOptions {
  direction?: 'TB' | 'BT' | 'LR' | 'RL'
  /** Horizontal spacing between nodes in the same layer */
  nodeSpacing?: number
  /** Vertical spacing between layers (includes routing channel) */
  layerSpacing?: number
  /** Extra space between layers reserved for edge routing */
  routingChannelSize?: number
  /** Padding inside subgraph boxes */
  subgraphPadding?: number
  /** Node width (default auto-calculated) */
  nodeWidth?: number
}

interface LayerAssignment {
  /** Node ID → layer index (0 = top) */
  layers: Map<string, number>
  /** Layer count */
  layerCount: number
}

// ============================================================================
// Helpers
// ============================================================================

function getNodeId(endpoint: string | LinkEndpoint): string {
  return typeof endpoint === 'string' ? endpoint : endpoint.node
}

function detectHAPairs(links: Link[]): Map<string, string> {
  // Returns Map: nodeA → nodeB (both directions)
  const pairs = new Map<string, string>()
  for (const link of links) {
    if (!link.redundancy) continue
    const a = getNodeId(link.from)
    const b = getNodeId(link.to)
    pairs.set(a, b)
    pairs.set(b, a)
  }
  return pairs
}

function calculateNodeHeight(node: Node): number {
  const lines = Array.isArray(node.label) ? node.label.length : node.label ? 1 : 0
  const labelHeight = lines * LABEL_LINE_HEIGHT
  const hasIcon = !!(node.type && getDeviceIcon(node.type))
  const iconHeight = hasIcon ? DEFAULT_ICON_SIZE : 0
  const gap = iconHeight > 0 ? ICON_LABEL_GAP : 0
  const contentHeight = iconHeight + gap + labelHeight
  return Math.max(60, contentHeight + NODE_VERTICAL_PADDING)
}

function calculateNodeWidth(node: Node, defaultWidth: number): number {
  const lines = Array.isArray(node.label) ? node.label : node.label ? [node.label] : []
  const maxLabelWidth = Math.max(...lines.map((l) => l.length), 0) * ESTIMATED_CHAR_WIDTH
  return Math.max(defaultWidth, maxLabelWidth + NODE_HORIZONTAL_PADDING * 2)
}

// ============================================================================
// Layer Assignment
// ============================================================================

/**
 * Assign nodes to layers using topological sort (BFS from sources).
 * Source nodes (no incoming edges) go to layer 0.
 * HA pairs are forced to the same layer.
 * Explicit `rank` on nodes overrides auto-assignment.
 */
function assignLayers(graph: NetworkGraph, haPairs: Map<string, string>): LayerAssignment {
  const nodeIds = new Set(graph.nodes.map((n) => n.id))

  // Build adjacency: who does each node connect TO (downstream)
  const downstream = new Map<string, Set<string>>()
  const upstream = new Map<string, Set<string>>()
  for (const id of nodeIds) {
    downstream.set(id, new Set())
    upstream.set(id, new Set())
  }

  for (const link of graph.links) {
    if (link.redundancy) continue // HA links don't define hierarchy
    const from = getNodeId(link.from)
    const to = getNodeId(link.to)
    if (nodeIds.has(from) && nodeIds.has(to)) {
      downstream.get(from)!.add(to)
      upstream.get(to)!.add(from)
    }
  }

  // Find sources (no upstream, excluding HA-only connections)
  const sources: string[] = []
  for (const id of nodeIds) {
    if (upstream.get(id)!.size === 0) {
      sources.push(id)
    }
  }

  // BFS from sources
  const layers = new Map<string, number>()
  const queue: Array<{ id: string; layer: number }> = []

  for (const id of sources) {
    queue.push({ id, layer: 0 })
  }

  while (queue.length > 0) {
    const { id, layer } = queue.shift()!
    if (layers.has(id)) {
      // Already assigned — take the maximum layer (longest path)
      if (layers.get(id)! >= layer) continue
    }
    layers.set(id, layer)

    for (const next of downstream.get(id) ?? []) {
      queue.push({ id: next, layer: layer + 1 })
    }
  }

  // Assign unvisited nodes (isolated or cycle members) to layer 0
  for (const id of nodeIds) {
    if (!layers.has(id)) {
      layers.set(id, 0)
    }
  }

  // Apply explicit rank overrides
  for (const node of graph.nodes) {
    if (node.rank !== undefined) {
      const rank = typeof node.rank === 'number' ? node.rank : Number.parseInt(node.rank, 10)
      if (!Number.isNaN(rank)) {
        layers.set(node.id, rank)
      }
    }
  }

  // Force HA pairs to same layer (use the minimum)
  for (const [a, b] of haPairs) {
    const la = layers.get(a) ?? 0
    const lb = layers.get(b) ?? 0
    const minLayer = Math.min(la, lb)
    layers.set(a, minLayer)
    layers.set(b, minLayer)
  }

  const layerCount = Math.max(0, ...layers.values()) + 1

  return { layers, layerCount }
}

// ============================================================================
// Node Ordering
// ============================================================================

/**
 * Order nodes within each layer to minimize edge crossings.
 * Uses barycenter heuristic: position each node at the average
 * position of its connected nodes in the adjacent layer.
 *
 * HA pairs are placed adjacent to each other.
 */
function orderNodesInLayers(
  graph: NetworkGraph,
  assignment: LayerAssignment,
  haPairs: Map<string, string>,
): string[][] {
  const { layers, layerCount } = assignment

  // Group nodes by layer
  const layerNodes: string[][] = Array.from({ length: layerCount }, () => [])
  for (const node of graph.nodes) {
    const layer = layers.get(node.id) ?? 0
    layerNodes[layer]!.push(node.id)
  }

  // Build connection map for barycenter
  const connections = new Map<string, string[]>()
  for (const link of graph.links) {
    if (link.redundancy) continue
    const from = getNodeId(link.from)
    const to = getNodeId(link.to)
    if (!connections.has(from)) connections.set(from, [])
    if (!connections.has(to)) connections.set(to, [])
    connections.get(from)!.push(to)
    connections.get(to)!.push(from)
  }

  // Barycenter ordering (2 passes: forward + backward)
  for (let pass = 0; pass < 2; pass++) {
    const start = pass === 0 ? 1 : layerCount - 2
    const end = pass === 0 ? layerCount : -1
    const step = pass === 0 ? 1 : -1

    for (let l = start; l !== end; l += step) {
      const currentLayer = layerNodes[l]!
      const refLayer = layerNodes[l - step]
      if (!refLayer || currentLayer.length <= 1) continue

      // Build position index for reference layer
      const refPos = new Map<string, number>()
      for (let i = 0; i < refLayer.length; i++) {
        refPos.set(refLayer[i]!, i)
      }

      // Compute barycenter for each node
      const barycenters = new Map<string, number>()
      for (const nodeId of currentLayer) {
        const conns = connections.get(nodeId) ?? []
        const refPositions = conns
          .map((c) => refPos.get(c))
          .filter((p): p is number => p !== undefined)
        if (refPositions.length > 0) {
          barycenters.set(
            nodeId,
            refPositions.reduce((a, b) => a + b, 0) / refPositions.length,
          )
        } else {
          barycenters.set(nodeId, currentLayer.indexOf(nodeId))
        }
      }

      // Sort by barycenter
      currentLayer.sort((a, b) => (barycenters.get(a) ?? 0) - (barycenters.get(b) ?? 0))
    }
  }

  // Ensure HA pairs are adjacent
  for (let l = 0; l < layerCount; l++) {
    const layer = layerNodes[l]!
    for (let i = 0; i < layer.length; i++) {
      const nodeId = layer[i]!
      const partner = haPairs.get(nodeId)
      if (!partner) continue
      const partnerIdx = layer.indexOf(partner)
      if (partnerIdx === -1 || Math.abs(i - partnerIdx) === 1) continue
      // Move partner next to node
      layer.splice(partnerIdx, 1)
      layer.splice(i + 1, 0, partner)
    }
  }

  return layerNodes
}

// ============================================================================
// Position Assignment
// ============================================================================

export interface NetworkLayoutResult {
  nodes: Map<string, ResolvedNode>
  subgraphs: Map<string, ResolvedSubgraph>
  bounds: Bounds
}

/**
 * Compute absolute positions for all nodes.
 * Layers are laid out top-to-bottom (TB) with routing channels between.
 */
function assignPositions(
  graph: NetworkGraph,
  orderedLayers: string[][],
  options: Required<NetworkLayoutOptions>,
): Map<string, ResolvedNode> {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]))
  const nodes = new Map<string, ResolvedNode>()

  let y = options.subgraphPadding

  for (const layer of orderedLayers) {
    if (layer.length === 0) continue

    // Calculate sizes for all nodes in this layer
    const sizes = layer.map((id) => {
      const node = nodeMap.get(id)!
      const w = calculateNodeWidth(node, options.nodeWidth ?? 180)
      const h = calculateNodeHeight(node)
      return { id, node, w, h }
    })

    const maxHeight = Math.max(...sizes.map((s) => s.h))

    // Calculate total width of this layer
    const totalWidth = sizes.reduce((sum, s) => sum + s.w, 0) + (sizes.length - 1) * options.nodeSpacing

    // Center the layer horizontally
    let x = -totalWidth / 2

    for (const { id, node, w, h } of sizes) {
      const cx = x + w / 2
      const cy = y + maxHeight / 2

      nodes.set(id, {
        id,
        position: { x: cx, y: cy },
        size: { width: w, height: h },
        node,
      })

      x += w + options.nodeSpacing
    }

    // Move to next layer: node height + routing channel + layer spacing
    y += maxHeight + options.routingChannelSize + options.layerSpacing
  }

  return nodes
}

// ============================================================================
// Subgraph Bounds
// ============================================================================

function computeSubgraphBounds(
  graph: NetworkGraph,
  nodes: Map<string, ResolvedNode>,
  padding: number,
): Map<string, ResolvedSubgraph> {
  const subgraphs = new Map<string, ResolvedSubgraph>()
  if (!graph.subgraphs) return subgraphs

  // Build parent map: nodeId → subgraphId
  const parentMap = new Map<string, string>()
  for (const node of graph.nodes) {
    if (node.parent) {
      parentMap.set(node.id, node.parent)
    }
  }

  // For each subgraph, compute bounding box of contained nodes
  for (const sg of graph.subgraphs) {
    const childNodes = graph.nodes.filter((n) => n.parent === sg.id)
    if (childNodes.length === 0) continue

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const child of childNodes) {
      const rn = nodes.get(child.id)
      if (!rn) continue
      const halfW = rn.size.width / 2
      const halfH = rn.size.height / 2
      minX = Math.min(minX, rn.position.x - halfW)
      minY = Math.min(minY, rn.position.y - halfH)
      maxX = Math.max(maxX, rn.position.x + halfW)
      maxY = Math.max(maxY, rn.position.y + halfH)
    }

    if (minX === Infinity) continue

    // Add padding + label height
    const labelHeight = 24
    subgraphs.set(sg.id, {
      id: sg.id,
      bounds: {
        x: minX - padding,
        y: minY - padding - labelHeight,
        width: maxX - minX + padding * 2,
        height: maxY - minY + padding * 2 + labelHeight,
      },
      subgraph: sg,
    })
  }

  return subgraphs
}

// ============================================================================
// Main Layout Function
// ============================================================================

const DEFAULT_OPTIONS: Required<NetworkLayoutOptions> = {
  direction: 'TB',
  nodeSpacing: 60,
  layerSpacing: 40,
  routingChannelSize: 80,
  subgraphPadding: 24,
  nodeWidth: 180,
}

/**
 * Layout a network graph using network-aware hierarchical algorithm.
 *
 * Returns ResolvedNodes (center positions) and ResolvedSubgraphs (bounds).
 * Use placePorts() and routeEdges() for the remaining steps.
 */
export function layoutNetwork(
  graph: NetworkGraph,
  options?: NetworkLayoutOptions,
): NetworkLayoutResult {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // 1. Detect HA pairs
  const haPairs = detectHAPairs(graph.links)

  // 2. Assign layers
  const assignment = assignLayers(graph, haPairs)

  // 3. Order nodes within layers
  const orderedLayers = orderNodesInLayers(graph, assignment, haPairs)

  // 4. Assign positions
  const nodes = assignPositions(graph, orderedLayers, opts)

  // 5. Compute subgraph bounds
  const subgraphs = computeSubgraphBounds(graph, nodes, opts.subgraphPadding)

  // 6. Compute overall bounds
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const rn of nodes.values()) {
    const halfW = rn.size.width / 2
    const halfH = rn.size.height / 2
    minX = Math.min(minX, rn.position.x - halfW)
    minY = Math.min(minY, rn.position.y - halfH)
    maxX = Math.max(maxX, rn.position.x + halfW)
    maxY = Math.max(maxY, rn.position.y + halfH)
  }
  for (const sg of subgraphs.values()) {
    minX = Math.min(minX, sg.bounds.x)
    minY = Math.min(minY, sg.bounds.y)
    maxX = Math.max(maxX, sg.bounds.x + sg.bounds.width)
    maxY = Math.max(maxY, sg.bounds.y + sg.bounds.height)
  }

  const padding = 50
  const bounds: Bounds = {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  }

  return { nodes, subgraphs, bounds }
}
