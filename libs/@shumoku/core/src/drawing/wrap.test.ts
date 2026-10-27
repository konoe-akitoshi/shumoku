// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { placeCoords } from './coords.js'
import type { Element, Elements } from './elements.js'
import type { Metrics } from './metrics.js'
import { orderElements } from './order.js'
import { cutRows, wrapLayers } from './wrap.js'

const metrics: Metrics = {
  card: () => ({ width: 10, height: 6 }),
  bus: () => ({ width: 8, height: 2 }),
  cloud: () => ({ width: 8, height: 4 }),
  group: () => ({ top: 3, right: 1, bottom: 1, left: 1 }),
  gap: 2,
  memberGap: 1,
  groupGap: 3,
  hullPad: 1,
  pitch: 0.5,
  leadOut: 1,
  aspect: 16 / 9,
}

const block = (id: string): Element => ({
  id,
  kind: 'block',
  members: [],
  size: { width: 10, height: 6 },
  parts: [],
})

const level = (ids: string[], pairs: [string, string][] = []): Elements => ({
  elements: ids.map(block),
  lines: pairs.map(([a, b], index) => ({
    index,
    ends: [{ element: a }, { element: b }] as const,
    virtual: false,
  })),
  inner: [],
  groups: [],
})

describe('wrapping a layer', () => {
  it('cuts a layer of equal blocks into about the columns the target shape asks for', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `b${i}`)
    const elements = level(ids)
    const rank = new Map(ids.map((id) => [id, 0] as const))
    const wrapped = wrapLayers(elements, orderElements(elements, rank), metrics)
    expect(wrapped).toBeDefined()
    const rows = new Map<number, number>()
    for (const r of wrapped?.rank.values() ?? []) rows.set(r, (rows.get(r) ?? 0) + 1)
    // c = sqrt(n * aspect * (h + between) / (w + gap)) = sqrt(12 * 16/9 * 8.5 / 12) = 3.9
    const columns = Math.max(...rows.values())
    expect(columns).toBe(4)
    expect(rows.size).toBe(3)
  })

  it('leaves a level that is already as near the target as one more row would get it', () => {
    const elements = level(['a', 'b'])
    const rank = new Map([
      ['a', 0],
      ['b', 0],
    ])
    expect(wrapLayers(elements, orderElements(elements, rank), metrics)).toBeUndefined()
  })

  it('cuts runs with the widest as narrow as it can be, then as even as it can be', () => {
    const items = [4, 1, 1, 4].map((width, i) => ({ id: `i${i}`, width, height: 1 }))
    const runs = cutRows(items, 2, 0)
    expect(runs.map((r) => r.map((m) => m.id))).toEqual([
      ['i0', 'i1'],
      ['i2', 'i3'],
    ])
  })

  it('keeps a directed line running from a nearer layer to a farther one', () => {
    const tops = Array.from({ length: 9 }, (_, i) => `t${i}`)
    const elements = level(
      ['r', ...tops, 'c'],
      [
        ...tops.map((t): [string, string] => ['r', t]),
        ...tops.map((t): [string, string] => [t, 'c']),
      ],
    )
    const rank = new Map<string, number>([['r', 0], ...tops.map((t) => [t, 1] as const), ['c', 2]])
    const first = orderElements(elements, rank)
    const wrapped = wrapLayers(elements, first, metrics)
    expect(wrapped).toBeDefined()
    const wrappedRank = wrapped?.rank ?? new Map<string, number>()
    const placed = placeCoords(
      elements,
      orderElements(elements, wrappedRank, { seed: wrapped?.seed }),
      metrics,
    )
    for (const t of tops) {
      expect(wrappedRank.get('r') ?? 0).toBeLessThan(wrappedRank.get(t) ?? 0)
      expect(wrappedRank.get(t) ?? 0).toBeLessThan(wrappedRank.get('c') ?? 0)
      expect(placed.y.get('r') ?? 0).toBeLessThan(placed.y.get(t) ?? 0)
      expect(placed.y.get(t) ?? 0).toBeLessThan(placed.y.get('c') ?? 0)
    }
  })
})
