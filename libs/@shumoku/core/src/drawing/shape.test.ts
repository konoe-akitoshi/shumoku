// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { haloOf } from './ground.js'
import { pitchOf, whiteOf } from './kin.js'
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

  it('draws a right angle as one vertex rounded with the radius of its quarter circle', () => {
    const shaped = shapeWires(problem, geometry, new Map([[inner, nested(20).get(inner) ?? []]]))
    const wire = shaped.wires.get(inner)
    expect(wire?.points).toHaveLength(3)
    expect(wire?.radii[0]).toBe(0)
    expect(wire?.radii[2]).toBe(0)
    const rho = whiteOf(testMetrics) + haloOf(problem.lines[0] ?? ({} as never))
    expect(wire?.radii[1]).toBeCloseTo(rho)
  })

  it('turns every corner as a quarter circle of the line radius, and cuts none: realize gives the room', () => {
    const rho = whiteOf(testMetrics) + haloOf(problem.lines[0] ?? ({} as never))
    const step = (dx: number, extra: [string, Point[]][] = []) =>
      shapeWires(
        problem,
        geometry,
        new Map([
          [
            inner,
            [
              { x: 100, y: 0 },
              { x: 100, y: 200 },
              { x: 100 + dx, y: 200 },
              { x: 100 + dx, y: 400 },
            ],
          ],
          ...extra,
        ]),
      ).wires.get(inner)
    const wide = step(100)
    expect(wide?.points).toHaveLength(4)
    for (const i of [1, 2]) expect(wide?.radii[i]).toBeCloseTo(rho)
    // a line crossing the leg near the corner does not cut it: shape draws what it is given
    const crossed = step(100, [
      [
        outer,
        [
          { x: 150, y: 150 },
          { x: 150, y: 250 },
        ],
      ],
    ])
    for (const i of [1, 2]) expect(crossed?.radii[i]).toBeCloseTo(rho)
  })

  it('draws a step shorter than two radii as one 45° straight, both ends rounded with the line radius', () => {
    const rho = whiteOf(testMetrics) + haloOf(problem.lines[0] ?? ({} as never))
    const zig = (dx: number): Point[] => [
      { x: 100, y: 0 },
      { x: 100, y: 200 },
      { x: 100 + dx, y: 200 },
      { x: 100 + dx, y: 400 },
    ]
    for (const dx of [rho * 0.6, rho, 2 * rho - 0.5]) {
      const wire = shapeWires(problem, geometry, new Map([[inner, zig(dx)]])).wires.get(inner)
      const [, a, b] = wire?.points ?? []
      expect(wire?.points).toHaveLength(4)
      // half the step before the first vertex, half after the second: one 45° straight
      expect(a).toEqual({ x: 100, y: 200 - dx / 2 })
      expect(b).toEqual({ x: 100 + dx, y: 200 + dx / 2 })
      for (const i of [1, 2]) expect(wire?.radii[i]).toBeCloseTo(rho)
    }
    // two radii and more: two quarter circles
    const wide = shapeWires(problem, geometry, new Map([[inner, zig(2 * rho)]])).wires.get(inner)
    expect(wide?.points).toEqual(zig(2 * rho))
    // a U-turn is two corners, however short
    const u = shapeWires(
      problem,
      geometry,
      new Map([
        [
          inner,
          [
            { x: 100, y: 0 },
            { x: 100, y: 200 },
            { x: 110, y: 200 },
            { x: 110, y: 0 },
          ],
        ],
      ]),
    ).wires.get(inner)
    expect(u?.points[1]).toEqual({ x: 100, y: 200 })
  })

  it('jogs a bundle together: the 45° straights a pitch and more apart, all of one radius', () => {
    const rho = whiteOf(testMetrics) + haloOf(problem.lines[0] ?? ({} as never))
    const l1 = problem.lines[0]
    const l2 = problem.lines[1]
    const p = l1 && l2 ? pitchOf(problem.metrics, l1, l2) : 0
    const dx = rho
    // two lines down, a step right, and down again; the outer one `p` out on the nest's diagonal
    const zig = (o: number): Point[] => [
      { x: 100 + o, y: 0 },
      { x: 100 + o, y: 200 - o },
      { x: 100 + o + dx, y: 200 - o },
      { x: 100 + o + dx, y: 400 },
    ]
    const shaped = shapeWires(
      problem,
      geometry,
      new Map([
        [inner, zig(0)],
        [outer, zig(p)],
      ]),
    )
    const [, a0, b0] = shaped.wires.get(inner)?.points ?? []
    const [, a1] = shaped.wires.get(outer)?.points ?? []
    if (!a0 || !b0 || !a1) throw new Error('no jog')
    // distance of the outer jog's start from the inner jog's 45° line
    const nx = b0.y - a0.y
    const ny = -(b0.x - a0.x)
    const off = Math.abs((a1.x - a0.x) * nx + (a1.y - a0.y) * ny) / Math.hypot(nx, ny)
    expect(off).toBeGreaterThanOrEqual(p - EPS)
    for (const id of [inner, outer])
      for (const r of shaped.wires.get(id)?.radii.slice(1, -1) ?? []) expect(r).toBeCloseTo(rho)
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
    const [la, lb, lc] = room.lines.map((l) => l.id)
    const rho = whiteOf(testMetrics) + haloOf(room.lines[0] ?? ({} as never))
    const p =
      room.lines[0] && room.lines[1] ? pitchOf(room.metrics, room.lines[0], room.lines[1]) : 0

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
    const radii = (id: string | undefined, shaped: ReturnType<typeof shapeWires>) =>
      shaped.wires.get(id ?? '')?.radii ?? []

    it('shapes three lines side by side as one corner: every corner a quarter circle, radii growing by the offset', () => {
      const shaped = shapeWires(room, geometry, bundle())
      const [a, b, c] = [la, lb, lc].map((id) => shaped.wires.get(id ?? '')?.points)
      // a corner with room for its whole quarter circle is a right angle rounded with its radius: no 45 degree
      // straight between two arcs
      for (const pts of [a, b, c]) expect(pts).toHaveLength(3)
      const [ra, rb, rc] = [la, lb, lc].map((id) => radii(id, shaped)[1] ?? 0)
      expect(rb - ra).toBeCloseTo(p)
      expect(rc - rb).toBeCloseTo(p)
      expect(ra).toBeGreaterThan(0)
    })

    it('lets a member go where its straight does not hold the concentric radius: it keeps its own', () => {
      // the outer line starts on its own corner's leg, too short for its offset radius: it turns with its own
      const shaped = shapeWires(room, geometry, bundle(400 - p / 2))
      expect(radii(lc, shaped)[1]).toBeCloseTo(rho)
      const [ra, rb] = [la, lb].map((id) => radii(id, shaped)[1] ?? 0)
      expect(ra).toBeCloseTo(rho)
      expect(rb - ra).toBeCloseTo(p)
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
