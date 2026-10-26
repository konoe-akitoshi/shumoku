// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { readNetworkModel } from '../models/network-model-graph.js'
import { deriveStructure } from '../structure/index.js'
import { deriveElements } from './elements.js'
import { detectFans, gridOf } from './fans.js'
import { layoutDrawing, layoutLayers } from './index.js'
import type { Metrics } from './metrics.js'
import { rankElements } from './ranks.js'

const metrics: Metrics = {
  card: (node) => (node.startsWith('wide') ? { width: 14, height: 8 } : { width: 10, height: 6 }),
  bus: (_id, lines) => ({ width: Math.max(8, lines * 2), height: 2 }),
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

/** A root `r`, a switch `s` under it with `count` leaves, and a branch `b-c` with one. */
function star(count: number) {
  const leaves = Array.from({ length: count }, (_, i) => `l${i}`)
  const nodes = ['r', 's', 'b', 'c', ...leaves].map((id) => `  - { id: ${id} }`).join('\n')
  const links = [['r', 's'], ['r', 'b'], ['b', 'c'], ...leaves.map((l) => ['s', l])]
    .map(([a, z]) => `  - endpoints: [{ node: ${a} }, { node: ${z} }]`)
    .join('\n')
  return readNetworkModel(`nodes:\n${nodes}\nlinks:\n${links}\n`).config
}

const rankOf = (net: ReturnType<typeof star>, boundary: string[]) => {
  const structure = deriveStructure(net, { boundary })
  const elements = deriveElements(net, structure, metrics)
  return { structure, elements, rank: rankElements(elements, structure) }
}

describe('fan detection', () => {
  it('takes the leaves of one parent and leaves out a single leaf', () => {
    const { elements, rank } = rankOf(star(4), ['r'])
    const found = detectFans(elements, rank)
    expect(found).toHaveLength(1)
    expect(found[0]?.parent).toBe('unit:s')
    expect(found[0]?.members.map((m) => m.id)).toEqual(['unit:l0', 'unit:l1', 'unit:l2', 'unit:l3'])
  })

  it('does not take a sibling that has another line', () => {
    const net = readNetworkModel(`
nodes:
  - { id: r }
  - { id: s }
  - { id: a }
  - { id: b }
  - { id: c }
  - { id: x }
links:
  - endpoints: [{ node: r }, { node: s }]
  - endpoints: [{ node: s }, { node: a }]
  - endpoints: [{ node: s }, { node: b }]
  - endpoints: [{ node: s }, { node: c }]
  - endpoints: [{ node: c }, { node: x }]
`).config
    const { elements, rank } = rankOf(net, ['r'])
    const [fan] = detectFans(elements, rank)
    expect(fan?.members.map((m) => m.id)).toEqual(['unit:a', 'unit:b'])
  })

  it('counts a hosted element under its host', () => {
    const net = readNetworkModel(`
nodes:
  - { id: r }
  - { id: h }
  - { id: vm1, host: h }
  - { id: vm2, host: h }
  - { id: vm3, host: h }
links:
  - endpoints: [{ node: r }, { node: h }]
`).config
    const { elements, rank } = rankOf(net, ['r'])
    const [fan] = detectFans(elements, rank)
    expect(fan?.parent).toBe('unit:h')
    expect(fan?.members.map((m) => m.id)).toEqual(['unit:vm1', 'unit:vm2', 'unit:vm3'])
  })

  it('keeps leaves in different groups apart and does not make a fan of one', () => {
    const net = readNetworkModel(`
groups:
  - { id: g1 }
  - { id: g2 }
nodes:
  - { id: r }
  - { id: a, group: g1 }
  - { id: b, group: g1 }
  - { id: c, group: g2 }
links:
  - endpoints: [{ node: r }, { node: a }]
  - endpoints: [{ node: r }, { node: b }]
  - endpoints: [{ node: r }, { node: c }]
`).config
    const { elements, rank } = rankOf(net, ['r'])
    const found = detectFans(elements, rank)
    expect(found.map((f) => f.members.map((m) => m.id))).toEqual([['unit:a', 'unit:b']])
  })
})

describe('fan grid', () => {
  const cards = [
    { width: 10, height: 6 },
    { width: 14, height: 8 },
    { width: 10, height: 6 },
    { width: 10, height: 6 },
    { width: 10, height: 6 },
  ]

  it('sizes the block by the largest member and the gap', () => {
    expect(gridOf(cards, 3, 2).size).toEqual({ width: 3 * 14 + 2 * 2, height: 2 * 8 + 2 })
    expect(gridOf(cards, 5, 2).size).toEqual({ width: 5 * 14 + 4 * 2, height: 8 })
    expect(gridOf(cards, 99, 2).size.width).toBe(5 * 14 + 4 * 2)
  })

  it('puts every member inside the block, in the order given, without overlap', () => {
    const { size, offsets } = gridOf(cards, 3, 2)
    const boxes = offsets.map((o, i) => ({ ...o, ...(cards[i] ?? { width: 0, height: 0 }) }))
    expect(boxes).toHaveLength(cards.length)
    for (const [i, a] of boxes.entries()) {
      expect(a.x).toBeGreaterThanOrEqual(0)
      expect(a.y).toBeGreaterThanOrEqual(0)
      expect(a.x + a.width).toBeLessThanOrEqual(size.width + 1e-9)
      expect(a.y + a.height).toBeLessThanOrEqual(size.height + 1e-9)
      for (const b of boxes.slice(i + 1)) {
        const apart =
          a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y
        expect(apart).toBe(true)
      }
    }
    // row by row: the fourth member starts the second row
    expect(offsets[3]?.y ?? 0).toBeGreaterThan(offsets[0]?.y ?? 0)
    expect(offsets[2]?.x ?? 0).toBeGreaterThan(offsets[1]?.x ?? 0)
  })
})

describe('column choice', () => {
  const draw = (aspect: number, count = 24) => {
    const net = star(count)
    const structure = deriveStructure(net, { boundary: ['r'] })
    const m = { ...metrics, aspect }
    const layers = layoutLayers(net, structure, m)
    return { fan: layers.fans.fans[0], bounds: layoutDrawing(net, structure, m).bounds }
  }

  it('keeps one row when the drawing is already no wider than the target', () => {
    const { fan } = draw(100)
    expect(fan?.rows).toBe(1)
    expect(fan?.columns).toBe(24)
  })

  it('narrows the widest rank toward the target', () => {
    const wide = draw(100)
    const narrow = draw(2)
    expect(narrow.fan?.rows ?? 0).toBeGreaterThan(1)
    expect(narrow.bounds.width).toBeLessThan(wide.bounds.width)
    expect(narrow.bounds.height).toBeGreaterThan(wide.bounds.height)
    const shape = (b: { width: number; height: number }) => b.width / b.height
    expect(shape(narrow.bounds)).toBeLessThan(shape(wide.bounds))
  })

  it('stops at one member to a row, however narrow the target', () => {
    const { fan } = draw(0.01, 3)
    expect(fan?.rows).toBe(3)
    expect(fan?.columns).toBe(1)
  })
})

describe('fans in the scene', () => {
  it('puts every member once inside the block and runs a wire from the parent to each', () => {
    const net = star(7)
    const structure = deriveStructure(net, { boundary: ['r'] })
    const small = { ...metrics, aspect: 1 }
    const layers = layoutLayers(net, structure, small)
    const scene = layoutDrawing(net, structure, small)
    const fan = layers.fans.fans[0]
    if (!fan) throw new Error('no fan')
    expect(fan.rows).toBeGreaterThan(1)
    const x = layers.placed.x.get(fan.id) ?? 0
    const layer = layers.ordered.layers.findIndex((l) => l.some((s) => s.id === fan.id))
    const y = layers.placed.y[layer] ?? 0
    const block = { x: x - fan.size.width / 2, y: y - fan.size.height / 2 }
    for (const id of fan.members.map((m) => m.slice('unit:'.length))) {
      const boxes = scene.nodes.filter((n) => n.node.id === id)
      expect(boxes).toHaveLength(1)
      const box = boxes[0]?.box
      if (!box) throw new Error('missing')
      expect(box.x).toBeGreaterThanOrEqual(block.x - 1e-6)
      expect(box.y).toBeGreaterThanOrEqual(block.y - 1e-6)
      expect(box.x + box.width).toBeLessThanOrEqual(block.x + fan.size.width + 1e-6)
      expect(box.y + box.height).toBeLessThanOrEqual(block.y + fan.size.height + 1e-6)
      const wires = scene.wires.filter((w) => w.link.to.node === id || w.link.from.node === id)
      expect(wires).toHaveLength(1)
      expect(wires[0]?.points.at(-1)?.y).toBeCloseTo(box.y, 6)
    }
    const ids = scene.nodes.map((n) => n.node.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
