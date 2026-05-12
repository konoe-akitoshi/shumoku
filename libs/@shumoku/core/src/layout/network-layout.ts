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
  type CompoundLayoutResult,
  type CompoundNode,
  type CompoundSubgraph,
  type Edge,
  layoutCompound,
} from './sugiyama/index.js'
import { layoutTree, type TreeLayoutEdge, type TreeLayoutNode } from './tree-layout.js'

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

function epId(ep: LinkEndpoint) {
  return ep.node
}

function epPort(ep: LinkEndpoint) {
  return ep.port
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
/**
 * Direction-derived "this side means upstream" map. Sugiyama lays
 * out the flow along this axis, so a port pinned to the dest side
 * of a source node (or vice versa) is the user telling layout that
 * the link should run the other way.
 */
type Side = 'top' | 'bottom' | 'left' | 'right'

function flowSides(direction: 'TB' | 'BT' | 'LR' | 'RL'): { source: Side; dest: Side } {
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

/**
 * Device types that should always be downstream (leaf side) of any
 * connection to an intermediate device, regardless of how the link
 * was declared. APs / IoT / printers / servers usually only have
 * one uplink and belong visually at the bottom of a TB diagram —
 * users routinely create `ap → switch` links in input forms and
 * expect the layout to do the right thing.
 */
const LEAF_DEVICE_TYPES: ReadonlySet<string> = new Set([
  'access-point',
  'cpe',
  'server',
  'database',
  'console-server',
])

/**
 * Device types that anchor at the upstream edge of the network
 * (WAN side in TB). `Internet` and `Cloud` represent the outside
 * world and should sit at the top.
 */
const UPSTREAM_DEVICE_TYPES: ReadonlySet<string> = new Set(['internet', 'cloud'])

function deviceType(node: Node | undefined): string | undefined {
  const spec = node?.spec
  if (!spec) return undefined
  if (spec.kind === 'hardware' || spec.kind === 'compute') return spec.type
  return undefined
}

/**
 * For a single link, decide whether the layout should swap its
 * (source, target) pair when feeding Sugiyama. Two signals, in
 * priority order:
 *
 *   1. **Per-port placement** — if the user has pinned a port to
 *      the opposite of the direction-derived default (e.g. a
 *      source port on the dest side in TB), respect that override.
 *      This is the manual escape hatch from PR #220.
 *   2. **Device-type heuristic** — if neither port has an explicit
 *      placement, look at `Node.spec.type`. A leaf-type endpoint
 *      (AccessPoint / CPE / Server / Database / ConsoleServer) on
 *      the `from` side, paired with an intermediate `to`, is the
 *      "AP → switch" reversal pattern users routinely create
 *      without realising. Flipping puts the leaf back at the
 *      downstream layer where network engineers expect it.
 *      An upstream-type endpoint (Internet / Cloud) on `to`
 *      similarly flips to keep WAN edges at the top.
 *
 * The actual `Link.from` / `Link.to` records are never mutated;
 * only the (source, target) pair used inside `buildCompoundEdges`
 * is swapped, so user-facing data stays exactly as authored.
 */
function shouldFlipForLayout(
  link: NetworkGraph['links'][number],
  nodes: Map<string, Node>,
  direction: 'TB' | 'BT' | 'LR' | 'RL',
): boolean {
  const sides = flowSides(direction)
  const fromNode = nodes.get(link.from.node)
  const toNode = nodes.get(link.to.node)
  const fromSide = fromNode?.ports?.find((p) => p.id === link.from.port)?.placement?.side
  const toSide = toNode?.ports?.find((p) => p.id === link.to.port)?.placement?.side
  // 1. Explicit placement override — wins over everything.
  if (fromSide === sides.dest) return true
  if (toSide === sides.source) return true
  // Honour the opposite intent too: if either port is pinned to the
  // expected source/dest side, the link as authored is already
  // correctly oriented for layout — skip the type-based check so we
  // never undo a deliberate placement.
  if (fromSide === sides.source) return false
  if (toSide === sides.dest) return false
  // 2. Device-type heuristic. Only flips when both ports are
  //    placement-neutral, so a single manual pin always wins.
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

function buildCompoundEdges(
  graph: NetworkGraph,
  parentOf: Map<string, string | null>,
  direction: 'TB' | 'BT' | 'LR' | 'RL',
  nodesById: Map<string, Node>,
): Edge[] {
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
    const flip = shouldFlipForLayout(link, nodesById, direction)
    const from = flip ? link.to : link.from
    const to = flip ? link.from : link.to
    const s = epId(from)
    const t = epId(to)
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
  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]))
  const edges = buildCompoundEdges(graph, parentOf, opts.direction, nodesById)

  // Choose between Buchheim tidy-tree (preferred for tree-dominant
  // network topologies) and full Sugiyama (fallback for graphs with
  // subgraphs, hints, or non-tree structure).
  const result =
    tryTreeLayout(compoundNodes, compoundSubgraphs, edges, opts) ??
    layoutCompound(compoundNodes, compoundSubgraphs, edges, {
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

// ============================================================================
// Tree layout dispatcher
// ============================================================================

/**
 * Maximum fraction of edges that can be "overlay" (non-structural) and
 * still let Buchheim drive the layout. Overlay edges are rendered but
 * don't constrain placement (Graphviz-style `constraint=false`).
 *
 * Beyond this ratio, the graph has enough non-tree structure that
 * Sugiyama's global crossing minimisation is the better tool.
 */
const TREE_DOMINANT_OVERLAY_RATIO = 0.1
const TREE_DOMINANT_OVERLAY_HARD_CAP = 5

/**
 * Pick the primary parent for each child node and run Buchheim's
 * tidy-tree algorithm. Returns null if the graph isn't tree-dominant
 * — caller falls back to Sugiyama in that case.
 *
 * Disqualifiers (forced fallback to Sugiyama):
 *
 *   - **Subgraphs present.** The tidy-tree path doesn't yet handle
 *     compound containment; the user expects subgraph boundaries to
 *     be respected, and Sugiyama already does that.
 *   - **`hints` or `fixed` supplied.** User-driven coordinate
 *     overrides flow more naturally through Sugiyama's coord
 *     assignment than through Buchheim's contour-based packing.
 *   - **Overlay ratio above threshold.** When too many edges fail
 *     the "primary parent" test, the graph has real mesh-like
 *     structure and Sugiyama's barycenter ordering is more
 *     appropriate.
 */
function tryTreeLayout(
  nodes: CompoundNode[],
  subgraphs: CompoundSubgraph[],
  edges: Edge[],
  opts: typeof DEFAULTS,
): CompoundLayoutResult | null {
  if (subgraphs.length > 0) return null
  if (opts.fixed.size > 0) return null
  if (opts.hints.size > 0) return null

  // Build incoming-edge index, ignoring self loops.
  const incoming = new Map<string, Edge[]>()
  for (const e of edges) {
    if (e.source === e.target) continue
    const list = incoming.get(e.target) ?? []
    list.push(e)
    incoming.set(e.target, list)
  }

  // Pick the first incoming edge as the primary parent for each
  // node. Remaining incoming edges become overlay (rendered, but not
  // structural for placement).
  const treeEdges: TreeLayoutEdge[] = []
  let overlayCount = 0
  for (const [child, list] of incoming) {
    const primary = list[0]
    if (!primary) continue
    treeEdges.push({ parent: primary.source, child })
    overlayCount += list.length - 1
  }

  // Overlay budget check. A small number of cross-links is OK; many
  // means the graph isn't really a tree.
  if (
    overlayCount > TREE_DOMINANT_OVERLAY_HARD_CAP &&
    overlayCount / Math.max(edges.length, 1) > TREE_DOMINANT_OVERLAY_RATIO
  ) {
    return null
  }

  // Cycle detection: walk parent chains; if any chain loops back on
  // itself, the "primary parent" picks formed a cycle (extremely
  // rare in practice but possible with circular ownership). Bail in
  // that case — Sugiyama's cycle removal handles it.
  if (hasCycleAfterPrimaryPick(treeEdges)) return null

  const treeNodes: TreeLayoutNode[] = nodes.map((n) => ({
    id: n.id,
    size: n.size ?? { width: 160, height: 60 },
  }))
  const result = layoutTree(treeNodes, treeEdges, {
    direction: opts.direction,
    nodeGap: opts.gap,
    layerGap: opts.topLevelGap,
  })

  return {
    nodePositions: result.positions,
    subgraphBounds: new Map(),
    rootBounds: result.bounds,
  }
}

function hasCycleAfterPrimaryPick(treeEdges: readonly TreeLayoutEdge[]): boolean {
  const parentOf = new Map<string, string>()
  for (const e of treeEdges) parentOf.set(e.child, e.parent)
  for (const start of parentOf.keys()) {
    const seen = new Set<string>()
    let cur: string | undefined = start
    while (cur !== undefined) {
      if (seen.has(cur)) return true
      seen.add(cur)
      cur = parentOf.get(cur)
    }
  }
  return false
}
