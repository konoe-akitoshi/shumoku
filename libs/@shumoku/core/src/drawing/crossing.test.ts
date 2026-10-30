// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { laneOrder } from './crossing.js'

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
