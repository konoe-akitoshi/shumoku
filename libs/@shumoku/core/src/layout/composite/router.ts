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
import type { ResolvedEdge } from '../resolved-types.js'

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
export function alignPortsToPeers(
  edges: Map<string, ResolvedEdge>,
  nodes: Map<string, Node>,
): number {
  let flipped = 0
  const seat = (
    port: ResolvedEdge['fromPort'],
    nodeId: string,
    side: 'top' | 'bottom' | 'left' | 'right',
  ): void => {
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
      seat(
        leftIsFrom ? edge.fromPort : edge.toPort,
        leftIsFrom ? edge.fromNodeId : edge.toNodeId,
        'right',
      )
      seat(
        leftIsFrom ? edge.toPort : edge.fromPort,
        leftIsFrom ? edge.toNodeId : edge.fromNodeId,
        'left',
      )
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
  for (const edge of sortedForSeat) {
    if (edge.coupling) continue
    const ends: [ResolvedEdge['fromPort'], ResolvedEdge['fromPort']][] = [
      [edge.fromPort, edge.toPort],
      [edge.toPort, edge.fromPort],
    ]
    for (const [port, peer] of ends) {
      if (port.side !== 'top' && port.side !== 'bottom') continue
      const key = `${port.nodeId}|${port.side}`
      const group = faceGroups.get(key) ?? []
      group.push({ port, peerX: peer.absolutePosition.x, width: edge.width, edgeId: edge.id })
      faceGroups.set(key, group)
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
    const slots = group.map((entry) => Math.max(8, entry.width + 4))
    const total = slots.reduce((sum, w) => sum + w, 0)
    const faceWidth = Math.max(12, size.width - 8)
    const scale = total > faceWidth ? faceWidth / total : 1
    let cursor = center.x - (total * scale) / 2
    for (const [i, entry] of group.entries()) {
      const w = (slots[i] ?? 8) * scale
      entry.port.absolutePosition = { ...entry.port.absolutePosition, x: cursor + w / 2 }
      cursor += w
    }
  }
  return flipped
}

/** A rectangle wires must not run through (zone box or node box). */
export interface RoutingObstacle {
  id: string
  bounds: Bounds
}

export interface OctilinearOptions {
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
   * Primary fan-out groups drawn as ONE org-chart trunk (v3 §47⑤):
   * comb id (parent node id) → edge ids. The parent drops a single
   * trunk to a shared horizontal bus; each child rises from the bus.
   * Collapses N parallel long risers into drop→bus→riser, which is the
   * pre-attentive "org chart" reading and removes the riser-vs-riser
   * crossings entirely. Edges that don't fit the clean vertical case
   * fall back to normal classification.
   */
  combs?: ReadonlyMap<string, readonly string[]>
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
  if (options.combs) {
    for (const [combId, edgeIds] of [...options.combs].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
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
        })
      }
      if (members.length < 2) continue
      const trunkX = members.reduce((sum, m) => sum + m.px, 0) / members.length
      combRoutes.push({
        id: combId,
        members,
        trunkX,
        busY: 0,
        half: Math.max(...members.map((m) => m.half)),
      })
      for (const m of members) combEdgeIds.add(m.edgeId)
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
  //    zone box detour through the whitespace corridor between boxes (v3 §36).
  const obstacles = options.obstacles ?? []
  const contains = (bounds: Bounds, x: number, y: number, pad = 4): boolean =>
    x > bounds.x - pad &&
    x < bounds.x + bounds.width + pad &&
    y > bounds.y - pad &&
    y < bounds.y + bounds.height + pad
  const placedGutters: { x: number; y1: number; y2: number; half: number }[] = []
  if (obstacles.length > 0) {
    for (const route of [...straights, ...orths]) {
      const yLo = route.y1 + 16
      const yHi = route.y2 - 16
      if (yHi - yLo < 80) continue
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
      assign: (y) => {
        route.trackY = y
      },
    })
  }
  // gutter routes need two horizontal runs (below the source, above the target)
  for (const route of [...straights, ...orths]) {
    const gutterX = route.gutterX
    if (gutterX === undefined) continue
    requests.push({
      id: `${route.id}|t`,
      half: route.half,
      lo: Math.min(route.x1, gutterX),
      hi: Math.max(route.x1, gutterX),
      want: route.y1 + 26,
      floor: route.y1 + 10,
      ceil: route.y2 - 40,
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
      assign: (y) => {
        route.trackY2 = y
      },
    })
  }
  // comb buses go through the SAME global allocator — one request per comb
  for (const comb of combRoutes) {
    const minChildY = Math.min(...comb.members.map((m) => m.cy))
    const maxParentY = Math.max(...comb.members.map((m) => m.py))
    requests.push({
      id: `comb:${comb.id}`,
      half: comb.half,
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
    const conflicts = (y: number): boolean =>
      placedTracks.some(
        (p) =>
          Math.abs(p.y - y) < p.half + half + clearance &&
          request.lo < p.hi + 12 &&
          request.hi > p.lo - 12,
      )
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
  // comb trunks and risers are fixed corridors — register them first
  for (const comb of combRoutes) {
    const minParentY = Math.min(...comb.members.map((m) => m.py))
    placedVerticals.push({ x: comb.trunkX, y1: minParentY, y2: comb.busY, half: comb.half })
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
  const verticalRuns = (route: OrthRoute, kind: 'straight' | 'orth') =>
    kind === 'straight'
      ? [{ x: (route.x1 + route.x2) / 2, y1: route.y1, y2: route.y2 }]
      : [
          { x: route.x1, y1: route.y1, y2: route.trackY },
          { x: route.x2, y1: route.trackY, y2: route.y2 },
        ]
  const allocate = (route: OrthRoute, kind: 'straight' | 'orth'): void => {
    const runs = verticalRuns(route, kind)
    let chosen = 0
    candidate: for (const shift of [0, 4, -4, 8, -8, 12, -12, 16, -16]) {
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
    for (const [i, m] of comb.members.entries()) {
      const edge = edges.get(m.edgeId)
      if (!edge) continue
      // collapse the parent port onto the shared trunk
      const parentPort = edge.fromNodeId === comb.id ? edge.fromPort : edge.toPort
      parentPort.absolutePosition = { ...parentPort.absolutePosition, x: comb.trunkX }
      const corner: Position[] = [
        { x: comb.trunkX, y: m.py },
        { x: comb.trunkX, y: comb.busY },
        { x: m.cx, y: comb.busY },
        { x: m.cx, y: m.cy },
      ]
      edge.route = {
        kind: 'bus',
        points: chamferCorners(corner, chamfer),
        busId: comb.id,
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
