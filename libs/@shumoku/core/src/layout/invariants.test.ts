// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import {
  type BoxSpec,
  findCollinearOverlaps,
  findContainmentViolations,
  findNodeOverlaps,
} from './invariants.js'

const box = (id: string, x: number, y: number, width = 100, height = 26): BoxSpec => ({
  id,
  x,
  y,
  width,
  height,
})

describe('findNodeOverlaps', () => {
  it('reports overlapping boxes with penetration depth', () => {
    // centers 80 apart, widths 100 → 20px x-penetration; same row → full y-penetration
    const overlaps = findNodeOverlaps([box('a', 0, 0), box('b', 80, 0)])
    expect(overlaps).toHaveLength(1)
    const first = overlaps[0]
    expect(first?.a).toBe('a')
    expect(first?.b).toBe('b')
    expect(first?.overlapX).toBeCloseTo(20)
  })

  it('accepts touching boxes and separated rows', () => {
    expect(findNodeOverlaps([box('a', 0, 0), box('b', 100, 0)])).toHaveLength(0)
    expect(findNodeOverlaps([box('a', 0, 0), box('b', 0, 26)])).toHaveLength(0)
  })

  it('enforces a clearance margin when given', () => {
    expect(findNodeOverlaps([box('a', 0, 0), box('b', 110, 0)], 12)).toHaveLength(1)
    expect(findNodeOverlaps([box('a', 0, 0), box('b', 113, 0)], 12)).toHaveLength(0)
  })
})

describe('findContainmentViolations', () => {
  const container = {
    id: 'zone',
    bounds: { x: 0, y: 0, width: 300, height: 100 },
    memberIds: ['a', 'b'],
  }

  it('accepts members inside, flags protruding members', () => {
    // a: fully inside; b: left edge at -39 → 39px protrusion (the thunder-1 bug class)
    const violations = findContainmentViolations([box('a', 150, 50), box('b', 11, 50)], [container])
    expect(violations).toHaveLength(1)
    expect(violations[0]?.nodeId).toBe('b')
    expect(violations[0]?.protrusion).toBeCloseTo(39)
  })

  it('ignores members that are not laid out', () => {
    expect(findContainmentViolations([box('a', 150, 50)], [container])).toHaveLength(0)
  })
})

describe('findCollinearOverlaps', () => {
  const line = (id: string, pts: [number, number][], halfWidth = 1) => ({
    id,
    points: pts.map(([x, y]) => ({ x, y })),
    halfWidth,
  })

  it('flags two horizontals on the same track', () => {
    const hits = findCollinearOverlaps([
      line('a', [
        [0, 100],
        [200, 100],
      ]),
      line('b', [
        [50, 101],
        [250, 101],
      ]),
    ])
    expect(hits).toHaveLength(1)
    expect(hits[0]?.sharedLength).toBeCloseTo(150)
  })

  it('accepts parallel lines separated beyond their stroke widths', () => {
    const hits = findCollinearOverlaps([
      line(
        'a',
        [
          [0, 100],
          [200, 100],
        ],
        2,
      ),
      line(
        'b',
        [
          [50, 110],
          [250, 110],
        ],
        2,
      ),
    ])
    expect(hits).toHaveLength(0)
  })

  it('accounts for stroke half-widths: wide ribbons need wider tracks', () => {
    // 8px apart is fine for 1px strokes but a collision for 8px-half ribbons
    const thin = findCollinearOverlaps([
      line(
        'a',
        [
          [0, 100],
          [200, 100],
        ],
        1,
      ),
      line(
        'b',
        [
          [0, 108],
          [200, 108],
        ],
        1,
      ),
    ])
    expect(thin).toHaveLength(0)
    const wide = findCollinearOverlaps([
      line(
        'a',
        [
          [0, 100],
          [200, 100],
        ],
        8,
      ),
      line(
        'b',
        [
          [0, 108],
          [200, 108],
        ],
        8,
      ),
    ])
    expect(wide).toHaveLength(1)
  })

  it('ignores crossings and short shared runs', () => {
    const crossing = findCollinearOverlaps([
      line('a', [
        [0, 0],
        [100, 100],
      ]),
      line('b', [
        [0, 100],
        [100, 0],
      ]),
    ])
    expect(crossing).toHaveLength(0)
    const brief = findCollinearOverlaps([
      line('a', [
        [0, 100],
        [200, 100],
      ]),
      line('b', [
        [195, 100],
        [400, 100],
      ]),
    ])
    expect(brief).toHaveLength(0)
  })

  it('checks 45° diagonals too, not just axis-aligned segments', () => {
    const hits = findCollinearOverlaps([
      line('a', [
        [0, 0],
        [100, 100],
      ]),
      line('b', [
        [20, 21],
        [120, 121],
      ]),
    ])
    expect(hits).toHaveLength(1)
  })
})
