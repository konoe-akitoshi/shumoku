// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { cornerOf, jogLeastOf, jogsOf, labelBandOf, pitchOf, turnOf } from './kin.js'
import type { Bound, Leg, Piece, Reading } from './lanes.js'
import { layoutDrawing, layoutParts } from './layout.js'
import type { Point } from './metrics.js'
import { type Lanes, separate } from './realize-constraints.js'
import { networkOf, testMetrics, wiringOf } from './testing.js'
import { Unknowns } from './unknowns.js'

const EPS = 1e-6

const nodes = `
nodes:
  - { id: top }
  - { id: l, group: g }
  - { id: r, group: g }
  - { id: low }
`
const links = `groups: [{ id: g }]
links:
  - { endpoints: [{ node: top }, { node: l }] }
  - { endpoints: [{ node: top }, { node: r }] }
  - { endpoints: [{ node: l }, { node: low }] }
  - { endpoints: [{ node: r }, { node: low }] }
  - { endpoints: [{ node: top }, { node: low }] }
`
const yaml = `${nodes}${links}`
const related = `${yaml}  - { endpoints: [{ node: top }, { node: low }], virtual: true }
`
// p and q are cabled to nothing else and related to nothing, so a virtual line between them is its own
const over = `${nodes}  - { id: p }
  - { id: q }
${links}  - { endpoints: [{ node: top }, { node: low }], virtual: true }
  - { endpoints: [{ node: p }, { node: q }], virtual: true }
`
/** Where the segment `a b` crosses the leg from the corner `v` to `end` (both axis-parallel), as its distance from `v`. */
const legCrossing = (v: Point, end: Point, a: Point, b: Point): number | undefined => {
  const vertical = Math.abs(v.x - end.x) < EPS
  if (vertical === Math.abs(a.x - b.x) < EPS) return undefined
  const [along, across] = vertical ? (['y', 'x'] as const) : (['x', 'y'] as const)
  const at = a[along]
  const [lo, hi] = [Math.min(v[along], end[along]), Math.max(v[along], end[along])]
  const [s0, s1] = [Math.min(a[across], b[across]), Math.max(a[across], b[across])]
  if (at <= lo + EPS || at >= hi - EPS || v[across] <= s0 + EPS || v[across] >= s1 - EPS)
    return undefined
  return Math.abs(at - v[along])
}

/** A polyline without repeated points and without vertices on a straight run. */
const straightsOf = (pts: readonly Point[]): Point[] => {
  const out: Point[] = []
  for (const p of pts) {
    const last = out[out.length - 1]
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < EPS) continue
    const prev = out[out.length - 2]
    if (prev && last) {
      const c = (last.x - prev.x) * (p.y - last.y) - (last.y - prev.y) * (p.x - last.x)
      if (Math.abs(c) < EPS) out.pop()
    }
    out.push(p)
  }
  return out
}

const sceneOf = (text: string) => {
  const { network, structure } = networkOf(text, ['top'])
  return layoutDrawing(network, structure, testMetrics)
}

describe('realize', () => {
  const scene = sceneOf(over)
  const box = (id: string) => scene.nodes.find((n) => n.node.id === id)?.box

  it('draws every line on horizontal, vertical and 45° stretches only, a radius for every vertex', () => {
    expect(scene.wires).toHaveLength(7)
    for (const w of scene.wires) {
      expect(w.radii).toHaveLength(w.points.length)
      for (const [i, p] of w.points.entries()) {
        const q = w.points[i + 1]
        if (!q) continue
        const dx = Math.abs(p.x - q.x)
        const dy = Math.abs(p.y - q.y)
        expect(dx < EPS || dy < EPS || Math.abs(dx - dy) < EPS).toBe(true)
      }
    }
  })

  it('leaves a port straight out of the edge it stands on, its label band before the first turn', () => {
    const ports = scene.ports ?? []
    for (const w of scene.wires) {
      const ends: [Point, Point | undefined][] = [
        [w.points[0] as Point, w.points[1]],
        [w.points.at(-1) as Point, w.points.at(-2)],
      ]
      for (const [k, [at, next]] of ends.entries()) {
        const port = ports.find(
          (p) => Math.abs(p.at.x - at.x) < EPS && Math.abs(p.at.y - at.y) < EPS,
        )
        expect(port).toBeDefined()
        if (!port || !next) continue
        const b = box(port.nodeId)
        expect(b).toBeDefined()
        if (!b) continue
        const onEdge =
          port.side === 'top'
            ? Math.abs(port.at.y - b.y) < EPS
            : port.side === 'bottom'
              ? Math.abs(port.at.y - (b.y + b.height)) < EPS
              : port.side === 'left'
                ? Math.abs(port.at.x - b.x) < EPS
                : Math.abs(port.at.x - (b.x + b.width)) < EPS
        expect(onEdge).toBe(true)
        const across = port.side === 'top' || port.side === 'bottom'
        expect(across ? Math.abs(next.x - at.x) < EPS : Math.abs(next.y - at.y) < EPS).toBe(true)
        // the corner's arc begins its tangent before the vertex, and not inside the label's band
        const i = k === 0 ? 1 : w.points.length - 2
        const after = w.points[k === 0 ? 2 : w.points.length - 3]
        const turn = after
          ? Math.abs(
              Math.atan2(after.y - next.y, after.x - next.x) -
                Math.atan2(next.y - at.y, next.x - at.x),
            )
          : 0
        const half = Math.min(turn, 2 * Math.PI - turn) / 2
        const tangent = (w.radii[i] ?? 0) * Math.tan(half)
        expect(Math.hypot(next.x - at.x, next.y - at.y) - tangent).toBeGreaterThanOrEqual(
          labelBandOf(testMetrics) - EPS,
        )
      }
    }
  })

  it('keeps lines that run side by side a pitch apart', () => {
    const report = wiringOf(scene, testMetrics)
    expect(report.parallel.near).toBe(0)
    expect(report.parallel.overlapping).toBe(0)
    expect(report.gap.horizontalRuns.below).toBe(0)
    expect(report.gap.verticalRuns.below).toBe(0)
  })

  it('leaves a line whose ends the structure does not relate by the top, and gives its ends no place', () => {
    const plain = sceneOf(related)
    const kept = (s: typeof scene) =>
      s.nodes.filter((n) => plain.nodes.some((m) => m.node.id === n.node.id))
    const at = (s: typeof scene) =>
      kept(s)
        .map((n) => `${n.node.id} ${n.box.width} ${n.box.height}`)
        .sort((p, q) => p.localeCompare(q))
    expect(at(scene)).toEqual(at(plain))
    // the order of the boxes down the drawing and across it is the same, whatever lies beside it
    const order = (s: typeof scene, axis: 'x' | 'y') =>
      kept(s)
        .map((n) => [n.node.id, n.box[axis]] as const)
        .sort((p, q) => p[1] - q[1] || p[0].localeCompare(q[0]))
        .map(([id]) => id)
    expect(order(scene, 'y')).toEqual(order(plain, 'y'))
    expect(order(scene, 'x')).toEqual(order(plain, 'x'))
    // the virtual line between p and q leaves both by their tops
    const unrelated = scene.wires[6]
    expect(unrelated).toBeDefined()
    const ends = [unrelated?.points[0], unrelated?.points.at(-1)]
    const sides = (scene.ports ?? [])
      .filter((p) =>
        ends.some((e) => e && Math.abs(p.at.x - e.x) < EPS && Math.abs(p.at.y - e.y) < EPS),
      )
      .map((p) => p.side)
    expect(sides).toEqual(['top', 'top'])
    expect(scene.bounds.y).toBeLessThanOrEqual(
      Math.min(...scene.wires.flatMap((w) => w.points.map((p) => p.y))),
    )
  })

  it('gives every turn its room: crossings a pitch past it, straights holding the turns at both ends, a short step a jog', () => {
    // a denser net, so that lines cross the legs of others near their corners
    const dense = `${nodes}  - { id: m, group: g }
${links}  - { endpoints: [{ node: top }, { node: m }] }
  - { endpoints: [{ node: m }, { node: low }] }
  - { endpoints: [{ node: l }, { node: r }] }
  - { endpoints: [{ node: top }, { node: low }] }
`
    const { network, structure } = networkOf(dense, ['top'])
    const parts = layoutParts(network, structure, testMetrics)
    const lines = new Map(parts.problem.lines.map((l) => [l.id, l]))
    const wires = [...parts.wiring.wires].map(([id, pts]) => [id, straightsOf(pts)] as const)
    const tol = 0.5
    let jogged = 0
    for (const [id, pts] of wires) {
      const line = lines.get(id)
      if (!line) continue
      const R = cornerOf(testMetrics, line)
      const turn = (i: number) => {
        const [p, v, n] = [pts[i - 1], pts[i], pts[i + 1]]
        return p && v && n ? Math.sign((v.x - p.x) * (n.y - v.y) - (v.y - p.y) * (n.x - v.x)) : 0
      }
      const segs = pts.slice(1).map((b, k) => ({
        length: Math.hypot(b.x - (pts[k] as Point).x, b.y - (pts[k] as Point).y),
        step: turn(k) * turn(k + 1) < 0,
      }))
      const jogs = jogsOf(segs, R)
      jogged += jogs.filter(Boolean).length
      const turnAt = (k: number) => turnOf(R, jogs[k] ? segs[k]?.length : undefined)
      for (const [k, seg] of segs.entries()) {
        // a straight between two turns holds both, each tangent within its half; a jog its rounded ends
        if (k > 0 && k + 1 < segs.length) {
          const [a, b] = [turnAt(k - 1), turnAt(k + 1)]
          const need = jogs[k] ? jogLeastOf(R) : a.cut + b.cut + 2 * Math.max(a.tangent, b.tangent)
          expect(seg.length).toBeGreaterThanOrEqual(need - tol)
        }
        // a straight to a port holds the turn past the label's band
        if ((k === 0 || k + 1 === segs.length) && segs.length > 1) {
          const t = turnAt(k === 0 ? 1 : k - 1)
          expect(seg.length).toBeGreaterThanOrEqual(
            labelBandOf(testMetrics) + t.cut + t.tangent - tol,
          )
        }
        // a line crossing the straight crosses it a pitch past where the turn at that end begins
        for (const nb of [k - 1, k + 1]) {
          if (nb < 0 || nb >= segs.length) continue
          const [v, end] = nb < k ? [pts[k], pts[k + 1]] : [pts[k + 1], pts[k]]
          const t = turnAt(nb)
          const begins = jogs[k] ? R : t.cut + t.tangent
          for (const [other, ops] of wires) {
            if (other === id) continue
            const o = lines.get(other)
            if (!o || !v || !end) continue
            for (const [j, a] of ops.entries()) {
              const b = ops[j + 1]
              if (!b) continue
              const q = legCrossing(v, end, a, b)
              if (q !== undefined)
                expect(q).toBeGreaterThanOrEqual(begins + pitchOf(testMetrics, line, o) - tol)
            }
          }
        }
      }
    }
    // the net has a step shorter than two radii, and it is left a jog rather than pushed apart
    expect(jogged).toBeGreaterThan(0)
  })

  it('gives the same lines for the same input', () => {
    expect(sceneOf(over).wires.map((w) => w.points)).toEqual(scene.wires.map((w) => w.points))
  })
})

describe('separate', () => {
  // Two vertical pieces, p (line A, with a horizontal leg either side of it) and q (line B, a
  // piece of its own), both free to lie anywhere in 0..200 and within a pitch of each other.
  const piece = (line: string, k: number, axis: 'x' | 'y'): Piece => ({
    line,
    k,
    axis,
    kind: 'run',
    i: k,
  })
  const [legIn, p, legOut] = [piece('A', 0, 'y'), piece('A', 1, 'x'), piece('A', 2, 'y')]
  const q = piece('B', 0, 'x')
  const index = new Map<Piece, number>([
    [legIn, 0],
    [p, 0],
    [legOut, 1],
    [q, 1],
  ])
  const pitch = 10
  const tolerance = 1

  /** The unknowns: p and q along x with the targets given, and the two legs of A along y, read with the ends and legs given. */
  const setup = (
    target: { p: number; q: number },
    ends: Record<string, [Bound, Bound]>,
    legs: Record<string, Leg[]> = {},
  ) => {
    const U = { x: new Unknowns(), y: new Unknowns() }
    U.x.add('p', { lo: 0, hi: 200 }, target.p)
    U.x.add('q', { lo: 0, hi: 200 }, target.q)
    U.y.add('leg in', { lo: 50, hi: 50 }, 50)
    U.y.add('leg out', { lo: 200, hi: 200 }, 200)
    const reading: Reading = {
      unknownOf: (x) => index.get(x),
      ends: (x) => ends[x.line] ?? [{ at: 0 }, { at: 0 }],
      legs: (x) => legs[x.line] ?? [],
      compare: (axis, a, b) => {
        // as the wiring reads it: fixed against fixed, else by the rooms
        const roomOf = (e: Bound): [number, number] =>
          'at' in e ? [e.at, e.at] : U[axis].room(e.v)
        const [lo, hi] = roomOf(a)
        const [lo2, hi2] = roomOf(b)
        return hi <= lo2 ? (lo >= hi2 ? 0 : -1) : hi2 <= lo ? 1 : undefined
      },
      room: (x) => U[x.axis].room(index.get(x) ?? 0),
      same: () => false,
      pitch: () => pitch,
    }
    const lanes: Lanes = { pieces: [legIn, p, legOut, q], reading }
    return { U, lanes }
  }
  // A leaves its box at x 10 and ends at 190, so its leg in at y 50 goes toward lower x; B runs
  // the length of the cell, so that leg runs into its extent
  const legged = {
    ends: { A: [{ v: 0 }, { v: 1 }], B: [{ at: 0 }, { at: 120 }] } as Record<
      string,
      [Bound, Bound]
    >,
    legs: { A: [{ at: { v: 0 }, dir: -1, to: { at: 10 } }] } as Record<string, Leg[]>,
  }
  // the same two pieces with no legs, so that nothing is forced
  const bare = { A: [{ at: 0 }, { at: 120 }], B: [{ at: 0 }, { at: 120 }] } as Record<
    string,
    [Bound, Bound]
  >

  it('takes the order the ends of the pieces force, whatever is pulled where', () => {
    // p is pulled after q, but p's leg in goes toward lower x into the extent of q, which must be
    // passed on the side the leg leaves from: p lies before q
    const { U, lanes } = setup({ p: 105, q: 100 }, legged.ends, legged.legs)
    const r = separate(U.x, 'x', lanes, tolerance)
    expect(U.x.sep).toEqual([{ i: 0, j: 1, d: pitch }])
    expect(r).toEqual({ added: 1, undecided: [] })
    expect(U.x.laneLost).toBe(0)
  })

  it('puts pieces nothing forces in the order the solve of what else is asked puts them in', () => {
    // with nothing else asked, the pulls are the order: q (100) before p (105)
    const plain = setup({ p: 105, q: 100 }, bare)
    separate(plain.U.x, 'x', plain.lanes, tolerance)
    expect(plain.U.x.sep).toEqual([{ i: 1, j: 0, d: pitch }])

    // asked elsewhere to keep p a pitch before q, the solve puts p first, against the pulls
    const asked = setup({ p: 105, q: 100 }, bare)
    asked.U.x.before(0, 1, pitch)
    separate(asked.U.x, 'x', asked.lanes, tolerance)
    const solved = asked.U.x.solve(tolerance)
    expect(solved.value(1) - solved.value(0)).toBeGreaterThanOrEqual(pitch - 1e-6)
    expect(asked.U.x.laneLost).toBe(0)
  })

  it('asks a pair once: a pair ordered before is not ordered again', () => {
    const { U, lanes } = setup({ p: 105, q: 100 }, bare)
    const done = new Set<string>()
    separate(U.x, 'x', lanes, tolerance, done)
    expect(separate(U.x, 'x', lanes, tolerance, done).added).toBe(0)
    expect(U.x.sep).toHaveLength(1)
  })
})

describe('what the wiring could not meet', () => {
  it('is nothing, for the orders the order layer gave and the rooms they were given', () => {
    for (const text of [yaml, over]) {
      const { network, structure } = networkOf(text, ['top'])
      const { unmet, refused } = layoutParts(network, structure, testMetrics)
      // and no room asked between box edges that the layout had to give up, but the one the group
      // and the card it holds each ask of the other (a ring of reaches, which is given up by design)
      expect(refused).toBeLessThanOrEqual(1)
      expect(unmet.squeezed).toBeLessThanOrEqual(refused)
      // a ring of orders, orders that the rooms cannot keep, rooms too small to hold their runs,
      // separations and rooms not kept by the solution, and corridors narrower than their lines need
      // (the ring that is given up leaves the one chain it was asked for short)
      expect(unmet).toEqual({
        squeezed: expect.any(Number),
        corridors: 0,
        cycles: 0,
        lanes: expect.any(Number),
        crossedLegs: expect.any(Number),
        apart: 0,
        separations: 0,
        bounds: 0,
      })
    }
  })
})
