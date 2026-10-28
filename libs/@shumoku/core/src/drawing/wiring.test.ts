// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { crossings } from './crossing.js'
import { demandsOf } from './demands.js'
import { buildGrid } from './grid.js'
import { solveHorizontal } from './horizontal.js'
import { layoutDrawing } from './layout.js'
import type { Point } from './metrics.js'
import { orderSiblings } from './order.js'
import { assignPorts, widen } from './ports.js'
import { routeLines } from './route.js'
import { networkOf, problemOf, testMetrics } from './testing.js'
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
    expect(bundles.some((b) => b.lines === 2 && b.core === 2)).toBe(true)
  })
})

describe('the order of lines in a bundle', () => {
  // Three lines run along y = 10 from x = 0 to 50; each leaves it at a different height at the
  // far end and comes in at a different height at the near end.
  const line = (from: number, to: number): Point[] => [
    { x: -10, y: from },
    { x: 0, y: from },
    { x: 0, y: 10 },
    { x: 50, y: 10 },
    { x: 50, y: to },
    { x: 60, y: to },
  ]
  const wires = (ids: string[]) =>
    new Map(
      ids.map((id) => {
        const [from, to] = { a: [0, 20], b: [20, 0], c: [20, 20] }[id] ?? [0, 0]
        return [id, line(from ?? 0, to ?? 0)] as const
      }),
    )

  it('is one order for the whole bundle, the same whichever line is given first', () => {
    const first = nudge(wires(['a', 'b', 'c']), new Map(), 4)
    const second = nudge(wires(['c', 'a', 'b']), new Map(), 4)
    for (const id of ['a', 'b', 'c']) expect(second.wires.get(id)).toEqual(first.wires.get(id))
    expect(first.approximated).toBe(0)
  })

  it('leaves the lines no more crossings than their routes call for', () => {
    const paths = wires(['a', 'b', 'c'])
    const { wires: out } = nudge(paths, new Map(), 4)
    const ids = [...out.keys()]
    const proper = (a: Point[], b: Point[]) => {
      let n = 0
      for (const [i, p] of a.entries()) {
        const q = a[i + 1]
        if (!q) continue
        for (const [j, r] of b.entries()) {
          const t = b[j + 1]
          if (!t) continue
          const side = (u: Point, v: Point, w: Point) =>
            (v.x - u.x) * (w.y - u.y) - (v.y - u.y) * (w.x - u.x)
          if (side(p, q, r) * side(p, q, t) < 0 && side(r, t, p) * side(r, t, q) < 0) n++
        }
      }
      return n
    }
    let drawn = 0
    let counted = 0
    for (const [i, a] of ids.entries()) {
      for (const b of ids.slice(i + 1)) {
        drawn += proper(out.get(a) ?? [], out.get(b) ?? [])
        counted += crossings(paths.get(a) ?? [], paths.get(b) ?? [])
      }
    }
    expect(drawn).toBeLessThanOrEqual(counted)
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
      { axis: 'h', coord: mid, lo: top.x, hi: top.x + top.width, lines: 2, core: 2 },
    ])
    const none = demandsOf(problem, geometry, [
      { axis: 'h', coord: mid, lo: top.x, hi: top.x + top.width, lines: 1, core: 1 },
    ])
    expect(none).toEqual([])
    // Two lines that lie over the drawing ask for nothing; the room they need is not the layout's.
    const over = demandsOf(problem, geometry, [
      { axis: 'h', coord: mid, lo: top.x, hi: top.x + top.width, lines: 3, core: 1 },
    ])
    expect(over).toEqual([])
    for (const d of wide) expect(d.min).toBe(testMetrics.pitch + 2 * testMetrics.leadOut)
  })
})

describe('lines laid over the drawing', () => {
  const over = `${yaml}  - { endpoints: [{ node: top }, { node: low }], virtual: true }
`
  const boxes = (text: string) => {
    const { network, structure } = networkOf(text, ['top'])
    const scene = layoutDrawing(network, structure, testMetrics)
    return scene.nodes
      .map((n) => `${n.node.id} ${n.box.x} ${n.box.y}`)
      .sort((p, q) => p.localeCompare(q))
  }

  it('are drawn without moving a single box', () => {
    const { network, structure } = networkOf(over, ['top'])
    expect(problemOf(over, ['top']).lines.filter((l) => l.role === 'overlay')).toHaveLength(1)
    expect(layoutDrawing(network, structure, testMetrics).wires).toHaveLength(6)
    expect(boxes(over)).toEqual(boxes(yaml))
  })

  it('have a ring around the drawing to run on, with room for all of them side by side', () => {
    const p = problemOf(over, ['top'])
    const y = solveVertical(p)
    const order = orderSiblings(p, y)
    const geometry = solveHorizontal(p, y, order)
    const { plans } = assignPorts(p, geometry)
    const grid = buildGrid(p, geometry, plans)
    const left = Math.min(...[...geometry.boxes.values()].map((b) => b.x))
    expect(grid.xs[0]).toBeLessThan(left - testMetrics.leadOut + 1e-6)
    expect(grid.capH[0]).toBeGreaterThan(1000)
  })

  it('find a way that stays within the room of every corridor, the ring if no other', () => {
    const p = problemOf(over, ['top'])
    const y = solveVertical(p)
    const geometry = solveHorizontal(p, y, orderSiblings(p, y))
    const { plans } = assignPorts(p, geometry)
    const routes = routeLines(p, geometry, plans, buildGrid(p, geometry, plans))
    const line = p.lines.find((l) => l.role === 'overlay')
    expect(line && routes.routes.get(line.id)?.cost[1]).toBe(0)
  })

  it('can be left out of a round that only needs the room the other lines ask for', () => {
    const p = problemOf(over, ['top'])
    const y = solveVertical(p)
    const geometry = solveHorizontal(p, y, orderSiblings(p, y))
    const { plans } = assignPorts(p, geometry)
    const grid = buildGrid(p, geometry, plans)
    const line = p.lines.find((l) => l.role === 'overlay')
    const all = routeLines(p, geometry, plans, grid, false, true)
    const core = routeLines(p, geometry, plans, grid, false, false)
    expect(line && all.wires.has(line.id)).toBe(true)
    expect(line && core.wires.has(line.id)).toBe(false)
    expect(core.wires.size).toBe(all.wires.size - 1)
  })
})
