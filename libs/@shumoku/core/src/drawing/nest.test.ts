// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { readNetworkModel } from '../models/index.js'
import { drawNetwork } from './draw.js'
import { layoutDrawing, layoutParts } from './layout.js'
import { groupItemId, localProblemOf, nestedOf, nestFrames, portalSidesOf } from './nest.js'
import { ranksOf } from './ranks.js'
import type { Scene } from './scene.js'
import { goldenCases } from './testing/cases.js'
import { networkOf, problemOf, testMetrics } from './testing/support.js'

const yaml = `
name: t
groups:
  - id: site
    groups: [{ id: floor1 }, { id: floor2 }]
  - id: rack
routingDomains: [{ id: wan }]
nodes:
  - { id: edge, type: router, group: site }
  - { id: c1, type: l3-switch, group: site }
  - { id: sw1, group: floor1 }
  - { id: sw2, group: floor2 }
  - { id: ap1, group: floor1 }
  - { id: ap2, group: floor1 }
  - { id: ap3, group: floor2 }
  - { id: srv, type: server, group: rack }
  - { id: nas, type: server, group: rack }
links:
  - { endpoints: [{ node: edge }, { routingDomain: wan }] }
  - { endpoints: [{ node: edge }, { node: c1 }] }
  - { endpoints: [{ node: c1 }, { node: sw1 }] }
  - { endpoints: [{ node: c1 }, { node: sw2 }] }
  - { endpoints: [{ node: sw1 }, { node: ap1 }] }
  - { endpoints: [{ node: sw1 }, { node: ap2 }] }
  - { endpoints: [{ node: sw2 }, { node: ap3 }] }
  - { endpoints: [{ node: c1 }, { node: srv }] }
  - { endpoints: [{ node: srv }, { node: nas }] }
`

describe('the groups solved on their own', () => {
  const problem = problemOf(yaml, ['wan'])

  it('are the groups with no group in them', () => {
    expect(
      nestedOf(problem)
        .map((l) => l.frame.id)
        .sort(),
    ).toEqual(['floor1', 'floor2', 'rack'])
    // the parent stays a frame of the flat problem, holding the leaves as boxes
    const { outer, nested } = nestFrames(problem)
    expect(nested.length).toBe(3)
    expect(outer.frames.map((f) => f.id).sort()).toEqual(['', 'site'])
    expect(outer.items.filter((i) => i.kind === 'frame' && i.frame === 'site').length).toBe(2)
  })

  it('stand in the parent as one box each, with the lines that leave them ending at its ports', () => {
    const { outer, nested } = nestFrames(problem)
    const boxes = outer.items.filter((i) => i.kind === 'frame')
    expect(boxes.map((b) => b.id)).toEqual(nested.map((l) => groupItemId(l.frame.id)).sort())
    expect(outer.items.map((i) => i.id)).not.toContain('sw1')
    const floor1 = groupItemId('floor1')
    expect(outer.above).toContainEqual({ upper: 'c1', lower: floor1 })
    const ends = outer.lines.flatMap((l) => [l.a, l.b]).filter((e) => e.item === floor1)
    expect(ends.length).toBe(1)
    expect(ends[0]?.port).toMatch(/^link:\d+\.[ab]$/)
  })

  it('each group is a problem of its own, its outside lines ending at a portal on the edge the parent gives', () => {
    const { outer, nested } = nestFrames(problem)
    const floor1 = nested.find((l) => l.frame.id === 'floor1')
    expect(floor1).toBeDefined()
    if (!floor1) return
    const local = localProblemOf(problem, floor1, portalSidesOf(outer, ranksOf(outer)))
    expect(local.frames.map((f) => f.id)).toEqual([''])
    expect(local.items.filter((i) => i.kind === 'portal').length).toBe(1)
    const portal = local.items.find((i) => i.kind === 'portal')
    expect(portal?.kind === 'portal' && portal.side).toBe('top')
    // the portal stands above the switch it leads to
    expect(local.above).toContainEqual({ upper: portal?.id, lower: 'sw1' })
    // every line is inside the group or ends at the portal
    expect(local.lines.length).toBe(3)
  })

  it('leaves out a group that a satellite link ties across its boundary', () => {
    const tied = problemOf(
      `name: t
groups: [{ id: g }]
nodes:
  - { id: a, group: g }
  - { id: b }
links:
  - { endpoints: [{ node: a }, { node: b }] }`,
      [],
    )
    expect(nestedOf({ ...tied, satellites: [{ item: 'a', partner: 'b', why: 'host' }] })).toEqual(
      [],
    )
  })

  it('is the whole network when it has no group', () => {
    const flat = problemOf(
      'name: t\nnodes: [{ id: a }, { id: b }]\nlinks: [{ endpoints: [{ node: a }, { node: b }] }]',
      [],
    )
    expect(nestFrames(flat).nested).toEqual([])
  })
})

const finite = (scene: Scene): boolean => !JSON.stringify(scene, (_k, v) => v).includes('null')
const hashOf = (scene: Scene) =>
  createHash('sha1').update(JSON.stringify(scene)).digest('hex').slice(0, 16)

function drawn(yamlText: string, boundary: string[]): Scene {
  if (boundary.length === 0) {
    return drawNetwork(readNetworkModel(yamlText), { metrics: () => testMetrics })
  }
  const { network, structure } = networkOf(yamlText, boundary)
  return layoutDrawing(network, structure, testMetrics)
}

const EDGE = 1e-3

describe('a group drawn on its own', () => {
  it('holds its boxes inside its own, and its wires end at ports', () => {
    const { network, structure } = networkOf(yaml, ['wan'])
    const parts = layoutParts(network, structure, testMetrics)
    const scene = parts.scene
    expect([...(parts.children?.keys() ?? [])].sort()).toEqual(['floor1', 'floor2', 'rack'])
    expect(parts.problem.frames.map((f) => f.id)).toContain('site')
    expect(finite(scene)).toBe(true)
    const group = new Map(scene.groups.map((g) => [g.group.id, g.box]))
    for (const { node, box } of scene.nodes) {
      const g = node.parent === undefined ? undefined : group.get(node.parent)
      if (!g) continue
      expect(box.x).toBeGreaterThanOrEqual(g.x - EDGE)
      expect(box.y).toBeGreaterThanOrEqual(g.y - EDGE)
      expect(box.x + box.width).toBeLessThanOrEqual(g.x + g.width + EDGE)
      expect(box.y + box.height).toBeLessThanOrEqual(g.y + g.height + EDGE)
    }
    const marks = (scene.ports ?? []).map((p) => p.at)
    for (const w of scene.wires) {
      for (const end of [w.points[0], w.points[w.points.length - 1]]) {
        expect(marks.some((m) => end && Math.hypot(m.x - end.x, m.y - end.y) < EDGE)).toBe(true)
      }
      // the line runs on without a jump
      for (const [k, p] of w.points.entries()) {
        const q = w.points[k + 1]
        if (q) expect(Math.hypot(q.x - p.x, q.y - p.y)).toBeGreaterThan(0)
      }
    }
    // a line that crosses a group's edge is one polyline from port to port
    const link = scene.wires.length
    expect(link).toBe(network.links.length)
  })
})

describe('the fixed networks', () => {
  it.each(goldenCases)('%s', (_name, text, boundary) => {
    const nested = drawn(text, boundary)
    expect(finite(nested)).toBe(true)
    expect(nested.wires.length).toBe(
      boundary.length === 0
        ? readNetworkModel(text).config.links.length
        : networkOf(text, boundary).network.links.length,
    )
    for (const w of nested.wires) {
      for (const p of w.points) {
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)
      }
    }
    const group = new Map(nested.groups.map((g) => [g.group.id, g.box]))
    for (const { node, box } of nested.nodes) {
      const g = node.parent === undefined ? undefined : group.get(node.parent)
      if (!g) continue
      expect(box.x).toBeGreaterThanOrEqual(g.x - EDGE)
      expect(box.y).toBeGreaterThanOrEqual(g.y - EDGE)
      expect(box.x + box.width).toBeLessThanOrEqual(g.x + g.width + EDGE)
      expect(box.y + box.height).toBeLessThanOrEqual(g.y + g.height + EDGE)
    }
    const marks = (nested.ports ?? []).map((p) => p.at)
    for (const w of nested.wires) {
      for (const end of [w.points[0], w.points[w.points.length - 1]]) {
        expect(marks.some((m) => end && Math.hypot(m.x - end.x, m.y - end.y) < EDGE)).toBe(true)
      }
    }
    // a group holds the groups in it, and groups side by side do not overlap
    for (const { group: g, box } of nested.groups) {
      const outer = g.parent === undefined ? undefined : group.get(g.parent)
      if (!outer) continue
      expect(box.x).toBeGreaterThanOrEqual(outer.x - EDGE)
      expect(box.y).toBeGreaterThanOrEqual(outer.y - EDGE)
      expect(box.x + box.width).toBeLessThanOrEqual(outer.x + outer.width + EDGE)
      expect(box.y + box.height).toBeLessThanOrEqual(outer.y + outer.height + EDGE)
    }
    for (const [i, p] of nested.groups.entries()) {
      for (const q of nested.groups.slice(i + 1)) {
        if (p.group.parent !== q.group.parent) continue
        const apart =
          p.box.x + p.box.width <= q.box.x + EDGE ||
          q.box.x + q.box.width <= p.box.x + EDGE ||
          p.box.y + p.box.height <= q.box.y + EDGE ||
          q.box.y + q.box.height <= p.box.y + EDGE
        expect(apart).toBe(true)
      }
    }
  })
})

describe('the drawing of a network with groups', () => {
  it('is the same scene when drawn twice', () => {
    const { network, structure } = networkOf(yaml, ['wan'])
    const a = layoutDrawing(network, structure, testMetrics)
    const b = layoutDrawing(network, structure, testMetrics)
    expect(hashOf(a)).toBe(hashOf(b))
    expect(finite(a)).toBe(true)
  })
})

describe('portal spacing', () => {
  const lines = 8
  const text = `
name: p
groups: [{ id: g }]
nodes:
  - { id: hub, type: l3-switch, group: g }
${Array.from({ length: lines }, (_, i) => `  - { id: far${i}, type: router }`).join('\n')}
links:
${Array.from({ length: lines }, (_, i) => `  - { endpoints: [{ node: far${i} }, { node: hub }] }`).join('\n')}
`
  // the least distance two parallel lines of strangers keep
  const pitch = testMetrics.gapApart + 2 * testMetrics.stroke
  const slot = pitch

  it('puts the portals of a group the pitch of their lines apart, not a margin and a gap', () => {
    const { network, structure } = networkOf(text, [])
    const parts = layoutParts(network, structure, testMetrics)
    const child = parts.children?.get('g')
    expect(child).toBeDefined()
    const portals = (child?.scene.ports ?? []).filter((p) => p.nodeId.startsWith('portal:'))
    expect(portals.length).toBe(lines)
    const xs = portals.map((p) => p.at.x).sort((p, q) => p - q)
    for (const [i, x] of xs.entries()) {
      const next = xs[i + 1]
      if (next !== undefined) {
        expect(next - x).toBeGreaterThanOrEqual(pitch - EDGE)
        // a portal used to be two ports' margins wide, with the gap of two boxes beside it
        expect(next - x).toBeLessThan(2 * slot + testMetrics.gap)
      }
    }
  })

  it('draws the wires across the edge without a kink and no mark at the edge', () => {
    const { network, structure } = networkOf(text, [])
    const scene = layoutDrawing(network, structure, testMetrics)
    expect(scene.wires.length).toBe(lines)
    for (const w of scene.wires) {
      for (const [k, p] of w.points.entries()) {
        const q = w.points[k + 1]
        if (q) expect(Math.hypot(q.x - p.x, q.y - p.y)).toBeGreaterThan(testMetrics.stroke)
      }
    }
    // the only marks are on the hub; the group's edge carries none
    const group = scene.groups.find((g) => g.group.id === 'g')?.box
    for (const m of scene.ports ?? []) {
      expect(m.nodeId.startsWith('portal:')).toBe(false)
      expect(m.nodeId.startsWith('\u0001')).toBe(false)
      expect(m.at.y).toBeGreaterThan((group?.y ?? 0) + EDGE)
    }
  })
})
