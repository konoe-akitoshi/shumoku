// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { layoutParts } from './layout.js'
import { portSides, sidesOf } from './sides.js'
import { networkOf, testMetrics } from './testing.js'

// top reaches a and b one cable away, and a and b are level; c hangs off a, and x and y are
// cabled to each other only.
const yaml = `
nodes:
  - { id: top }
  - { id: a }
  - { id: b }
  - { id: c }
  - { id: x }
  - { id: y }
links:
  - { endpoints: [{ node: top }, { node: a }] }
  - { endpoints: [{ node: top }, { node: b }] }
  - { endpoints: [{ node: a }, { node: b }] }
  - { endpoints: [{ node: a }, { node: c }] }
  - { endpoints: [{ node: top }, { node: c }], virtual: true }
  - { endpoints: [{ node: x }, { node: y }] }
`

function problem() {
  const { network, structure } = networkOf(yaml, ['top'])
  return layoutParts(network, structure, testMetrics).problem
}

describe('the sides a line leaves its boxes by', () => {
  const p = problem()
  const line = (from: string, to: string, role: string) =>
    p.lines.find(
      (l) => l.role === role && [l.a.item, l.b.item].sort().join() === [from, to].sort().join(),
    )

  it('takes a line down the flow out of the bottom of the upper box and into the top of the lower', () => {
    const l = line('top', 'a', 'oriented')
    expect(l).toBeDefined()
    if (!l) return
    const sides = sidesOf(p, l)
    expect(sides).toBeDefined()
    const upper = l.a.item === 'top' ? sides?.a : sides?.b
    const lower = l.a.item === 'top' ? sides?.b : sides?.a
    expect(upper).toEqual(['bottom'])
    expect(lower).toEqual(['top'])
  })

  it('takes a line between level boxes out by their sides, whichever faces the other', () => {
    const l = line('a', 'b', 'oriented')
    expect(l).toBeDefined()
    if (!l) return
    expect(sidesOf(p, l)).toEqual({ a: ['left', 'right'], b: ['left', 'right'] })
  })

  it('takes a line laid over the drawing out by the side of its band', () => {
    const virtual = p.lines.find((l) => l.role === 'overlay' && l.band === 'top')
    const cabled = p.lines.find((l) => l.role === 'overlay' && l.band === 'bottom')
    expect(virtual && sidesOf(p, virtual)).toEqual({ a: ['top'], b: ['top'] })
    expect(cabled && sidesOf(p, cabled)).toEqual({ a: ['bottom'], b: ['bottom'] })
  })

  it('knows before any line is routed which sides of a box have ports', () => {
    const sides = portSides(p)
    // top is the upper end of two flows and the end of the virtual line, which is bundled above
    expect([...(sides.get('top') ?? [])].sort()).toEqual(['bottom', 'top'])
    // a and b are level, so each may leave by either side; a is also under top and over c
    expect([...(sides.get('a') ?? [])].sort()).toEqual(['bottom', 'left', 'right', 'top'])
    // c is under a, and the virtual line leaves it by the top
    expect([...(sides.get('c') ?? [])]).toEqual(['top'])
  })
})
