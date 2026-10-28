// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { crossings, laneOrder, type Path } from './crossing.js'
import type { Point } from './metrics.js'

const path = (...pts: [number, number][]): Path => pts.map(([x, y]): Point => ({ x, y }))

// One long line along y = 10, and shorter ones that join it from above and leave it.
const through = path([0, 0], [0, 10], [20, 10], [20, 0])
const sameSide = path([5, 0], [5, 10], [15, 10], [15, 0])
const otherSide = path([5, 0], [5, 10], [15, 10], [15, 20])

describe('crossings', () => {
  it('counts one where one line goes straight across another', () => {
    expect(crossings(path([0, 5], [10, 5]), path([5, 0], [5, 10]))).toBe(1)
    expect(crossings(path([0, 5], [10, 5]), path([15, 0], [15, 10]))).toBe(0)
  })

  it('counts none where two lines share a stretch and come in and leave on the same side', () => {
    expect(crossings(through, sameSide)).toBe(0)
  })

  it('counts one where they come in on one side and leave on the other', () => {
    expect(crossings(through, otherSide)).toBe(1)
  })

  it('does not tell the lines apart', () => {
    for (const [a, b] of [
      [through, sameSide],
      [through, otherSide],
      [sameSide, otherSide],
    ] as const) {
      expect(crossings(a, b)).toBe(crossings(b, a))
    }
  })

  it('follows a shared stretch round a corner to where the lines part, and counts the run once', () => {
    // Both run east along y = 10 and then south along x = 15, and part at y = 30: `east` goes
    // on east and `west` turns back west, which is the outside of the turn for `east`.
    const east = path([5, 0], [5, 10], [15, 10], [15, 30], [25, 30])
    const west = path([5, 20], [5, 10], [15, 10], [15, 30], [5, 30])
    expect(crossings(east, west)).toBe(0)
    // Had `east` come in from the inside lane instead, the two would have to change places.
    const inside = path([5, 20], [5, 10], [15, 10], [15, 30], [25, 30])
    const outside = path([5, 0], [5, 10], [15, 10], [15, 30], [5, 30])
    expect(crossings(inside, outside)).toBe(1)
  })
})

describe('laneOrder', () => {
  const lines = ['a', 'b', 'c', 'd', 'e']
  // Costs from a fixed rule, not the order the lines are given in.
  const cost = (x: string, y: string) => (x.charCodeAt(0) * 7 + y.charCodeAt(0) * 3) % 5
  const permutations = <T>(xs: T[]): T[][] =>
    xs.length <= 1
      ? [xs]
      : xs.flatMap((x, i) =>
          permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((r) => [x, ...r]),
        )
  const total = (order: string[]) =>
    order.reduce((sum, a, i) => sum + order.slice(i + 1).reduce((s, b) => s + cost(a, b), 0), 0)

  it('finds an order no other beats, when there are eight lines or fewer', () => {
    const { order, exact } = laneOrder(lines, cost)
    expect(exact).toBe(true)
    expect(total(order)).toBe(Math.min(...permutations(lines).map(total)))
  })

  it('keeps the order given when every order costs the same', () => {
    expect(laneOrder(['x', 'y', 'z'], () => 0).order).toEqual(['x', 'y', 'z'])
  })

  it('puts in every line, and says so when it only approximates', () => {
    const many = Array.from({ length: 9 }, (_, i) => `l${i}`)
    const { order, exact } = laneOrder(many, (a, b) => (a < b ? 0 : 1))
    expect(exact).toBe(false)
    expect([...order].sort()).toEqual(many)
    expect(total(order)).toBeGreaterThanOrEqual(0)
  })
})
