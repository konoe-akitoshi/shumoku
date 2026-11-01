// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { clearance } from './kin.js'
import { layoutParts } from './layout.js'
import type { Box } from './metrics.js'
import { frameKey, type Geometry, type Problem, ROOT } from './problem.js'
import { buildSpace, type Space } from './space.js'
import { networkOf, testMetrics } from './testing.js'

const overlapArea = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))

const boxOf = (c: { x0: number; y0: number; x1: number; y1: number }): Box => ({
  x: c.x0,
  y: c.y0,
  width: c.x1 - c.x0,
  height: c.y1 - c.y0,
})

/** The area covered by the union of boxes, by compressing the coordinates. */
function unionArea(boxes: readonly Box[]): number {
  const xs = [...new Set(boxes.flatMap((b) => [b.x, b.x + b.width]))].sort((p, q) => p - q)
  const ys = [...new Set(boxes.flatMap((b) => [b.y, b.y + b.height]))].sort((p, q) => p - q)
  let sum = 0
  for (const [i, x] of xs.entries()) {
    const nx = xs[i + 1]
    if (nx === undefined) continue
    for (const [j, y] of ys.entries()) {
      const ny = ys[j + 1]
      if (ny === undefined) continue
      const covered = boxes.some(
        (b) => b.x <= x && nx <= b.x + b.width && b.y <= y && ny <= b.y + b.height,
      )
      if (covered) sum += (nx - x) * (ny - y)
    }
  }
  return sum
}

/** A problem that is only cards and frames at given places, which is all the space reads. */
function stub(cards: Record<string, Box>, frames: Record<string, Box> = {}) {
  const none = { top: 0, right: 0, bottom: 0, left: 0 }
  const problem = {
    metrics: testMetrics,
    frames: [
      { id: ROOT, insets: none },
      ...Object.keys(frames).map((id) => ({ id, parent: ROOT, insets: none })),
    ],
    lines: [],
    above: [],
    level: [],
    satellites: [],
    items: Object.keys(cards).map((id) => ({
      id,
      kind: 'card' as const,
      frame: ROOT,
      size: { width: 0, height: 0 },
    })),
  } as unknown as Problem
  const boxes = new Map<string, Box>(Object.entries(cards))
  for (const [id, b] of Object.entries(frames)) boxes.set(frameKey(id), b)
  const geometry: Geometry = { boxes }
  return buildSpace(problem, geometry)
}

function check(space: Space, frames: Box[] = []) {
  const content = space.cells
  // the cells and the cards fill the drawing exactly once
  const filled = content.reduce((s, c) => s + (c.x1 - c.x0) * (c.y1 - c.y0), 0)
  expect(filled + unionArea(space.obstacles)).toBeCloseTo(
    space.bounds.width * space.bounds.height,
    3,
  )
  for (const [i, a] of content.entries()) {
    for (const b of content.slice(i + 1)) {
      expect(overlapArea(boxOf(a), boxOf(b))).toBeLessThan(1e-6)
    }
    for (const o of space.obstacles) expect(overlapArea(boxOf(a), o)).toBeLessThan(1e-6)
    // no cell is partly in a frame
    for (const f of frames) {
      const part = overlapArea(boxOf(a), f)
      expect(part < 1e-6 || Math.abs(part - (a.x1 - a.x0) * (a.y1 - a.y0)) < 1e-6).toBe(true)
    }
  }
  // doors are seen the same from both sides
  for (const c of space.cells) {
    for (const d of c.doors) {
      const door = space.doors[d.door]
      expect(door).toBeDefined()
      const other = space.cells[d.to]
      expect(other?.doors.some((e) => e.door === d.door && e.to === c.id)).toBe(true)
      expect(door && door.hi - door.lo).toBeGreaterThan(0)
    }
  }
}

describe('the free space of a small drawing', () => {
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
`
  const { network, structure } = networkOf(yaml, ['top'])
  const { problem, geometry } = layoutParts(network, structure, testMetrics)
  const space = buildSpace(problem, geometry)
  const frames = problem.frames.flatMap((f) => {
    const b = geometry.boxes.get(frameKey(f.id))
    return f.id === ROOT || !b ? [] : [b]
  })

  it('fills the drawing with cells and cards and nothing else', () => check(space, frames))

  it('gives each cell the deepest frame that holds it', () => {
    for (const c of space.cells) {
      const holds = problem.frames.filter((f) => {
        const b = geometry.boxes.get(frameKey(f.id))
        return (
          f.id !== ROOT &&
          b &&
          b.x <= c.x0 + 1e-6 &&
          c.x1 <= b.x + b.width + 1e-6 &&
          b.y <= c.y0 + 1e-6 &&
          c.y1 <= b.y + b.height + 1e-6
        )
      })
      expect(c.frame).toBe(holds.at(-1)?.id ?? ROOT)
    }
    expect(space.cells.some((c) => c.frame === 'g')).toBe(true)
  })

  it('finds the cell that holds a point, and none inside a card', () => {
    for (const c of space.cells) {
      const p = { x: (c.x0 + c.x1) / 2, y: (c.y0 + c.y1) / 2 }
      expect(space.cellAt(p)).toBe(c.id)
    }
    const card = geometry.boxes.get('l')
    expect(card).toBeDefined()
    if (card) {
      const inside = { x: card.x + card.width / 2, y: card.y + card.height / 2 }
      expect(space.cellAt(inside)).toBeUndefined()
    }
  })

  it('is the same for the same input', () => {
    const again = buildSpace(problem, geometry)
    expect(again.cells.map((c) => [c.x0, c.y0, c.x1, c.y1, c.frame])).toEqual(
      space.cells.map((c) => [c.x0, c.y0, c.x1, c.y1, c.frame]),
    )
  })
})

describe('coordinates that coincide', () => {
  const card = (x: number, y: number): Box => ({ x, y, width: 100, height: 40 })
  it('cards on one row, a gap apart, a pitch apart, touching and overlapping', () => {
    const pitch = testMetrics.gapApart
    for (const gap of [30, pitch, 0, -10]) {
      check(stub({ a: card(0, 0), b: card(100 + gap, 0), c: card(0, 80) }))
    }
  })
  it('cards on one column that share their edges, and a frame on their edges', () => {
    const frame: Box = { x: 0, y: 0, width: 100, height: 120 }
    check(stub({ a: card(0, 0), b: card(0, 80) }, { g: frame }), [frame])
  })
  it('a frame beside another', () => {
    const f1: Box = { x: 0, y: 0, width: 100, height: 100 }
    const f2: Box = { x: 100, y: 0, width: 100, height: 100 }
    check(stub({ a: card(0, 0), b: card(100, 0) }, { f1, f2 }), [f1, f2])
  })
  it('no cards at all', () => {
    const space = stub({})
    expect(space.cells.length).toBeLessThanOrEqual(1)
  })
})

describe('what a door can hold', () => {
  it('lets a line cross within the door, a white in from each end, and leaves the count to the lines', () => {
    const space = stub({
      a: { x: 0, y: 0, width: 100, height: 40 },
      b: { x: 200, y: 0, width: 100, height: 40 },
    })
    for (const d of space.doors) {
      expect(d.reach[0]).toBeGreaterThanOrEqual(d.lo)
      expect(d.reach[1]).toBeLessThanOrEqual(d.hi)
      expect(d.reach[0]).toBeLessThanOrEqual(d.reach[1])
      expect(d).not.toHaveProperty('capacity')
    }
  })
})

describe('how far a line keeps from a card', () => {
  const yaml = `
nodes:
  - { id: top }
  - { id: c }
links:
  - { endpoints: [{ node: top }, { node: c }] }
`
  const { network, structure } = networkOf(yaml, ['top'])
  const { problem, geometry } = layoutParts(network, structure, testMetrics)
  const space = buildSpace(problem, geometry)
  const { gapApart: white, leadOut } = testMetrics

  it('is a lead-out less the white the card is already kept by, on a side with a port, and nothing on one without', () => {
    expect(clearance(testMetrics, true)).toBe(leadOut - white)
    expect(clearance(testMetrics, false)).toBe(0)
    // c is under top, so its only port is on its top
    const at = space.owners.indexOf('c')
    expect(space.margins[at]).toEqual({
      top: leadOut - white,
      bottom: 0,
      left: 0,
      right: 0,
    })
  })

  it('keeps the end of a door that a card bounds at the margin of that side of the card, and gives the item', () => {
    let bounded = 0
    for (const d of space.doors) {
      for (const [k, by] of d.by.entries()) {
        if (!by) continue
        bounded++
        const keep = k === 0 ? d.reach[0] - d.lo : d.hi - d.reach[1]
        const first = by[0]
        const at = first ? space.owners.indexOf(first.item) : -1
        if (at >= 0) {
          const m = space.margins[at]
          expect([m?.top, m?.bottom, m?.left, m?.right]).toContain(keep)
        }
      }
    }
    expect(bounded).toBeGreaterThan(0)
  })
})

describe('the walls that make the ends of a cell', () => {
  it('are all the cards whose edge is the end, over any part of the cell', () => {
    // two cards side by side on one row and a third lower: the cell between has the first two for
    // its top and the third for its bottom
    const space = stub({
      a: { x: 0, y: 0, width: 40, height: 20 },
      b: { x: 80, y: 0, width: 40, height: 20 },
      c: { x: 200, y: 60, width: 40, height: 20 },
    })
    const cell = space.cells.find((c) => c.y0 >= 20 && c.x0 <= 0 + 40 && c.x1 >= 120)
    expect(cell).toBeDefined()
    if (!cell) return
    const walls = space.wallsOf(cell, 'y')
    expect(walls.lo.map((w) => w.item).sort()).toEqual(['a', 'b'])
    expect(walls.hi.map((w) => w.item)).toEqual(['c'])
  })
})
