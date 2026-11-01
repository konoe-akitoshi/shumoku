// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import type { Piece } from './lanes.js'
import { layoutDrawing, layoutParts } from './layout.js'
import type { Point } from './metrics.js'
import { type Lanes, separate } from './realize-constraints.js'
import { anywhere } from './rooms.js'
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
const sceneOf = (text: string) => {
  const { network, structure } = networkOf(text, ['top'])
  return layoutDrawing(network, structure, testMetrics)
}

describe('realize', () => {
  const scene = sceneOf(over)
  const box = (id: string) => scene.nodes.find((n) => n.node.id === id)?.box

  it('draws every line on horizontal and vertical stretches only', () => {
    expect(scene.wires).toHaveLength(7)
    for (const w of scene.wires) {
      for (const [i, p] of w.points.entries()) {
        const q = w.points[i + 1]
        if (q) expect(Math.abs(p.x - q.x) < EPS || Math.abs(p.y - q.y) < EPS).toBe(true)
      }
    }
  })

  it('leaves a port straight out of the edge it stands on, a lead-out before the first turn', () => {
    const ports = scene.ports ?? []
    for (const w of scene.wires) {
      const ends: [Point, Point | undefined][] = [
        [w.points[0] as Point, w.points[1]],
        [w.points.at(-1) as Point, w.points.at(-2)],
      ]
      for (const [at, next] of ends) {
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
        expect(Math.hypot(next.x - at.x, next.y - at.y)).toBeGreaterThanOrEqual(
          testMetrics.leadOut - EPS,
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

  /** The unknowns: p and q along x with the targets given, and the two legs of A along y. */
  const setup = (target: { p: number; q: number }, lines: Lanes['lines']) => {
    const U = { x: new Unknowns(), y: new Unknowns() }
    U.x.add('p', { lo: 0, hi: 200 }, target.p)
    U.x.add('q', { lo: 0, hi: 200 }, target.q)
    U.y.add('leg in', anywhere, 50)
    U.y.add('leg out', anywhere, 200)
    const lanes: Lanes = { lines, unknownOf: (x) => index.get(x), pitch: () => pitch }
    const known = (a: 'x' | 'y', i: number) => U[a].guess(i)
    return { U, lanes, known }
  }
  // A leaves its box at x 10 and ends at 190, so its leg in at y 50 goes left; B runs the length of
  // the cell, so that leg enters its extent
  const legged: Lanes['lines'] = [
    { pieces: [legIn, p, legOut], fromEdge: 10, toEdge: 190 },
    { pieces: [q], fromEdge: 0, toEdge: 120 },
  ]
  // the same two pieces with no legs, so that nothing is forced
  const bare: Lanes['lines'] = [
    { pieces: [p], fromEdge: 0, toEdge: 120 },
    { pieces: [q], fromEdge: 0, toEdge: 120 },
  ]

  it('takes the order the ends of the pieces force, whatever the estimates say', () => {
    // p is estimated after q, but p's leg in goes left into the extent of q, which must be passed
    // on the side the leg leaves from: p lies before q
    const { U, lanes, known } = setup({ p: 105, q: 100 }, legged)
    separate(U.x, 'x', lanes, tolerance, known)
    expect(U.x.sep).toEqual([{ i: 0, j: 1, d: pitch }])
    expect(U.x.laneLost).toBe(0)
  })

  it('puts pieces nothing forces in the order the solve of what else is asked puts them in', () => {
    // with nothing else asked, the estimates are the order: q (100) before p (105)
    const plain = setup({ p: 105, q: 100 }, bare)
    separate(plain.U.x, 'x', plain.lanes, tolerance, plain.known)
    expect(plain.U.x.sep).toEqual([{ i: 1, j: 0, d: pitch }])

    // asked elsewhere to keep p a pitch before q, the solve puts p first, against the estimates
    const asked = setup({ p: 105, q: 100 }, bare)
    asked.U.x.before(0, 1, pitch)
    separate(asked.U.x, 'x', asked.lanes, tolerance, asked.known)
    const solved = asked.U.x.solve(tolerance)
    expect(solved.value(1) - solved.value(0)).toBeGreaterThanOrEqual(pitch - 1e-6)
    expect(asked.U.x.laneLost).toBe(0)
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
        apart: 0,
        separations: 0,
        bounds: 0,
      })
    }
  })
})
