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
groups: [{ id: g }]
links:
  - { endpoints: [{ node: top }, { node: a }] }
  - { endpoints: [{ node: top }, { node: b }] }
  - { endpoints: [{ node: a }, { node: c }] }
  - { endpoints: [{ node: b }, { node: c }] }
  - { endpoints: [{ node: top }, { node: c }], virtual: true }
  - { endpoints: [{ node: x }, { node: y }] }
`

/** A network small enough to try every way through: one line laid over the drawing. */
const small = `
nodes:
  - { id: top }
  - { id: a }
  - { id: b }
  - { id: c }
links:
  - { endpoints: [{ node: top }, { node: a }] }
  - { endpoints: [{ node: top }, { node: b }] }
  - { endpoints: [{ node: a }, { node: c }] }
  - { endpoints: [{ node: top }, { node: c }], virtual: true }
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

describe('which side a line laid over the drawing is bundled on', () => {
  const { problem } = run()
  it('puts a virtual line above and one that lies on the cables below', () => {
    const overlay = problem.lines.filter((l) => l.role === 'overlay')
    expect(overlay.length).toBe(2)
    const ends = (l: (typeof overlay)[number]) => [l.a.item, l.b.item].sort().join('-')
    expect(Object.fromEntries(overlay.map((l) => [ends(l), l.band]))).toEqual({
      'c-top': 'top',
      'x-y': 'bottom',
    })
  })
  it('gives no band to a line that places things', () => {
    for (const l of problem.lines) if (l.role !== 'overlay') expect(l.band).toBeUndefined()
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
      expect(pts[0]).toEqual(r.from.port)
      expect(pts.at(-1)).toEqual(r.to.port)
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

  it('takes a line laid over the drawing up to its band and down again', () => {
    for (const line of problem.lines) {
      if (line.role !== 'overlay' || !line.band) continue
      const r = routes.routes.get(line.id)
      const band = space.bands[line.band]
      expect(r?.steps.some((s) => s.into === band)).toBe(true)
      const bounds = space.bounds
      const beyond = (p: { y: number }) =>
        line.band === 'top' ? p.y < bounds.y : p.y > bounds.y + bounds.height
      expect(r?.points.some(beyond)).toBe(true)
    }
  })

  it('enters no band but the one it was given', () => {
    for (const r of routes.routes.values()) {
      const line = problem.lines.find((l) => l.id === r.line)
      const own = line?.band === undefined ? undefined : space.bands[line.band]
      for (const s of r.steps) {
        const into = space.cells[s.into]
        expect(into?.band === undefined || s.into === own).toBe(true)
      }
    }
  })

  it('does not take a line laid over the drawing through a door that is full', () => {
    for (const line of problem.lines) {
      if (line.role !== 'overlay') continue
      for (const s of routes.routes.get(line.id)?.steps ?? []) {
        const door = space.doors[s.door]
        expect((routes.used[s.door] ?? 0) <= (door?.capacity ?? 0)).toBe(true)
      }
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
      expect(again.lateral).toBeCloseTo(r.cost.lateral, 6)
      expect(again.length).toBeCloseTo(r.cost.length, 6)
    }
  })
})

type Steps = { door: number; into: number }[]

/**
 * Every way from `from` to `to` that passes no cell more than `times` times and no band cell
 * twice, as door steps. A line laid over the drawing that starts and ends in one cell goes up to
 * its band and down again, so it comes back to the cell it left.
 */
function allPaths(space: Space, from: number, to: number, times = 1, limit = 400000) {
  const out: Steps[] = []
  const seen = new Map<number, number>([[from, 1]])
  const walk = (cell: number, steps: Steps) => {
    if (out.length > limit) return
    if (cell === to) out.push([...steps])
    for (const d of space.cells[cell]?.doors ?? []) {
      const n = seen.get(d.to) ?? 0
      if (n >= (space.cells[d.to]?.band === undefined ? times : 1)) continue
      if (steps.at(-1)?.door === d.door && space.cells[cell]?.band === undefined) continue
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

/** The cheapest by `key` of every way, from any of the starts to any of the goals, that `usable` lets through. */
function cheapest(
  space: Space,
  starts: readonly Anchor[],
  goals: readonly Anchor[],
  allowed: ReturnType<typeof allowedFrames>,
  key: readonly (keyof Cost)[],
  usable: (steps: Steps) => boolean,
  times = 1,
): Cost | undefined {
  let best: Cost | undefined
  for (const from of starts) {
    for (const to of goals) {
      for (const steps of allPaths(space, from.cell, to.cell, times)) {
        if (!usable(steps)) continue
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

  it('is no dearer than any other way between any sides, for a line that places things, alone', () => {
    const { problem, geometry, space } = setup()
    const line = problem.lines.find((l) => l.role === 'oriented')
    expect(line).toBeDefined()
    if (!line) return
    const got = routeGlobal({ ...problem, lines: [line] }, geometry, space).routes.get(line.id)
    expect(got).toBeDefined()
    if (!got) return
    const best = cheapest(
      space,
      anchorsOf(problem, geometry, space, line.a),
      anchorsOf(problem, geometry, space, line.b),
      allowedFrames(problem, line),
      KEY.oriented,
      (steps) => steps.every((s) => space.cells[s.into]?.band === undefined),
    )
    expect(best).toBeDefined()
    if (best) expect(same(got.cost, best, KEY.oriented)).toBe(true)
  })

  it('takes a line laid over the drawing sideways no further than the way that is best for bends and length', () => {
    const { problem, geometry, space } = setup(small)
    for (const line of problem.lines) {
      if (line.role !== 'overlay' || !line.band) continue
      const band = space.bands[line.band]
      const toBand = (steps: Steps) =>
        steps.some((s) => s.into === band) &&
        steps.every((s) => space.cells[s.into]?.band === undefined || s.into === band)
      const got = routeGlobal({ ...problem, lines: [line] }, geometry, space).routes.get(line.id)
      expect(got).toBeDefined()
      if (!got) continue
      const allowed = allowedFrames(problem, line)
      const starts = anchorsOf(problem, geometry, space, line.a)
      const goals = anchorsOf(problem, geometry, space, line.b)
      const best = cheapest(space, starts, goals, allowed, KEY.overlay, toBand, 2)
      expect(best).toBeDefined()
      if (best) expect(same(got.cost, best, KEY.overlay)).toBe(true)
      // The lower bound: the way that is best for frames, bends and length alone runs sideways
      // at least as far as this one.
      const plain = cheapest(
        space,
        starts,
        goals,
        allowed,
        ['frames', 'bends', 'length'],
        toBand,
        2,
      )
      if (plain) expect(got.cost.lateral).toBeLessThanOrEqual(plain.lateral + 1e-6)
    }
  })
})

describe('routing in the root alone', () => {
  it('allows the root frame', () => {
    const { problem } = run()
    for (const l of problem.lines) expect(allowedFrames(problem, l).has(ROOT)).toBe(true)
  })
})
