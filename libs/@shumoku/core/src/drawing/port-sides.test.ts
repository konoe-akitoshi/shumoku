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

describe('a caption for the start the names of an edge share', () => {
  const captioned: Metrics = {
    ...testMetrics,
    portSides: (box) => {
      const base = testMetrics.portSides(box)
      const side = (list: readonly { name?: string }[], layout: PortSideLayout): PortSideLayout =>
        list.length >= 3
          ? {
              ...layout,
              caption: { text: 'Port', width: 30 },
              labels: layout.labels.map((l) => ({ ...l, text: l.text.replace('Port', '') })),
            }
          : layout
      return {
        top: side(box.sides.top, base.top),
        bottom: side(box.sides.bottom, base.bottom),
        left: side(box.sides.left, base.left),
        right: side(box.sides.right, base.right),
      }
    },
  }
  const { network, structure } = networkOf(
    `
nodes:
  - { id: hub }
  - { id: b1 }
  - { id: b2 }
  - { id: b3 }
links:
  - { endpoints: [{ node: hub, port: Port1 }, { node: b1 }] }
  - { endpoints: [{ node: hub, port: Port2 }, { node: b2 }] }
  - { endpoints: [{ node: hub, port: Port3 }, { node: b3 }] }
`,
    ['hub'],
  )
  const scene = layoutDrawing(network, structure, captioned)

  it('is written once for the edge, at the corner it starts from', () => {
    expect(scene.captions).toHaveLength(1)
    const caption = scene.captions?.[0]
    const box = scene.nodes.find((n) => n.node.id === 'hub')?.box
    expect(caption).toMatchObject({ nodeId: 'hub', side: 'bottom', text: 'Port' })
    expect(caption?.at).toEqual({ x: box?.x, y: (box?.y ?? 0) + (box?.height ?? 0) })
  })

  it('leaves the start off each port and keeps the whole name', () => {
    const ports = (scene.ports ?? []).filter((p) => p.nodeId === 'hub')
    expect(ports.map((p) => p.label).sort()).toEqual(['1', '2', '3'])
    expect(ports.map((p) => p.name).sort()).toEqual(['Port1', 'Port2', 'Port3'])
  })
})

describe('names that reach out past the usual lead-out', () => {
  const link = `
nodes:
  - { id: up }
  - { id: down }
links:
  - { endpoints: [{ node: up, port: p1 }, { node: down, port: q1 }] }
`
  const reaching = (depth: number): Metrics => ({
    ...testMetrics,
    portSides: (box) => {
      const base = testMetrics.portSides(box)
      return {
        top: { ...base.top, depth },
        bottom: { ...base.bottom, depth },
        left: base.left,
        right: base.right,
      }
    },
  })
  const height = (depth: number) => {
    const { network, structure } = networkOf(link, ['up'])
    return layoutDrawing(network, structure, reaching(depth)).bounds.height
  }

  it('keeps no more room than a lead-out while the names stay within it', () => {
    expect(height(0)).toBe(height(testMetrics.leadOut - testMetrics.gapApart))
  })

  it('opens the rank gap by what the names reach past it on both facing sides', () => {
    const lead = testMetrics.leadOut
    const white = testMetrics.gapApart
    // each side keeps depth + white where that is more than the lead-out
    expect(height(lead + 25) - height(0)).toBeCloseTo(2 * (25 + white), 5)
  })
})
