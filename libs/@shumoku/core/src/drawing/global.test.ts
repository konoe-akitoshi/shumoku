// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import {
  type Anchor,
  allowedFrames,
  anchorsOf,
  type Cost,
  costOf,
  KEY,
  routeGlobal,
} from './global.js'
import { layoutParts } from './layout.js'
import type { Box } from './metrics.js'
import { portEntities } from './ports.js'
import { ROOT } from './problem.js'
import { sidesOf } from './sides.js'
import { buildSpace, type Space } from './space.js'
import { networkOf, testMetrics } from './testing.js'

const yaml = `
nodes:
  - { id: top }
  - { id: a, group: g }
  - { id: b, group: g }
  - { id: c }
  - { id: x }
  - { id: y }
  - { id: p }
  - { id: q }
groups: [{ id: g }]
links:
  - { endpoints: [{ node: top }, { node: a }] }
  - { endpoints: [{ node: top }, { node: b }] }
  - { endpoints: [{ node: a }, { node: c }] }
  - { endpoints: [{ node: b }, { node: c }] }
  - { endpoints: [{ node: top }, { node: c }], virtual: true }
  - { endpoints: [{ node: x }, { node: y }] }
  - { endpoints: [{ node: p }, { node: q }], virtual: true }
`

function run() {
  const { network, structure } = networkOf(yaml, ['top'])
  const { problem, geometry } = layoutParts(network, structure, testMetrics)
  const space = buildSpace(problem, geometry)
  const routes = routeGlobal(problem, geometry, space)
  return { problem, geometry, space, routes }
}

const inside = (b: Box, p: { x: number; y: number }) =>
  p.x > b.x && p.x < b.x + b.width && p.y > b.y && p.y < b.y + b.height

describe('which lines the structure relates', () => {
  const { problem } = run()
  const line = (a: string, b: string) =>
    problem.lines.find((l) => [l.a.item, l.b.item].sort().join() === [a, b].sort().join())

  it('takes a line from one end of a chain of directions to the other as a flow, whichever way it is written', () => {
    // top is above a and a above c on the cables, so the virtual line top-c is a hand-over too
    const l = line('top', 'c')
    expect(l?.role).toBe('oriented')
    expect(l && (l.upper === 'a' ? l.a.item : l.b.item)).toBe('top')
  })

  it('leaves a line unrelated where the structure says nothing of its ends, and says which side it leaves by', () => {
    expect(line('x', 'y')).toMatchObject({ role: 'unrelated', edge: 'bottom' })
    expect(line('p', 'q')).toMatchObject({ role: 'unrelated', edge: 'top' })
  })

  it('gives a direction to a flow only and a side to an unrelated line only', () => {
    for (const l of problem.lines) {
      if (l.role !== 'oriented') expect(l.upper).toBeUndefined()
      if (l.role !== 'unrelated') expect(l.edge).toBeUndefined()
    }
  })
})

describe('global routes', () => {
  const { problem, geometry, space, routes } = run()

  it('routes every line from its port to its port, in straight runs', () => {
    expect(routes.unroutable).toEqual([])
    for (const line of problem.lines) {
      if (line.role === 'inside') continue
      const r = routes.routes.get(line.id)
      expect(r).toBeDefined()
      if (!r) continue
      const pts = r.points
      // The port stands on the side it is on, anywhere along the stretch its cell allows.
      for (const [p, a] of [
        [pts[0], r.from],
        [pts.at(-1), r.to],
      ] as const) {
        const across = a.out === 0 || a.out === 2
        expect(across ? p?.x : p?.y).toBeCloseTo(across ? a.port.x : a.port.y)
        const v = across ? p?.y : p?.x
        expect(v).toBeGreaterThanOrEqual(a.span[0] - 1e-6)
        expect(v).toBeLessThanOrEqual(a.span[1] + 1e-6)
      }
      for (const [i, p] of pts.entries()) {
        const q = pts[i + 1]
        if (q) expect(Math.abs(p.x - q.x) < 1e-6 || Math.abs(p.y - q.y) < 1e-6).toBe(true)
      }
      // a lead-out straight off the port, at least, before the first turn
      const next = pts[1]
      expect(
        next && Math.hypot(next.x - r.from.port.x, next.y - r.from.port.y),
      ).toBeGreaterThanOrEqual(testMetrics.leadOut - 1e-6)
    }
  })

  it('never runs through a card', () => {
    const cards = problem.items.flatMap((i) => {
      const b = geometry.boxes.get(i.id)
      return i.kind === 'unit' || !b ? [] : [b]
    })
    for (const r of routes.routes.values()) {
      for (const [i, p] of r.points.entries()) {
        const q = r.points[i + 1]
        if (!q) continue
        for (const card of cards) {
          expect(inside(card, { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 })).toBe(false)
        }
      }
    }
  })

  it('keeps out of frames that hold neither end, whenever the doors let it', () => {
    for (const line of problem.lines) {
      const r = routes.routes.get(line.id)
      if (r) expect(r.cost.frames).toBe(0)
    }
  })

  it('gives each end the port on the side its route leaves the box by', () => {
    const ports = portEntities(problem, geometry, routes)
    for (const line of problem.lines) {
      const r = routes.routes.get(line.id)
      if (!r) continue
      for (const [end, anchor] of [
        ['a', r.from],
        ['b', r.to],
      ] as const) {
        const port = ports.find((p) => p.ends.some((e) => e.line === line.id && e.end === end))
        expect(port?.side).toBe(anchor.side)
        expect(port?.cell).toBe(anchor.cell)
      }
    }
  })

  it('is the same for the same input', () => {
    const again = run()
    expect([...again.routes.routes].map(([k, r]) => [k, r.steps, r.cost, r.from.side])).toEqual(
      [...routes.routes].map(([k, r]) => [k, r.steps, r.cost, r.from.side]),
    )
  })

  it('reports a cost that the doors it passes give again', () => {
    for (const line of problem.lines) {
      const r = routes.routes.get(line.id)
      if (!r) continue
      const again = costOf(space, r, allowedFrames(problem, line))
      expect(again.frames).toBe(r.cost.frames)
      expect(again.bends).toBe(r.cost.bends)
      expect(again.length).toBeCloseTo(r.cost.length, 6)
    }
  })
})

type Steps = { door: number; into: number }[]

/** Every way from `from` to `to` that passes no cell more than `times` times, as door steps. */
function allPaths(space: Space, from: number, to: number, times = 1, limit = 400000) {
  const out: Steps[] = []
  const seen = new Map<number, number>([[from, 1]])
  const walk = (cell: number, steps: Steps) => {
    if (out.length > limit) return
    if (cell === to) out.push([...steps])
    for (const d of space.cells[cell]?.doors ?? []) {
      const n = seen.get(d.to) ?? 0
      if (n >= times) continue
      if (steps.at(-1)?.door === d.door) continue
      seen.set(d.to, n + 1)
      steps.push({ door: d.door, into: d.to })
      walk(d.to, steps)
      steps.pop()
      seen.set(d.to, n)
    }
  }
  walk(from, [])
  return out
}

/** Whether `c` is no better than `best` by the terms of `key`, most important first. */
function noBetter(c: Cost, best: Cost, key: readonly (keyof Cost)[]): boolean {
  for (const t of key) {
    if (Math.abs(c[t] - best[t]) < 1e-6) continue
    return c[t] > best[t]
  }
  return true
}

const same = (a: Cost, b: Cost, key: readonly (keyof Cost)[]) =>
  noBetter(a, b, key) && noBetter(b, a, key)

/** The cheapest by `key` of every way, from any of the starts to any of the goals. */
function cheapest(
  space: Space,
  starts: readonly Anchor[],
  goals: readonly Anchor[],
  allowed: ReturnType<typeof allowedFrames>,
  key: readonly (keyof Cost)[],
  times = 1,
): Cost | undefined {
  let best: Cost | undefined
  for (const from of starts) {
    for (const to of goals) {
      for (const steps of allPaths(space, from.cell, to.cell, times)) {
        const c = costOf(space, { steps, from, to }, allowed)
        if (!best || !noBetter(c, best, key)) best = c
      }
    }
  }
  return best
}

describe('the cheapest route', () => {
  const setup = (text = yaml) => {
    const { network, structure } = networkOf(text, ['top'])
    const { problem, geometry } = layoutParts(network, structure, testMetrics)
    return { problem, geometry, space: buildSpace(problem, geometry) }
  }

  it.each(['oriented', 'unrelated'] as const)(
    'is no dearer than any other way between its sides, for a %s line alone',
    (role) => {
      const { problem, geometry, space } = setup()
      const line = problem.lines.find((l) => l.role === role)
      expect(line).toBeDefined()
      if (!line) return
      const got = routeGlobal({ ...problem, lines: [line] }, geometry, space).routes.get(line.id)
      expect(got).toBeDefined()
      if (!got) return
      const best = cheapest(
        space,
        anchorsOf(problem, geometry, space, line.a, sidesOf(line)?.a),
        anchorsOf(problem, geometry, space, line.b, sidesOf(line)?.b),
        allowedFrames(problem, line),
        KEY,
      )
      expect(best).toBeDefined()
      if (best) expect(same(got.cost, best, KEY)).toBe(true)
    },
  )
})

describe('routing in the root alone', () => {
  it('allows the root frame', () => {
    const { problem } = run()
    for (const l of problem.lines) expect(allowedFrames(problem, l).has(ROOT)).toBe(true)
  })
})

describe('the side a line leaves a box by', () => {
  const { problem, geometry, routes } = run()

  it('is one of the sides the relation of its ends gives, and no line is left without one', () => {
    expect(routes.unroutable).toEqual([])
    for (const line of problem.lines) {
      const r = routes.routes.get(line.id)
      const sides = sidesOf(line)
      if (!r || !sides) continue
      expect(sides.a).toContain(r.from.side)
      expect(sides.b).toContain(r.to.side)
    }
  })

  it('leaves a flow down by the bottom of the upper box and into the top of the lower', () => {
    const down = problem.above.map((p) => [p.upper, p.lower])
    expect(down.length).toBeGreaterThan(0)
    for (const line of problem.lines) {
      const r = routes.routes.get(line.id)
      if (!r || line.role !== 'oriented') continue
      const [a, b] = [line.a.item, line.b.item]
      if (down.some(([u, l]) => u === a && l === b)) {
        expect([r.from.side, r.to.side]).toEqual(['bottom', 'top'])
      } else if (down.some(([u, l]) => u === b && l === a)) {
        expect([r.from.side, r.to.side]).toEqual(['top', 'bottom'])
      }
    }
  })

  it('leaves the port a stretch of the side, within the box and the cell that the lead-out runs through', () => {
    for (const r of routes.routes.values()) {
      for (const a of [r.from, r.to]) {
        const b = geometry.boxes.get(a.box)
        expect(b).toBeDefined()
        if (!b) continue
        const across = a.out === 0 || a.out === 2
        const [lo, hi] = across ? [b.y, b.y + b.height] : [b.x, b.x + b.width]
        expect(a.span[0]).toBeGreaterThanOrEqual(lo - 1e-6)
        expect(a.span[1]).toBeLessThanOrEqual(hi + 1e-6)
        expect(a.span[0]).toBeLessThanOrEqual(a.span[1] + 1e-6)
        const at = across ? a.port.y : a.port.x
        expect(at).toBeGreaterThanOrEqual(a.span[0] - 1e-6)
        expect(at).toBeLessThanOrEqual(a.span[1] + 1e-6)
      }
    }
  })
})
