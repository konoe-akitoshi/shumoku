// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { placeCoords } from './coords.js'
import type { Element, Elements } from './elements.js'
import type { Metrics } from './metrics.js'
import { type Ordered, orderElements } from './order.js'
import { cutRows, type Place, wrapLayers } from './wrap.js'

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

/** The size the level comes out as when it is placed, as `compound.ts` measures it. */
const placer =
  (elements: Elements, first: Ordered): Place =>
  (wrapped) => {
    const ordered =
      wrapped === undefined ? first : orderElements(elements, wrapped.rank, { seed: wrapped.seed })
    const placed = placeCoords(elements, ordered, metrics)
    const boxes = elements.elements.map((e) => {
      const x = placed.x.get(e.id) ?? 0
      const y = placed.y.get(e.id) ?? 0
      return { x: x - e.size.width / 2, y: y - e.size.height / 2, ...e.size }
    })
    const left = Math.min(...boxes.map((b) => b.x))
    const top = Math.min(...boxes.map((b) => b.y))
    return {
      width: Math.max(...boxes.map((b) => b.x + b.width)) - left,
      height: Math.max(...boxes.map((b) => b.y + b.height)) - top,
    }
  }

describe('wrapping a layer', () => {
  it('cuts a layer of equal blocks into about the columns the target shape asks for', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `b${i}`)
    const elements = level(ids)
    const rank = new Map(ids.map((id) => [id, 0] as const))
    const first = orderElements(elements, rank)
    const wrapped = wrapLayers(elements, first, metrics, placer(elements, first))
    expect(wrapped).toBeDefined()
    const rows = new Map<number, number>()
    for (const r of wrapped?.rank.values() ?? []) rows.set(r, (rows.get(r) ?? 0) + 1)
    // The placed size decides: whatever the rows, the level ends nearer the target than the
    // one row it started as.
    const place = placer(elements, first)
    const off = (size: { width: number; height: number }) =>
      Math.abs(Math.log(size.width / size.height) - Math.log(metrics.aspect))
    expect(rows.size).toBeGreaterThan(1)
    expect(off(place(wrapped))).toBeLessThan(off(place()))
  })

  it('decides from the size the placer reports, not from the layers it is given', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `b${i}`)
    const elements = level(ids)
    const first = orderElements(elements, new Map(ids.map((id) => [id, 0] as const)))
    // A placer for which a second row only makes the level a tall sliver: the first row is kept.
    const worse: Place = (wrapped) =>
      wrapped === undefined ? { width: 16, height: 9 } : { width: 1, height: 100 }
    expect(wrapLayers(elements, first, metrics, worse)).toBeUndefined()
    // And one for which any row brings the level to the target.
    const better: Place = (wrapped) =>
      wrapped === undefined ? { width: 1000, height: 9 } : { width: 16, height: 9 }
    expect(wrapLayers(elements, first, metrics, better)).toBeDefined()
  })

  it('leaves a level that is already as near the target as one more row would get it', () => {
    const elements = level(['a', 'b'])
    const rank = new Map([
      ['a', 0],
      ['b', 0],
    ])
    const first = orderElements(elements, rank)
    expect(wrapLayers(elements, first, metrics, placer(elements, first))).toBeUndefined()
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
    const wrapped = wrapLayers(elements, first, metrics, placer(elements, first))
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
