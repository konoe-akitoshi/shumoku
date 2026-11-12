// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { layoutDrawing } from './layout.js'
import type { Metrics, PortSideLayout } from './metrics.js'
import { extentOf, gapsOf } from './ports.js'
import { networkOf, testMetrics } from './testing/support.js'

const EPS = 1e-6

const yaml = `
nodes:
  - { id: hub }
  - { id: b1 }
  - { id: b2 }
  - { id: b3 }
  - { id: b4 }
links:
  - { endpoints: [{ node: hub, port: LongName1 }, { node: b1 }] }
  - { endpoints: [{ node: hub, port: P2 }, { node: b2 }] }
  - { endpoints: [{ node: hub, port: P3 }, { node: b3 }] }
  - { endpoints: [{ node: hub, port: LongName4 }, { node: b4 }] }
`

/** Gaps that differ pair by pair, a pair two apart, and the names shown shortened. */
const uneven: Metrics = {
  ...testMetrics,
  portSides: ({ sides }) => {
    const side = (list: readonly { name?: string }[]): PortSideLayout => ({
      labels: list.map((p) => ({
        text: p.name ? p.name.toLowerCase() : '',
        width: 0,
        height: 0,
        row: 0,
      })),
      gaps: [
        ...list.slice(1).map((_, i) => ({ from: i, to: i + 1, min: 25 + 15 * i })),
        ...list.slice(2).map((_, i) => ({ from: i, to: i + 2, min: 70 })),
      ],
      leadMargin: 17,
      trailMargin: 13,
      depth: 0,
    })
    return {
      top: side(sides.top),
      bottom: side(sides.bottom),
      left: side(sides.left),
      right: side(sides.right),
    }
  },
}

describe('the room ports ask along an edge', () => {
  const { network, structure } = networkOf(yaml, ['hub'])
  const scene = layoutDrawing(network, structure, uneven)
  const box = scene.nodes.find((n) => n.node.id === 'hub')?.box
  const ports = (scene.ports ?? []).filter((p) => p.nodeId === 'hub')

  it('keeps each neighbouring pair as far apart as its own gap, and a pair two apart as asked', () => {
    const side = ports[0]?.side
    const along = ports
      .filter((p) => p.side === side)
      .sort((p, q) => p.at.x - q.at.x || p.at.y - q.at.y)
      .map((p) => (side === 'top' || side === 'bottom' ? p.at.x : p.at.y))
    expect(along).toHaveLength(4)
    for (const [i, x] of along.entries()) {
      const next = along[i + 1]
      if (next !== undefined) expect(next - x).toBeGreaterThanOrEqual(25 + 15 * i - EPS)
      const after = along[i + 2]
      if (after !== undefined) expect(after - x).toBeGreaterThanOrEqual(70 - EPS)
    }
  })

  it('keeps the first and the last port the margins from the corners', () => {
    const side = ports[0]?.side
    const horizontal = side === 'top' || side === 'bottom'
    const along = ports.map((p) => (horizontal ? p.at.x : p.at.y)).sort((p, q) => p - q)
    const start = horizontal ? box?.x : box?.y
    const length = horizontal ? box?.width : box?.height
    expect((along[0] ?? 0) - (start ?? 0)).toBeGreaterThanOrEqual(17 - EPS)
    expect((start ?? 0) + (length ?? 0) - (along.at(-1) ?? 0)).toBeGreaterThanOrEqual(13 - EPS)
  })

  it('lengthens the edge to hold what the pairs ask', () => {
    const side = ports[0]?.side
    const length = side === 'top' || side === 'bottom' ? box?.width : box?.height
    expect(length ?? 0).toBeGreaterThanOrEqual(17 + 13 + 25 + 40 + 55 - EPS)
  })

  it('names a port in full and writes the layout metrics gave in its chip', () => {
    const long = ports.find((p) => p.name === 'LongName1')
    expect(long?.label).toBe('longname1')
    expect(long?.id).toBe('hub/LongName1')
  })
})

describe('gapsOf and extentOf', () => {
  const layout: PortSideLayout = {
    labels: [],
    gaps: [
      { from: 0, to: 1, min: 30 },
      { from: 1, to: 2, min: 5 },
      { from: 0, to: 2, min: 50 },
    ],
    leadMargin: 12,
    trailMargin: 8,
    depth: 0,
  }

  it('raises a neighbouring gap to the room of the line, and passes a pair two apart', () => {
    expect(gapsOf(layout, 10, 3)).toEqual([
      { from: 0, to: 1, d: 30 },
      { from: 1, to: 2, d: 10 },
      { from: 0, to: 2, d: 50 },
    ])
  })

  it('ignores a pair that names a port the edge does not have', () => {
    expect(gapsOf(layout, 10, 2)).toEqual([{ from: 0, to: 1, d: 30 }])
  })

  it('is the gaps and twice each margin, the margin no less than half a slot', () => {
    expect(extentOf(layout, 10, 3)).toBe(2 * 12 + 2 * 8 + 30 + 10)
    expect(extentOf(undefined, 10, 3)).toBe(2 * 5 + 2 * 5 + 10 + 10)
  })
})
