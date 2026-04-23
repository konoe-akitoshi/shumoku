// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Network-aware hierarchical layout.
 *
 * Thin adapter that turns a NetworkGraph into Sugiyama-style inputs,
 * delegates to the compound pipeline in `./sugiyama`, then folds the
 * result back into the Node/Subgraph records the rest of the system
 * already speaks. Port positions come from `placePorts`, which is
 * direction-aware and understands HA redundancy pairs.
 *
 * What this file still owns:
 *   - `computeNodeSize`       — single source of truth for node box sizing
 *   - `NetworkLayoutOptions`  — public knobs (direction/gap/fixed/…)
 *   - `layoutNetwork`         — the main entry that glues Sugiyama to the
 *                                Node/Subgraph/ResolvedPort world
 *
 * What it delegates:
 *   - Cycle removal, layer/order/coordinate assignment → `./sugiyama`
 *   - Port placement                                    → `./port-placement`
 *   - Subgraph bounds rebalance (for `fixed` overrides) → `./interaction`
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
  Direction,
  LinkEndpoint,
  NetworkGraph,
  Node,
  NodeSpec,
  Subgraph,
} from '../models/types.js'
import { rebalanceSubgraphs } from './interaction.js'
import { placePorts } from './port-placement.js'
import type { ResolvedPort } from './resolved-types.js'
import {
  type CompoundNode,
  type CompoundSubgraph,
  type Edge,
  layoutCompound,
} from './sugiyama/index.js'

// ============================================================================
// Options
// ============================================================================

export interface NetworkLayoutOptions {
  direction?: Direction
  gap?: number
  topLevelGap?: number
  subgraphPadding?: number
  subgraphLabelHeight?: number
  nodeWidth?: number
  minPortSpacing?: number
  portSize?: number
  portLabelPadding?: number
  /**
   * Nodes whose input `position` is a **hard constraint**. Sugiyama
   * runs as usual, then each fixed node is snapped back to its input
   * position (with its ports shifted by the same delta); subgraph
   * bounds are recomputed via rebalanceSubgraphs.
   *
   * Empty set keeps the legacy "re-layout everything" behaviour.
   */
  fixed?: Set<string>
  /**
   * Soft per-node x-coord hints. For any node listed here, the
   * Sugiyama coordinate pass uses the hint as the preferred x instead
   * of the barycenter of its predecessors — packing still prevents
   * overlap, so the final x may drift if the neighbourhood is tight.
   * y comes from the node's layer as usual (hints are x-only).
   *
   * Use hints for "nudge these nodes toward this x" scenarios; use
   * `fixed` when the position must be exact.
   */
  hints?: Map<string, { x: number }>
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
  fixed: new Set(),
  hints: new Map(),
}

// ============================================================================
// Node sizing
// ============================================================================

/**
 * Compute the appropriate size for a node based on its content.
 * Used by the layout engine, interactive addNewNode, and renderers.
 * `portCount` is the number of ports on the node — when the layout
 * engine invokes this it passes the count so very-wide port banks
 * grow the node rather than crowding its edge.
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
// Link-endpoint helpers
// ============================================================================

function epId(ep: string | LinkEndpoint) {
  return typeof ep === 'string' ? ep : ep.node
}

function epPort(ep: string | LinkEndpoint) {
  return typeof ep === 'string' ? undefined : ep.port
}

// ============================================================================
// NetworkGraph → Sugiyama conversion
// ============================================================================

/**
 * Count how many distinct ports each node exposes (dedup by name).
 * Used to size nodes so their port banks fit along the edges.
 */
function countPortsPerNode(graph: NetworkGraph): Map<string, number> {
  const seen = new Set<string>()
  const counts = new Map<string, number>()
  const bump = (id: string, name: string | undefined) => {
    if (!name) return
    const key = `${id}:${name}`
    if (seen.has(key)) return
    seen.add(key)
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  for (const link of graph.links) {
    bump(epId(link.from), epPort(link.from))
    bump(epId(link.to), epPort(link.to))
  }
  return counts
}

/**
 * Build a parent-pointer map covering both nodes and subgraphs. `null`
 * means top level.
 */
function buildParentOf(graph: NetworkGraph): Map<string, string | null> {
  const parentOf = new Map<string, string | null>()
  for (const sg of graph.subgraphs ?? []) parentOf.set(sg.id, sg.parent ?? null)
  for (const n of graph.nodes) parentOf.set(n.id, n.parent ?? null)
  return parentOf
}

/**
 * Convert links to Sugiyama edges, **promoting cross-container links
 * to their common ancestor**. A link from a node deep in sg1 to a node
 * deep in sg2 becomes an edge between sg1 and sg2 at the top level —
 * that way containers are arranged with awareness of inter-container
 * connectivity, rather than drifting apart because the raw link drops
 * out of every container's filter.
 *
 * Redundancy (HA) links are skipped: they don't represent a flow
 * direction, so we don't want them driving layer assignment. Their
 * port sides are still handled separately by `placePorts`.
 */
function buildCompoundEdges(graph: NetworkGraph, parentOf: Map<string, string | null>): Edge[] {
  const commonAncestor = (a: string, b: string): string | null => {
    const aChain = new Set<string | null>()
    let cur: string | null = a
    while (true) {
      aChain.add(cur)
      if (cur === null) break
      cur = parentOf.get(cur) ?? null
    }
    cur = b
    while (true) {
      if (aChain.has(cur)) return cur
      if (cur === null) break
      cur = parentOf.get(cur) ?? null
    }
    return null
  }

  // Walk up from `id` until its parent equals `level`. The returned
  // id is the direct child of `level` on the path to `id` (possibly
  // `id` itself).
  const resolveChild = (id: string, level: string | null): string => {
    let cur = id
    while (true) {
      const parent = parentOf.get(cur) ?? null
      if (parent === level) return cur
      if (parent === null) return cur
      cur = parent
    }
  }

  const edges: Edge[] = []
  for (const [i, link] of graph.links.entries()) {
    if (link.redundancy) continue
    const s = epId(link.from)
    const t = epId(link.to)
    const level = commonAncestor(s, t)
    const srcAtLevel = resolveChild(s, level)
    const tgtAtLevel = resolveChild(t, level)
    if (srcAtLevel === tgtAtLevel) continue
    edges.push({
      id: (link as { id?: string }).id ?? `link-${i}`,
      source: srcAtLevel,
      target: tgtAtLevel,
    })
  }
  return edges
}

// ============================================================================
// Fixed-position post-process
// ============================================================================

/**
 * Snap each fixed node to its input position (overriding the algorithm's
 * choice) and shift its ports by the same delta so they stay attached.
 * Subgraph bounds are recomputed from the actual positions afterward.
 */
function applyFixedOverride(
  nodes: Map<string, Node>,
  ports: Map<string, ResolvedPort>,
  subgraphs: Map<string, Subgraph>,
  fixed: Set<string>,
  inputNodes: Node[],
): void {
  if (fixed.size === 0) return
  const inputPositions = new Map<string, { x: number; y: number }>()
  for (const n of inputNodes) {
    if (n.position && fixed.has(n.id)) inputPositions.set(n.id, n.position)
  }
  let anyMoved = false
  for (const [id, target] of inputPositions) {
    const arranged = nodes.get(id)
    if (!arranged?.position) continue
    const dx = target.x - arranged.position.x
    const dy = target.y - arranged.position.y
    if (dx === 0 && dy === 0) continue
    anyMoved = true
    nodes.set(id, { ...arranged, position: { x: target.x, y: target.y } })
    for (const [pid, port] of ports) {
      if (port.nodeId !== id) continue
      ports.set(pid, {
        ...port,
        absolutePosition: {
          x: port.absolutePosition.x + dx,
          y: port.absolutePosition.y + dy,
        },
      })
    }
  }
  if (anyMoved) rebalanceSubgraphs(nodes, subgraphs, ports)
}

// ============================================================================
// Main entry
// ============================================================================

/**
 * **Structural** full-graph layout. Runs the Sugiyama pipeline over
 * the entire `NetworkGraph` (cycle-breaking → layer assignment →
 * crossing reduction → coordinate assignment), then places ports and
 * applies `fixed` / `hints` post-processing. Use this for:
 *
 *   - initial layout of a freshly-parsed graph (YAML import)
 *   - "Auto-arrange" / re-layout after heavy editing
 *   - "Arrange selection": pass `fixed` for the nodes you want kept,
 *     let the algorithm reposition the rest
 *   - "Nudge these nodes toward these x values": use `hints`
 *
 * For **geometric** placement of one node at a specific point without
 * disturbing the rest (user drop, paste at cursor), use `placeNode`.
 * That's deliberately a separate, cheaper primitive — this function
 * is O(V + E) with libavoid-class constants.
 */
export function layoutNetwork(
  graph: NetworkGraph,
  options?: NetworkLayoutOptions,
): NetworkLayoutResult {
  const opts = { ...DEFAULTS, ...options }

  // Size each node with its port count so wide port banks get room.
  const portCounts = countPortsPerNode(graph)
  const compoundNodes: CompoundNode[] = graph.nodes.map((n) => ({
    id: n.id,
    parent: n.parent ?? null,
    size: computeNodeSize(n, portCounts.get(n.id) ?? 0),
  }))
  const compoundSubgraphs: CompoundSubgraph[] = (graph.subgraphs ?? []).map((s) => ({
    id: s.id,
    parent: s.parent ?? null,
  }))
  const parentOf = buildParentOf(graph)
  const edges = buildCompoundEdges(graph, parentOf)

  // Compound Sugiyama: positions every node, bounds every subgraph.
  const result = layoutCompound(compoundNodes, compoundSubgraphs, edges, {
    direction: opts.direction,
    nodeGap: opts.gap,
    layerGap: opts.topLevelGap,
    subgraphPadding: opts.subgraphPadding,
    subgraphLabelHeight: opts.subgraphLabelHeight,
    hints: opts.hints.size > 0 ? opts.hints : undefined,
  })

  // Fold positions back onto Node / Subgraph records.
  const nodes = new Map<string, Node>()
  for (const n of graph.nodes) {
    const pos = result.nodePositions.get(n.id)
    nodes.set(n.id, pos ? { ...n, position: pos } : n)
  }
  const subgraphs = new Map<string, Subgraph>()
  for (const s of graph.subgraphs ?? []) {
    const bounds = result.subgraphBounds.get(s.id)
    subgraphs.set(s.id, bounds ? { ...s, bounds } : s)
  }

  // Ports come from positioned nodes via the existing direction-aware
  // placer, which also handles HA pairs (sides perpendicular to flow).
  const ports = placePorts(nodes, graph.links, opts.direction)

  applyFixedOverride(nodes, ports, subgraphs, opts.fixed, graph.nodes)

  // Add a comfortable margin around the tight extents. The empty-graph
  // fallback size matches the legacy implementation so callers that
  // relied on the default canvas size aren't surprised.
  const pad = 50
  const rb = result.rootBounds
  const bounds: Bounds =
    rb.width === 0 && rb.height === 0
      ? { x: 0, y: 0, width: 400, height: 300 }
      : {
          x: rb.x - pad,
          y: rb.y - pad,
          width: rb.width + pad * 2,
          height: rb.height + pad * 2,
        }

  return { nodes, ports, subgraphs, bounds }
}
