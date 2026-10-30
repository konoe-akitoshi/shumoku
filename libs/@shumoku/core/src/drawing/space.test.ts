// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { layoutParts } from './layout.js'
import type { Box } from './metrics.js'
import { frameKey, type Geometry, type Problem, ROOT } from './problem.js'
import { buildSpace, lanes, type Space } from './space.js'
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
  const content = space.cells.filter((c) => c.band === undefined)
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
      if (c.band !== undefined) continue
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

  it('puts a band on the top and the bottom as wide as the drawing, joined along all of it', () => {
    for (const side of ['top', 'bottom'] as const) {
      const id = space.bands[side]
      expect(id).toBeDefined()
      const band = id === undefined ? undefined : space.cells[id]
      expect(band && band.x1 - band.x0).toBeCloseTo(space.bounds.width, 6)
      const entry = (band?.doors ?? []).reduce((sum, d) => {
        const door = space.doors[d.door]
        return sum + (door ? door.hi - door.lo : 0)
      }, 0)
      expect(entry).toBeCloseTo(space.bounds.width, 6)
      // and does not overlap the cells inside
      for (const c of space.cells) {
        if (c.band !== undefined || !band) continue
        expect(overlapArea(boxOf(band), boxOf(c))).toBeLessThan(1e-6)
      }
    }
  })

  it('makes a band only when asked', () => {
    const none = buildSpace(problem, geometry, [])
    expect(none.bands).toEqual({})
    expect(none.cells.every((c) => c.band === undefined)).toBe(true)
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
    const { pitch } = testMetrics
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
    expect(space.cells.filter((c) => c.band === undefined).length).toBeLessThanOrEqual(1)
  })
})

describe('what a door can hold', () => {
  it('counts the lines side by side a pitch from each end and from each other', () => {
    const { pitch } = testMetrics
    const space = stub({
      a: { x: 0, y: 0, width: 100, height: 40 },
      b: { x: 200, y: 0, width: 100, height: 40 },
    })
    for (const d of space.doors) {
      const length = d.hi - d.lo
      expect(d.capacity).toBe(lanes(length, pitch, testMetrics.leadOut))
    }
  })
})
