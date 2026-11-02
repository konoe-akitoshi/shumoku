// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { haloOf, pitchOf, whiteOf } from './kin.js'
import type { Point } from './metrics.js'
import { shapeWires } from './shape.js'
import { problemOf, testMetrics } from './testing.js'

const EPS = 1e-6

const yaml = `
nodes:
  - { id: a }
  - { id: b }
  - { id: c }
  - { id: d }
links:
  - { endpoints: [{ node: a }, { node: b }] }
  - { endpoints: [{ node: c }, { node: d }] }
`

describe('shape', () => {
  const base = problemOf(yaml, [])
  // room enough on the straights beside the ports for the arcs of the largest radius
  const problem = { ...base, metrics: { ...base.metrics, leadOut: 100 } }
  const [one, two] = problem.lines
  const geometry = { boxes: new Map() }
  const inner = one?.id ?? ''
  const outer = two?.id ?? ''

  // Two lines going down and then left round one corner, `d` apart, the second outside the first.
  const nested = (d: number) =>
    new Map<string, Point[]>([
      [
        inner,
        [
          { x: 400 - d, y: 0 },
          { x: 400 - d, y: 400 - d },
          { x: 0, y: 400 - d },
        ],
      ],
      [
        outer,
        [
          { x: 400, y: 0 },
          { x: 400, y: 400 },
          { x: 0, y: 400 },
        ],
      ],
    ])

  it('cuts a right angle into a 45° chamfer and rounds its two vertices', () => {
    const shaped = shapeWires(problem, geometry, new Map([[inner, nested(20).get(inner) ?? []]]))
    const wire = shaped.wires.get(inner)
    expect(wire?.points).toHaveLength(4)
    const [p, q] = [wire?.points[1], wire?.points[2]]
    expect(Math.abs((q?.x ?? 0) - (p?.x ?? 0))).toBeCloseTo(Math.abs((q?.y ?? 0) - (p?.y ?? 0)))
    expect(wire?.radii[0]).toBe(0)
    expect(wire?.radii[3]).toBe(0)
    const rho = whiteOf(testMetrics) + haloOf(problem.lines[0] ?? ({} as never))
    expect(wire?.radii[1]).toBeGreaterThan(0)
    expect(wire?.radii[1]).toBeLessThanOrEqual(rho + EPS)
  })

  it('cuts a corner no bigger than the arc of a right angle the line turns with: the leg is its radius', () => {
    const rho = whiteOf(testMetrics) + haloOf(problem.lines[0] ?? ({} as never))
    const shaped = shapeWires(problem, geometry, new Map([[inner, nested(20).get(inner) ?? []]]))
    const wire = shaped.wires.get(inner)
    const [p, q] = [wire?.points[1], wire?.points[2]]
    // the vertex of the right angle is (380, 380); the chamfer starts a leg up the first line
    expect(380 - (p?.y ?? 0)).toBeCloseTo(rho)
    expect(380 - (q?.x ?? 0)).toBeCloseTo(rho)
    // and both its vertices are rounded with that one radius
    expect(wire?.radii[1]).toBeCloseTo(rho)
    expect(wire?.radii[2]).toBeCloseTo(rho)
  })

  it('keeps one radius for all of a line, but for the concentric ones of a bundle', () => {
    const d = 20
    const shaped = shapeWires(problem, geometry, nested(d))
    const rho = whiteOf(testMetrics) + haloOf(problem.lines[0] ?? ({} as never))
    const inRadii = shaped.wires.get(inner)?.radii ?? []
    for (const r of inRadii.slice(1, -1)) expect(r).toBeCloseTo(rho)
    const outPts = shaped.wires.get(outer)?.points ?? []
    // the outer leg is no more than its radius, rho + d
    expect(400 - (outPts[1]?.y ?? 0)).toBeLessThanOrEqual(rho + d + EPS)
  })

  it('rounds a line round the corner of another concentrically: the radius grows by their distance', () => {
    const d = 20
    const shaped = shapeWires(problem, geometry, nested(d))
    const rin = shaped.wires.get(inner)?.radii[1] ?? 0
    const rout = shaped.wires.get(outer)?.radii[1] ?? 0
    expect(rin).toBeGreaterThan(0)
    expect(rout).toBeCloseTo(rin + d)
    // and the chamfers stay a pitch apart across the line
    const a = shaped.wires.get(inner)?.points ?? []
    const b = shaped.wires.get(outer)?.points ?? []
    const across = (b[1] ? b[1].x + b[1].y : 0) - (a[1] ? a[1].x + a[1].y : 0)
    const l1 = problem.lines[0]
    const l2 = problem.lines[1]
    const pitch = l1 && l2 ? pitchOf(problem.metrics, l1, l2) : 0
    expect(Math.abs(across) / Math.SQRT2).toBeGreaterThanOrEqual(pitch - EPS)
  })

  describe('a bundle turns as one nest', () => {
    const three = problemOf(
      `
nodes:
  - { id: a }
  - { id: b }
  - { id: c }
  - { id: d }
  - { id: e }
  - { id: f }
  - { id: g }
  - { id: h }
links:
  - { endpoints: [{ node: a }, { node: b }] }
  - { endpoints: [{ node: c }, { node: d }] }
  - { endpoints: [{ node: e }, { node: f }] }
  - { endpoints: [{ node: g }, { node: h }] }
`,
      [],
    )
    const room = { ...three, metrics: { ...three.metrics, leadOut: 100 } }
    const [la, lb, lc, lx] = room.lines.map((l) => l.id)
    const rho = whiteOf(testMetrics) + haloOf(room.lines[0] ?? ({} as never))
    const p =
      room.lines[0] && room.lines[1] ? pitchOf(room.metrics, room.lines[0], room.lines[1]) : 0
    const k = 2 - Math.SQRT2

    // Three lines down and then left, `p` apart on both axes, from the inside (a) out (c); `top` is where c starts.
    const bundle = (top = 0, shift = 0) =>
      new Map<string, Point[]>(
        [la, lb, lc].map((id, n) => {
          const o = (n - 2) * p
          const x = 400 + o
          return [
            id ?? '',
            [
              { x: x + (id === lc ? shift : 0), y: id === lc ? top : 0 },
              { x, y: 400 + o },
              { x: 0, y: 400 + o },
            ],
          ]
        }),
      )
    const leg = (pts: Point[] | undefined, o: number) => 400 + o - (pts?.[1]?.y ?? 0)
    const radii = (id: string | undefined, shaped: ReturnType<typeof shapeWires>) =>
      shaped.wires.get(id ?? '')?.radii ?? []

    it('shapes three lines side by side as one corner: legs and radii grow by the offset, the chamfers keep the pitch', () => {
      const shaped = shapeWires(room, geometry, bundle())
      const [a, b, c] = [la, lb, lc].map((id) => shaped.wires.get(id ?? '')?.points)
      const [ia, ib, ic] = [leg(a, -2 * p), leg(b, -p), leg(c, 0)]
      expect(ib - ia).toBeCloseTo(k * p)
      expect(ic - ib).toBeCloseTo(k * p)
      const [ra, rb, rc] = [la, lb, lc].map((id) => radii(id, shaped)[1] ?? 0)
      expect(rb - ra).toBeCloseTo(p)
      expect(rc - rb).toBeCloseTo(p)
      expect(ra).toBeGreaterThan(0)
      const sum = (q: Point[] | undefined) => (q?.[1] ? q[1].x + q[1].y : 0)
      expect((sum(a) - sum(b)) / Math.SQRT2).toBeCloseTo(-p)
      expect((sum(b) - sum(c)) / Math.SQRT2).toBeCloseTo(-p)
    })

    it('turns the whole nest as concentric quarter circles when one line has no room for a chamfer', () => {
      // a line across the outer one's leg, close to the corner: it can only turn square, and so does the nest
      const crossed = new Map(bundle())
      crossed.set(lx ?? '', [
        { x: 400 - p / 2, y: 400 - rho },
        { x: 500, y: 400 - rho },
      ])
      const shaped = shapeWires(room, geometry, crossed)
      const r = [la, lb, lc].map((id) => radii(id, shaped)[1] ?? 0)
      for (const id of [la, lb, lc]) {
        const pts = shaped.wires.get(id ?? '')?.points ?? []
        expect(pts).toHaveLength(3)
      }
      expect((r[1] ?? 0) - (r[0] ?? 0)).toBeCloseTo(p)
      expect((r[2] ?? 0) - (r[1] ?? 0)).toBeCloseTo(p)
    })

    it('rounds only what fits when the outer straight is too short to share the centre', () => {
      const shaped = shapeWires(room, geometry, bundle(400 - p / 2))
      for (const id of [la, lb, lc]) {
        for (const r of radii(id, shaped).slice(1, -1)) expect(r).toBeGreaterThan(0)
      }
    })

    it('leaves lines whose corners are not on one diagonal as they were (a fan)', () => {
      const fan = new Map<string, Point[]>([
        [
          la ?? '',
          [
            { x: 150, y: 0 },
            { x: 150, y: 380 },
            { x: 0, y: 380 },
          ],
        ],
        [
          lb ?? '',
          [
            { x: 400, y: 0 },
            { x: 400, y: 400 },
            { x: 0, y: 400 },
          ],
        ],
      ])
      const together = shapeWires(room, geometry, fan)
      for (const [id, pts] of fan) {
        const alone = shapeWires(room, geometry, new Map([[id, pts]]))
        expect(together.wires.get(id)).toEqual(alone.wires.get(id))
      }
    })
  })
})
