// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { demandsOf } from './demands.js'
import { buildGrid } from './grid.js'
import { solveHorizontal } from './horizontal.js'
import { orderSiblings } from './order.js'
import { assignPorts, widen } from './ports.js'
import { routeLines } from './route.js'
import { problemOf, testMetrics } from './testing.js'
import { nudge } from './tracks.js'
import { solveVertical } from './vertical.js'

const yaml = `
nodes:
  - { id: top }
  - { id: l, group: g }
  - { id: r, group: g }
  - { id: low }
groups: [{ id: g }]
links:
  - { endpoints: [{ node: top }, { node: l }] }
  - { endpoints: [{ node: top }, { node: r }] }
  - { endpoints: [{ node: l }, { node: low }] }
  - { endpoints: [{ node: r }, { node: low }] }
  - { endpoints: [{ node: top }, { node: low }] }
`

function placed() {
  const base = problemOf(yaml, ['top'])
  const y = solveVertical(base)
  const order = orderSiblings(base, y)
  const geometry = solveHorizontal(base, y, order)
  const { plans, widths } = assignPorts(base, geometry)
  return { problem: widen(base, widths), geometry, plans }
}

describe('ports and routes', () => {
  const { problem, geometry, plans } = placed()
  const grid = buildGrid(problem, geometry, plans)
  const routes = routeLines(problem, geometry, plans, grid)

  it('keeps every grid step that runs through a card shut', () => {
    const card = geometry.boxes.get('l')
    expect(card).toBeDefined()
    if (!card) return
    const ix = grid.xs.findIndex((x) => x > card.x + 1 && x < card.x + card.width - 1)
    const iy = grid.ys.findIndex((y) => y > card.y + 1 && y < card.y + card.height - 1)
    expect(grid.blockedH[iy * grid.nx + ix]).toBe(1)
  })

  it('routes every line, from a port out by a lead-out', () => {
    expect(routes.unroutable).toEqual([])
    for (const plan of plans) {
      const wire = routes.wires.get(plan.line.id)
      const [first, second] =
        plan.end === 'a' ? [wire?.[0], wire?.[1]] : [wire?.at(-1), wire?.at(-2)]
      expect(first).toEqual(plan.at)
      expect(
        second && Math.hypot(second.x - plan.at.x, second.y - plan.at.y),
      ).toBeGreaterThanOrEqual(testMetrics.leadOut - 1e-6)
    }
  })

  it('draws only horizontal and vertical segments', () => {
    for (const wire of routes.wires.values()) {
      for (const [i, p] of wire.entries()) {
        const q = wire[i + 1]
        if (q) expect(p.x === q.x || p.y === q.y).toBe(true)
      }
    }
  })

  it('gives the same routes for the same input', () => {
    const again = routeLines(problem, geometry, plans, grid)
    expect([...again.wires]).toEqual([...routes.wires])
  })
})

describe('nudge', () => {
  it('spreads lines that share a corridor a pitch apart', () => {
    const wires = new Map([
      [
        'a',
        [
          { x: 0, y: 0 },
          { x: 0, y: 5 },
          { x: 0, y: 10 },
          { x: 50, y: 10 },
          { x: 50, y: 50 },
          { x: 50, y: 60 },
        ],
      ],
      [
        'b',
        [
          { x: 10, y: 0 },
          { x: 10, y: 5 },
          { x: 10, y: 10 },
          { x: 40, y: 10 },
          { x: 40, y: 50 },
          { x: 40, y: 60 },
        ],
      ],
    ])
    const { wires: out, bundles } = nudge(wires, new Map(), 4)
    const ya = out.get('a')?.[3]?.y ?? 0
    const yb = out.get('b')?.[3]?.y ?? 0
    expect(Math.abs(ya - yb)).toBe(4)
    expect(bundles.some((b) => b.lines === 2)).toBe(true)
  })
})

describe('demandsOf', () => {
  it('asks for room where a bundle is wider than its corridor', () => {
    const { problem, geometry } = placed()
    const top = geometry.boxes.get('top')
    const low = geometry.boxes.get('low')
    expect(top && low).toBeTruthy()
    if (!top || !low) return
    const mid = (top.y + top.height + low.y) / 2
    const wide = demandsOf(problem, geometry, [
      { axis: 'h', coord: mid, lo: top.x, hi: top.x + top.width, lines: 2 },
    ])
    const none = demandsOf(problem, geometry, [
      { axis: 'h', coord: mid, lo: top.x, hi: top.x + top.width, lines: 1 },
    ])
    expect(none).toEqual([])
    for (const d of wide) expect(d.min).toBe(testMetrics.pitch + 2 * testMetrics.leadOut)
  })
})
