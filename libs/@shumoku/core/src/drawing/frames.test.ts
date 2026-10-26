// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { readNetworkModel } from '../models/network-model-graph.js'
import { deriveStructure } from '../structure/index.js'
import { deriveElements } from './elements.js'
import { layoutDrawing, layoutLayers } from './index.js'
import type { Metrics, Point } from './metrics.js'
import { rankElements } from './ranks.js'

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
 * A short group A (ranks 1 and 2) beside a deep group B (ranks 1 to 5) that is wide at rank 4,
 * with a group C inside B that holds the wide rank.
 */
const reach = readNetworkModel(`
groups:
  - { id: ga }
  - id: gb
    groups:
      - { id: gc }
nodes:
  - { id: r }
  - { id: a1, group: ga }
  - { id: a2, group: ga }
  - { id: b1, group: gb }
  - { id: b2, group: gb }
  - { id: b3, group: gb }
  - { id: w1, group: gc }
  - { id: w2, group: gc }
  - { id: w3, group: gc }
  - { id: w4, group: gc }
  - { id: b5, group: gb }
links:
  - endpoints: [{ node: r }, { node: a1 }]
  - endpoints: [{ node: a1 }, { node: a2 }]
  - endpoints: [{ node: r }, { node: b1 }]
  - endpoints: [{ node: b1 }, { node: b2 }]
  - endpoints: [{ node: b2 }, { node: b3 }]
  - endpoints: [{ node: b3 }, { node: w1 }]
  - endpoints: [{ node: b3 }, { node: w2 }]
  - endpoints: [{ node: b3 }, { node: w3 }]
  - endpoints: [{ node: b3 }, { node: w4 }]
  - endpoints: [{ node: w1 }, { node: b5 }]
  - endpoints: [{ node: w2 }, { node: b5 }]
  - endpoints: [{ node: w3 }, { node: b5 }]
  - endpoints: [{ node: w4 }, { node: b5 }]
`).config
const structure = deriveStructure(reach, { boundary: ['r'] })
const layers = layoutLayers(reach, structure, metrics)
const scene = layoutDrawing(reach, structure, metrics)
const frame = (id: string) => {
  const f = layers.placed.frames.get(id)
  if (!f) throw new Error(`no frame for ${id}`)
  return f
}
/** The interval a group has in a layer. */
const intervalIn = (id: string, layer: number) => {
  const f = frame(id)
  const interval = f.intervals[layer - f.first]
  if (!interval) throw new Error(`${id} has no interval in layer ${layer}`)
  return interval
}
const layerOfRank = (rank: number) => layers.ordered.ranks.indexOf(rank)
const parents = new Map(layers.elements.groups.map((g) => [g.id, g.parent]))

describe('a frame per rank', () => {
  it('spans every layer between its first and its last, one interval each', () => {
    expect(frame('ga').first).toBe(layerOfRank(1))
    expect(frame('ga').intervals).toHaveLength(2)
    expect(frame('gb').first).toBe(layerOfRank(1))
    expect(frame('gb').intervals).toHaveLength(5)
    expect(frame('gc').first).toBe(layerOfRank(4))
    expect(frame('gc').intervals).toHaveLength(1)
  })

  it('lets a deep group reach under a shallow sibling', () => {
    const wide = intervalIn('gb', layerOfRank(4))
    const short = intervalIn('ga', layerOfRank(2))
    // B is as wide as its four cards need at rank 4 and nothing of A is there, so B's interval
    // there runs over the x range A has in the ranks above.
    expect(wide.right - wide.left).toBeGreaterThan(4 * 10 + 3 * 2)
    expect(wide.left).toBeLessThan(short.right - EPS)
    expect(wide.right).toBeGreaterThan(short.left + EPS)
    const a = frame('ga').box
    const b = frame('gb').box
    expect(b.x).toBeLessThan(a.x + a.width - EPS)
  })

  it('keeps sibling groups a group gap apart in every layer they share, and only there', () => {
    for (const layer of [layerOfRank(1), layerOfRank(2)]) {
      const a = intervalIn('ga', layer)
      const b = intervalIn('gb', layer)
      const [near, far] = a.left < b.left ? [a, b] : [b, a]
      expect(far.left - near.right).toBeGreaterThanOrEqual(metrics.groupGap - EPS)
    }
    // the same order in every shared layer
    const sides = [layerOfRank(1), layerOfRank(2)].map(
      (l) => intervalIn('ga', l).left < intervalIn('gb', l).left,
    )
    expect(new Set(sides).size).toBe(1)
  })

  it('keeps a group inside its parent with the parent insets, layer by layer', () => {
    const inset = metrics.group('gb')
    const c = intervalIn('gc', layerOfRank(4))
    const b = intervalIn('gb', layerOfRank(4))
    expect(c.left - b.left).toBeGreaterThanOrEqual(inset.left - EPS)
    expect(b.right - c.right).toBeGreaterThanOrEqual(inset.right - EPS)
  })

  it('holds every slot of a group inside its interval with the insets of the group', () => {
    for (const [layerIndex, layer] of layers.ordered.layers.entries()) {
      for (const slot of layer) {
        if (slot.group === undefined) continue
        const x = layers.placed.x.get(slot.id) ?? 0
        const width = layers.fans.elements.elements.find((e) => e.id === slot.id)?.size.width ?? 0
        const inset = metrics.group(slot.group)
        const interval = intervalIn(slot.group, layerIndex)
        expect(x - width / 2 - interval.left).toBeGreaterThanOrEqual(inset.left - EPS)
        expect(interval.right - (x + width / 2)).toBeGreaterThanOrEqual(inset.right - EPS)
      }
    }
  })

  it('draws no card over a group it does not belong to', () => {
    for (const { group, outline } of scene.groups) {
      for (const { node, box } of scene.nodes) {
        const own = layers.elements.elements.find((e) => e.members.includes(node.id))?.place
        let belongs = false
        for (let g = own; g !== undefined; g = parents.get(g)) belongs ||= g === group.id
        if (belongs) continue
        const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
        expect(inside(centre, outline, false)).toBe(false)
      }
    }
  })
})

/** Whether a point is in a polygon of horizontal and vertical edges; `edge` counts its edges. */
function inside(p: Point, polygon: readonly Point[], edge = true): boolean {
  let within = false
  for (const [i, a] of polygon.entries()) {
    const b = polygon[(i + 1) % polygon.length]
    if (!b) continue
    const onX = a.x === b.x && Math.abs(p.x - a.x) < EPS
    const onY = a.y === b.y && Math.abs(p.y - a.y) < EPS
    const along =
      (onX && p.y >= Math.min(a.y, b.y) - EPS && p.y <= Math.max(a.y, b.y) + EPS) ||
      (onY && p.x >= Math.min(a.x, b.x) - EPS && p.x <= Math.max(a.x, b.x) + EPS)
    if (along) return edge
    if (a.x === b.x && p.x < a.x && p.y >= Math.min(a.y, b.y) && p.y < Math.max(a.y, b.y)) {
      within = !within
    }
  }
  return within
}

const segments = (polygon: readonly Point[]) =>
  polygon.flatMap((a, i) => {
    const b = polygon[(i + 1) % polygon.length]
    return b ? [{ a, b }] : []
  })

describe('outlines', () => {
  it('is a closed rectilinear polygon, clockwise from the top-left of the first band', () => {
    expect(scene.groups.map((g) => g.group.id).sort()).toEqual(['ga', 'gb', 'gc'])
    for (const { group, outline, box } of scene.groups) {
      expect(outline.length).toBeGreaterThanOrEqual(4)
      for (const { a, b } of segments(outline)) {
        // each edge runs along one axis and is not a point
        expect(a.x === b.x || a.y === b.y).toBe(true)
        expect(a.x === b.x && a.y === b.y).toBe(false)
      }
      // clockwise on a page that runs down: a positive area
      const area = segments(outline).reduce((sum, { a, b }) => sum + a.x * b.y - b.x * a.y, 0)
      expect(area).toBeGreaterThan(0)
      const first = outline[0]
      expect(first).toEqual({ x: frame(group.id).intervals[0]?.left, y: box.y })
      // the box is the box around it
      const xs = outline.map((p) => p.x)
      const ys = outline.map((p) => p.y)
      expect(box.x).toBeCloseTo(Math.min(...xs), 6)
      expect(box.x + box.width).toBeCloseTo(Math.max(...xs), 6)
      expect(box.y).toBeCloseTo(Math.min(...ys), 6)
      expect(box.y + box.height).toBeCloseTo(Math.max(...ys), 6)
    }
  })

  it('steps sideways between layers where the intervals differ', () => {
    const b = scene.groups.find((g) => g.group.id === 'gb')
    // B is narrow at ranks 1 to 3 and wide at rank 4: its outline is not a rectangle
    expect(b?.outline.length).toBeGreaterThan(4)
  })

  it('holds every member of a group inside it', () => {
    for (const { group, outline } of scene.groups) {
      for (const { node, box } of scene.nodes) {
        const place = layers.elements.elements.find((e) => e.members.includes(node.id))?.place
        let member = false
        for (let g = place; g !== undefined; g = parents.get(g)) member ||= g === group.id
        if (!member) continue
        for (const corner of [
          { x: box.x, y: box.y },
          { x: box.x + box.width, y: box.y },
          { x: box.x, y: box.y + box.height },
          { x: box.x + box.width, y: box.y + box.height },
        ]) {
          expect(inside(corner, outline)).toBe(true)
        }
      }
    }
  })

  it('never touches the outline of another group, nested or beside', () => {
    for (const [i, p] of scene.groups.entries()) {
      for (const q of scene.groups.slice(i + 1)) {
        for (const s of segments(p.outline)) {
          for (const t of segments(q.outline)) {
            const touch =
              Math.min(s.a.x, s.b.x) <= Math.max(t.a.x, t.b.x) + EPS &&
              Math.min(t.a.x, t.b.x) <= Math.max(s.a.x, s.b.x) + EPS &&
              Math.min(s.a.y, s.b.y) <= Math.max(t.a.y, t.b.y) + EPS &&
              Math.min(t.a.y, t.b.y) <= Math.max(s.a.y, s.b.y) + EPS
            expect(touch).toBe(false)
          }
        }
      }
    }
  })

  it('keeps a group inside the outline of its parent', () => {
    const outlineOf = (id: string) => scene.groups.find((g) => g.group.id === id)?.outline ?? []
    for (const corner of outlineOf('gc')) expect(inside(corner, outlineOf('gb'))).toBe(true)
  })
})

describe('ranks of what the structure does not reach', () => {
  const rankOf = (grouped: boolean) => {
    const net = readNetworkModel(`
groups:
  - { id: g }
nodes:
  - { id: r }
  - { id: a, group: g }
  - { id: o${grouped ? ', group: g' : ''} }
  - { id: c }
  - { id: d }
links:
  - endpoints: [{ node: r }, { node: a }]
  - endpoints: [{ node: r }, { node: c }]
  - endpoints: [{ node: c }, { node: d }]
  - endpoints: [{ node: a }, { node: o }]
    virtual: true
`).config
    const s = deriveStructure(net, { boundary: ['r'] })
    return rankElements(deriveElements(net, s, metrics), s)
  }

  it('keeps such an element inside the ranks its group spans', () => {
    // g holds only a, at rank 1; the rule would put o at rank 2, past the end of g
    expect(rankOf(true).get('unit:o')).toBe(1)
  })

  it('keeps the rule for an element in no group', () => {
    expect(rankOf(false).get('unit:o')).toBe(2)
  })

  it('keeps a separate part of a group inside the group too', () => {
    const net = readNetworkModel(`
groups:
  - { id: g }
routingDomains:
  - { id: lte }
nodes:
  - { id: r }
  - { id: a, group: g }
  - { id: b, group: g }
  - { id: oob, group: g }
links:
  - endpoints: [{ node: r }, { node: a }]
  - endpoints: [{ node: a }, { node: b }]
  - endpoints: [{ node: oob }, { routingDomain: lte }]
    virtual: true
`).config
    const s = deriveStructure(net, { boundary: ['r'] })
    const rank = rankElements(deriveElements(net, s, metrics), s)
    // g spans ranks 1 and 2; the part would go after rank 2, and the cloud beside it stays out
    expect(rank.get('unit:oob')).toBe(2)
    expect(rank.get('routingDomain:lte')).toBe(3)
  })
})
