// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { layoutDrawing, layoutParts } from './layout.js'
import type { Point } from './metrics.js'
import { networkOf, testMetrics, wiringOf } from './testing.js'

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
