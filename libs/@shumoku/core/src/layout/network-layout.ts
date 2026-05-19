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
  PORT_LABEL_OUTER_REACH,
} from '../constants.js'
import { getDeviceIcon } from '../icons/index.js'
import type { Bounds, Direction, NetworkGraph, Node, NodeSpec, Subgraph } from '../models/types.js'
import { layoutFlatTree } from './flat-tree-layout.js'
import { rebalanceSubgraphs } from './interaction.js'
import { measureTextWidth } from './measure-text.js'
import { decidePortSides, placePorts } from './port-placement.js'
import type { ResolvedPort } from './resolved-types.js'

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
const PORT_LABEL_GAP = 12

/** Font size (px) used by the renderer for port labels. */
const PORT_LABEL_FONT_PX = 9

/**
 * Slot width chosen so two adjacent port labels of the given
 * actual rendered width don't touch. Caller passes the
 * maximum measured label width across the node's ports;
 * function returns slot = max(minPortSpacing, labelWidth +
 * gap). Falls back to `minPortSpacing` for short labels.
 */
function portSlotWidth(maxLabelPx: number): number {
  return Math.max(DEFAULTS.minPortSpacing, maxLabelPx + PORT_LABEL_GAP)
}

export function computeNodeFootprint(
  node: { label?: string | string[]; spec?: NodeSpec },
  portsBySide: PortsBySide = EMPTY_PORTS_BY_SIDE,
  /**
   * Widest port label on this node, in SVG units (px). When 0
   * /omitted the slot uses `minPortSpacing` (good for nodes
   * with short labels like `eth0`). Pass the max actual
   * rendered width across ALL sides so every side gets a slot
   * wide enough for the widest port.
   */
  maxPortLabelPx = 0,
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
  const slot = portSlotWidth(maxPortLabelPx)
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
// Link-direction normalisation
// ============================================================================

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
  const maxLabelPxById = new Map<string, number>()
  for (const a of portAssignments) {
    let bucket = portsBySideById.get(a.nodeId)
    if (!bucket) {
      bucket = { top: 0, bottom: 0, left: 0, right: 0 }
      portsBySideById.set(a.nodeId, bucket)
    }
    bucket[a.side]++
    const node = nodesById.get(a.nodeId)
    const port = node?.ports?.find((p) => p.id === a.portId)
    const labelText = port?.label ?? a.portId
    const labelPx = measureTextWidth(labelText, PORT_LABEL_FONT_PX)
    if (labelPx > (maxLabelPxById.get(a.nodeId) ?? 0)) {
      maxLabelPxById.set(a.nodeId, labelPx)
    }
  }
  // Footprints come from per-side port counts so the box reserves
  // room for ports along whichever side carries them.
  const sizeById = new Map(
    graph.nodes.map(
      (n) =>
        [
          n.id,
          computeNodeFootprint(n, portsBySideById.get(n.id), maxLabelPxById.get(n.id) ?? 0),
        ] as const,
    ),
  )
  const subgraphsById = new Map((graph.subgraphs ?? []).map((s) => [s.id, s] as const))

  // Flat-tree layout: lay out the entire node graph as one tidy-tree
  // driven by link topology, then compute subgraph rectangles as
  // hulls around their members. Subgraphs are *not* layout
  // containers — they're a visual grouping computed after placement.
  // This lets each switch's downstream subtree expand in whatever
  // direction the topology needs, rather than being forced into a
  // single row of sibling containers.
  // Renderer-derived metrics give the engine an explicit handle
  // on the label geometry it should size its internal gaps for.
  // Currently only `portLabelOuterReach` is forwarded (matching
  // the engine's default, so no visual change), but the seam
  // exists for future per-renderer tuning. Outer gaps and the
  // subgraph hull dimensions remain explicit UX choices owned
  // by this wrapper.
  const result = layoutFlatTree(
    graph,
    nodesById,
    subgraphsById,
    sizeById,
    (link) => shouldFlipForLayout(link, nodesById, opts.direction),
    {
      direction: opts.direction,
      nodeGap: opts.gap,
      layerGap: opts.topLevelGap,
      subgraphPadding: opts.subgraphPadding,
      subgraphLabelHeight: opts.subgraphLabelHeight,
      metrics: {
        portLabelOuterReach: PORT_LABEL_OUTER_REACH,
      },
      // Pass per-node port-side counts. The engine uses them
      // to shrink horizontal gaps when neither facing side has
      // a port (typical for AP chains where ports are on top/
      // bottom only). Absent in callers that skip the wrapper.
      portsBySideById,
    },
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
