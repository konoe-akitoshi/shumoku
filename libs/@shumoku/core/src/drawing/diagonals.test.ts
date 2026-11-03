// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { diagonalsOf } from './diagonals.js'
import { cornerOf, labelBandOf, pitchOf, whiteOf } from './kin.js'
import type { Point } from './metrics.js'
import { frameKey } from './problem.js'
import { shapeWires } from './shape.js'
import { problemOf } from './testing/support.js'
import { quarterLegOf, sampled, tangentOf } from './turns.js'

const yaml = `
nodes:
  - { id: a }
  - { id: b }
  - { id: c }
  - { id: d }
links:
  - { endpoints: [{ node: a }, { node: b }] }
  - { endpoints: [{ node: c }, { node: d }] }
`

describe('diagonals', () => {
  const base = problemOf(yaml, [])
  const problem = { ...base, metrics: { ...base.metrics, leadOut: 40 } }
  const [one, two] = problem.lines
  if (!one || !two) throw new Error('two lines')
  const geometry = { boxes: new Map() }
  const R = cornerOf(problem.metrics, one)
  const band = labelBandOf(problem.metrics)

  const run = (wires: Map<string, Point[]>, boxes = geometry.boxes) => {
    const turns = diagonalsOf(problem, { boxes }, wires, [])
    return { turns, shaped: shapeWires(problem, { boxes }, wires, turns) }
  }
  const drawnOf = (shaped: ReturnType<typeof run>['shaped'], id: string) => {
    const w = shaped.wires.get(id)
    return w ? sampled(w.points, w.radii) : []
  }
  const minDist = (p: Point[], q: Point[]) => {
    let best = Number.POSITIVE_INFINITY
    for (const a of p) for (const b of q) best = Math.min(best, Math.hypot(a.x - b.x, a.y - b.y))
    return best
  }

  it('cuts a free corner across as far as its runs let it, and leaves the port straight first', () => {
    const { turns, shaped } = run(
      new Map([
        [
          one.id,
          [
            { x: 400, y: 0 },
            { x: 400, y: 300 },
            { x: 0, y: 300 },
          ],
        ],
      ]),
    )
    const t = turns.get(one.id)?.[0]
    // the shorter run, less the band and the rounding the port's straight keeps
    expect(t?.leg).toBeCloseTo(300 - band - tangentOf(R), 0)
    expect(t?.rho).toBe(R)
    const w = shaped.wires.get(one.id)
    expect(w?.points[1]?.y).toBeCloseTo(band + tangentOf(R), 0)
  })

  it('keeps the pitch off a line inside the corner, and moves no crossing onto the 45° straight', () => {
    const pitch = pitchOf(problem.metrics, one, two)
    const { turns, shaped } = run(
      new Map([
        [
          one.id,
          [
            { x: 400, y: 0 },
            { x: 400, y: 300 },
            { x: 0, y: 300 },
          ],
        ],
        // a vertical line crossing the horizontal run 120 from the vertex
        [
          two.id,
          [
            { x: 280, y: 100 },
            { x: 280, y: 500 },
          ],
        ],
      ]),
    )
    const t = turns.get(one.id)?.[0]
    expect(t?.leg).toBeGreaterThan(quarterLegOf(R))
    // the rounding ends a pitch before the crossing
    expect((t?.leg ?? 0) + tangentOf(R)).toBeLessThanOrEqual(120 - pitch + 1)
    const a = drawnOf(shaped, one.id)
    const b = drawnOf(shaped, two.id)
    // apart from the crossing itself, the drawn lines keep the pitch
    const off = a.filter((p) => Math.abs(p.y - 300) > 1e-6)
    expect(minDist(off, b)).toBeGreaterThanOrEqual(pitch - 1)
  })

  it('crosses a step with one 45° straight where its runs hold it', () => {
    const { turns, shaped } = run(
      new Map([
        [
          one.id,
          [
            { x: 400, y: 0 },
            { x: 400, y: 300 },
            { x: 200, y: 300 },
            { x: 200, y: 700 },
          ],
        ],
      ]),
    )
    const [first, second] = turns.get(one.id) ?? []
    expect(first?.through).toBe(true)
    expect((first?.leg ?? 0) + (second?.leg ?? 0)).toBeCloseTo(200)
    // two bends of 45° in place of two right angles and the step
    expect(shaped.wires.get(one.id)?.points).toHaveLength(4)
  })

  it('finds the split of a step whose 45° straight is clear, nearest the middle', () => {
    // a card on the 45° straight through the middle (and cut off by the lowest), one on the highest
    const wire = new Map([
      [
        one.id,
        [
          { x: 0, y: 0 },
          { x: 0, y: 300 },
          { x: 200, y: 300 },
          { x: 200, y: 600 },
        ],
      ],
    ])
    const cards = new Map([
      ['low', { x: 60, y: 340, width: 80, height: 40 }],
      ['high', { x: 120, y: 160, width: 60, height: 60 }],
    ])
    const { turns, shaped } = run(wire, cards)
    const [first, second] = turns.get(one.id) ?? []
    expect(first?.through).toBe(true)
    expect((first?.leg ?? 0) + (second?.leg ?? 0)).toBeCloseTo(200)
    // past the middle, by no more than the card's white and a pitch
    const white = whiteOf(problem.metrics)
    expect(first?.leg).toBeGreaterThan(100)
    expect(first?.leg).toBeLessThan(
      100 + Math.SQRT2 * (R + white) + pitchOf(problem.metrics, one, one),
    )
    const drawn = drawnOf(shaped, one.id)
    for (const box of cards.values()) {
      const gap = Math.min(
        ...drawn.map((p) =>
          Math.hypot(
            Math.max(box.x - p.x, 0, p.x - box.x - box.width),
            Math.max(box.y - p.y, 0, p.y - box.y - box.height),
          ),
        ),
      )
      expect(gap).toBeGreaterThanOrEqual(white - 1)
    }
  })

  it('crosses the steps of a nest together, the 45° straights a pitch apart', () => {
    const d = pitchOf(problem.metrics, one, two)
    const { turns, shaped } = run(
      new Map([
        [
          one.id,
          [
            { x: 0, y: 0 },
            { x: 0, y: 300 },
            { x: 138, y: 300 },
            { x: 138, y: 388 },
          ],
        ],
        [
          two.id,
          [
            { x: -d, y: 0 },
            { x: -d, y: 300 + d },
            { x: 138 - d, y: 300 + d },
            { x: 138 - d, y: 388 },
          ],
        ],
      ]),
    )
    expect(turns.get(one.id)?.[0]?.through).toBe(true)
    expect(turns.get(two.id)?.[0]?.through).toBe(true)
    expect(minDist(drawnOf(shaped, one.id), drawnOf(shaped, two.id))).toBeGreaterThanOrEqual(
      d - 0.5,
    )
  })

  it('keeps the white off a card inside the corner', () => {
    const wire = new Map([
      [
        one.id,
        [
          { x: 400, y: 0 },
          { x: 400, y: 300 },
          { x: 0, y: 300 },
        ],
      ],
    ])
    const card = new Map([['c', { x: 200, y: 100, width: 100, height: 100 }]])
    const withCard = run(wire, card)
    const legCard = withCard.turns.get(one.id)?.[0]?.leg ?? 0
    const box = { x: 200, y: 100, width: 100, height: 100 }
    const gap = Math.min(
      ...drawnOf(withCard.shaped, one.id).map((p) =>
        Math.hypot(
          Math.max(box.x - p.x, 0, p.x - box.x - box.width),
          Math.max(box.y - p.y, 0, p.y - box.y - box.height),
        ),
      ),
    )
    expect(gap).toBeGreaterThanOrEqual(R - 1)
    expect(legCard).toBeLessThan(300 - band - tangentOf(R) - 1)
  })

  it('crosses a frame edge at 45° where it crossed it, a white off the corner and straight across it', () => {
    const frame = problem.frames[0]
    if (!frame) throw new Error('a frame')
    const white = whiteOf(problem.metrics)
    /** Where a drawn line crosses the edges of the frame (300, 200)-(700, 600). */
    const crossings = (pts: Point[]) => {
      const top: number[] = []
      const left: number[] = []
      for (const [k, a] of pts.entries()) {
        const b = pts[k + 1]
        if (!b) continue
        if ((a.y - 200) * (b.y - 200) < 0) top.push(a.x + ((200 - a.y) * (b.x - a.x)) / (b.y - a.y))
        if ((a.x - 300) * (b.x - 300) < 0)
          left.push(a.y + ((300 - a.x) * (b.y - a.y)) / (b.x - a.x))
      }
      return { top: top.filter((x) => x > 300), left: left.filter((y) => y > 200) }
    }
    const boxes = new Map([[frameKey(frame.id), { x: 300, y: 200, width: 400, height: 400 }]])
    // the vertical run enters by the top edge 100 above the vertex, the other leaves by the left
    const framed = run(
      new Map([
        [
          one.id,
          [
            { x: 400, y: 0 },
            { x: 400, y: 300 },
            { x: 0, y: 300 },
          ],
        ],
      ]),
      boxes,
    )
    const legFrame = framed.turns.get(one.id)?.[0]?.leg ?? 0
    expect(legFrame + tangentOf(R)).toBeGreaterThan(100)
    const drawn = drawnOf(framed.shaped, one.id)
    const at = crossings(drawn)
    expect(at.top).toHaveLength(1)
    expect(at.left).toHaveLength(1)
    // the 45° straight passes the frame's corner a white off
    const corner = Math.min(
      ...drawn.map((p) => Math.hypot(p.x - 300, p.y - 200)),
      Math.abs((at.top[0] ?? 0) - 300 + (at.left[0] ?? 0) - 200) / Math.SQRT2,
    )
    expect(corner).toBeGreaterThanOrEqual(white - 1)
    // a corner that would carry the line past the frame's corner keeps it entering and leaving
    const tight = run(
      new Map([
        [
          one.id,
          [
            { x: 320, y: 0 },
            { x: 320, y: 220 },
            { x: 0, y: 220 },
          ],
        ],
      ]),
      boxes,
    )
    const near = crossings(drawnOf(tight.shaped, one.id))
    expect(near.top).toHaveLength(1)
    expect(near.left).toHaveLength(1)
  })
})
