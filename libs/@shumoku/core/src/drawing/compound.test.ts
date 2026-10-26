// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { readNetworkModel } from '../models/network-model-graph.js'
import { deriveStructure } from '../structure/index.js'
import { layoutDrawing, layoutLayers } from './index.js'
import type { Box, Metrics } from './metrics.js'

const metrics: Metrics = {
  card: () => ({ width: 10, height: 6 }),
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
const EPS = 1e-6

/**
 * Two sites under one root. Site `ga` is a tree, deeper than site `gb`; a line joins the two
 * across the frames, one more runs from `gb` to the root, and `gc` sits inside `ga`.
 */
const net = readNetworkModel(`
groups:
  - id: ga
    groups:
      - { id: gc }
  - { id: gb }
nodes:
  - { id: r }
  - { id: a1, group: ga }
  - { id: a2, group: ga }
  - { id: a3, group: ga }
  - { id: a4, group: gc }
  - { id: a5, group: gc }
  - { id: a6, group: gc }
  - { id: b1, group: gb }
  - { id: b2, group: gb }
  - { id: x }
links:
  - endpoints: [{ node: r }, { node: a1 }]
  - endpoints: [{ node: a1 }, { node: a2 }]
  - endpoints: [{ node: a1 }, { node: a3 }]
  - endpoints: [{ node: a2 }, { node: a4 }]
  - endpoints: [{ node: a2 }, { node: a5 }]
  - endpoints: [{ node: a3 }, { node: a6 }]
  - endpoints: [{ node: r }, { node: b1 }]
  - endpoints: [{ node: b1 }, { node: b2 }]
  - endpoints: [{ node: b1 }, { node: a3 }]
  - endpoints: [{ node: b1 }, { node: x }]
`).config
const structure = deriveStructure(net, { boundary: ['r'] })
const scene = layoutDrawing(net, structure, metrics)
const layers = layoutLayers(net, structure, metrics)
const boxOf = (id: string) => {
  const b = scene.nodes.find((n) => n.node.id === id)?.box
  if (!b) throw new Error(`no box for ${id}`)
  return b
}
const frameOf = (id: string) => {
  const b = scene.groups.find((g) => g.group.id === id)?.box
  if (!b) throw new Error(`no frame for ${id}`)
  return b
}
const inside = (inner: Box, outer: Box) =>
  inner.x >= outer.x - EPS &&
  inner.y >= outer.y - EPS &&
  inner.x + inner.width <= outer.x + outer.width + EPS &&
  inner.y + inner.height <= outer.y + outer.height + EPS
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width - EPS &&
  b.x < a.x + a.width - EPS &&
  a.y < b.y + b.height - EPS &&
  b.y < a.y + a.height - EPS

describe('compound layout', () => {
  it('draws every group as one rectangle around everything in it', () => {
    for (const g of scene.groups) {
      expect(g.outline).toHaveLength(4)
      expect(g.box.width * g.box.height).toBeGreaterThan(0)
    }
    for (const id of ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'])
      expect(inside(boxOf(id), frameOf('ga'))).toBe(true)
    for (const id of ['a4', 'a5', 'a6']) expect(inside(boxOf(id), frameOf('gc'))).toBe(true)
    for (const id of ['b1', 'b2']) expect(inside(boxOf(id), frameOf('gb'))).toBe(true)
    expect(inside(frameOf('gc'), frameOf('ga'))).toBe(true)
  })

  it('keeps sibling blocks apart and every other card out of a frame', () => {
    expect(overlaps(frameOf('ga'), frameOf('gb'))).toBe(false)
    for (const id of ['r', 'x']) {
      for (const g of ['ga', 'gb', 'gc']) expect(overlaps(boxOf(id), frameOf(g))).toBe(false)
    }
    for (const id of ['b1', 'b2']) expect(overlaps(boxOf(id), frameOf('ga'))).toBe(false)
    for (const id of ['a1', 'a2', 'a3']) expect(overlaps(boxOf(id), frameOf('gc'))).toBe(false)
  })

  it('keeps cards apart', () => {
    for (const [i, a] of scene.nodes.entries()) {
      for (const b of scene.nodes.slice(i + 1)) expect(overlaps(a.box, b.box)).toBe(false)
    }
  })

  it('stands the farther end of every line that is routed no higher than the nearer, across groups too', () => {
    let checked = 0
    for (const line of layers.elements.lines) {
      if (!layers.composition.routes.has(line.index)) continue
      const [a, b] = line.ends
      const [ra, rb] = [layers.rank.get(a.element) ?? 0, layers.rank.get(b.element) ?? 0]
      const [boxA, boxB] = [
        layers.composition.boxes.get(a.element),
        layers.composition.boxes.get(b.element),
      ]
      if (!boxA || !boxB || ra === rb) continue
      const [near, far] = ra < rb ? [boxA, boxB] : [boxB, boxA]
      expect(far.y + far.height / 2).toBeGreaterThanOrEqual(near.y + near.height / 2 - EPS)
      checked++
    }
    expect(checked).toBeGreaterThan(5)
  })

  it('does not hold what is as near as each other in different groups at one height', () => {
    // a4 (in ga) and b2 (in gb) are both two lines from r; ga is deeper, so they need not align
    expect(boxOf('a2').y).not.toBeCloseTo(boxOf('b2').y, 3)
  })

  it('enters a block at the edge facing the end it comes from', () => {
    // b1 is nearer than a3: the line from b1 enters ga's frame at the top, through its route
    const line = layers.elements.lines.find(
      (l) =>
        l.ends.some((e) => e.element === 'unit:b1') && l.ends.some((e) => e.element === 'unit:a3'),
    )
    const route = line ? layers.composition.routes.get(line.index) : undefined
    expect(route).toBeDefined()
    const ga = frameOf('ga')
    expect(route?.some((p) => Math.abs(p.y - ga.y) < EPS)).toBe(true)
  })

  it('draws a group whose inside is a tree as a rectangle with no empty ranks cut out of it', () => {
    const f = frameOf('gc')
    const content = ['a4', 'a5', 'a6'].reduce(
      (sum, id) => sum + boxOf(id).width * boxOf(id).height,
      0,
    )
    expect(content / (f.width * f.height)).toBeGreaterThan(0.3)
  })
})
