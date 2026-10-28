// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { readNetworkModel } from '../models/network-model-graph.js'
import { deriveStructure } from '../structure/index.js'
import { deriveElements, elementIdOf } from './elements.js'
import { columnsFor, detectFans, gridOf } from './fans.js'
import { layoutDrawing } from './index.js'
import type { Metrics } from './metrics.js'

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

/** The elements, and the layers a level would give them: one more than the nearer end of each flow. */
const layersOf = (net: ReturnType<typeof star>, boundary: string[]) => {
  const structure = deriveStructure(net, { boundary })
  const elements = deriveElements(net, structure, metrics)
  const layer = new Map(boundary.map((id) => [`unit:${id}`, 0] as const))
  const steps = [
    ...structure.planes
      .flatMap((p) => p.flows)
      .map(([near, far]) => [elementIdOf(near), elementIdOf(far)] as const),
    ...elements.lines
      .filter((l) => l.layoutOnly)
      .map((l) => [l.ends[0].element, l.ends[1].element] as const),
  ]
  // Each far end one layer after its nearer end, until nothing moves.
  for (let moved = true; moved; ) {
    moved = false
    for (const [near, far] of steps) {
      const at = layer.get(near)
      if (at !== undefined && (layer.get(far) ?? -1) < at + 1) {
        layer.set(far, at + 1)
        moved = true
      }
    }
  }
  return { structure, elements, layer }
}

describe('fan detection', () => {
  it('takes the leaves of one parent and leaves out a single leaf', () => {
    const { elements, layer } = layersOf(star(4), ['r'])
    const found = detectFans(elements, layer)
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
    const { elements, layer } = layersOf(net, ['r'])
    const [fan] = detectFans(elements, layer)
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
    const { elements, layer } = layersOf(net, ['r'])
    const [fan] = detectFans(elements, layer)
    expect(fan?.parent).toBe('unit:h')
    expect(fan?.members.map((m) => m.id)).toEqual(['unit:vm1', 'unit:vm2', 'unit:vm3'])
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
  const cell = { width: 10, height: 6 }

  it('asks for as many columns as make the block as wide as the target says', () => {
    // pitch 12 across and 8 down: c = sqrt(n * aspect * 8 / 12)
    expect(columnsFor(24, cell, 2, 16 / 9)).toBe(Math.round(Math.sqrt((24 * (16 / 9) * 8) / 12)))
    expect(columnsFor(24, cell, 2, 16 / 9)).toBe(5)
    expect(columnsFor(24, cell, 2, 1)).toBe(4)
    // a wider target takes more columns, a taller one fewer
    expect(columnsFor(24, cell, 2, 4)).toBeGreaterThan(columnsFor(24, cell, 2, 1))
    expect(columnsFor(24, cell, 2, 1 / 4)).toBeLessThan(columnsFor(24, cell, 2, 1))
  })

  it('stays between one column and one row of every member', () => {
    expect(columnsFor(24, cell, 2, 100)).toBe(24)
    expect(columnsFor(3, cell, 2, 0.01)).toBe(1)
    expect(columnsFor(2, cell, 2, 16 / 9)).toBeGreaterThanOrEqual(1)
    expect(columnsFor(2, cell, 2, 16 / 9)).toBeLessThanOrEqual(2)
  })

  it('brings each block near the target ratio, whatever else is in the drawing', () => {
    // two switches under one root, with fans of very different sizes
    const counts = [12, 60]
    const nodes = ['r', ...counts.map((_, i) => `s${i}`)]
    const links = counts.map((_, i) => ['r', `s${i}`])
    for (const [i, count] of counts.entries()) {
      for (let k = 0; k < count; k++) {
        nodes.push(`l${i}_${k}`)
        links.push([`s${i}`, `l${i}_${k}`])
      }
    }
    const nodeLines = nodes.map((id) => `  - { id: ${id} }`)
    const linkLines = links.map(([x, z]) => `  - endpoints: [{ node: ${x} }, { node: ${z} }]`)
    const net = readNetworkModel(
      ['nodes:', ...nodeLines, 'links:', ...linkLines, ''].join(String.fromCharCode(10)),
    ).config
    const scene = layoutDrawing(net, deriveStructure(net, { boundary: ['r'] }), metrics)
    for (const i of [0, 1]) {
      const boxes = scene.nodes.filter((n) => n.node.id.startsWith(`l${i}_`)).map((n) => n.box)
      const wide = Math.max(...boxes.map((b) => b.x + b.width)) - Math.min(...boxes.map((b) => b.x))
      const tall =
        Math.max(...boxes.map((b) => b.y + b.height)) - Math.min(...boxes.map((b) => b.y))
      const shape = wide / tall
      expect(shape).toBeGreaterThan(16 / 9 / 1.6)
      expect(shape).toBeLessThan((16 / 9) * 1.6)
    }
  })

  it('keeps one row when the target is wide enough, and one column when it is narrow', () => {
    const rows = (count: number, aspect: number, key: 'x' | 'y') => {
      const net = star(count)
      const scene = layoutDrawing(net, deriveStructure(net, { boundary: ['r'] }), {
        ...metrics,
        aspect,
      })
      const at = scene.nodes.filter((n) => n.node.id.startsWith('l')).map((n) => n.box[key])
      return new Set(at.map((v) => Math.round(v))).size
    }
    expect(rows(24, 100, 'y')).toBe(1)
    expect(rows(3, 0.01, 'x')).toBe(1)
  })
})

describe('fans in the scene', () => {
  it('puts every member once inside the block and runs a wire from the parent to each', () => {
    const net = star(7)
    const structure = deriveStructure(net, { boundary: ['r'] })
    const small = { ...metrics, aspect: 1 }
    const scene = layoutDrawing(net, structure, small)
    const leaves = scene.nodes.filter((n) => n.node.id.startsWith('l'))
    expect(leaves).toHaveLength(7)
    expect(new Set(leaves.map((n) => Math.round(n.box.y))).size).toBeGreaterThan(1)
    for (const { node, box } of leaves) {
      const id = node.id
      const wires = scene.wires.filter((w) => w.link.to.node === id || w.link.from.node === id)
      expect(wires).toHaveLength(1)
      expect(wires[0]?.points.at(-1)?.y).toBeCloseTo(box.y, 6)
    }
    const ids = scene.nodes.map((n) => n.node.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
