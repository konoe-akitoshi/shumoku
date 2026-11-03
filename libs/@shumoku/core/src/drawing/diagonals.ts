// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { haloOf } from './ground.js'
import { keepOff, labelBandOf, pitchOf, snapOf, whiteOf } from './kin.js'
import type { Box, Point } from './metrics.js'
import { frameKey, type Geometry, type Line, type Problem } from './problem.js'
import type { Scene } from './scene.js'
import {
  dist,
  drawTurns,
  quarterLegOf,
  sampled,
  simplify,
  type Turn,
  tangentOf,
  turnSign,
  turnsOf,
  unit,
} from './turns.js'

/**
 * The 45° straights of the routes: how far each turn of the realized wires is cut across, read from
 * the room the realized lines and boxes leave. A turn's chamfer (`Turn.leg`) is a segment of the
 * route, not an accessory of its corner, and is as long as the room lets it be:
 *
 * - The drawing is shortest, and each right angle becomes two 45° bends, when every chamfer is as
 *   long as it may be; a step whose two runs hold it is crossed by one 45° straight (two 45° bends
 *   in place of two right angles). Path length is what readability follows first, then bends and
 *   crossings, so this is the objective: the longest chamfers the constraints below allow.
 * - What bounds a chamfer: a port is left straight for the label's band and the rounding (the line
 *   leaves its card orthogonally); a straight between two turns holds both their roundings (shared
 *   half each, then what one leaves to the other); every piece the chamfer adds keeps the pitch off
 *   every other line, the white (the lead-out where ports leave) off every card, the white off every
 *   frame, and crosses nothing. So no crossing moves, comes or goes (the crossings stay where the
 *   routes put them, at right angles, a pitch past any turn), and nothing is taken from what realize
 *   gave the other lines: the room is the room left free.
 * - A nest turns together: its members' chamfers are the innermost's moved out along the diagonal
 *   (`leg_k = leg_0 + (2 − √2)·D_k`), which keeps the pitch across the 45° straights; a step of a
 *   nest is crossed so too. A nest lengthens only as one.
 *
 * Nothing is asked of the layout: what is not free stays the turn realize gave room for (`turnsOf`).
 */
export function diagonalsOf(
  problem: Problem,
  geometry: Geometry,
  wires: ReadonlyMap<string, Point[]>,
  ports: NonNullable<Scene['ports']>,
): Map<string, Turn[]> {
  const metrics = problem.metrics
  const snap = snapOf(metrics)
  const band = labelBandOf(metrics)
  const lineById = new Map(problem.lines.map((l) => [l.id, l]))

  const skeleton = new Map<string, Point[]>()
  for (const [id, pts] of wires) skeleton.set(id, simplify(pts))
  const base = turnsOf(problem, skeleton)

  interface State {
    id: string
    line: Line
    pts: Point[]
    turns: Turn[]
    drawn: Point[]
    box: Bounds
    ends: Set<string>
  }
  const states = new Map<string, State>()
  for (const [id, pts] of skeleton) {
    const line = lineById.get(id)
    if (!line) continue
    const turns = (base.get(id) ?? []).map((t) => ({ ...t }))
    const drawn = sampledOf(pts, turns)
    const ends = new Set(
      [line.a.item, line.a.node, line.b.item, line.b.node].filter((x): x is string => !!x),
    )
    states.set(id, { id, line, pts, turns, drawn, box: boundsOf(drawn), ends })
  }

  // The cards and frames, with the sides of each that ports leave.
  const frameKeys = new Set(problem.frames.map((f) => frameKey(f.id)))
  const portedSides = new Map<string, Set<string>>()
  const unitOf = new Map<string, string>()
  for (const item of problem.items)
    for (const m of item.members ?? []) unitOf.set(m.node.id, item.id)
  for (const p of ports) {
    for (const key of [p.nodeId, unitOf.get(p.nodeId)]) {
      if (!key) continue
      const set = portedSides.get(key) ?? new Set<string>()
      set.add(p.side)
      portedSides.set(key, set)
    }
  }
  const cards: { key: string; box: Box; ported: Set<string> }[] = []
  const frameEdges: [Point, Point][] = []
  for (const [key, box] of geometry.boxes) {
    if (frameKeys.has(key)) {
      const a = { x: box.x, y: box.y }
      const b = { x: box.x + box.width, y: box.y }
      const c = { x: box.x + box.width, y: box.y + box.height }
      const d = { x: box.x, y: box.y + box.height }
      frameEdges.push([a, b], [b, c], [c, d], [d, a])
      continue
    }
    cards.push({ key, box, ported: portedSides.get(key) ?? new Set() })
  }

  const turnAt = (st: State, i: number) => st.turns.find((t) => t.i === i)
  /** What a turn takes of a straight at its vertex (`use`) and what its rounding takes past that. */
  const takenOf = (t: Turn | undefined) => (t ? (t.leg > 0 ? t.leg : 0) : 0)
  const tanOf = (t: Turn | undefined) => (t ? (t.leg > 0 ? tangentOf(t.rho) : t.rho) : 0)
  /** The most the turn at `i` may take of its straight on one side (`-1` in, `+1` out). */
  const capOf = (st: State, i: number, side: -1 | 1, half: boolean) => {
    const j = i + side
    const a = st.pts[i]
    const b = st.pts[j]
    const me = turnAt(st, i)
    if (!a || !b || !me) return 0
    const L = dist(a, b)
    const t = tangentOf(me.own)
    if (j === 0 || j === st.pts.length - 1) return L - Math.max(band + t, 2 * t)
    const other = turnAt(st, j)
    const exact = L - takenOf(other) - 2 * Math.max(t, tanOf(other))
    if (!half || !other) return exact
    return Math.min(exact, (L - 2 * Math.max(t, tangentOf(other.own))) / 2)
  }

  /** The pieces of the drawn wire a change of the turns `first..last` adds: from where the drawing leaves the straight coming in to where it rejoins the straight going out, old or new, whichever is farther. */
  const piecesOf = (st: State, first: number, last: number, now: Turn[], drawn: Point[]) => {
    const was = (i: number) => {
      const a = st.turns.find((t) => t.i === i)
      const b = now.find((t) => t.i === i)
      return a && b && takenOf(a) + tanOf(a) > takenOf(b) + tanOf(b) ? a : b
    }
    const p = st.pts[first - 1]
    const v = st.pts[first]
    const w = st.pts[last]
    const n = st.pts[last + 1]
    if (!p || !v || !w || !n) return { now: [], was: [] }
    const din = unit(p, v)
    const dout = unit(w, n)
    const sIn = Math.min(dist(p, v), takenOf(was(first)) + tanOf(was(first)))
    const sOut = Math.min(dist(w, n), takenOf(was(last)) + tanOf(was(last)))
    const A = { x: v.x - din.x * sIn, y: v.y - din.y * sIn }
    const B = { x: w.x + dout.x * sOut, y: w.y + dout.y * sOut }
    return { now: slice(drawn, A, B), was: slice(st.drawn, A, B) }
  }

  /** Whether the pieces of the line `st` keep their room off every other line (as `drawnOf` draws it), card and frame. */
  const clear = (
    st: State,
    cut: { now: Point[]; was: Point[] },
    drawnOf: (id: string) => State['drawn'] | undefined,
  ) => {
    const pieces = segmentsOf(cut.now)
    if (pieces.length === 0) return true
    // What the new pieces leave behind must not have crossed anything: else a crossing would go.
    const was = segmentsOf(cut.was)
    const region = [...cut.was, ...[...cut.now].reverse()]
    const pb = boundsOf(region)
    const crossed = (u0: Point, u1: Point) => was.some(([a, b]) => segDist(a, b, u0, u1) < 1e-9)
    for (const o of states.values()) {
      if (o.id === st.id) continue
      const need = pitchOf(metrics, st.line, o.line) - snap
      const od = drawnOf(o.id) ?? o.drawn
      const ob = od === o.drawn ? o.box : boundsOf(od)
      if (!near(pb, ob, need)) continue
      const others = segmentsOf(od)
      for (const [s0, s1] of pieces) {
        const sb = segBounds(s0, s1)
        for (const [u0, u1] of others) {
          if (near(sb, segBounds(u0, u1), need) && segDist(s0, s1, u0, u1) < need) return false
        }
      }
      // the crossings there are: with the other line as it stands, not as it is being tried with
      // this one (lines changed together leave each other's old pieces behind)
      for (const [u0, u1] of od === o.drawn ? others : segmentsOf(o.drawn))
        if (near(pb, segBounds(u0, u1), 0) && crossed(u0, u1)) return false
    }
    const halo = haloOf(st.line)
    for (const c of cards) {
      // the line's own cards: the white off every side, its ports being left straight (`capOf`)
      const own = st.ends.has(c.key)
      const need = halo + keepOff(metrics, false) - snap
      const far = halo + keepOff(metrics, true) - snap
      const bb = { x0: c.box.x, y0: c.box.y, x1: c.box.x + c.box.width, y1: c.box.y + c.box.height }
      if (!near(pb, bb, Math.max(need, far))) continue
      const corners = [
        { x: bb.x0, y: bb.y0 },
        { x: bb.x1, y: bb.y0 },
        { x: bb.x1, y: bb.y1 },
        { x: bb.x0, y: bb.y1 },
      ]
      if (corners.some((q) => inside(q, region))) return false
      for (const [s0, s1] of pieces) {
        const { d, side } = boxDist(s0, s1, c.box)
        const want = !own && c.ported.has(side) ? far : need
        if (d < want) return false
      }
    }
    const fneed = whiteOf(metrics) + halo - snap
    for (const [e0, e1] of frameEdges) {
      if (!near(pb, segBounds(e0, e1), fneed)) continue
      // A frame's edge is no line to be followed, but where a line enters the frame is to be read:
      // a line may cross the edge on any straight, at 45° too, so long as it enters and leaves the
      // frame where it did (the same edge, as many times), the crossing is a white off the frame's
      // corners, and the line is straight for a white either side of the edge (no turn on it, and
      // no piece running along it).
      const meets = (list: [Point, Point][]) =>
        list.filter(([a, b]) => segDist(a, b, e0, e1) < 1e-9)
      /** Where a polyline crosses the edge: a point once, however many of its pieces touch it there. */
      const crossings = (list: [Point, Point][]) => {
        const at: Point[] = []
        for (const [a, b] of meets(list)) {
          const p = meetOf(a, b, e0, e1)
          if (!at.some((q) => dist(p, q) <= snap)) at.push(p)
        }
        return at.length
      }
      if (crossings(pieces) !== crossings(was)) return false
      const across = new Set(meets(pieces))
      for (const piece of pieces) {
        const [s0, s1] = piece
        if (across.has(piece)) {
          if (Math.min(lineDist(s0, e0, e1), lineDist(s1, e0, e1)) < fneed) return false
          if (Math.min(ptSeg(e0, s0, s1), ptSeg(e1, s0, s1)) < fneed) return false
          continue
        }
        if (segDist(s0, s1, e0, e1) < fneed) return false
      }
    }
    return true
  }

  /** Tries the turns given for some lines at once: keeps them when every added piece is clear. */
  const attempt = (changes: { st: State; turns: Turn[]; first: number; last: number }[]) => {
    const drawn = new Map(changes.map((c) => [c.st.id, sampledOf(c.st.pts, c.turns)]))
    for (const c of changes) {
      const d = drawn.get(c.st.id) ?? []
      const pieces = piecesOf(c.st, c.first, c.last, c.turns, d)
      if (!clear(c.st, pieces, (id) => drawn.get(id))) return false
    }
    for (const c of changes) {
      c.st.turns = c.turns
      c.st.drawn = drawn.get(c.st.id) ?? c.st.drawn
      c.st.box = boundsOf(c.st.drawn)
    }
    return true
  }

  // The nests, as they stand in the turns realize gave room for.
  const nests = new Map<number, { st: State; i: number }[]>()
  for (const st of states.values())
    for (const t of st.turns)
      if (t.nest !== undefined) nests.set(t.nest, [...(nests.get(t.nest) ?? []), { st, i: t.i }])
  const nestList = [...nests.entries()].sort((a, b) => a[0] - b[0])
  const fixed = (st: State, i: number) => {
    const t = turnAt(st, i)
    return !t || t.through || !!turnAt(st, i - 1)?.through
  }

  // 1. Steps crossed by one 45° straight: the shortest form of a step, and two bends fewer. The
  // split `λ` slides the 45° straight along the step's two neighbours as far as their straights
  // hold it, so where realize put the step's run limits nothing more: the run is not drawn.
  const crossStep = (members: { st: State; i: number }[]): boolean => {
    if (members.some((m) => fixed(m.st, m.i) || fixed(m.st, m.i + 1))) return false
    if (members.some((m) => turnSign(m.st.pts, m.i) * turnSign(m.st.pts, m.i + 1) >= 0))
      return false
    if (members.some((m) => m.i + 2 > m.st.pts.length - 1)) return false
    // The innermost's split `λ`; the k-th takes `λ + (2 − √2)·D_k` of its step.
    let lo = 0
    let hi = Number.POSITIVE_INFINITY
    let mid = 0
    const off = (m: (typeof members)[number]) => quarterLegOf(1) * (turnAt(m.st, m.i)?.D ?? 0)
    for (const m of members) {
      const a = m.st.pts[m.i] as Point
      const b = m.st.pts[m.i + 1] as Point
      const step = dist(a, b)
      const me = turnAt(m.st, m.i) as Turn
      if (step < quarterLegOf(me.own)) hi = -1
      const capA = capOf(m.st, m.i, -1, false)
      const capB = capOf(m.st, m.i + 1, 1, false)
      lo = Math.max(lo, step - capB - off(m), snap - off(m))
      hi = Math.min(hi, capA - off(m), step - snap - off(m))
      if ((turnAt(m.st, m.i)?.D ?? 0) === 0) mid = step / 2
    }
    if (!(hi >= lo)) return false
    const changesAt = (lambda: number) =>
      members.map((m) => {
        const step = dist(m.st.pts[m.i] as Point, m.st.pts[m.i + 1] as Point)
        const legA = lambda + off(m)
        const turns = m.st.turns.map((t) =>
          t.i === m.i
            ? { ...t, leg: legA, rho: t.own, through: true }
            : t.i === m.i + 1
              ? { ...t, leg: step - legA, rho: t.own, through: false }
              : t,
        )
        return { st: m.st, turns, first: m.i, last: m.i + 1 }
      })
    // Every split the room allows is as short and as simple: the middle first (the 45° straight
    // centred on the step), then outward a pitch at a time, each side in turn, and the clear split
    // found nearest the middle to within the snap.
    const centre = Math.min(hi, Math.max(lo, mid))
    if (attempt(changesAt(centre))) return true
    const inner0 = members[0]
    if (!inner0) return false
    const q = pitchOf(metrics, inner0.st.line, inner0.st.line)
    for (let k = 1; ; k++) {
      const tries = [centre - k * q, centre + k * q]
        .map((at, side) => ({
          at: Math.min(hi, Math.max(lo, at)),
          from: centre + (side ? 1 : -1) * (k - 1) * q,
          open: side ? centre + (k - 1) * q < hi : centre - (k - 1) * q > lo,
        }))
        .filter((t) => t.open)
      if (tries.length === 0) return false
      for (const { at, from } of tries) {
        if (!wouldFit(changesAt(at))) continue
        let good = at
        let bad = from
        while (Math.abs(good - bad) > snap) {
          const g = (good + bad) / 2
          if (wouldFit(changesAt(g))) good = g
          else bad = g
        }
        if (attempt(changesAt(good))) return true
      }
    }
  }
  for (const [, members] of nestList) crossStep(members)

  // 2. Every other turn's 45° straight as long as its room lets it: first each straight shared half
  // and half, then what one turn leaves to the other.
  for (const half of [true, false]) {
    const order = nestList
      .map(([, members]) => members)
      .filter((members) => members.every((m) => !fixed(m.st, m.i)))
    for (const members of order) {
      const baseOf = (m: (typeof members)[number]) => {
        const t = turnAt(m.st, m.i) as Turn
        return t.leg > 0 ? t.leg : quarterLegOf(t.rho)
      }
      let cap = Number.POSITIVE_INFINITY
      for (const m of members) {
        const c = Math.min(capOf(m.st, m.i, -1, half), capOf(m.st, m.i, 1, half))
        cap = Math.min(cap, c - baseOf(m))
      }
      if (!(cap >= snap)) continue
      const changesFor = (g: number) =>
        members.map((m) => {
          const leg = baseOf(m) + g
          const turns = m.st.turns.map((t) => (t.i === m.i ? { ...t, leg, rho: t.own } : t))
          return { st: m.st, turns, first: m.i, last: m.i }
        })
      if (attempt(changesFor(cap))) continue
      let lo = 0
      let hi = cap
      while (hi - lo > snap) {
        const g = (lo + hi) / 2
        // a trial keeps nothing: the state changes only with the last good length
        if (wouldFit(changesFor(g))) lo = g
        else hi = g
      }
      if (lo >= snap) attempt(changesFor(lo))
    }
  }

  // 3. The steps again: the other lines' 45° straights may have left the room a step lacked, and a
  // step whose two turns took all of it but the roundings is crossed by one 45° straight where the
  // room lets it (two bends fewer, shorter), not left as two 45° straights a rounding apart.
  for (const [, members] of nestList) crossStep(members)

  function wouldFit(changes: { st: State; turns: Turn[]; first: number; last: number }[]) {
    const drawn = new Map(changes.map((c) => [c.st.id, sampledOf(c.st.pts, c.turns)]))
    return changes.every((c) =>
      clear(c.st, piecesOf(c.st, c.first, c.last, c.turns, drawn.get(c.st.id) ?? []), (id) =>
        drawn.get(id),
      ),
    )
  }

  return new Map([...states].map(([id, st]) => [id, st.turns]))
}

/** The segments of a polyline, in order. */
function segmentsOf(pts: readonly Point[]): [Point, Point][] {
  return pts.slice(1).map((b, k) => [pts[k] ?? b, b])
}

function sampledOf(pts: readonly Point[], turns: readonly Turn[]): Point[] {
  const d = drawTurns(pts, turns)
  return sampled(d.points, d.radii)
}

interface Bounds {
  x0: number
  y0: number
  x1: number
  y1: number
}

function boundsOf(pts: readonly Point[]): Bounds {
  let x0 = Number.POSITIVE_INFINITY
  let y0 = Number.POSITIVE_INFINITY
  let x1 = Number.NEGATIVE_INFINITY
  let y1 = Number.NEGATIVE_INFINITY
  for (const p of pts) {
    x0 = Math.min(x0, p.x)
    y0 = Math.min(y0, p.y)
    x1 = Math.max(x1, p.x)
    y1 = Math.max(y1, p.y)
  }
  return { x0, y0, x1, y1 }
}

function segBounds(a: Point, b: Point): Bounds {
  return {
    x0: Math.min(a.x, b.x),
    y0: Math.min(a.y, b.y),
    x1: Math.max(a.x, b.x),
    y1: Math.max(a.y, b.y),
  }
}

function near(a: Bounds, b: Bounds, by: number): boolean {
  return !(a.x1 + by < b.x0 || b.x1 + by < a.x0 || a.y1 + by < b.y0 || b.y1 + by < a.y0)
}

/** The part of a polyline between the points on it nearest `a` and `b`. */
function slice(poly: readonly Point[], a: Point, b: Point): Point[] {
  const segs = segmentsOf(poly)
  const at = (q: Point) => {
    let best = { k: 0, t: 0, d: Number.POSITIVE_INFINITY }
    for (const [k, [p0, p1]] of segs.entries()) {
      const dx = p1.x - p0.x
      const dy = p1.y - p0.y
      const L2 = dx * dx + dy * dy
      const t = L2 > 0 ? Math.max(0, Math.min(1, ((q.x - p0.x) * dx + (q.y - p0.y) * dy) / L2)) : 0
      const d = Math.hypot(p0.x + t * dx - q.x, p0.y + t * dy - q.y)
      if (d < best.d - 1e-9) best = { k, t, d }
    }
    return best
  }
  const s = at(a)
  const e = at(b)
  const point = (x: { k: number; t: number }) => {
    const p0 = poly[x.k] as Point
    const p1 = (poly[x.k + 1] ?? p0) as Point
    return { x: p0.x + x.t * (p1.x - p0.x), y: p0.y + x.t * (p1.y - p0.y) }
  }
  if (s.k > e.k || (s.k === e.k && s.t > e.t)) return []
  return [point(s), ...poly.slice(s.k + 1, e.k + 1), point(e)]
}

/** Whether a point lies inside a polygon (even-odd). */
function inside(q: Point, poly: readonly Point[]): boolean {
  let odd = false
  for (const [k, a] of poly.entries()) {
    const b = poly[(k + 1) % poly.length] as Point
    if (a.y > q.y !== b.y > q.y && q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x) odd = !odd
  }
  return odd
}

function side(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

function ptSeg(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const L2 = dx * dx + dy * dy
  const t = L2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2)) : 0
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
}

/** Where two segments that meet meet (an end of one where they lie along each other). */
function meetOf(a: Point, b: Point, c: Point, d: Point): Point {
  const den = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x)
  if (Math.abs(den) < 1e-12) return ptSeg(a, c, d) < 1e-9 ? a : b
  const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / den
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }
}

/** The distance of a point from the line through `a` and `b`. */
function lineDist(p: Point, a: Point, b: Point): number {
  const L = Math.hypot(b.x - a.x, b.y - a.y)
  return L > 0 ? Math.abs(side(a, b, p)) / L : Math.hypot(p.x - a.x, p.y - a.y)
}

/** The distance of two segments: 0 where they meet. */
function segDist(a: Point, b: Point, c: Point, d: Point): number {
  const d1 = side(a, b, c)
  const d2 = side(a, b, d)
  const d3 = side(c, d, a)
  const d4 = side(c, d, b)
  if (d1 * d2 <= 0 && d3 * d4 <= 0) {
    const sb = segBounds(a, b)
    const tb = segBounds(c, d)
    if (near(sb, tb, 1e-9)) return 0
  }
  return Math.min(ptSeg(a, c, d), ptSeg(b, c, d), ptSeg(c, a, b), ptSeg(d, a, b))
}

/** The distance of a segment from a box, and the box's side nearest it. */
function boxDist(a: Point, b: Point, box: Box): { d: number; side: string } {
  const x0 = box.x
  const y0 = box.y
  const x1 = box.x + box.width
  const y1 = box.y + box.height
  const inside = (p: Point) => p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1
  if (inside(a) || inside(b)) return { d: 0, side: 'top' }
  const edges: [string, Point, Point][] = [
    ['top', { x: x0, y: y0 }, { x: x1, y: y0 }],
    ['right', { x: x1, y: y0 }, { x: x1, y: y1 }],
    ['bottom', { x: x1, y: y1 }, { x: x0, y: y1 }],
    ['left', { x: x0, y: y1 }, { x: x0, y: y0 }],
  ]
  let best = { d: Number.POSITIVE_INFINITY, side: 'top' }
  for (const [s, p, q] of edges) {
    const d = segDist(a, b, p, q)
    if (d < best.d) best = { d, side: s }
  }
  return best
}
