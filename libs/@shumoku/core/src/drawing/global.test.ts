// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { allowedFrames, costOf, routeGlobal } from './global.js'
import { layoutParts } from './layout.js'
import type { Box } from './metrics.js'
import { assignPorts } from './ports.js'
import { type Problem, ROOT } from './problem.js'
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

function run(refine = true) {
  const { network, structure } = networkOf(yaml, ['top'])
  const { problem, geometry } = layoutParts(network, structure, testMetrics)
  const { plans } = assignPorts(problem, geometry)
  const space = buildSpace(problem, geometry)
  const routes = routeGlobal(problem, geometry, plans, space, refine)
  return { problem, geometry, plans, space, routes }
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
      if (r) expect(r.cost[0]).toBe(0)
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

  it('lets a line laid over the drawing run sideways only in its band, or where it leaves or reaches a card', () => {
    for (const line of problem.lines) {
      if (line.role !== 'overlay') continue
      const r = routes.routes.get(line.id)
      if (!r) continue
      const bounds = space.bounds
      for (const [i, p] of r.points.entries()) {
        const q = r.points[i + 1]
        if (!q || Math.abs(p.y - q.y) > 1e-6 || Math.abs(p.x - q.x) < 1e-6) continue
        const inContent = p.y >= bounds.y && p.y <= bounds.y + bounds.height
        const cell = space.cellAt({ x: (p.x + q.x) / 2, y: p.y })
        expect(!inContent || cell === r.from.cell || cell === r.to.cell).toBe(true)
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

  it('is the same for the same input', () => {
    const again = run()
    expect([...again.routes.routes].map(([k, r]) => [k, r.steps, r.cost])).toEqual(
      [...routes.routes].map(([k, r]) => [k, r.steps, r.cost]),
    )
  })

  it('reports a cost that the doors it passes give again', () => {
    for (const line of problem.lines) {
      const r = routes.routes.get(line.id)
      if (!r) continue
      const [frames, , bends, length] = costOf(space, r, allowedFrames(problem, line))
      expect(frames).toBe(r.cost[0])
      expect(bends).toBe(r.cost[2])
      expect(length).toBeCloseTo(r.cost[3], 6)
    }
  })
})

/** Every way from `from` to `to` that passes no cell twice, as door steps. */
function allPaths(space: Space, from: number, to: number, limit = 40000) {
  const out: { door: number; into: number }[][] = []
  const seen = new Set<number>([from])
  const walk = (cell: number, steps: { door: number; into: number }[]) => {
    if (out.length > limit) return
    if (cell === to) {
      out.push([...steps])
      return
    }
    for (const d of space.cells[cell]?.doors ?? []) {
      if (seen.has(d.to)) continue
      seen.add(d.to)
      steps.push({ door: d.door, into: d.to })
      walk(d.to, steps)
      steps.pop()
      seen.delete(d.to)
    }
  }
  walk(from, [])
  return out
}

describe('the cheapest route', () => {
  it('is no dearer than any other way through the doors, for a line alone', () => {
    const { network, structure } = networkOf(yaml, ['top'])
    const { problem, geometry } = layoutParts(network, structure, testMetrics)
    const { plans } = assignPorts(problem, geometry)
    const space = buildSpace(problem, geometry)
    const line = problem.lines.find((l) => l.role === 'oriented')
    expect(line).toBeDefined()
    if (!line) return
    // route that one line only, by leaving the others out of the problem
    const alone: Problem = { ...problem, lines: [line] }
    const got = routeGlobal(alone, geometry, plans, space, false).routes.get(line.id)
    expect(got).toBeDefined()
    if (!got) return
    const allowed = allowedFrames(problem, line)
    const best = costOf(space, got, allowed)
    for (const steps of allPaths(space, got.from.cell, got.to.cell)) {
      const c = costOf(space, { steps, from: got.from, to: got.to }, allowed)
      const worse =
        c[0] > best[0] ||
        (c[0] === best[0] && (c[2] > best[2] || (c[2] === best[2] && c[3] >= best[3] - 1e-6)))
      expect(worse).toBe(true)
    }
  })
})

describe('routing in the root alone', () => {
  it('allows the root frame', () => {
    const { problem } = run()
    for (const l of problem.lines) expect(allowedFrames(problem, l).has(ROOT)).toBe(true)
  })
})
