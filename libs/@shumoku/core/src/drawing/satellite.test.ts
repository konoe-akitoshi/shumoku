// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { solveHorizontal } from './horizontal.js'
import { layoutDrawing } from './layout.js'
import { estimateCrossings, orderSiblings } from './order.js'
import { frameKey, type Geometry, type Order } from './problem.js'
import { networkOf, problemOf, testMetrics } from './testing.js'
import { solveVertical } from './vertical.js'

// A node outside every group is tied by a line over the network to `mon`, which is two frames
// deep. It stands outside them, level with `mon`, on whichever side costs less.
const net = (mon: string) => `
groups: [{ id: venue, groups: [{ id: noc }, { id: hall }] }]
nodes:
  - { id: border, group: noc }
  - { id: core, group: noc }
  - { id: ${mon}, group: noc }
  - { id: dns, group: noc }
  - { id: dhcp, group: noc }
  - { id: h1, group: hall }
  - { id: h2, group: hall }
  - { id: oob }
links:
  - { endpoints: [{ node: border }, { node: core }] }
  - { endpoints: [{ node: core }, { node: ${mon} }] }
  - { endpoints: [{ node: core }, { node: dns }] }
  - { endpoints: [{ node: core }, { node: dhcp }] }
  - { endpoints: [{ node: core }, { node: h1 }] }
  - { endpoints: [{ node: h1 }, { node: h2 }] }
  - { endpoints: [{ node: oob }, { node: ${mon} }], virtual: true }
`

const sceneOf = (mon: string) => {
  const { network, structure } = networkOf(net(mon), ['border'])
  return layoutDrawing(network, structure, testMetrics)
}

describe('a satellite whose partner is in a frame', () => {
  for (const [mon, side] of [
    ['amon', 'left'],
    ['zmon', 'right'],
  ] as const) {
    it(`stands outside the frames, level with its partner, on the ${side} when that is nearer`, () => {
      const scene = sceneOf(mon)
      const box = (id: string) => scene.nodes.find((n) => n.node.id === id)?.box
      const frame = (id: string) => scene.groups.find((g) => g.group.id === id)?.box
      const oob = box('oob')
      const partner = box(mon)
      const venue = frame('venue')
      expect(oob && partner && venue).toBeTruthy()
      if (!oob || !partner || !venue) return
      expect(oob.y + oob.height / 2).toBeCloseTo(partner.y + partner.height / 2)
      const outside =
        side === 'left' ? oob.x + oob.width <= venue.x : oob.x >= venue.x + venue.width
      expect(outside).toBe(true)
      // not across the whole drawing: the line only crosses the frames it has to
      const wire = scene.wires.find((w) => w.link.from.node === 'oob' || w.link.to.node === 'oob')
      const xs = wire?.points.map((p) => p.x) ?? []
      expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(scene.bounds.width / 2)
    })
  }

  it('is on the side with fewer crossings, and then shorter lines, of the two', () => {
    for (const mon of ['amon', 'zmon']) {
      const problem = problemOf(net(mon), ['border'])
      const y = solveVertical(problem)
      const order = orderSiblings(problem, y)
      const root = order.siblings.get('') ?? []
      const at = root.indexOf('oob')
      expect(at).toBeGreaterThanOrEqual(0)
      const anchor = root.indexOf(frameKey('venue'))
      const flipped = root.filter((k) => k !== 'oob')
      flipped.splice(
        at < anchor ? flipped.indexOf(frameKey('venue')) + 1 : flipped.indexOf(frameKey('venue')),
        0,
        'oob',
      )
      const other: Order = { ...order, siblings: new Map(order.siblings).set('', flipped) }
      const measure = (o: Order) => {
        const g: Geometry = solveHorizontal(problem, y, o)
        const length = problem.lines
          .filter((l) => l.role === 'oriented' || l.role === 'attach')
          .reduce((sum, l) => {
            const a = g.boxes.get(l.a.node ?? l.a.item)
            const b = g.boxes.get(l.b.node ?? l.b.item)
            return a && b
              ? sum +
                  Math.abs(a.x + a.width / 2 - b.x - b.width / 2) +
                  Math.abs(a.y + a.height / 2 - b.y - b.height / 2)
              : sum
          }, 0)
        return [estimateCrossings(problem, g), length] as const
      }
      const [c1, l1] = measure(order)
      const [c2, l2] = measure(other)
      expect(c1 < c2 || (c1 === c2 && l1 <= l2 + 1e-6)).toBe(true)
    }
  })
})
