// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { placeAll } from './geometry.js'
import { layoutParts, type Parts } from './layout.js'
import { heldLevels } from './level.js'
import { needsOf } from './needs.js'
import { networkOf, testMetrics } from './testing/support.js'
import { tracksOf } from './tracks.js'

/**
 * Two switches of one type level with each other, `f` left of `l`, joined by four lines. `l` also has a line to
 * each of four peers further left (`p0`..`p3`), which leave `l` by its left side above the four,
 * climb over `f` and come down to them. So `l`'s ends of the four stand lower on it than `f`'s do
 * on `f`, and the middles of the two cannot stand level while the four run straight across.
 */
const yaml = `
nodes:
  - { id: r, type: router }
  - { id: f, type: l2-switch }
  - { id: l, type: l2-switch }
  - { id: p0, type: l2-switch }
  - { id: p1, type: l2-switch }
  - { id: p2, type: l2-switch }
  - { id: p3, type: l2-switch }
links:
  - { endpoints: [{ node: r, port: a0 }, { node: l, port: up }] }
  - { endpoints: [{ node: r, port: b0 }, { node: p0, port: up }] }
  - { endpoints: [{ node: r, port: b1 }, { node: p1, port: up }] }
  - { endpoints: [{ node: r, port: b2 }, { node: p2, port: up }] }
  - { endpoints: [{ node: r, port: b3 }, { node: p3, port: up }] }
  - { endpoints: [{ node: r, port: c0 }, { node: f, port: up }] }
  - { endpoints: [{ node: l, port: e0 }, { node: p0, port: x }] }
  - { endpoints: [{ node: l, port: e1 }, { node: p1, port: x }] }
  - { endpoints: [{ node: l, port: e2 }, { node: p2, port: x }] }
  - { endpoints: [{ node: l, port: e3 }, { node: p3, port: x }] }
  - { endpoints: [{ node: f, port: s0 }, { node: l, port: t0 }] }
  - { endpoints: [{ node: f, port: s1 }, { node: l, port: t1 }] }
  - { endpoints: [{ node: f, port: s2 }, { node: l, port: t2 }] }
  - { endpoints: [{ node: f, port: s3 }, { node: l, port: t3 }] }
`

function parts(): Parts {
  const { network, structure } = networkOf(yaml, ['r'])
  return layoutParts(network, structure, testMetrics, {
    hints: { siblings: { '': ['p0', 'p1', 'p2', 'p3', 'f', 'l'] } },
  })
}

const between = (p: Parts, a: string, b: string): string[] =>
  p.problem.lines
    .filter((l) => [l.a.item, l.b.item].sort().join() === [a, b].sort().join())
    .map((l) => l.id)

/** The crossings drawn that no stage counted, summed over the gaps. */
const uncounted = (table: Parts['placed']['table']): number =>
  table.reduce((sum, r) => sum + Math.max(0, r.drawn - r.lanes), 0)

/** Pairs of the given wires with a horizontal run at one height over a common stretch. */
function runsOnEachOther(wires: ReadonlyMap<string, readonly { x: number; y: number }[]>) {
  const runs = [...wires].flatMap(([id, pts]) =>
    pts.slice(1).flatMap((b, i) => {
      const a = pts[i]
      return a && Math.abs(a.y - b.y) < 1e-6
        ? [{ id, y: a.y, lo: Math.min(a.x, b.x), hi: Math.max(a.x, b.x) }]
        : []
    }),
  )
  return runs.flatMap((s, i) =>
    runs
      .slice(i + 1)
      .filter(
        (t) =>
          t.id !== s.id &&
          Math.abs(s.y - t.y) < testMetrics.gapApart &&
          Math.min(s.hi, t.hi) - Math.max(s.lo, t.lo) > testMetrics.gapApart,
      )
      .map((t) => [s.id, t.id]),
  )
}

describe('lines between two boxes side by side', () => {
  it('stay straight where their ports keep the middles of the boxes from standing level', () => {
    const p = parts()
    const four = between(p, 'f', 'l')
    expect(four).toHaveLength(4)
    for (const id of four) expect(p.tracks.across.has(id)).toBe(true)
    expect(uncounted(p.placed.table)).toBe(0)
  })

  it('when bent, turn in an order that crosses nothing and runs on nothing', () => {
    const p = parts()
    const four = between(p, 'f', 'l')
    // bend them as the drawing did before the boxes were let go of their middles
    const tracks = tracksOf(p.problem, p.layers, p.corridors, p.routes, { bent: new Set(four) })
    const placed = placeAll(needsOf(p.problem, tracks), p.ranks, p.layers, p.corridors, tracks)
    const [bundle, ...others] = [...tracks.bundles.values()]
    expect(others).toHaveLength(0)
    expect(bundle?.lines.map((l) => l.line).sort()).toEqual([...four].sort())
    // `l`'s ends stand lower, so the lowest turns first
    expect(bundle?.falling).toBe(true)
    expect(uncounted(placed.table)).toBe(0)
    expect(runsOnEachOther(new Map(four.map((id) => [id, placed.wires.get(id) ?? []])))).toEqual([])
  })
})

describe('heldLevels', () => {
  const level = [
    { a: 'a', b: 'b' },
    { a: 'a', b: 'c' },
    { a: 'b', b: 'c' },
    { a: 'x', b: 'y' },
  ]

  it('keeps every level of a class that is not let go', () => {
    expect(heldLevels(level, [['b', 'c']], new Set())).toEqual(level)
  })

  it('joins the middles of a class let go only where no straight line holds them level', () => {
    // b and c are held by their line; a is joined to them once, and x-y is another class
    expect(heldLevels(level, [['b', 'c']], new Set(['a']))).toEqual([
      { a: 'a', b: 'b' },
      { a: 'x', b: 'y' },
    ])
  })
})
