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

import type { Position } from '../../models/types.js'
import type { ResolvedEdge } from '../resolved-types.js'

export interface OctilinearOptions {
  /** Treat |dx| up to this as a straight (near-vertical) run. */
  straightTolerance?: number
  /** Corner chamfer size in px. */
  chamfer?: number
  /** Extra clearance between neighboring tracks beyond stroke widths. */
  trackClearance?: number
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

  // -- classify: only bottom→top vertical pairs are routed ----------------------
  const straights: OrthRoute[] = []
  const orths: OrthRoute[] = []
  const sortedEdges = [...edges.values()].sort((a, b) => (a.id < b.id ? -1 : 1))
  for (const edge of sortedEdges) {
    const upper =
      edge.fromPort.absolutePosition.y <= edge.toPort.absolutePosition.y
        ? edge.fromPort
        : edge.toPort
    const lower = upper === edge.fromPort ? edge.toPort : edge.fromPort
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
      half: Math.max(0.5, edge.width / 2),
      trackY: 0,
      shiftX: 0,
    }
    if (Math.abs(x2 - x1) <= straightTol) straights.push(route)
    else orths.push(route)
  }

  // -- global horizontal track allocation (one allocator, bounds inside) --------
  interface TrackRequest {
    route: OrthRoute
    lo: number
    hi: number
    want: number
    floor: number
    ceil: number
  }
  const requests: TrackRequest[] = []
  for (const route of orths) {
    requests.push({
      route,
      lo: Math.min(route.x1, route.x2),
      hi: Math.max(route.x1, route.x2),
      // org-chart convention: turn near the child (just above the target)
      want: route.y2 - 26,
      floor: route.y1 + 10,
      ceil: route.y2 - 10,
    })
  }
  requests.sort((a, b) => a.want - b.want || (a.route.id < b.route.id ? -1 : 1))
  const placedTracks: { y: number; lo: number; hi: number; half: number }[] = []
  for (const request of requests) {
    const half = request.route.half
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
    request.route.trackY = y
  }

  // -- vertical corridor separation (geometry-level, not a render nudge) --------
  const placedVerticals: { x: number; y1: number; y2: number; half: number }[] = []
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
  for (const route of straights) allocate(route, 'straight')
  for (const route of orths) allocate(route, 'orth')

  // -- emit polylines -------------------------------------------------------------
  let routed = 0
  for (const route of straights) {
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
