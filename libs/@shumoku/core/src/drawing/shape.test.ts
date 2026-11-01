// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { sampleNetworkYaml } from '../index.js'
import { haloOf, pitchOf, whiteOf } from './kin.js'
import { layoutDrawing } from './layout.js'
import type { Point } from './metrics.js'
import { shapeWires } from './shape.js'
import { networkOf, problemOf, testMetrics } from './testing.js'

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
})

describe('the mouths of bands', () => {
  const { network, structure } = networkOf(sampleNetworkYaml, [])
  const scene = layoutDrawing(network, structure, testMetrics)

  it('stand at a chamfer of the line, where it meets a straight run beside others', () => {
    expect(scene.marks.length).toBeGreaterThan(0)
    for (const mark of scene.marks) {
      expect(mark.members.length).toBeGreaterThan(1)
      const wire = scene.wires.find((w) => w.link === mark.link)
      const k = wire?.points.findIndex(
        (p) => Math.abs(p.x - mark.at.x) < EPS && Math.abs(p.y - mark.at.y) < EPS,
      )
      expect(k).toBeGreaterThanOrEqual(0)
      const [p, v, n] = [
        wire?.points[(k ?? 0) - 1],
        wire?.points[k ?? 0],
        wire?.points[(k ?? 0) + 1],
      ]
      const other = mark.kind === 'join' ? p : n
      expect(v && other && Math.abs(Math.abs(v.x - other.x) - Math.abs(v.y - other.y)) < EPS).toBe(
        true,
      )
    }
  })
})
