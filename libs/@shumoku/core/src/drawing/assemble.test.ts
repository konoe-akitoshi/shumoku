// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { layoutDrawing } from './layout.js'
import { networkOf, testMetrics } from './testing.js'

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
  // a double line takes more room than it is drawn wide
  const scene = layoutDrawing(network, structure, {
    ...testMetrics,
    line: (link) => (link.to.node === 'b' ? { stroke: 3, width: 9 } : { stroke: 2, width: 2 }),
  })

  it('hands each wire the width it is drawn at and the room it took', () => {
    const toB = scene.wires.find((w) => w.link.to.node === 'b')
    const toC = scene.wires.find((w) => w.link.to.node === 'c')
    expect([toB?.stroke, toB?.width]).toEqual([3, 9])
    expect([toC?.stroke, toC?.width]).toEqual([2, 2])
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
})
