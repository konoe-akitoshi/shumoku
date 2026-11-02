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

  it('puts in every line beyond eight, and says the order is the best where it is the least', () => {
    const many = Array.from({ length: 9 }, (_, i) => `l${i}`)
    const { order, exact } = laneOrder(many, (a, b) => (a < b ? 0 : 1))
    expect(exact).toBe(true)
    expect([...order].sort()).toEqual(many)
    expect(total(order)).toBeGreaterThanOrEqual(0)
  })

  it('leaves more than eight lines where no one line moved elsewhere costs less', () => {
    const many = Array.from({ length: 12 }, (_, i) => String.fromCharCode(97 + i))
    const rule = (x: string, y: string) => (x.charCodeAt(0) * 11 + y.charCodeAt(0) * 5) % 7
    const sum = (order: string[]) =>
      order.reduce((s, a, i) => s + order.slice(i + 1).reduce((t, b) => t + rule(a, b), 0), 0)
    const { order, exact } = laneOrder(many, rule)
    expect([...order].sort()).toEqual(many)
    const now = sum(order)
    for (const line of many) {
      const rest = order.filter((x) => x !== line)
      for (const at of rest.keys()) {
        expect(sum([...rest.slice(0, at), line, ...rest.slice(at)])).toBeGreaterThanOrEqual(now)
      }
    }
    let least = 0
    for (const [i, a] of many.entries())
      for (const b of many.slice(i + 1)) least += Math.min(rule(a, b), rule(b, a))
    expect(exact).toBe(now === least)
  })

  it('says an order beyond eight lines is the best when each pair costs its least', () => {
    const many = Array.from({ length: 10 }, (_, i) => String.fromCharCode(106 - i))
    const { order, exact } = laneOrder(many, (x, y) => (x < y ? 0 : 1))
    expect(order).toEqual([...many].sort())
    expect(exact).toBe(true)
  })
})
