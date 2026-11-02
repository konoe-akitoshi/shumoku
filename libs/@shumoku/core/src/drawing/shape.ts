// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { haloOf, pitchOf, snapOf, whiteOf } from './kin.js'
import type { Point } from './metrics.js'
import { type Band, frameKey, type Geometry, type Problem, ROOT } from './problem.js'
import type { Mark } from './scene.js'

/**
 * Cuts the right-angled corners of the realized (axis-parallel) wires into 45° chamfers the size of
 * the arc of a right angle (a line has one radius, and a corner is cut no bigger than it, unless
 * what lies inside the corner allows less), and rounds the 135° vertices. The route is not changed:
 * only the triangle inside a corner is given up, so nothing the realize kept (no line through a
 * box, every crossing on a leg at 90°) is undone. The one thing shape watches is that a chamfer
 * does not come nearer to what lies inside the corner than the white the line keeps there.
 *
 * Leg `l` of a corner (from the right-angled vertex to where the chamfer starts, along either
 * leg; the chamfer itself is `l·√2` long) is the least of
 *   (R1) the leg's room: `L − leadOut` where the leg ends at a port; two corners sharing a
 *        segment of length `Δ` share it (`l_a + l_b ≤ Δ`), half each, then the slack of one goes to the other;
 *   (R2) the nearest crossing on either leg, less the pitch of the two lines, so a crossing
 *        stays on a straight leg at 90° and the lines are a row of white apart either side of it;
 *   (R3) every point `(−a, −b)` inside the corner (box edges, frame edges, other wires):
 *        `l ≤ a + b − √2·c`, `c` the white the line keeps off that thing (`pitchOf` for a line,
 *        `whiteOf + haloOf` for a box);
 *   (R6) the corner's own radius `ρ` (below): a chamfer is a corner's arc cut straight, not a run;
 *   (R4) a corner of the same kind inside this one is measured by its own chamfer, inside out,
 *        which gives `l_out ≤ l_in + (2 − √2)·d` and keeps a bundle concentric; two chamfers
 *        of one slant keep a pitch between them, the one that parts them more giving way.
 * Every 135° vertex is rounded with `ρ = whiteOf + haloOf`: the radius a line turns a box's corner
 * with; a corner whose leg falls to 0 stays a right angle, rounded with `ρ`. (R5) Where the
 * corner of another line stands `d` inside it on the diagonal (a bundle turning together), the
 * radius is that corner's `ρ + d`, so the arcs are concentric and keep the pitch the straights keep.
 */
export interface Shaped {
  wires: Map<string, { points: Point[]; radii: number[] }>
  marks: Omit<Mark, 'link' | 'stroke'>[]
}

const SQ2 = Math.SQRT2
const EPS = 1e-6

interface Seg {
  line: string
  a: Point
  b: Point
}

interface Corner {
  line: string
  /** Index of the vertex in the skeleton. */
  i: number
  v: Point
  /** Unit direction of the incoming leg (from the previous vertex to `v`) and of the outgoing leg. */
  din: Point
  dout: Point
  /** The inward normal of the chamfer: the direction into the corner's inside quadrant, as signs. */
  sx: number
  sy: number
  /** Orientation of the chamfer: +1 for `x + y = const`, −1 for `x − y = const`. */
  orient: number
  /** The leg (axis length). */
  l: number
  /** Static cap (R1 port, R2, R3) before sharing and pairing. */
  cap: number
  rho: number
}

export function shapeWires(
  problem: Problem,
  geometry: Geometry,
  wires: Map<string, Point[]>,
  bands: readonly Band[] = [],
): Shaped {
  const metrics = problem.metrics
  const lines = new Map(problem.lines.map((l) => [l.id, l]))
  const skeleton = new Map<string, Point[]>()
  for (const [id, pts] of wires) skeleton.set(id, dedupe(pts))

  // Segments of every wire, and the edges of every box and frame.
  const wireSegs: Seg[] = []
  for (const [id, pts] of skeleton)
    for (let k = 0; k + 1 < pts.length; k++) {
      const a = pts[k]
      const b = pts[k + 1]
      if (a && b) wireSegs.push({ line: id, a, b })
    }
  const boxSegs: Seg[] = []
  for (const [key, box] of geometry.boxes) {
    if (key === frameKey(ROOT)) continue
    const x0 = box.x
    const y0 = box.y
    const x1 = box.x + box.width
    const y1 = box.y + box.height
    boxSegs.push(
      { line: key, a: { x: x0, y: y0 }, b: { x: x1, y: y0 } },
      { line: key, a: { x: x1, y: y0 }, b: { x: x1, y: y1 } },
      { line: key, a: { x: x1, y: y1 }, b: { x: x0, y: y1 } },
      { line: key, a: { x: x0, y: y1 }, b: { x: x0, y: y0 } },
    )
  }

  const corners: Corner[] = []
  const byLine = new Map<string, Corner[]>()
  for (const [id, pts] of skeleton) {
    const line = lines.get(id)
    if (!line) continue
    const rho = whiteOf(metrics) + haloOf(line)
    const own: Corner[] = []
    for (let i = 1; i + 1 < pts.length; i++) {
      const p = pts[i - 1]
      const v = pts[i]
      const n = pts[i + 1]
      if (!p || !v || !n) continue
      const din = unit(p, v)
      const dout = unit(v, n)
      if (Math.abs(din.x * dout.x + din.y * dout.y) > EPS) continue // not a right angle
      // Inside quadrant: back along the incoming leg, and forward along the outgoing leg.
      const sx = -din.x + dout.x
      const sy = -din.y + dout.y
      const orient = sx * sy > 0 ? 1 : -1
      own.push({
        line: id,
        i,
        v,
        din,
        dout,
        sx,
        sy,
        orient,
        l: 0,
        cap: Number.POSITIVE_INFINITY,
        rho,
      })
    }
    byLine.set(id, own)
    corners.push(...own)
  }

  const snap = snapOf(metrics)
  // The corners by kind (the inside quadrant they open to).
  const kinds = new Map<string, Corner[]>()
  for (const c of corners) {
    const key = `${c.sx},${c.sy}`
    const list = kinds.get(key) ?? []
    list.push(c)
    kinds.set(key, list)
  }
  // R5: the one radius of each line's corners. A corner of a bundle is concentric with the one inside it: the
  // line `d` outside is rounded `d` more (`ρ_out = ρ_in + d`), so the arcs keep the pitch the
  // straights keep. Inside out, so an inner corner's radius is known when an outer one is read.
  for (const list of kinds.values()) {
    list.sort((p, q) => inward(q) - inward(p))
    for (const [idx, outer] of list.entries()) {
      for (const inner of list.slice(0, idx).reverse()) {
        if (inner.line === outer.line) continue
        const dx = (inner.v.x - outer.v.x) * outer.sx
        const dy = (inner.v.y - outer.v.y) * outer.sy
        if (dx < -EPS || dy < -EPS || Math.abs(dx - dy) > snap) continue
        outer.rho = Math.max(outer.rho, inner.rho + Math.min(dx, dy))
        break
      }
    }
  }

  // Static caps: R1 (port legs), R2 (crossings on the legs), R3 (what lies inside).
  for (const c of corners) {
    const pts = skeleton.get(c.line)
    const line = lines.get(c.line)
    if (!pts || !line) continue
    const prev = pts[c.i - 1]
    const next = pts[c.i + 1]
    if (!prev || !next) continue
    const lenIn = dist(prev, c.v)
    const lenOut = dist(c.v, next)
    let cap = Number.POSITIVE_INFINITY
    if (c.i - 1 === 0) cap = Math.min(cap, lenIn - metrics.leadOut)
    if (c.i + 1 === pts.length - 1) cap = Math.min(cap, lenOut - metrics.leadOut)
    // Canonical frame: u along −din (back up the incoming leg), w along dout; inside is u>0, w>0.
    const toLocal = (p: Point): { u: number; w: number } => ({
      u: -((p.x - c.v.x) * c.din.x + (p.y - c.v.y) * c.din.y),
      w: (p.x - c.v.x) * c.dout.x + (p.y - c.v.y) * c.dout.y,
    })
    const consider = (s: Seg, white: number, ownLegs: boolean): void => {
      const t = white
      const A = toLocal(s.a)
      const B = toLocal(s.b)
      // Does the segment cross a leg? Incoming leg: w = 0, u ∈ (0, lenIn]; outgoing: u = 0, w ∈ (0, lenOut].
      if (!ownLegs) {
        const hit = crossLeg(A, B, lenIn, lenOut)
        if (hit !== undefined) {
          cap = Math.min(cap, hit - t)
          return
        }
      }
      // Clip to the closed inside quadrant u ≥ 0, w ≥ 0 and take the point nearest the chamfer (max of u + w... the
      // chamfer is u + w = l; the nearest point minimises u + w).
      const clipped = clipQuadrant(A, B)
      if (!clipped) return
      const m = Math.min(clipped[0].u + clipped[0].w, clipped[1].u + clipped[1].w)
      cap = Math.min(cap, m - SQ2 * white)
    }
    for (const s of boxSegs) consider(s, whiteOf(metrics) + haloOf(line), false)
    for (const s of wireSegs) {
      if (s.line === c.line) {
        // Own segments other than the two legs.
        if ((s.a === prev && s.b === c.v) || (s.a === c.v && s.b === next)) continue
        consider(s, pitchOf(metrics, line, line), true)
        continue
      }
      const other = lines.get(s.line)
      if (!other) continue
      // A leg of a corner of the same kind nested inside this one is measured by its chamfer (R4), not here.
      if (nestedLeg(c, s, byLine.get(s.line) ?? [])) continue
      consider(s, pitchOf(metrics, line, other), false)
    }
    // (R6) a corner is no bigger than the arc of a right angle the line turns with: its leg is its radius.
    cap = Math.min(cap, c.rho)
    c.cap = Math.max(0, cap)
  }

  // R1 sharing of a segment between two corners of one line: half each, then the slack passes over.
  for (const own of byLine.values()) {
    for (const c of own) c.l = c.cap
    const pairs: [Corner, Corner, number][] = []
    for (let k = 0; k + 1 < own.length; k++) {
      const a = own[k]
      const b = own[k + 1]
      if (a && b && b.i === a.i + 1) pairs.push([a, b, dist(a.v, b.v)])
    }
    for (const [a, b, delta] of pairs) {
      a.l = Math.min(a.l, delta / 2)
      b.l = Math.min(b.l, delta / 2)
    }
    for (const [k, [a, b, delta]] of pairs.entries()) {
      const before = pairs[k - 1]
      const after = pairs[k + 1]
      const boundA = before ? before[2] - before[0].l : Number.POSITIVE_INFINITY
      const boundB = after ? after[2] - after[1].l : Number.POSITIVE_INFINITY
      a.l = Math.min(a.cap, boundA, delta - b.l)
      b.l = Math.min(b.cap, boundB, delta - a.l)
    }
    for (const c of own) c.l = Math.max(0, c.l)
  }

  // R4: nests (inside out, by kind) and facing pairs, until nothing moves.
  for (let round = 0; round < 8; round++) {
    let moved = false
    for (const list of kinds.values()) {
      // Most inward first: larger projection on the inward normal.
      list.sort((p, q) => inward(q) - inward(p))
      for (const [idx, outer] of list.entries()) {
        const lo = lines.get(outer.line)
        if (!lo) continue
        for (let j = 0; j < idx; j++) {
          const inner = list[j]
          if (!inner || inner.line === outer.line) continue
          const li = lines.get(inner.line)
          if (!li) continue
          const dx = (inner.v.x - outer.v.x) * outer.sx
          const dy = (inner.v.y - outer.v.y) * outer.sy
          if (dx < -EPS || dy < -EPS) continue // not inside this corner
          const bound = inner.l + dx + dy - SQ2 * pitchOf(metrics, lo, li)
          if (outer.l > bound + EPS) {
            outer.l = Math.max(0, bound)
            moved = true
          }
        }
      }
    }
    // Two chamfers of one orientation (parallel, or end to end on one 45° line) keep the pitch between them as
    // segments: the one whose shortening parts them more gives way, both when they part alike.
    for (let p = 0; p < corners.length; p++) {
      const a = corners[p]
      if (!a || a.l <= 0) continue
      for (let q = p + 1; q < corners.length; q++) {
        const b = corners[q]
        if (!b || b.l <= 0 || a.line === b.line || a.orient !== b.orient) continue
        const la = lines.get(a.line)
        const lb = lines.get(b.line)
        if (!la || !lb) continue
        const need = pitchOf(metrics, la, lb)
        const d = segGap(chamferEnds(a), chamferEnds(b))
        if (d >= need - EPS) continue
        const step = need - d
        const withA = segGap(chamferEnds({ ...a, l: Math.max(0, a.l - step) }), chamferEnds(b))
        const withB = segGap(chamferEnds(a), chamferEnds({ ...b, l: Math.max(0, b.l - step) }))
        if (Math.abs(withA - withB) < EPS) {
          a.l = Math.max(0, a.l - step / 2)
          b.l = Math.max(0, b.l - step / 2)
        } else if (withA > withB) a.l = Math.max(0, a.l - step)
        else b.l = Math.max(0, b.l - step)
        moved = true
      }
    }
    if (!moved) break
  }

  // A leg shorter than the least distance two places are told apart by is no leg.
  for (const c of corners) if (c.l < snap) c.l = 0

  // Build the polylines.
  const out = new Map<string, { points: Point[]; radii: number[] }>()
  for (const [id, pts] of skeleton) {
    const own = byLine.get(id) ?? []
    const byIndex = new Map(own.map((c) => [c.i, c]))
    const points: Point[] = []
    const rhos: number[] = []
    const add = (p: Point, rho: number) => {
      points.push(p)
      rhos.push(rho)
    }
    const first = pts[0]
    if (first) add(first, 0)
    for (let i = 1; i + 1 < pts.length; i++) {
      const v = pts[i]
      if (!v) continue
      const c = byIndex.get(i)
      if (!c || c.l <= EPS) {
        add(v, c?.rho ?? 0)
        continue
      }
      add({ x: v.x - c.din.x * c.l, y: v.y - c.din.y * c.l }, c.rho)
      add({ x: v.x + c.dout.x * c.l, y: v.y + c.dout.y * c.l }, c.rho)
    }
    const last = pts[pts.length - 1]
    if (last && pts.length > 1) add(last, 0)
    const kept = keep(points)
    const clean = kept.map((k) => points[k]).filter((p): p is Point => p !== undefined)
    out.set(id, {
      points: clean,
      radii: fitRadii(
        clean,
        kept.map((k) => rhos[k] ?? 0),
      ),
    })
  }

  return { wires: out, marks: marksOf(bands, byLine) }
}

function dedupe(pts: readonly Point[]): Point[] {
  const out: Point[] = []
  for (const p of pts) {
    const last = out[out.length - 1]
    if (last && dist(last, p) < EPS) continue
    out.push(p)
  }
  return simplify(out)
}

/** Drops vertices that lie on a straight run. */
function simplify(pts: readonly Point[]): Point[] {
  return keep(pts).flatMap((k) => {
    const p = pts[k]
    return p ? [p] : []
  })
}

/** The indexes of the vertices that are not on a straight run, nor on the one before. */
function keep(pts: readonly Point[]): number[] {
  const out: number[] = []
  for (const [i, p] of pts.entries()) {
    const prev = pts[out[out.length - 1] ?? -1]
    if (prev && dist(prev, p) < EPS) continue
    const next = pts.slice(i + 1).find((q) => dist(q, p) >= EPS)
    if (prev && next) {
      const a = unit(prev, p)
      const b = unit(p, next)
      if (Math.abs(a.x * b.y - a.y * b.x) < EPS && a.x * b.x + a.y * b.y > 0) continue
    }
    out.push(i)
  }
  return out
}

/** The radius each vertex can be rounded with: its `rhos`, less where the two straights are too short for its tangents. */
function fitRadii(pts: readonly Point[], rhos: readonly number[]): number[] {
  const radii = pts.map(() => 0)
  // Half of each straight is the most a tangent may take, so two vertices never share a point.
  for (let i = 1; i + 1 < pts.length; i++) {
    const p = pts[i - 1]
    const v = pts[i]
    const n = pts[i + 1]
    if (!p || !v || !n) continue
    const a = unit(p, v)
    const b = unit(v, n)
    const cos = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y))
    const theta = Math.acos(cos)
    if (theta < EPS) continue
    const tanHalf = Math.tan(theta / 2)
    const room = Math.min(dist(p, v) / 2, dist(v, n) / 2)
    radii[i] = Math.min(rhos[i] ?? 0, room / tanHalf)
  }
  return radii
}

function unit(a: Point, b: Point): Point {
  const d = dist(a, b)
  return d < EPS ? { x: 0, y: 0 } : { x: (b.x - a.x) / d, y: (b.y - a.y) / d }
}

function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

type L = { u: number; w: number }

/** Where an axis-parallel segment crosses one of the two legs, as its distance from the vertex; else undefined. */
function crossLeg(A: L, B: L, lenIn: number, lenOut: number): number | undefined {
  let best: number | undefined
  // Crossing the incoming leg (w = 0, 0 < u ≤ lenIn): the segment spans w = 0 with u in range.
  if ((A.w < -EPS && B.w > EPS) || (A.w > EPS && B.w < -EPS)) {
    const u = A.u + ((B.u - A.u) * (0 - A.w)) / (B.w - A.w)
    if (u > EPS && u <= lenIn + EPS) best = Math.min(best ?? u, u)
  }
  if ((A.u < -EPS && B.u > EPS) || (A.u > EPS && B.u < -EPS)) {
    const w = A.w + ((B.w - A.w) * (0 - A.u)) / (B.u - A.u)
    if (w > EPS && w <= lenOut + EPS) best = Math.min(best ?? w, w)
  }
  return best
}

/** The part of a segment inside the closed quadrant u ≥ 0, w ≥ 0, or undefined. */
function clipQuadrant(A: L, B: L): [L, L] | undefined {
  let t0 = 0
  let t1 = 1
  const du = B.u - A.u
  const dw = B.w - A.w
  for (const [p, d] of [
    [A.u, du],
    [A.w, dw],
  ] as const) {
    if (Math.abs(d) < EPS) {
      if (p < -EPS) return undefined
      continue
    }
    const t = -p / d
    if (d > 0) t0 = Math.max(t0, t)
    else t1 = Math.min(t1, t)
  }
  if (t0 > t1 + EPS) return undefined
  const at = (t: number): L => ({ u: A.u + du * t, w: A.w + dw * t })
  const P = at(t0)
  const Q = at(t1)
  if (P.u < -EPS || P.w < -EPS || Q.u < -EPS || Q.w < -EPS) return undefined
  return [P, Q]
}

/** Whether `s` is a leg of a corner of `c`'s kind that lies inside `c` (measured by its chamfer instead, R4). */
function nestedLeg(c: Corner, s: Seg, theirs: readonly Corner[]): boolean {
  return theirs.some(
    (o) =>
      o.sx === c.sx &&
      o.sy === c.sy &&
      (o.v.x - c.v.x) * c.sx >= -EPS &&
      (o.v.y - c.v.y) * c.sy >= -EPS &&
      (s.a === o.v || s.b === o.v),
  )
}

function inward(c: Corner): number {
  return c.v.x * c.sx + c.v.y * c.sy
}

/** The least distance between two segments. */
function segGap(s: [Point, Point], t: [Point, Point]): number {
  const ptSeg = (p: Point, a: Point, b: Point): number => {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy
    const k = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0
    return Math.hypot(p.x - a.x - k * dx, p.y - a.y - k * dy)
  }
  return Math.min(
    ptSeg(s[0], t[0], t[1]),
    ptSeg(s[1], t[0], t[1]),
    ptSeg(t[0], s[0], s[1]),
    ptSeg(t[1], s[0], s[1]),
  )
}

function chamferEnds(c: Corner): [Point, Point] {
  return [
    { x: c.v.x - c.din.x * c.l, y: c.v.y - c.din.y * c.l },
    { x: c.v.x + c.dout.x * c.l, y: c.v.y + c.dout.y * c.l },
  ]
}

/**
 * The mouths of the bands. Where a run of a band starts or ends at a corner that was cut, the
 * chamfer meets the straight run there: a join at the start, a leave at the end. The band is the
 * order's (`Band`: the lines next to the run at the doors it goes through); only the stretch of
 * each run that is left straight once the corners are cut is read from the shaped corners.
 */
function marksOf(
  bands: readonly Band[],
  corners: ReadonlyMap<string, readonly Corner[]>,
): Omit<Mark, 'link' | 'stroke'>[] {
  const leg = (line: string, p: Point): number =>
    corners.get(line)?.find((c) => dist(c.v, p) < EPS)?.l ?? 0
  const marks: Omit<Mark, 'link' | 'stroke'>[] = []
  for (const band of bands) {
    const flat = Math.abs(band.a.y - band.b.y) < EPS
    if (!flat && Math.abs(band.a.x - band.b.x) >= EPS) continue
    const sign = Math.sign(flat ? band.b.x - band.a.x : band.b.y - band.a.y)
    const along: Point = flat ? { x: sign, y: 0 } : { x: 0, y: sign }
    const across: Point = flat ? { x: 0, y: 1 } : { x: 1, y: 0 }
    const pos = (p: Point) => (flat ? p.x : p.y)
    const level = (p: Point) => (flat ? p.y : p.x)
    const at = (p: Point, t: number): Point => ({ x: p.x + along.x * t, y: p.y + along.y * t })
    /** The stretch of a run that stays straight, as positions along it, lowest first. */
    const straight = (line: string, a: Point, b: Point): [number, number] => {
      const s = sign === 0 ? 1 : sign
      const [first, last] = [pos(a) + s * leg(line, a), pos(b) - s * leg(line, b)]
      return [Math.min(first, last), Math.max(first, last)]
    }
    const [lo, hi] = straight(band.line, band.a, band.b)
    let near = 0
    let far = 0
    let from = hi
    let to = lo
    const members = [band.line]
    for (const other of band.beside) {
      const [olo, ohi] = straight(other.line, other.a, other.b)
      if (ohi < lo + EPS || olo > hi - EPS) continue
      const d = level(other.a) - level(band.a)
      near = Math.min(near, d)
      far = Math.max(far, d)
      from = Math.min(from, Math.max(lo, olo))
      to = Math.max(to, Math.min(hi, ohi))
      members.push(other.line)
    }
    if (members.length < 2) continue
    const run = {
      from: flat ? { x: from, y: level(band.a) } : { x: level(band.a), y: from },
      to: flat ? { x: to, y: level(band.a) } : { x: level(band.a), y: to },
    }
    const mark = (kind: 'join' | 'leave', point: Point) => ({
      line: band.line,
      kind,
      at: point,
      along,
      across,
      band: { near, far },
      run,
      members,
    })
    const first = leg(band.line, band.a)
    const last = leg(band.line, band.b)
    if (first > EPS) marks.push(mark('join', at(band.a, first)))
    if (last > EPS) marks.push(mark('leave', at(band.b, -last)))
  }
  return marks
}
