// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Octilinear channel router for the composite layout (engine-v3-migration.md
 * B2, #433; geometry history in docs/engine-v3-design.md §27-39).
 *
 * Metro-map grammar: vertical-dominant routes with horizontal runs on
 * allocated tracks, corners chamfered at 45°. The two hard rules from
 * the v3 rounds:
 *
 *   1. NO TWO LINES SHARE A TRACK — every horizontal run gets its own y
 *      via a single GLOBAL greedy allocator (per-edge floor/ceil bounds,
 *      bidirectional search; separating by stroke half-widths, so wide
 *      ribbons claim wide berths). Separate allocators collide with each
 *      other; per-edge clamping after allocation silently re-stacks
 *      tracks — both were real bugs, hence one allocator and bounds
 *      inside it.
 *   2. Crossings should be ~90° — long shallow diagonals crossing at
 *      grazing angles were the dominant residual unreadability.
 *
 * The router only handles the clean vertical case (source port on the
 * bottom of the upper node, target port on the top of the lower node).
 * Everything else (peers wired side-to-side, unusual port sides) keeps
 * the renderer's default Bezier — octilinear discipline where it helps,
 * graceful fallback where it doesn't.
 */

import type { Bounds, Node, Position } from '../../models/types.js'
import { resolveNodeSize } from '../engine/index.js'
import { PORT_LABEL_H, portLabelBox } from '../port-geometry.js'
import type { ResolvedEdge, ResolvedPort } from '../resolved-types.js'

/**
 * Re-seat ports to face their peer, by GEOMETRY. The flat-tree side
 * decision leans on link from/to direction, but discovered (LLDP) links
 * point in arbitrary directions — on test6, 29 of 104 links ended up
 * with both ports facing AWAY from each other (lower node's bottom port
 * climbing to the upper node's top port), which forced Bezier wrap-around
 * sweeps and made the dense bands look tangled. v3 lesson (§9): never
 * trust from/to orientation; trust positions.
 *
 * Mutates the ResolvedPort objects in place (1 port = 1 link, so a flip
 * never affects another edge). Returns the number of ports re-seated.
 */
export interface AlignResult {
  /** Number of ports re-seated to face their peer. */
  flipped: number
  /**
   * Nodes whose busiest face could not seat its ports at full slot
   * width (the pass had to compress). Value = the full width/height
   * the node NEEDS. Feed back into the next layout round as
   * `minNodeWidths` / `minNodeHeights` — growing the node is the
   * correct resolution; compression is only the within-round fallback.
   */
  minWidths: Map<string, number>
  minHeights: Map<string, number>
}

const PORT_LABEL_CLEARANCE = 8

/** Slot a port claims along its face: stroke width + air, floored so a
 *  12px label strip plus breathing room always fits. Keep in sync with
 *  the face-demand estimate in `layoutComposite`. */
export const PORT_SLOT = (edgeWidth: number): number =>
  Math.max(PORT_LABEL_H + PORT_LABEL_CLEARANCE, edgeWidth + 4)

export function alignPortsToPeers(
  edges: Map<string, ResolvedEdge>,
  nodes: Map<string, Node>,
  options: {
    /**
     * For collapsed redundant pairs: each member's OUTWARD lateral side
     * (left member → 'left', right member → 'right'). A member's
     * side-seated ports always use the outward face — seating them
     * toward the partner puts ports, labels and wires inside the 16px
     * pair gap, on top of the partner.
     */
    outwardSide?: ReadonlyMap<string, 'left' | 'right'>
  } = {},
): AlignResult {
  let flipped = 0
  const minWidths = new Map<string, number>()
  const minHeights = new Map<string, number>()
  const seat = (
    port: ResolvedEdge['fromPort'],
    nodeId: string,
    side: 'top' | 'bottom' | 'left' | 'right',
  ): void => {
    // Uniform label policy for the composite schematic: top/bottom port
    // labels ALWAYS run along the wire (vertical), side ports stay
    // horizontal. Mixed orientations on one face read as clutter, and
    // horizontal labels can never clear each other at schematic pitch.
    port.labelOrientation = side === 'top' || side === 'bottom' ? 'vertical' : 'horizontal'
    if (port.side === side) return
    const node = nodes.get(nodeId)
    const center = node?.position
    if (!node || !center) return
    const size = resolveNodeSize(node)
    if (side === 'top' || side === 'bottom') {
      port.absolutePosition = {
        x: Math.max(
          center.x - size.width / 2 + 6,
          Math.min(center.x + size.width / 2 - 6, port.absolutePosition.x),
        ),
        y: side === 'top' ? center.y - size.height / 2 : center.y + size.height / 2,
      }
    } else {
      port.absolutePosition = {
        x: side === 'left' ? center.x - size.width / 2 : center.x + size.width / 2,
        y: center.y,
      }
    }
    port.side = side
    flipped++
  }
  const sortedForSeat = [...edges.values()].sort((a, b) => (a.id < b.id ? -1 : 1))
  for (const edge of sortedForSeat) {
    if (edge.coupling) continue
    const fromCenter = nodes.get(edge.fromNodeId)?.position
    const toCenter = nodes.get(edge.toNodeId)?.position
    if (!fromCenter || !toCenter) continue
    const dy = toCenter.y - fromCenter.y
    if (Math.abs(dy) > 40) {
      const upperIsFrom = dy > 0
      seat(
        upperIsFrom ? edge.fromPort : edge.toPort,
        upperIsFrom ? edge.fromNodeId : edge.toNodeId,
        'bottom',
      )
      seat(
        upperIsFrom ? edge.toPort : edge.fromPort,
        upperIsFrom ? edge.toNodeId : edge.fromNodeId,
        'top',
      )
    } else {
      const leftIsFrom = fromCenter.x <= toCenter.x
      const rightSidePort = leftIsFrom ? edge.fromPort : edge.toPort
      const rightSideNode = leftIsFrom ? edge.fromNodeId : edge.toNodeId
      const leftSidePort = leftIsFrom ? edge.toPort : edge.fromPort
      const leftSideNode = leftIsFrom ? edge.toNodeId : edge.fromNodeId
      seat(rightSidePort, rightSideNode, options.outwardSide?.get(rightSideNode) ?? 'right')
      seat(leftSidePort, leftSideNode, options.outwardSide?.get(leftSideNode) ?? 'left')
    }
  }

  // -- width-aware port slots (v3 §33) ---------------------------------------
  // Each edge claims a slot proportional to its stroke width along the
  // node's top/bottom face, ordered by where its peer sits — wide ribbons
  // get wide berths and parallel drops stop stacking at the face. Slots
  // are scaled down together when the face is narrower than the demand.
  const faceGroups = new Map<
    string,
    { port: ResolvedEdge['fromPort']; peerX: number; width: number; edgeId: string }[]
  >()
  const sideGroups = new Map<
    string,
    { port: ResolvedEdge['fromPort']; peerY: number; width: number; edgeId: string }[]
  >()
  for (const edge of sortedForSeat) {
    if (edge.coupling) continue
    const ends: [ResolvedEdge['fromPort'], ResolvedEdge['fromPort']][] = [
      [edge.fromPort, edge.toPort],
      [edge.toPort, edge.fromPort],
    ]
    for (const [port, peer] of ends) {
      if (port.side === 'top' || port.side === 'bottom') {
        const key = `${port.nodeId}|${port.side}`
        const group = faceGroups.get(key) ?? []
        group.push({ port, peerX: peer.absolutePosition.x, width: edge.width, edgeId: edge.id })
        faceGroups.set(key, group)
      } else {
        const key = `${port.nodeId}|${port.side}`
        const group = sideGroups.get(key) ?? []
        group.push({ port, peerY: peer.absolutePosition.y, width: edge.width, edgeId: edge.id })
        sideGroups.set(key, group)
      }
    }
  }
  for (const [key, group] of [...faceGroups].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (group.length < 2) continue
    const nodeId = key.slice(0, key.lastIndexOf('|'))
    const node = nodes.get(nodeId)
    const center = node?.position
    if (!node || !center) continue
    const size = resolveNodeSize(node)
    group.sort((a, b) => a.peerX - b.peerX || (a.edgeId < b.edgeId ? -1 : 1))
    const slots = group.map((entry) => PORT_SLOT(entry.width))
    const total = slots.reduce((sum, w) => sum + w, 0)
    const faceWidth = Math.max(12, size.width - 8)
    const scale = total > faceWidth ? faceWidth / total : 1
    if (scale < 1) {
      // under-provisioned face: report the width the node actually needs
      minWidths.set(nodeId, Math.max(minWidths.get(nodeId) ?? 0, total + 8))
    }
    let cursor = center.x - (total * scale) / 2
    for (const [i, entry] of group.entries()) {
      const w = (slots[i] ?? 14) * scale
      entry.port.absolutePosition = { ...entry.port.absolutePosition, x: cursor + w / 2 }
      cursor += w
    }
  }
  // Same discipline for the side faces — without this every left/right
  // port of a node sat on the exact same point (test6: 106 port-port
  // collisions, all on side faces of same-depth peer routers).
  for (const [key, group] of [...sideGroups].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const nodeId = key.slice(0, key.lastIndexOf('|'))
    const node = nodes.get(nodeId)
    const center = node?.position
    if (!node || !center) continue
    const size = resolveNodeSize(node)
    group.sort((a, b) => a.peerY - b.peerY || (a.edgeId < b.edgeId ? -1 : 1))
    const slots = group.map((entry) => PORT_SLOT(entry.width))
    const total = slots.reduce((sum, h) => sum + h, 0)
    const faceHeight = Math.max(12, size.height - 8)
    const scale = total > faceHeight ? faceHeight / total : 1
    if (scale < 1) {
      minHeights.set(nodeId, Math.max(minHeights.get(nodeId) ?? 0, total + 8))
    }
    let cursor = center.y - (total * scale) / 2
    for (const [i, entry] of group.entries()) {
      const h = (slots[i] ?? 14) * scale
      entry.port.absolutePosition = { ...entry.port.absolutePosition, y: cursor + h / 2 }
      cursor += h
    }
  }

  // -- label de-aliasing (slot allocation extended to LABELS) -----------------
  // Treat port labels as node-owned geometry: first report the face demand
  // for the next layout round, then use any spare face room this round to
  // separate labels on the same or neighboring nodes.
  const labelPorts = collectLabelPorts(sortedForSeat)
  recordPortLabelFaceDemand(labelPorts, nodes, minWidths, minHeights)
  legalizeSameFaceLabelOrder(labelPorts, nodes, minWidths, minHeights)
  separatePortLabelBoxes(labelPorts, nodes, minWidths, minHeights)
  legalizeSameFaceLabelOrder(labelPorts, nodes, minWidths, minHeights)
  return { flipped, minWidths, minHeights }
}

interface LabelPort {
  port: ResolvedPort
  nodeId: string
}

function collectLabelPorts(edges: readonly ResolvedEdge[]): LabelPort[] {
  const ports = new Map<string, LabelPort>()
  for (const edge of edges) {
    if (edge.coupling) continue
    for (const port of [edge.fromPort, edge.toPort]) {
      if (port.label.trim() === '') continue
      ports.set(port.id, { port, nodeId: port.nodeId })
    }
  }
  return [...ports.values()].sort((a, b) => (a.port.id < b.port.id ? -1 : 1))
}

function recordPortLabelFaceDemand(
  ports: readonly LabelPort[],
  nodes: ReadonlyMap<string, Node>,
  minWidths: Map<string, number>,
  minHeights: Map<string, number>,
): void {
  const byFace = new Map<string, LabelPort[]>()
  for (const entry of ports) {
    const key = `${entry.nodeId}|${entry.port.side}`
    const group = byFace.get(key) ?? []
    group.push(entry)
    byFace.set(key, group)
  }
  for (const [key, group] of byFace) {
    if (group.length < 2) continue
    const nodeId = key.slice(0, key.lastIndexOf('|'))
    if (!nodes.has(nodeId)) continue
    let total = PORT_LABEL_CLEARANCE * (group.length - 1) + 8
    for (const entry of group) {
      const box = portLabelBox(entry.port)
      if (!box) continue
      total += entry.port.side === 'top' || entry.port.side === 'bottom' ? box.width : box.height
    }
    if (group[0]?.port.side === 'top' || group[0]?.port.side === 'bottom') {
      minWidths.set(nodeId, Math.max(minWidths.get(nodeId) ?? 0, total))
    } else {
      minHeights.set(nodeId, Math.max(minHeights.get(nodeId) ?? 0, total))
    }
  }
}

function separatePortLabelBoxes(
  ports: readonly LabelPort[],
  nodes: ReadonlyMap<string, Node>,
  minWidths: Map<string, number>,
  minHeights: Map<string, number>,
): void {
  for (let pass = 0; pass < 6; pass++) {
    let moved = 0
    for (let i = 0; i < ports.length; i++) {
      const a = ports[i]
      if (!a) continue
      const boxA = portLabelBox(a.port)
      if (!boxA) continue
      for (let j = i + 1; j < ports.length; j++) {
        const b = ports[j]
        if (!b) continue
        const boxB = portLabelBox(b.port)
        if (!boxB || rectGap(boxA, boxB) >= PORT_LABEL_CLEARANCE) continue
        if (movePortLabelAway(b, boxB, boxA, nodes)) {
          moved++
          continue
        }
        if (movePortLabelAway(a, boxA, boxB, nodes)) moved++
      }
    }
    if (moved === 0) break
  }
  recordPortLabelFaceDemand(ports, nodes, minWidths, minHeights)
}

function legalizeSameFaceLabelOrder(
  ports: readonly LabelPort[],
  nodes: ReadonlyMap<string, Node>,
  minWidths: Map<string, number>,
  minHeights: Map<string, number>,
): void {
  const byFace = new Map<string, LabelPort[]>()
  for (const entry of ports) {
    const key = `${entry.nodeId}|${entry.port.side}`
    const group = byFace.get(key) ?? []
    group.push(entry)
    byFace.set(key, group)
  }
  for (const [key, group] of byFace) {
    if (group.length < 2) continue
    const nodeId = key.slice(0, key.lastIndexOf('|'))
    const node = nodes.get(nodeId)
    const center = node?.position
    if (!node || !center) continue
    const size = resolveNodeSize(node)
    const verticalFace = group[0]?.port.side === 'top' || group[0]?.port.side === 'bottom'
    const lo = verticalFace ? center.x - size.width / 2 + 6 : center.y - size.height / 2 + 6
    const hi = verticalFace ? center.x + size.width / 2 - 6 : center.y + size.height / 2 - 6
    const items = group
      .map((entry) => {
        const box = portLabelBox(entry.port)
        if (!box) return undefined
        const axis = verticalFace ? entry.port.absolutePosition.x : entry.port.absolutePosition.y
        const boxCenter = verticalFace ? box.x + box.width / 2 : box.y + box.height / 2
        const length = verticalFace ? box.width : box.height
        return { entry, center: boxCenter, half: length / 2, offset: boxCenter - axis }
      })
      .filter((item): item is NonNullable<typeof item> => item !== undefined)
      .sort((a, b) => a.center - b.center || (a.entry.port.id < b.entry.port.id ? -1 : 1))
    const first = items[0]
    const last = items[items.length - 1]
    if (!first || !last) continue
    const minCenter = lo + first.offset
    const maxCenter = hi + last.offset
    let cursor = Math.max(first.center, minCenter)
    let previous = first
    const targets = new Map<string, number>()
    targets.set(first.entry.port.id, cursor)
    for (const item of items.slice(1)) {
      cursor = Math.max(item.center, cursor + previous.half + PORT_LABEL_CLEARANCE + item.half)
      targets.set(item.entry.port.id, cursor)
      previous = item
    }
    const overflow = cursor - maxCenter
    if (overflow > 0) {
      cursor = maxCenter
      let next = last
      targets.set(last.entry.port.id, cursor)
      for (const item of [...items.slice(0, -1)].reverse()) {
        cursor = Math.min(
          targets.get(item.entry.port.id) ?? item.center,
          cursor - next.half - PORT_LABEL_CLEARANCE - item.half,
        )
        targets.set(item.entry.port.id, cursor)
        next = item
      }
    }
    const needed =
      items.reduce((sum, item) => sum + item.half * 2, 0) +
      PORT_LABEL_CLEARANCE * (items.length - 1) +
      8
    if (verticalFace) minWidths.set(nodeId, Math.max(minWidths.get(nodeId) ?? 0, needed))
    else minHeights.set(nodeId, Math.max(minHeights.get(nodeId) ?? 0, needed))
    for (const item of items) {
      const targetCenter = targets.get(item.entry.port.id)
      if (targetCenter === undefined) continue
      const axis = Math.max(lo, Math.min(hi, targetCenter - item.offset))
      item.entry.port.absolutePosition = verticalFace
        ? { ...item.entry.port.absolutePosition, x: axis }
        : { ...item.entry.port.absolutePosition, y: axis }
    }
  }
}
function rectGap(a: Bounds, b: Bounds): number {
  const ax2 = a.x + a.width
  const ay2 = a.y + a.height
  const bx2 = b.x + b.width
  const by2 = b.y + b.height
  const dx = Math.max(0, Math.max(b.x - ax2, a.x - bx2))
  const dy = Math.max(0, Math.max(b.y - ay2, a.y - by2))
  return Math.hypot(dx, dy)
}

function movePortLabelAway(
  mover: LabelPort,
  moverBox: Bounds,
  anchorBox: Bounds,
  nodes: ReadonlyMap<string, Node>,
): boolean {
  const node = nodes.get(mover.nodeId)
  const center = node?.position
  if (!node || !center) return false
  const size = resolveNodeSize(node)
  const verticalFace = mover.port.side === 'top' || mover.port.side === 'bottom'
  const current = verticalFace ? mover.port.absolutePosition.x : mover.port.absolutePosition.y
  const lo = verticalFace ? center.x - size.width / 2 + 6 : center.y - size.height / 2 + 6
  const hi = verticalFace ? center.x + size.width / 2 - 6 : center.y + size.height / 2 - 6
  const moverMid = verticalFace ? moverBox.x + moverBox.width / 2 : moverBox.y + moverBox.height / 2
  const anchorMid = verticalFace
    ? anchorBox.x + anchorBox.width / 2
    : anchorBox.y + anchorBox.height / 2
  const delta =
    moverMid >= anchorMid
      ? Math.max(
          0,
          (verticalFace
            ? anchorBox.x + anchorBox.width - moverBox.x
            : anchorBox.y + anchorBox.height - moverBox.y) + PORT_LABEL_CLEARANCE,
        )
      : Math.min(
          0,
          (verticalFace
            ? anchorBox.x - (moverBox.x + moverBox.width)
            : anchorBox.y - (moverBox.y + moverBox.height)) - PORT_LABEL_CLEARANCE,
        )
  const target = Math.max(lo, Math.min(hi, current + delta))
  if (Math.abs(target - current) < 0.25) return false
  mover.port.absolutePosition = verticalFace
    ? { ...mover.port.absolutePosition, x: target }
    : { ...mover.port.absolutePosition, y: target }
  return true
}

/** A rectangle wires must not run through (zone box or node box). */
export interface RoutingObstacle {
  id: string
  bounds: Bounds
}

/**
 * Semantic routing-grammar permissions — the single channel the search feeds
 * the router (a structural subset of `CompositeRoutingPlan`; the router stays
 * decoupled from `routing-plan.ts` by declaring its own view).
 */
export interface OctilinearRoutingPlan {
  /**
   * Primary fan-out groups drawn as ONE org-chart trunk (v3 §47⑤): comb id
   * (parent node id) → edge ids. The parent drops a single trunk to a shared
   * horizontal bus; each child rises from it — collapsing N parallel risers
   * into drop→bus→riser and removing the riser-vs-riser crossings. Edges that
   * don't fit the clean vertical case fall back to normal classification.
   */
  combs?: ReadonlyMap<string, readonly string[]>
  /**
   * Edge ids that may use the lateral "ramp" grammar. Ramps are a semantic
   * notation for same-tier peer links, not a generic side-port fallback.
   */
  rampEdges?: ReadonlySet<string>
  /** Edge ids that may use long subgraph gutter bypasses. */
  gutterEdges?: ReadonlySet<string>
}

export interface OctilinearOptions {
  /** Semantic routing grammar permissions (combs / ramps / gutters). */
  routingPlan?: OctilinearRoutingPlan
  /** Treat |dx| up to this as a straight (near-vertical) run. */
  straightTolerance?: number
  /** Corner chamfer size in px. */
  chamfer?: number
  /** Extra clearance between neighboring tracks beyond stroke widths. */
  trackClearance?: number
  /**
   * Boxes that long edges must BYPASS via gutters (the whitespace
   * corridors between zone boxes) instead of running straight through —
   * v3's "through-traffic takes the bypass, not the city streets"
   * (engine-v3-design.md §36). Edges whose endpoints touch an obstacle
   * are exempt from that obstacle.
   */
  obstacles?: readonly RoutingObstacle[]
  /**
   * Node boxes as first-class routing obstacles: horizontal tracks pick
   * a y that clears them, vertical runs shift around them, comb trunk
   * corridors land beside them. An edge is exempt from its OWN
   * endpoints' boxes. A wire under a node is a defect, not a trade-off.
   */
  nodeObstacles?: readonly RoutingObstacle[]
  /** Minimum vertical span before subgraph gutter bypass is considered. */
  gutterMinSpan?: number
}

interface OrthRoute {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  half: number
  trackY: number
  shiftX: number
  /** When set, route via the gutter column at this x (6-point bypass). */
  gutterX?: number
  trackY2?: number
}

/**
 * Mutates eligible edges: sets `route` to an octilinear polyline (and
 * mirrors the corner points into `points` for labels / hit testing).
 * Returns the number of edges routed.
 */
export function applyOctilinearRoutes(
  edges: Map<string, ResolvedEdge>,
  options: OctilinearOptions = {},
): number {
  const straightTol = options.straightTolerance ?? 16
  const chamfer = options.chamfer ?? 9
  const clearance = options.trackClearance ?? 3
  const gutterMinSpan = options.gutterMinSpan ?? 160
  const combs = options.routingPlan?.combs
  const rampEdges = options.routingPlan?.rampEdges
  const gutterEdges = options.routingPlan?.gutterEdges
  // node boxes as routing obstacles + per-edge exemptions
  const nodeBoxes = (options.nodeObstacles ?? []).map((o) => ({
    id: o.id,
    x1: o.bounds.x,
    y1: o.bounds.y,
    x2: o.bounds.x + o.bounds.width,
    y2: o.bounds.y + o.bounds.height,
  }))
  const endpointsOf = new Map<string, readonly [string, string]>()
  for (const e of edges.values()) endpointsOf.set(e.id, [e.fromNodeId, e.toNodeId])

  // -- classify ------------------------------------------------------------------
  // bottom→top pairs route vertically; side-port peers (left/right at similar
  // height) route as under-loops ("ramps" — the v3 redundancy/peer notation).
  interface RampRoute {
    id: string
    x1: number
    y1: number
    dir1: number
    x2: number
    y2: number
    dir2: number
    half: number
    busY: number
  }
  const straights: OrthRoute[] = []
  const orths: OrthRoute[] = []
  const ramps: RampRoute[] = []
  const isSidePort = (side: string): boolean => side === 'left' || side === 'right'
  const sortedEdges = [...edges.values()].sort((a, b) => (a.id < b.id ? -1 : 1))

  // -- org-chart combs (v3 §47⑤): primary fan-outs share one trunk + bus ----
  interface CombMember {
    edgeId: string
    px: number
    py: number
    cx: number
    cy: number
    half: number
    /** Global lane offset in the shared trunk corridor (whole comb,
     *  not per row group — groups share the trunk x). */
    lane: number
  }
  interface CombRoute {
    id: string
    members: CombMember[]
    trunkX: number
    busY: number
    half: number
  }
  const combRoutes: CombRoute[] = []
  const combEdgeIds = new Set<string>()
  // corridors already claimed by earlier combs — two hubs' harnesses
  // must not run the same column (214px of two combs side-on was real)
  const claimedCorridors: { x1: number; x2: number; y1: number; y2: number }[] = []
  if (combs) {
    for (const [combId, edgeIds] of [...combs].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      const members: CombMember[] = []
      for (const edgeId of [...edgeIds].sort()) {
        const edge = edges.get(edgeId)
        if (!edge || edge.coupling) continue
        const parentPort =
          edge.fromNodeId === combId
            ? edge.fromPort
            : edge.toNodeId === combId
              ? edge.toPort
              : undefined
        if (!parentPort) continue
        const childPort = parentPort === edge.fromPort ? edge.toPort : edge.fromPort
        // only the clean vertical case rides the comb; everything else
        // falls back to normal classification below
        if (parentPort.side !== 'bottom' || childPort.side !== 'top') continue
        if (childPort.absolutePosition.y - parentPort.absolutePosition.y < 48) continue
        members.push({
          edgeId,
          px: parentPort.absolutePosition.x,
          py: parentPort.absolutePosition.y,
          cx: childPort.absolutePosition.x,
          cy: childPort.absolutePosition.y,
          half: Math.max(0.5, edge.width / 2),
          lane: 0,
        })
      }
      if (members.length < 2) continue
      // One bus PER CHILD ROW (shared trunk): a single bus above the
      // topmost child sends risers straight through every intermediate
      // row — the dominant pierce source. Per-row buses keep each riser
      // inside its own row's corridor.
      const byRow = [...members].sort((a, b) => a.cy - b.cy || (a.edgeId < b.edgeId ? -1 : 1))
      const rowGroups: CombMember[][] = []
      for (const m of byRow) {
        const last = rowGroups[rowGroups.length - 1]
        const first = last?.[0]
        if (last && first && m.cy - first.cy < 60) last.push(m)
        else rowGroups.push([m])
      }
      const busGroups = rowGroups.filter((group) => group.length >= 2)
      if (busGroups.length === 0) continue
      const busMembers = busGroups.flat()
      // global lanes across the ACTUAL bus members — row groups share
      // the trunk corridor, so per-group lanes would stack on the same x.
      // Singleton rows are not combed; they fall back to normal routing.
      {
        const laneHalf = Math.max(...busMembers.map((m) => m.half))
        const lanePitch = Math.max(3, laneHalf * 2 + 1.5)
        const byCx = [...busMembers].sort((a, b) => a.cx - b.cx || (a.edgeId < b.edgeId ? -1 : 1))
        for (const [i, m] of byCx.entries()) {
          m.lane = (i - (byCx.length - 1) / 2) * lanePitch
        }
      }
      const half = Math.max(...busMembers.map((m) => m.half))
      // corridor width = the GLOBAL lane extent (emit uses global lanes;
      // sizing by group count under-reserved and let two combs' buses
      // land 3px apart)
      const corridorHalf = Math.max(...busMembers.map((m) => Math.abs(m.lane))) + half + 1
      // The trunk corridor runs from the parent past EVERY bused child row
      // down to the deepest bus. Singleton child rows are deliberately
      // excluded because they route better as ordinary orthogonal links.
      const yLo = Math.max(...busMembers.map((m) => m.py)) + 6
      const yHi = Math.max(...busMembers.map((m) => m.cy)) - 10
      const blocked = (x: number): boolean =>
        nodeBoxes.some(
          (b) =>
            b.id !== combId &&
            x + corridorHalf > b.x1 - 2 &&
            x - corridorHalf < b.x2 + 2 &&
            yHi > b.y1 + 4 &&
            yLo < b.y2 - 4,
        ) ||
        claimedCorridors.some(
          (c) =>
            x + corridorHalf > c.x1 - clearance &&
            x - corridorHalf < c.x2 + clearance &&
            yHi > c.y1 + 8 &&
            yLo < c.y2 - 8,
        )
      let trunkX = busMembers.reduce((sum, m) => sum + m.px, 0) / busMembers.length
      for (const off of [
        0, 8, -8, 16, -16, 24, -24, 32, -32, 48, -48, 64, -64, 80, -80, 96, -96, 112, -112, 128,
        -128,
      ]) {
        if (!blocked(trunkX + off)) {
          trunkX += off
          break
        }
      }
      // No clear column for the corridor (heterogeneous fan-outs that
      // span several zones can't share one trunk) → don't comb at all;
      // members fall back to normal orth routing, which has the full
      // dodge machinery. A wire under a node loses to a missing bundle.
      if (blocked(trunkX)) continue
      claimedCorridors.push({
        x1: trunkX - corridorHalf,
        x2: trunkX + corridorHalf,
        y1: yLo,
        y2: yHi,
      })
      for (const [k, group] of busGroups.entries()) {
        combRoutes.push({
          id: busGroups.length > 1 ? `${combId}~${k}` : combId,
          members: group,
          trunkX,
          busY: 0,
          half: Math.max(...group.map((m) => m.half)),
        })
      }
      for (const m of busMembers) combEdgeIds.add(m.edgeId)
    }
  }

  for (const edge of sortedEdges) {
    // couplings are drawn as the glasses bridge, never routed as a wire
    if (edge.coupling) continue
    if (combEdgeIds.has(edge.id)) continue
    const upper =
      edge.fromPort.absolutePosition.y <= edge.toPort.absolutePosition.y
        ? edge.fromPort
        : edge.toPort
    const lower = upper === edge.fromPort ? edge.toPort : edge.fromPort
    const half = Math.max(0.5, edge.width / 2)
    if (
      rampEdges?.has(edge.id) === true &&
      isSidePort(upper.side) &&
      isSidePort(lower.side) &&
      Math.abs(lower.absolutePosition.y - upper.absolutePosition.y) <= 80
    ) {
      ramps.push({
        id: edge.id,
        x1: upper.absolutePosition.x,
        y1: upper.absolutePosition.y,
        dir1: upper.side === 'right' ? 1 : -1,
        x2: lower.absolutePosition.x,
        y2: lower.absolutePosition.y,
        dir2: lower.side === 'right' ? 1 : -1,
        half,
        busY: 0,
      })
      continue
    }
    if (upper.side !== 'bottom' || lower.side !== 'top') continue
    const x1 = upper.absolutePosition.x
    const y1 = upper.absolutePosition.y
    const x2 = lower.absolutePosition.x
    const y2 = lower.absolutePosition.y
    if (y2 - y1 < 24) continue
    const route: OrthRoute = {
      id: edge.id,
      x1,
      y1,
      x2,
      y2,
      half,
      trackY: 0,
      shiftX: 0,
    }
    if (Math.abs(x2 - x1) <= straightTol) straights.push(route)
    else orths.push(route)
  }

  // -- gutter selection: long edges whose direct vertical would pierce a foreign
  //    group box detour through the whitespace corridor between boxes (v3 §36).
  // Node boxes are handled by the horizontal/vertical track allocators below;
  // using them here turns short local wires into large six-point bypasses.
  const obstacles: RoutingObstacle[] = [...(options.obstacles ?? [])]
  const contains = (bounds: Bounds, x: number, y: number, pad = 4): boolean =>
    x > bounds.x - pad &&
    x < bounds.x + bounds.width + pad &&
    y > bounds.y - pad &&
    y < bounds.y + bounds.height + pad
  const placedGutters: { x: number; y1: number; y2: number; half: number }[] = []
  if (obstacles.length > 0) {
    for (const route of [...straights, ...orths]) {
      if (gutterEdges?.has(route.id) !== true) continue
      const yLo = route.y1 + 16
      const yHi = route.y2 - 16
      if (yHi - yLo < gutterMinSpan) continue
      const relevant = obstacles.filter(
        (o) =>
          o.bounds.y < yHi &&
          o.bounds.y + o.bounds.height > yLo &&
          !contains(o.bounds, route.x1, route.y1, 8) &&
          !contains(o.bounds, route.x2, route.y2, 8),
      )
      if (relevant.length === 0) continue
      const crossesBox = (x: number): boolean =>
        relevant.some((o) => x > o.bounds.x - 6 && x < o.bounds.x + o.bounds.width + 6)
      if (!crossesBox(route.x1) && !crossesBox(route.x2)) continue
      // free x slots = complement of the blocking intervals
      const blocks: [number, number][] = relevant
        .map((o): [number, number] => [o.bounds.x - 8, o.bounds.x + o.bounds.width + 8])
        .sort((a, b) => a[0] - b[0])
      const merged: [number, number][] = []
      for (const block of blocks) {
        const last = merged[merged.length - 1]
        if (last && block[0] <= last[1] + 4) last[1] = Math.max(last[1], block[1])
        else merged.push([block[0], block[1]])
      }
      const desired = (route.x1 + route.x2) / 2
      const candidates: number[] = []
      for (let i = 0; i <= merged.length; i++) {
        const lo = i === 0 ? Number.NEGATIVE_INFINITY : (merged[i - 1]?.[1] ?? 0)
        const hi = i === merged.length ? Number.POSITIVE_INFINITY : (merged[i]?.[0] ?? 0)
        if (hi - lo < route.half * 2 + 16) continue
        candidates.push(Math.max(lo + route.half + 8, Math.min(hi - route.half - 8, desired)))
      }
      candidates.sort((a, b) => Math.abs(a - desired) - Math.abs(b - desired) || a - b)
      const firstSlot = candidates[0]
      if (firstSlot === undefined) continue
      let gutterX = firstSlot
      for (let guard = 0; guard < 40; guard++) {
        const probe = gutterX
        const hit = placedGutters.some(
          (p) =>
            Math.abs(p.x - probe) < p.half + route.half + clearance &&
            Math.min(p.y2, yHi) - Math.max(p.y1, yLo) > 12,
        )
        if (!hit) break
        gutterX += 5
      }
      route.gutterX = gutterX
      placedGutters.push({ x: gutterX, y1: yLo, y2: yHi, half: route.half })
    }
  }

  // -- global horizontal track allocation (ONE allocator, bounds inside) --------
  interface TrackRequest {
    id: string
    half: number
    lo: number
    hi: number
    want: number
    floor: number
    ceil: number
    /** Node ids whose boxes this track may legally touch (its endpoints). */
    exempt?: ReadonlySet<string>
    assign: (y: number) => void
  }
  const requests: TrackRequest[] = []
  for (const route of orths) {
    if (route.gutterX !== undefined) continue
    requests.push({
      id: route.id,
      half: route.half,
      lo: Math.min(route.x1, route.x2),
      hi: Math.max(route.x1, route.x2),
      // org-chart convention: turn near the child (just above the target)
      want: route.y2 - 26,
      floor: route.y1 + 10,
      ceil: route.y2 - 10,
      exempt: new Set(endpointsOf.get(route.id) ?? []),
      assign: (y) => {
        route.trackY = y
      },
    })
  }
  // gutter routes need two horizontal runs (below the source, above the target)
  for (const route of [...straights, ...orths]) {
    const gutterX = route.gutterX
    if (gutterX === undefined) continue
    const gutterExempt = new Set(endpointsOf.get(route.id) ?? [])
    requests.push({
      id: `${route.id}|t`,
      half: route.half,
      lo: Math.min(route.x1, gutterX),
      hi: Math.max(route.x1, gutterX),
      want: route.y1 + 26,
      floor: route.y1 + 10,
      ceil: route.y2 - 40,
      exempt: gutterExempt,
      assign: (y) => {
        route.trackY = y
      },
    })
    requests.push({
      id: `${route.id}|b`,
      half: route.half,
      lo: Math.min(gutterX, route.x2),
      hi: Math.max(gutterX, route.x2),
      want: route.y2 - 30,
      floor: route.y1 + 24,
      ceil: route.y2 - 10,
      exempt: gutterExempt,
      assign: (y) => {
        route.trackY2 = y
      },
    })
  }
  // comb buses go through the SAME global allocator — one request per
  // comb, sized for the whole parallel-strand corridor
  for (const comb of combRoutes) {
    const minChildY = Math.min(...comb.members.map((m) => m.cy))
    const maxParentY = Math.max(...comb.members.map((m) => m.py))
    const combExempt = new Set<string>([comb.id])
    for (const m of comb.members) {
      for (const nid of endpointsOf.get(m.edgeId) ?? []) combExempt.add(nid)
    }
    requests.push({
      id: `comb:${comb.id}`,
      half: Math.max(...comb.members.map((m) => Math.abs(m.lane))) + comb.half + 1,
      exempt: combExempt,
      lo: Math.min(comb.trunkX, ...comb.members.map((m) => m.cx)) - 16,
      hi: Math.max(comb.trunkX, ...comb.members.map((m) => m.cx)) + 16,
      want: minChildY - 26,
      floor: maxParentY + 10,
      ceil: minChildY - 10,
      assign: (y) => {
        comb.busY = y
      },
    })
  }
  // ramp buses share the SAME allocator (separate allocators collide)
  for (const ramp of ramps) {
    const bottom = Math.max(ramp.y1, ramp.y2)
    requests.push({
      id: `ramp:${ramp.id}`,
      half: ramp.half,
      exempt: new Set(endpointsOf.get(ramp.id) ?? []),
      lo: Math.min(ramp.x1, ramp.x2) - 16,
      hi: Math.max(ramp.x1, ramp.x2) + 16,
      want: bottom + 30,
      floor: bottom + 18,
      ceil: bottom + 400,
      assign: (y) => {
        ramp.busY = y
      },
    })
  }
  requests.sort((a, b) => a.want - b.want || (a.id < b.id ? -1 : 1))
  const placedTracks: { y: number; lo: number; hi: number; half: number }[] = []
  for (const request of requests) {
    const half = request.half
    // The x-overlap halves of both conflict conditions don't depend on the
    // candidate y, and placedTracks doesn't change during this request's
    // step probing — prefilter once instead of rescanning every track and
    // every node box per probe (same predicate, same result).
    const candTracks = placedTracks.filter((p) => request.lo < p.hi + 12 && request.hi > p.lo - 12)
    const candBoxes = nodeBoxes.filter(
      (b) => !request.exempt?.has(b.id) && request.lo < b.x2 + 4 && request.hi > b.x1 - 4,
    )
    const conflicts = (y: number): boolean => {
      for (const p of candTracks) {
        if (Math.abs(p.y - y) < p.half + half + clearance) return true
      }
      // never run a horizontal track THROUGH a foreign node box
      for (const b of candBoxes) {
        if (y > b.y1 - half - 2 && y < b.y2 + half + 2) return true
      }
      return false
    }
    const clamp = (y: number): number => Math.max(request.floor, Math.min(request.ceil, y))
    let y = clamp(request.want)
    for (let step = 6; step <= 240 && conflicts(y); step += 6) {
      const down = clamp(request.want + step)
      if (down !== y && !conflicts(down)) {
        y = down
        break
      }
      const up = clamp(request.want - step)
      if (up !== y && !conflicts(up)) {
        y = up
        break
      }
    }
    placedTracks.push({ y, lo: request.lo, hi: request.hi, half })
    request.assign(y)
  }

  // -- vertical corridor separation (geometry-level, not a render nudge) --------
  const placedVerticals: { x: number; y1: number; y2: number; half: number }[] = []
  // comb trunk corridors and risers are fixed — register them first
  for (const comb of combRoutes) {
    const minParentY = Math.min(...comb.members.map((m) => m.py))
    const corridorHalf = Math.max(...comb.members.map((m) => Math.abs(m.lane))) + comb.half + 1
    placedVerticals.push({ x: comb.trunkX, y1: minParentY, y2: comb.busY, half: corridorHalf })
    for (const m of comb.members) {
      placedVerticals.push({ x: m.cx, y1: comb.busY, y2: m.cy, half: m.half })
    }
  }
  // gutter columns are fixed corridors — register them first so others dodge
  for (const route of [...straights, ...orths]) {
    if (route.gutterX === undefined) continue
    placedVerticals.push({
      x: route.gutterX,
      y1: route.trackY,
      y2: route.trackY2 ?? route.y2,
      half: route.half,
    })
  }
  // ramp entry/exit stubs are short verticals too — unregistered, they
  // got grazed by through-running lines
  for (const ramp of ramps) {
    placedVerticals.push({
      x: ramp.x1 + ramp.dir1 * 14,
      y1: Math.min(ramp.y1, ramp.busY),
      y2: Math.max(ramp.y1, ramp.busY),
      half: ramp.half,
    })
    placedVerticals.push({
      x: ramp.x2 + ramp.dir2 * 14,
      y1: Math.min(ramp.y2, ramp.busY),
      y2: Math.max(ramp.y2, ramp.busY),
      half: ramp.half,
    })
  }
  const verticalRuns = (route: OrthRoute, kind: 'straight' | 'orth') =>
    kind === 'straight'
      ? [{ x: (route.x1 + route.x2) / 2, y1: route.y1, y2: route.y2 }]
      : [
          { x: route.x1, y1: route.y1, y2: route.trackY },
          { x: route.x2, y1: route.trackY, y2: route.y2 },
        ]
  const allocate = (route: OrthRoute, kind: 'straight' | 'orth'): void => {
    const runs = verticalRuns(route, kind)
    const ownNodes = new Set(endpointsOf.get(route.id) ?? [])
    let chosen = 0
    candidate: for (const shift of [
      0, 4, -4, 8, -8, 12, -12, 16, -16, 20, -20, 24, -24, 28, -28, 32, -32,
    ]) {
      for (const run of runs) {
        for (const placed of placedVerticals) {
          const overlap =
            Math.min(Math.max(run.y1, run.y2), placed.y2) -
            Math.max(Math.min(run.y1, run.y2), placed.y1)
          if (
            Math.abs(run.x + shift - placed.x) < placed.half + route.half + clearance &&
            overlap > 12
          ) {
            continue candidate
          }
        }
        // a vertical run through a foreign node box is a pierce — dodge
        for (const b of nodeBoxes) {
          if (ownNodes.has(b.id)) continue
          const x = run.x + shift
          if (x <= b.x1 - route.half - 2 || x >= b.x2 + route.half + 2) continue
          const overlap =
            Math.min(Math.max(run.y1, run.y2), b.y2) - Math.max(Math.min(run.y1, run.y2), b.y1)
          if (overlap > 4) continue candidate
        }
      }
      chosen = shift
      break
    }
    route.shiftX = chosen
    for (const run of runs) {
      placedVerticals.push({
        x: run.x + chosen,
        y1: Math.min(run.y1, run.y2),
        y2: Math.max(run.y1, run.y2),
        half: route.half,
      })
    }
  }
  for (const route of straights) {
    if (route.gutterX === undefined) allocate(route, 'straight')
  }
  for (const route of orths) {
    if (route.gutterX === undefined) allocate(route, 'orth')
  }

  // -- emit polylines -------------------------------------------------------------
  let routed = 0
  const emitGutter = (route: OrthRoute): boolean => {
    const gutterX = route.gutterX
    if (gutterX === undefined) return false
    const edge = edges.get(route.id)
    if (!edge) return true
    const t1 = route.trackY
    const t2 = route.trackY2 ?? route.y2 - 10
    const corner: Position[] = [
      { x: route.x1, y: route.y1 },
      { x: route.x1, y: t1 },
      { x: gutterX, y: t1 },
      { x: gutterX, y: t2 },
      { x: route.x2, y: t2 },
      { x: route.x2, y: route.y2 },
    ]
    edge.route = { kind: 'polyline', points: chamferCorners(corner, chamfer) }
    edge.points = corner
    routed++
    return true
  }
  for (const route of straights) {
    if (emitGutter(route)) continue
    const edge = edges.get(route.id)
    if (!edge) continue
    const points: Position[] = [
      { x: route.x1 + route.shiftX, y: route.y1 },
      { x: route.x2 + route.shiftX, y: route.y2 },
    ]
    edge.route = { kind: 'polyline', points }
    edge.points = points
    routed++
  }
  for (const route of orths) {
    if (emitGutter(route)) continue
    const edge = edges.get(route.id)
    if (!edge) continue
    const corner: Position[] = [
      { x: route.x1 + route.shiftX, y: route.y1 },
      { x: route.x1 + route.shiftX, y: route.trackY },
      { x: route.x2 + route.shiftX, y: route.trackY },
      { x: route.x2 + route.shiftX, y: route.y2 },
    ]
    edge.route = { kind: 'polyline', points: chamferCorners(corner, chamfer) }
    edge.points = corner
    routed++
  }
  for (const comb of combRoutes) {
    const n = comb.members.length
    // Metro discipline (v3 §27-33: ONE STRAND PER PHYSICAL LINK, no
    // merged trunk): members run as PARALLEL strands in a shared
    // corridor — each line stays individually traceable from port to
    // child (the dependency reading), while the corridor itself reads
    // as one harness. Lane order follows child x so strands never
    // cross each other inside the corridor.
    const ordered = [...comb.members].sort((a, b) => a.cx - b.cx || (a.edgeId < b.edgeId ? -1 : 1))
    const gatherY = Math.max(...comb.members.map((m) => m.py)) + 6
    for (const [i, m] of ordered.entries()) {
      const edge = edges.get(m.edgeId)
      if (!edge) continue
      const lane = m.lane
      const trunkLaneX = comb.trunkX + lane
      const busLaneY = comb.busY + lane
      const dx = Math.abs(m.px - trunkLaneX)
      const bendY = busLaneY > gatherY ? Math.min(gatherY + dx, busLaneY) : busLaneY
      const raw: Position[] = [
        { x: m.px, y: m.py },
        { x: m.px, y: gatherY },
        { x: trunkLaneX, y: bendY },
        { x: trunkLaneX, y: busLaneY },
        { x: m.cx, y: busLaneY },
        { x: m.cx, y: m.cy },
      ]
      // drop zero-length segments (member sitting exactly on the trunk)
      const corner = raw.filter(
        (p, idx) =>
          idx === 0 ||
          Math.hypot(p.x - (raw[idx - 1]?.x ?? p.x), p.y - (raw[idx - 1]?.y ?? p.y)) > 0.5,
      )
      edge.route = {
        kind: 'bus',
        // row groups split the allocator id with "~k" but remain ONE
        // harness — share the root busId so same-comb strand pairs stay
        // exempt from collinear scoring
        points: chamferCorners(corner, chamfer),
        busId: comb.id.split('~')[0] ?? comb.id,
        branchIndex: i,
        branchCount: n,
      }
      edge.points = corner
      routed++
    }
  }
  for (const ramp of ramps) {
    const edge = edges.get(ramp.id)
    if (!edge) continue
    const out1 = ramp.x1 + ramp.dir1 * 14
    const out2 = ramp.x2 + ramp.dir2 * 14
    const corner: Position[] = [
      { x: ramp.x1, y: ramp.y1 },
      { x: out1, y: ramp.y1 },
      { x: out1, y: ramp.busY },
      { x: out2, y: ramp.busY },
      { x: out2, y: ramp.y2 },
      { x: ramp.x2, y: ramp.y2 },
    ]
    edge.route = { kind: 'polyline', points: chamferCorners(corner, chamfer) }
    edge.points = corner
    routed++
  }
  return routed
}

/** Cut each ~90° corner with a 45° chamfer for the metro look. */
export function chamferCorners(points: readonly Position[], size: number): Position[] {
  if (points.length < 3) return [...points]
  const first = points[0]
  if (!first) return [...points]
  const out: Position[] = [first]
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const corner = points[i]
    const next = points[i + 1]
    if (!prev || !corner || !next) continue
    const inX = corner.x - prev.x
    const inY = corner.y - prev.y
    const outX = next.x - corner.x
    const outY = next.y - corner.y
    const inLen = Math.hypot(inX, inY)
    const outLen = Math.hypot(outX, outY)
    if (inLen === 0 || outLen === 0) {
      out.push(corner)
      continue
    }
    const cos = Math.abs((inX * outX + inY * outY) / (inLen * outLen))
    const cut = Math.min(size, inLen / 2, outLen / 2)
    if (cos < 0.7 && cut > 2) {
      out.push({ x: corner.x - (inX / inLen) * cut, y: corner.y - (inY / inLen) * cut })
      out.push({ x: corner.x + (outX / outLen) * cut, y: corner.y + (outY / outLen) * cut })
    } else {
      out.push(corner)
    }
  }
  const last = points[points.length - 1]
  if (last) out.push(last)
  return out
}
