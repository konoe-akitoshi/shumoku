// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Auto-placement entry — flat-tree algorithm wrapped behind a
 * `LayoutEngine`.
 *
 * Builds on the existing pipeline:
 *
 *   1. Decide port sides (uses the in-tree `decidePortSides`).
 *   2. Compute node footprints via `engine.nodeFootprint` — the
 *      engine measures port labels through its TextMeasurer.
 *   3. Run the existing `layoutFlatTree` algorithm with the
 *      per-side port info threaded in.
 *   4. Place ports via the existing `placePorts`.
 *   5. Return a `NetworkLayoutResult` (Node ↦ position+size,
 *      Subgraph ↦ bounds, ResolvedPort map, root bounds).
 *
 * This entry is direction-aware (the engine's rules are not).
 * It's the right boundary: rules say how big things should be,
 * the algorithm decides where to put them given a flow
 * direction.
 */

import type { Bounds, Direction, NetworkGraph, Node, Subgraph } from '../../../models/types.js'
import type { LayoutEngine, PortInfo, PortsBySide } from '../../engine/index.js'
import { rebalanceSubgraphs } from '../../interaction.js'
import type { ResolvedPort } from '../../resolved-types.js'
import { layoutFlatTree } from './index.js'
import { decidePortSides, placePorts } from './port-placement.js'

export interface AutoLayoutOptions {
  direction?: Direction
  /** Sibling block gap in the outer tidy-tree. Optional; engine spacing applies otherwise. */
  nodeGap?: number
  /** Vertical layer gap in the outer tidy-tree. Optional. */
  layerGap?: number
  /** Override subgraph hull padding. Optional. */
  subgraphPadding?: number
  /** Override subgraph label band height. Optional. */
  subgraphLabelHeight?: number
  /** Nodes whose input `position` must be honoured exactly. */
  fixed?: Set<string>
  /** Soft per-node x-coord hints. */
  hints?: Map<string, { x: number }>
}

export interface AutoLayoutResult {
  nodes: Map<string, Node>
  ports: Map<string, ResolvedPort>
  subgraphs: Map<string, Subgraph>
  bounds: Bounds
}

const DEFAULTS: Required<AutoLayoutOptions> = {
  direction: 'TB',
  nodeGap: 30,
  layerGap: 80,
  subgraphPadding: 20,
  subgraphLabelHeight: 28,
  fixed: new Set(),
  hints: new Map(),
}

type Side = 'top' | 'bottom' | 'left' | 'right'

// ─────────────────────────────────────────────────────────────
// Direction-flip heuristics (algorithm-side, not engine-side)
// ─────────────────────────────────────────────────────────────

const LEAF_DEVICE_TYPES: ReadonlySet<string> = new Set([
  'access-point',
  'cpe',
  'server',
  'database',
  'console-server',
])
const UPSTREAM_DEVICE_TYPES: ReadonlySet<string> = new Set(['internet', 'cloud'])

function flowSides(direction: Direction): { source: Side; dest: Side } {
  switch (direction) {
    case 'TB':
      return { source: 'bottom', dest: 'top' }
    case 'BT':
      return { source: 'top', dest: 'bottom' }
    case 'LR':
      return { source: 'right', dest: 'left' }
    case 'RL':
      return { source: 'left', dest: 'right' }
  }
}

function deviceType(node: Node | undefined): string | undefined {
  const spec = node?.spec
  if (!spec) return undefined
  if (spec.kind === 'hardware' || spec.kind === 'compute') return spec.type
  return undefined
}

function shouldFlipForLayout(
  link: NetworkGraph['links'][number],
  nodes: Map<string, Node>,
  direction: Direction,
): boolean {
  const sides = flowSides(direction)
  const fromNode = nodes.get(link.from.node)
  const toNode = nodes.get(link.to.node)
  const fromSide = fromNode?.ports?.find((p) => p.id === link.from.port)?.placement?.side
  const toSide = toNode?.ports?.find((p) => p.id === link.to.port)?.placement?.side
  if (fromSide === sides.dest) return true
  if (toSide === sides.source) return true
  if (fromSide === sides.source) return false
  if (toSide === sides.dest) return false
  const fromType = deviceType(fromNode)
  const toType = deviceType(toNode)
  if (fromType && LEAF_DEVICE_TYPES.has(fromType) && toType && !LEAF_DEVICE_TYPES.has(toType)) {
    return true
  }
  if (
    toType &&
    UPSTREAM_DEVICE_TYPES.has(toType) &&
    fromType &&
    !UPSTREAM_DEVICE_TYPES.has(fromType)
  ) {
    return true
  }
  return false
}

// ─────────────────────────────────────────────────────────────
// Fixed-position snap-back
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
// Entry
// ─────────────────────────────────────────────────────────────

/**
 * Lay out a network graph using the flat-tree algorithm,
 * using the supplied `LayoutEngine` for rules (sizes, gaps,
 * label widths).
 *
 * Equivalent to the legacy `layoutNetwork(graph, options)`,
 * but the engine is now a first-class concept. The same engine
 * instance can also serve manual placement (`engine.tryPlace`)
 * so layout and drag-snap stay consistent.
 */
export function autoLayoutFlatTree(
  graph: NetworkGraph,
  engine: LayoutEngine,
  options: AutoLayoutOptions = {},
): AutoLayoutResult {
  const opts = { ...DEFAULTS, ...options }

  // 1. Decide port sides — algorithm-side (direction-aware).
  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]))
  const portAssignments = decidePortSides(graph.links, nodesById, opts.direction)

  // Aggregate into the rich PortsBySide (PortInfo[] per side)
  // format the engine consumes.
  const portsBySideById = new Map<string, PortsBySide>()
  for (const a of portAssignments) {
    let bucket = portsBySideById.get(a.nodeId)
    if (!bucket) {
      bucket = { top: [], bottom: [], left: [], right: [] }
      portsBySideById.set(a.nodeId, bucket)
    }
    const node = nodesById.get(a.nodeId)
    const port = node?.ports?.find((p) => p.id === a.portId)
    const info: PortInfo = { id: a.portId, label: port?.label }
    bucket[a.side].push(info)
  }

  // 2. Compute footprints via engine (engine measures labels
  // through TextMeasurer internally — no maxPortLabelPx
  // parameter needed).
  const sizeById = new Map<string, { width: number; height: number }>()
  for (const n of graph.nodes) {
    const ports = portsBySideById.get(n.id)
    sizeById.set(n.id, engine.nodeFootprint(n, ports ? { portsBySide: ports } : undefined))
  }

  // 3. Run flat-tree algorithm. The existing layoutFlatTree
  // takes the count-only PortsBySide form (its port-extent
  // adapter uses only the per-side existence flag). We convert
  // here so the algorithm internals don't need a port-info
  // signature change in this PR.
  const subgraphsById = new Map((graph.subgraphs ?? []).map((s) => [s.id, s] as const))
  const countOnly = new Map<string, { top: number; bottom: number; left: number; right: number }>()
  for (const [id, p] of portsBySideById) {
    countOnly.set(id, {
      top: p.top.length,
      bottom: p.bottom.length,
      left: p.left.length,
      right: p.right.length,
    })
  }
  const result = layoutFlatTree(
    graph,
    nodesById,
    subgraphsById,
    sizeById,
    (link) => shouldFlipForLayout(link, nodesById, opts.direction),
    {
      direction: opts.direction,
      nodeGap: opts.nodeGap,
      layerGap: opts.layerGap,
      subgraphPadding: opts.subgraphPadding,
      subgraphLabelHeight: opts.subgraphLabelHeight,
      metrics: engine.metrics,
      portsBySideById: countOnly,
    },
  )

  // 4. Fold results into the Node / Subgraph records.
  const nodes = new Map<string, Node>()
  for (const n of graph.nodes) {
    const pos = result.nodePositions.get(n.id)
    const size = sizeById.get(n.id)
    const folded: Node = { ...n, ...(pos ? { position: pos } : {}), ...(size ? { size } : {}) }
    nodes.set(n.id, folded)
  }
  const subgraphs = new Map<string, Subgraph>()
  for (const s of graph.subgraphs ?? []) {
    const bounds = result.subgraphBounds.get(s.id)
    subgraphs.set(s.id, bounds ? { ...s, bounds } : s)
  }

  // 5. Port positions via the existing direction-aware placer.
  const ports = placePorts(nodes, graph.links, opts.direction)

  applyFixedOverride(nodes, ports, subgraphs, opts.fixed, graph.nodes)

  // 5b. Final safety pass — recompute subgraph hulls from
  // children, resolve sibling-subgraph overlaps via the engine,
  // and push free nodes away from subgraphs they don't belong
  // to. The flat-tree's own block-sizing should already satisfy
  // invariant 2 (sibling hulls disjoint), but it currently
  // leaks overlaps on real samples; we rely on the engine's
  // collision resolver as the authoritative final check so
  // layout output never violates the contract.
  rebalanceSubgraphs(nodes, subgraphs, ports)

  // 6. Bounds with comfortable margin.
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
