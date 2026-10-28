// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { chooseStacks, type StackOrder } from './aspect.js'
import { solveHorizontal } from './horizontal.js'
import { estimateCrossings, orderSiblings } from './order.js'
import type { Problem } from './problem.js'
import { problemOf, testMetrics } from './testing.js'
import { solveVertical } from './vertical.js'

// Three sites under one head: stacked they are one tall column, cut they are one wide row.
const yaml = `
groups: [{ id: ga }, { id: gb }, { id: gc }, { id: gd }]
nodes:
  - { id: top, group: ga }
  - { id: b1, group: gb }
  - { id: b2, group: gb }
  - { id: c1, group: gc }
  - { id: c2, group: gc }
  - { id: d1, group: gd }
links:
  - { endpoints: [{ node: top }, { node: b1 }] }
  - { endpoints: [{ node: b1 }, { node: b2 }] }
  - { endpoints: [{ node: b1 }, { node: c1 }] }
  - { endpoints: [{ node: c1 }, { node: c2 }] }
  - { endpoints: [{ node: c1 }, { node: d1 }] }
`

const shapeOf = (p: Problem) => {
  const y = solveVertical(p)
  const g = solveHorizontal(p, y, orderSiblings(p, y))
  const boxes = p.items.flatMap((i) => g.boxes.get(i.id) ?? [])
  const w = Math.max(...boxes.map((b) => b.x + b.width)) - Math.min(...boxes.map((b) => b.x))
  const h = Math.max(...boxes.map((b) => b.y + b.height)) - Math.min(...boxes.map((b) => b.y))
  return { w, h, crossings: estimateCrossings(p, g) }
}

const withAspect = (aspect: number): Problem => {
  const p = problemOf(yaml, ['top'])
  return { ...p, metrics: { ...testMetrics, aspect } }
}

describe('chooseStacks', () => {
  const orders: StackOrder[] = ['aspect-first', 'fill-first']

  it('cuts the stack when the drawing is too tall for its target', () => {
    const tall = withAspect(8)
    const before = shapeOf(tall)
    const chosen = chooseStacks(tall, 'aspect-first')
    expect(Object.values(chosen.stack)).toContain(false)
    const after = shapeOf(chosen)
    const gap = (s: { w: number; h: number }) => Math.abs(Math.log(s.w / s.h) - Math.log(8))
    expect(gap(after)).toBeLessThan(gap(before))
  })

  it('leaves everything stacked when the drawing is already wider than its target', () => {
    const chosen = chooseStacks(withAspect(0.01), 'aspect-first')
    expect(Object.values(chosen.stack)).not.toContain(false)
  })

  it('never takes a way that crosses more than the way it started from', () => {
    for (const how of orders) {
      const p = withAspect(8)
      expect(shapeOf(chooseStacks(p, how)).crossings).toBeLessThanOrEqual(shapeOf(p).crossings)
    }
  })

  it('gives the same choice for the same problem, whichever order of scoring', () => {
    for (const how of orders) {
      expect(chooseStacks(withAspect(8), how)).toEqual(chooseStacks(withAspect(8), how))
    }
  })
})
