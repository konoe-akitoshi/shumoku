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
import { linkSpeedBps } from '../../link-utils.js'
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
  tier: ReadonlyMap<string, number>,
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
  // No port-placement or device-type signal — common for auto-
  // discovered topologies that carry neither. Fall back to link
  // SPEED: a device's tier is the fastest link it terminates
  // (100G/400G backbone vs 1G/10G access), so the higher-tier
  // endpoint is the structural parent and the fabric core floats
  // upstream (parent = root = top, per the outer-tree convention).
  //
  // When both ends top out at the SAME speed there is no
  // bandwidth signal — e.g. two core routers across a shared 800G
  // link, or a switch and its host that only share a 1G link. We
  // keep the authored from→to rather than guess. Degree must NOT
  // break the tie: a high-degree node is an access *aggregator*
  // (many downlinks) which sits DOWNSTREAM, so degree-as-parent
  // inverts the hierarchy (it would pull a 48-port leaf switch or
  // a traffic generator above the core it hangs off).
  const fromTier = tier.get(link.from.node) ?? 0
  const toTier = tier.get(link.to.node) ?? 0
  if (toTier !== fromTier) return toTier > fromTier
  return false
}

/**
 * Per-node tier = the fastest link it terminates (bits/sec). Drives
 * the speed-based flip fallback so the high-bandwidth fabric core
 * is oriented upstream of the slower access edge. Links with no
 * resolvable speed contribute 0 (they fall through to the degree
 * tie-break).
 */
function computeTier(links: NetworkGraph['links']): Map<string, number> {
  const tier = new Map<string, number>()
  for (const link of links) {
    if (link.redundancy) continue
    const bps = linkSpeedBps(link) ?? 0
    if (bps > (tier.get(link.from.node) ?? 0)) tier.set(link.from.node, bps)
    if (bps > (tier.get(link.to.node) ?? 0)) tier.set(link.to.node, bps)
  }
  return tier
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

  // 1. Decide port sides — algorithm-side (direction-aware). The
  // tier-driven flip predicate is shared with the tidy-tree below so the
  // port sides (and the gaps derived from them) match the orientation
  // the layout will actually use: a flipped parent→child link reserves
  // vertical room on the facing sides instead of crowding to the bare
  // label gap.
  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]))
  const tier = computeTier(graph.links)
  const shouldFlip = (link: NetworkGraph['links'][number]): boolean =>
    shouldFlipForLayout(link, nodesById, opts.direction, tier)
  const portAssignments = decidePortSides(graph.links, nodesById, opts.direction, shouldFlip)

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
  const result = layoutFlatTree(graph, nodesById, subgraphsById, sizeById, shouldFlip, {
    direction: opts.direction,
    nodeGap: opts.nodeGap,
    layerGap: opts.layerGap,
    subgraphPadding: opts.subgraphPadding,
    subgraphLabelHeight: opts.subgraphLabelHeight,
    metrics: engine.metrics,
    portsBySideById: countOnly,
  })

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
  // layout output never violates the contract. Pass through the
  // caller-supplied subgraph spacing so the rebalance honours
  // it instead of falling back to the interaction defaults.
  rebalanceSubgraphs(nodes, subgraphs, ports, {
    subgraphPadding: opts.subgraphPadding,
    subgraphLabelHeight: opts.subgraphLabelHeight,
    direction: opts.direction,
  })

  // 6. Bounds with comfortable margin. Recompute from the
  // post-rebalance state — `result.rootBounds` describes the
  // pre-rebalance layout, so any shift from 5b would otherwise
  // leave shifted entities outside the returned bounds.
  const bounds = computeBounds(nodes, subgraphs)

  return { nodes, ports, subgraphs, bounds }
}

/**
 * Tight bbox over every positioned node + every subgraph
 * hull, expanded by a comfortable margin so the caller's
 * viewport doesn't clip the outermost elements.
 */
function computeBounds(nodes: Map<string, Node>, subgraphs: Map<string, Subgraph>): Bounds {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let any = false
  for (const n of nodes.values()) {
    if (!n.position) continue
    const size = n.size ?? { width: 0, height: 0 }
    const hw = size.width / 2
    const hh = size.height / 2
    minX = Math.min(minX, n.position.x - hw)
    minY = Math.min(minY, n.position.y - hh)
    maxX = Math.max(maxX, n.position.x + hw)
    maxY = Math.max(maxY, n.position.y + hh)
    any = true
  }
  for (const sg of subgraphs.values()) {
    if (!sg.bounds) continue
    minX = Math.min(minX, sg.bounds.x)
    minY = Math.min(minY, sg.bounds.y)
    maxX = Math.max(maxX, sg.bounds.x + sg.bounds.width)
    maxY = Math.max(maxY, sg.bounds.y + sg.bounds.height)
    any = true
  }
  if (!any) return { x: 0, y: 0, width: 400, height: 300 }
  const pad = 50
  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  }
}
