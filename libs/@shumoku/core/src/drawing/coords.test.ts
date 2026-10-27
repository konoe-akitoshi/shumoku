// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { placeCoords } from './coords.js'
import type { Element, Elements } from './elements.js'
import type { Metrics } from './metrics.js'
import type { Ordered, Slot } from './order.js'

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
const gap = 2 * metrics.leadOut + metrics.pitch

const element = (id: string, height: number): Element => ({
  id,
  kind: 'card',
  members: [],
  size: { width: 10, height },
  parts: [],
})
const slot = (id: string, layer: number): Slot => ({ id, kind: 'element', layer, element: id })

/** A tall and a short element side by side, each with one below it. */
const elements: Elements = {
  elements: [
    element('tall', 20),
    element('short', 2),
    element('under-tall', 2),
    element('under-short', 2),
  ],
  lines: [],
  inner: [],
  groups: [],
}
const ordered: Ordered = {
  ranks: [0, 1],
  layers: [
    [slot('short', 0), slot('tall', 0)],
    [slot('under-short', 1), slot('under-tall', 1)],
  ],
  paths: [
    ['short', 'under-short'],
    ['tall', 'under-tall'],
  ],
  crossings: 0,
}

describe('coordinates down the page', () => {
  const placed = placeCoords(elements, ordered, metrics)
  const top = (id: string, height: number) => (placed.y.get(id) ?? 0) - height / 2
  const bottom = (id: string, height: number) => (placed.y.get(id) ?? 0) + height / 2

  it('does not hold what stands beside a tall element below the tall one', () => {
    expect(top('under-short', 2)).toBeCloseTo(bottom('short', 2) + gap, 6)
    expect(top('under-short', 2)).toBeLessThan(bottom('tall', 20))
  })

  it('keeps an element below the one it is joined to, and below what it stands under', () => {
    expect(top('under-tall', 2)).toBeCloseTo(bottom('tall', 20) + gap, 6)
  })

  it('steps a line through the layers between its ends one gap at a time', () => {
    // a line that spans a layer has a point in it, which is as high as the end above allows
    // and the end below it starts under that point
    const withDummy = placeCoords(
      { ...elements, elements: [element('a', 6), element('b', 6)] },
      {
        ranks: [0, 1, 2],
        layers: [
          [slot('a', 0)],
          [{ id: '~line.0@1', kind: 'dummy', layer: 1, line: 0 }],
          [slot('b', 2)],
        ],
        paths: [['a', '~line.0@1', 'b']],
        crossings: 0,
      },
      metrics,
    )
    const a = withDummy.y.get('a') ?? 0
    const dummy = withDummy.y.get('~line.0@1') ?? 0
    const b = withDummy.y.get('b') ?? 0
    expect(dummy).toBeCloseTo(a + 3 + gap, 6)
    expect(b - 3).toBeCloseTo(dummy + gap, 6)
  })
})
