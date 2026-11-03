// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { polylineMiddle } from './assemble.js'
import { layoutDrawing } from './layout.js'
import { networkOf, testMetrics } from './testing/support.js'

const yaml = `
nodes:
  - { id: a }
  - { id: b }
  - { id: c }
links:
  - { endpoints: [{ node: a }, { node: b }] }
  - { endpoints: [{ node: a }, { node: c }] }
`

describe('the scene assemble makes', () => {
  const { network, structure } = networkOf(yaml, [])
  const scene = layoutDrawing(network, structure, {
    ...testMetrics,
    line: (link) => (link.to.node === 'b' ? 9 : 2),
  })

  it('hands each wire the width the metrics gave its link', () => {
    const toB = scene.wires.find((w) => w.link.to.node === 'b')
    const toC = scene.wires.find((w) => w.link.to.node === 'c')
    expect(toB?.stroke).toBe(9)
    expect(toC?.stroke).toBe(2)
  })

  it('moves everything so that its top-left corner is the origin', () => {
    const xs = [
      ...scene.nodes.flatMap((n) => [n.box.x]),
      ...scene.wires.flatMap((w) => w.points.map((p) => p.x)),
    ]
    const ys = [
      ...scene.nodes.flatMap((n) => [n.box.y]),
      ...scene.wires.flatMap((w) => w.points.map((p) => p.y)),
    ]
    expect(Math.min(...xs)).toBeCloseTo(0)
    expect(Math.min(...ys)).toBeCloseTo(0)
    expect(scene.bounds.x).toBe(0)
    expect(scene.bounds.y).toBe(0)
  })

  it('puts the label of a wire at half its length', () => {
    expect(
      polylineMiddle([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 30 },
      ]),
    ).toEqual({ x: 10, y: 10 })
    for (const w of scene.wires) expect(w.label).toEqual(polylineMiddle(w.points))
  })
})
