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
  SMALL_LABEL_CHAR_WIDTH,
} from '../constants.js'
import { getDeviceIcon } from '../icons/index.js'
import type {
  Bounds,
  Direction,
  LinkEndpoint,
  NetworkGraph,
  Node,
  NodeSpec,
  Position,
  Size,
  Subgraph,
} from '../models/types.js'
import { rebalanceSubgraphs } from './interaction.js'
import { decidePortSides, placePorts } from './port-placement.js'
import type { ResolvedPort } from './resolved-types.js'
import {
  type CompoundLayoutResult,
  type CompoundNode,
  type CompoundSubgraph,
  type Edge,
  layoutCompound,
} from './sugiyama/index.js'
import { layoutTree, type TreeLayoutEdge, type TreeLayoutNode } from './tree-layout.js'
import { wrapWideRows } from './wrap-wide-rows.js'

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
  nodeWidth: 80,
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
 * Per-side port count. Used by `computeNodeFootprint` to size the
 * node's bounding box to fit ports along whichever side has the
 * most. Sides not actually used by the node have 0 count.
 */
export interface PortsBySide {
  top: number
  bottom: number
  left: number
  right: number
}

const EMPTY_PORTS_BY_SIDE: PortsBySide = { top: 0, bottom: 0, left: 0, right: 0 }

/**
 * Node BODY size — the rectangle that holds the icon + label, with no
 * port-lane allowance. Pure function on the node's content; suitable
 * for nodes that haven't been through layout yet (newly-dropped
 * nodes in the editor, fixtures, previews).
 *
 * Floor is `DEFAULTS.nodeWidth` × 60 so very-short labels don't
 * collapse below a readable click target.
 */
export function computeNodeBodySize(node: { label?: string | string[]; spec?: NodeSpec }): {
  width: number
  height: number
} {
  const lines = Array.isArray(node.label) ? node.label.length : node.label ? 1 : 0
  const specType = node.spec?.kind !== 'service' ? node.spec?.type : undefined
  const hasIcon = !!(specType && getDeviceIcon(specType))
  const iconH = hasIcon ? DEFAULT_ICON_SIZE : 0
  const iconW = hasIcon ? DEFAULT_ICON_SIZE : 0
  const gapH = iconH > 0 ? ICON_LABEL_GAP : 0
  const contentH = iconH + gapH + lines * LABEL_LINE_HEIGHT
  const labelLines = Array.isArray(node.label) ? node.label : node.label ? [node.label] : []
  const labelW = Math.max(0, ...labelLines.map((l) => l.length)) * ESTIMATED_CHAR_WIDTH
  const contentW = Math.max(iconW, labelW)

  return {
    width: Math.max(DEFAULTS.nodeWidth, contentW + NODE_HORIZONTAL_PADDING * 2),
    height: Math.max(60, contentH + NODE_VERTICAL_PADDING),
  }
}

/**
 * Node FOOTPRINT — the outer rectangle the layout engine reserves
 * for the node, including space along whichever side has the most
 * ports. Width grows with `max(top, bottom)` port count; height
 * grows with `max(left, right)`. Sides without ports don't inflate
 * the corresponding axis.
 *
 * In a typical TB diagram an access switch has all downlinks on
 * `bottom` and 1 uplink on `top` — so width = max(body, bottom *
 * portSpacing) which is just what we need to fan out the downlinks.
 *
 * Falls back to body size when `portsBySide` is omitted (e.g. for
 * a node that hasn't picked port sides yet).
 */
/** Minimum gap between adjacent port labels so they don't touch. */
const PORT_LABEL_GAP = 6

/**
 * Slot width chosen so two adjacent port labels of the given char
 * count don't visually touch. Falls back to `minPortSpacing` for
 * short labels (e.g. `eth0`) — only inflates for verbose names
 * like `port1.0.1` (9 chars ≈ 50 px text + gap).
 */
function portSlotWidth(maxLabelChars: number): number {
  const labelWidth = maxLabelChars * SMALL_LABEL_CHAR_WIDTH + PORT_LABEL_GAP
  return Math.max(DEFAULTS.minPortSpacing, labelWidth)
}

export function computeNodeFootprint(
  node: { label?: string | string[]; spec?: NodeSpec },
  portsBySide: PortsBySide = EMPTY_PORTS_BY_SIDE,
  /** Longest port label on this node, in characters. When 0/omitted
   *  the slot uses `minPortSpacing` (good for nodes with short
   *  labels like `eth0`). Pass the max length across ALL sides so
   *  every side gets a slot wide enough for the widest port. */
  maxPortLabelChars = 0,
): { width: number; height: number } {
  const body = computeNodeBodySize(node)
  const horizPorts = Math.max(portsBySide.top, portsBySide.bottom)
  const vertPorts = Math.max(portsBySide.left, portsBySide.right)
  // Port placement spreads N ports along a side at ratios
  // (i + 1) / (N + 1), so actual centre-to-centre spacing is
  // side_length / (N + 1). To *guarantee* `slot` between
  // neighbouring port centres we need side_length ≥ (N + 1) × slot.
  // The N+1 factor also leaves a half-slot margin on each end so
  // the first / last port doesn't sit right on the node corner.
  const slot = portSlotWidth(maxPortLabelChars)
  const horizPortReq = horizPorts > 0 ? (horizPorts + 1) * slot : 0
  const vertPortReq = vertPorts > 0 ? (vertPorts + 1) * slot : 0
  return {
    width: Math.max(body.width, horizPortReq),
    height: Math.max(body.height, vertPortReq),
  }
}

/**
 * **The new "single source of truth" for node size at render time.**
 *
 * Returns `node.size` if the layout engine has already computed and
 * attached a footprint to the node. Falls back to `computeNodeBody-
 * Size` for nodes that haven't been through layout yet (newly-
 * dropped, fixtures, previews). Renderers, port placement, collision
 * detection, bounds calc should all funnel through here.
 *
 * The fallback gives a *body-only* size — no port-lane allowance —
 * which is fine for an un-laid-out node because no ports have been
 * placed on it yet.
 */
export function resolveNodeSize(node: {
  label?: string | string[]
  spec?: NodeSpec
  size?: { width: number; height: number }
}): { width: number; height: number } {
  return node.size ?? computeNodeBodySize(node)
}

/**
 * @deprecated Prefer `resolveNodeSize(node)` everywhere. The old
 * `computeNodeSize(node, portCount)` signature is kept as a thin
 * compat shim — `portCount` is treated as if every port lived on a
 * single horizontal side (over-estimates width when ports actually
 * split top/bottom). The new code path threads per-side counts via
 * `computeNodeFootprint`.
 */
export function computeNodeSize(
  node: { label?: string | string[]; spec?: NodeSpec },
  portCount = 0,
): { width: number; height: number } {
  if (portCount <= 0) return computeNodeBodySize(node)
  return computeNodeFootprint(node, {
    top: 0,
    bottom: portCount,
    left: 0,
    right: 0,
  })
}

// ============================================================================
// Link-endpoint helpers
// ============================================================================

function epId(ep: LinkEndpoint) {
  return ep.node
}

// ============================================================================
// NetworkGraph → Sugiyama conversion
// ============================================================================

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

  // Decide port sides up front so each node's footprint reflects
  // *which* sides carry ports (and how many). Footprint width grows
  // with max(top, bottom) port count; height with max(left, right).
  // We also track the longest port label per node so the slot width
  // is wide enough for that label without overlap with neighbours.
  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]))
  const portAssignments = decidePortSides(graph.links, nodesById, opts.direction)
  const portsBySideById = new Map<string, PortsBySide>()
  const maxLabelCharsById = new Map<string, number>()
  for (const a of portAssignments) {
    let bucket = portsBySideById.get(a.nodeId)
    if (!bucket) {
      bucket = { top: 0, bottom: 0, left: 0, right: 0 }
      portsBySideById.set(a.nodeId, bucket)
    }
    bucket[a.side]++
    const node = nodesById.get(a.nodeId)
    const port = node?.ports?.find((p) => p.id === a.portId)
    const labelLen = (port?.label ?? a.portId).length
    if (labelLen > (maxLabelCharsById.get(a.nodeId) ?? 0)) {
      maxLabelCharsById.set(a.nodeId, labelLen)
    }
  }
  const compoundNodes: CompoundNode[] = graph.nodes.map((n) => ({
    id: n.id,
    parent: n.parent ?? null,
    size: computeNodeFootprint(n, portsBySideById.get(n.id), maxLabelCharsById.get(n.id) ?? 0),
  }))
  const compoundSubgraphs: CompoundSubgraph[] = (graph.subgraphs ?? []).map((s) => ({
    id: s.id,
    parent: s.parent ?? null,
  }))
  const parentOf = buildParentOf(graph)
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

  // Fold positions + computed footprint back onto Node records.
  // Consumers read `node.size` from here on; computeNodeBodySize is a
  // fallback only for nodes that haven't been through layout.
  const sizeById = new Map(
    graph.nodes.map(
      (n) =>
        [
          n.id,
          computeNodeFootprint(n, portsBySideById.get(n.id), maxLabelCharsById.get(n.id) ?? 0),
        ] as const,
    ),
  )
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

  // Ports come from positioned nodes via the existing direction-aware
  // placer, which also handles HA pairs (sides perpendicular to flow).
  const ports = placePorts(nodes, graph.links, opts.direction)

  applyFixedOverride(nodes, ports, subgraphs, opts.fixed, graph.nodes)

  // Add a comfortable margin around the tight extents. The empty-graph
  // fallback size matches the legacy implementation so callers that
  // relied on the default canvas size aren't surprised.
  const pad = 50
  const rb = result.rootBounds
  let bounds: Bounds =
    rb.width === 0 && rb.height === 0
      ? { x: 0, y: 0, width: 400, height: 300 }
      : {
          x: rb.x - pad,
          y: rb.y - pad,
          width: rb.width + pad * 2,
          height: rb.height + pad * 2,
        }

  // Wrap overly wide rows of subgraphs into multiple visual rows.
  // Default tuned so that the "10+ area subgraphs at one tier"
  // case from the user's screenshot folds into two compact rows
  // rather than sprawling across 4500px+ of canvas. The pass is a
  // no-op for graphs that don't have a wide row.
  bounds = wrapWideRows(nodes, ports, subgraphs, bounds)

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
 * Compound subgraphs are handled bottom-up (deepest first): each
 * subgraph is laid out as its own tree with `layoutTree`, then
 * treated as a single node at its parent's level with size = its
 * computed inner bounds + padding + label height. This mirrors
 * `layoutCompound` but swaps Sugiyama for Buchheim per container so
 * subtree contiguity is preserved — siblings of the same parent
 * stay contiguous, whether they're inside a subgraph or above it.
 *
 * Disqualifiers (forced fallback to Sugiyama):
 *
 *   - **`hints` or `fixed` supplied.** User-driven coordinate
 *     overrides flow more naturally through Sugiyama's coord
 *     assignment than through Buchheim's contour-based packing.
 *   - **Any container's overlay ratio above threshold.** When too
 *     many edges in some container fail the "primary parent" test,
 *     that level has real mesh-like structure and Sugiyama's
 *     barycenter ordering is more appropriate. All-or-nothing: if
 *     one container falls back, the whole graph does (mixing two
 *     algorithms across the hierarchy would produce inconsistent
 *     spacing rules).
 */
function tryTreeLayout(
  nodes: CompoundNode[],
  subgraphs: CompoundSubgraph[],
  edges: Edge[],
  opts: typeof DEFAULTS,
): CompoundLayoutResult | null {
  if (opts.fixed.size > 0) return null
  if (opts.hints.size > 0) return null

  const padding = opts.subgraphPadding
  const labelHeight = opts.subgraphLabelHeight
  const defaultSize: Size = { width: 160, height: 60 }

  const nodeById = new Map<string, CompoundNode>()
  for (const n of nodes) nodeById.set(n.id, n)
  const subgraphById = new Map<string, CompoundSubgraph>()
  for (const s of subgraphs) subgraphById.set(s.id, s)

  // childrenOf: container id (or null = top level) → direct children
  // (mixed nodes and subgraphs in declaration order).
  const childrenOf = new Map<string | null, (CompoundNode | CompoundSubgraph)[]>()
  const push = (parent: string | null, item: CompoundNode | CompoundSubgraph) => {
    const list = childrenOf.get(parent)
    if (list) list.push(item)
    else childrenOf.set(parent, [item])
  }
  for (const n of nodes) push(n.parent ?? null, n)
  for (const s of subgraphs) push(s.parent ?? null, s)

  const depthOf = (id: string, visited = new Set<string>()): number => {
    if (visited.has(id)) return 0
    visited.add(id)
    const sg = subgraphById.get(id)
    if (!sg?.parent) return 0
    return 1 + depthOf(sg.parent, visited)
  }

  interface LocalLayout {
    positions: Map<string, Position>
    width: number
    height: number
  }
  const localLayouts = new Map<string | null, LocalLayout>()
  const subgraphSize = new Map<string, Size>()

  // Run Buchheim for a single container. Returns null when the
  // container's edges aren't tree-dominant — caller propagates the
  // null up so the whole graph falls back to Sugiyama (consistent
  // spacing across the hierarchy).
  const runContainer = (containerId: string | null): LocalLayout | null => {
    const children = childrenOf.get(containerId) ?? []
    if (children.length === 0) {
      return { positions: new Map(), width: 0, height: 0 }
    }
    const childIds = new Set(children.map((c) => c.id))

    // Edges between direct children of this container only. Edges
    // escaping the container were already promoted to their common
    // ancestor by `buildCompoundEdges`, so they'll surface at the
    // appropriate level instead of leaking down here.
    const innerEdges = edges.filter(
      (e) => childIds.has(e.source) && childIds.has(e.target) && e.source !== e.target,
    )

    // Pick a primary parent per child; remaining incoming edges
    // become overlay (rendered but non-structural).
    const incoming = new Map<string, Edge[]>()
    for (const e of innerEdges) {
      const list = incoming.get(e.target) ?? []
      list.push(e)
      incoming.set(e.target, list)
    }
    const treeEdges: TreeLayoutEdge[] = []
    let overlayCount = 0
    for (const [child, list] of incoming) {
      const primary = list[0]
      if (!primary) continue
      treeEdges.push({ parent: primary.source, child })
      overlayCount += list.length - 1
    }
    if (
      overlayCount > TREE_DOMINANT_OVERLAY_HARD_CAP &&
      overlayCount / Math.max(innerEdges.length, 1) > TREE_DOMINANT_OVERLAY_RATIO
    ) {
      return null
    }
    if (hasCycleAfterPrimaryPick(treeEdges)) return null

    // Build TreeLayoutNode set: leaves use their intrinsic size,
    // subgraphs use their already-computed inner bounds expanded by
    // padding + label.
    const treeNodes: TreeLayoutNode[] = children.map((c) => {
      const sg = subgraphById.get(c.id)
      if (sg) {
        const inner = subgraphSize.get(c.id) ?? { width: 0, height: 0 }
        return {
          id: c.id,
          size: {
            width: inner.width + padding * 2,
            height: inner.height + padding * 2 + labelHeight,
          },
        }
      }
      const n = nodeById.get(c.id)
      return { id: c.id, size: n?.size ?? defaultSize }
    })

    const result = layoutTree(treeNodes, treeEdges, {
      direction: opts.direction,
      nodeGap: opts.gap,
      layerGap: opts.topLevelGap,
    })

    // Shift so the container origin is (0, 0). `flatten` translates
    // by the container's absolute origin to produce final coords.
    const shiftX = -result.bounds.x
    const shiftY = -result.bounds.y
    const shifted = new Map<string, Position>()
    for (const [id, p] of result.positions) {
      shifted.set(id, { x: p.x + shiftX, y: p.y + shiftY })
    }
    return { positions: shifted, width: result.bounds.width, height: result.bounds.height }
  }

  // Bottom-up: deepest subgraphs first, then walk up. Any failure
  // bails the whole tree attempt.
  const sortedSubgraphs = [...subgraphs].sort((a, b) => depthOf(b.id) - depthOf(a.id))
  for (const sg of sortedSubgraphs) {
    const layout = runContainer(sg.id)
    if (!layout) return null
    localLayouts.set(sg.id, layout)
    subgraphSize.set(sg.id, { width: layout.width, height: layout.height })
  }
  const top = runContainer(null)
  if (!top) return null
  localLayouts.set(null, top)

  // Flatten: walk top-down, accumulating each container's origin into
  // absolute coords. Same shape as layoutCompound's flatten.
  const nodePositions = new Map<string, Position>()
  const subgraphBounds = new Map<string, Bounds>()
  const flatten = (containerId: string | null, originX: number, originY: number) => {
    const local = localLayouts.get(containerId)
    if (!local) return
    const children = childrenOf.get(containerId) ?? []
    for (const c of children) {
      const localPos = local.positions.get(c.id)
      if (!localPos) continue
      const absX = originX + localPos.x
      const absY = originY + localPos.y
      const sg = subgraphById.get(c.id)
      if (sg) {
        const inner = subgraphSize.get(c.id) ?? { width: 0, height: 0 }
        const width = inner.width + padding * 2
        const height = inner.height + padding * 2 + labelHeight
        const bx = absX - width / 2
        const by = absY - height / 2
        subgraphBounds.set(c.id, { x: bx, y: by, width, height })
        flatten(c.id, bx + padding, by + padding + labelHeight)
      } else {
        nodePositions.set(c.id, { x: absX, y: absY })
      }
    }
  }
  flatten(null, 0, 0)

  // Root bounds — same union pass as layoutCompound.
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const [id, { x, y }] of nodePositions) {
    const n = nodeById.get(id)
    const size = n?.size ?? defaultSize
    minX = Math.min(minX, x - size.width / 2)
    minY = Math.min(minY, y - size.height / 2)
    maxX = Math.max(maxX, x + size.width / 2)
    maxY = Math.max(maxY, y + size.height / 2)
  }
  for (const bounds of subgraphBounds.values()) {
    minX = Math.min(minX, bounds.x)
    minY = Math.min(minY, bounds.y)
    maxX = Math.max(maxX, bounds.x + bounds.width)
    maxY = Math.max(maxY, bounds.y + bounds.height)
  }
  const rootBounds: Bounds =
    minX === Number.POSITIVE_INFINITY
      ? { x: 0, y: 0, width: 0, height: 0 }
      : { x: minX, y: minY, width: maxX - minX, height: maxY - minY }

  return { nodePositions, subgraphBounds, rootBounds }
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
