// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { layoutDrawing } from './layout.js'
import { drawingReport } from './testing/report.js'
import { networkOf, problemOf, testMetrics } from './testing/support.js'

const yaml = `
name: t
groups:
  - id: site
    groups: [{ id: floor1 }, { id: floor2 }]
routingDomains: [{ id: wan }]
redundancy:
  - { id: core, nodes: [c1, c2], kind: mlag }
nodes:
  - { id: edge, type: router, group: site }
  - { id: c1, type: l3-switch, group: site }
  - { id: c2, type: l3-switch, group: site }
  - { id: sw1, group: floor1 }
  - { id: sw2, group: floor2 }
  - { id: ap1, group: floor1 }
  - { id: ap2, group: floor1 }
  - { id: ap3, group: floor2 }
  - { id: oob, group: site }
  - { id: srv, type: server, group: site }
  - { id: vm1, type: vm, host: srv, group: site }
links:
  - { endpoints: [{ node: edge }, { routingDomain: wan }] }
  - { endpoints: [{ node: edge }, { node: c1 }] }
  - { endpoints: [{ node: edge }, { node: c2 }] }
  - { endpoints: [{ node: c1 }, { node: c2 }] }
  - { endpoints: [{ node: c1 }, { node: sw1 }] }
  - { endpoints: [{ node: c2 }, { node: sw2 }] }
  - { endpoints: [{ node: c1 }, { node: srv }] }
  - { endpoints: [{ node: sw1 }, { node: ap1 }] }
  - { endpoints: [{ node: sw1 }, { node: ap2 }] }
  - { endpoints: [{ node: sw2 }, { node: ap3 }] }
  - { endpoints: [{ node: oob }, { node: edge }], virtual: true }
  - { endpoints: [{ node: srv }, { node: vm1 }], virtual: true }
`

const boundary = ['wan']

describe('readProblem', () => {
  const p = problemOf(yaml, boundary)

  it('folds a redundancy set into one unit and draws the routing domain as a cloud', () => {
    const unit = p.items.find((i) => i.id === 'unit:core')
    expect(unit?.kind).toBe('unit')
    expect(p.items.find((i) => i.id === 'wan')?.kind).toBe('cloud')
    expect(unit?.kind === 'unit' ? unit.members.map((m) => m.node.id) : undefined).toEqual([
      'c1',
      'c2',
    ])
  })

  it("draws a hosted node inside its host's box, not as an item of its own", () => {
    const srv = p.items.find((i) => i.id === 'srv')
    expect(srv?.kind === 'card' ? srv.guests?.map((g) => g.node.id) : undefined).toEqual(['vm1'])
    expect(p.items.some((i) => i.id === 'vm1')).toBe(false)
    expect(p.satellites).toEqual([])
    // the line between the host and its guest runs inside the box: kept, not routed
    expect(p.inner.map((i) => i.host)).toEqual(['srv'])
    expect(p.lines.some((l) => [l.a.node, l.b.node].includes('vm1'))).toBe(false)
  })

  it('orders flows from the boundary down, and a line between members is inside', () => {
    expect(p.above).toContainEqual({ upper: 'wan', lower: 'edge' })
    expect(p.above).toContainEqual({ upper: 'edge', lower: 'unit:core' })
    expect(p.lines.filter((l) => l.role === 'inside')).toHaveLength(1)
  })

  it('stands what a virtual line leaves the ground for above the ground it leaves', () => {
    expect(p.above).toContainEqual({ upper: 'oob', lower: 'edge' })
    expect(p.free).toEqual([])
  })

  it('has no satellite but a node on a host, and no line that only attaches', () => {
    expect(p.satellites.every((s) => s.why === 'host')).toBe(true)
    expect(p.lines.every((l) => ['oriented', 'unrelated', 'inside'].includes(l.role))).toBe(true)
  })

  it('leaves free what no way from the ground or the boundary gives a direction, in a pair', () => {
    const pair = problemOf(
      yaml
        .replace(
          '  - { endpoints: [{ node: oob }, { node: edge }], virtual: true }',
          '  - { endpoints: [{ node: oob }, { node: gate }], virtual: true }',
        )
        .replace('  - { id: oob, group: site }', '  - { id: oob, group: site }\n  - { id: gate }'),
      boundary,
    )
    expect(pair.free).toEqual(['gate', 'oob'])
    expect(pair.above.some((a) => a.upper === 'oob' || a.lower === 'oob')).toBe(false)
  })

  it('leaves what is tied to nothing free, and its lines over the drawing', () => {
    const lone = problemOf(
      yaml.replace('- { endpoints: [{ node: oob }, { node: edge }], virtual: true }', ''),
      boundary,
    )
    expect(lone.free).toEqual(['oob'])
  })

  it('does not depend on the order the network is written in', () => {
    const q = problemOf(yaml, boundary)
    expect(q.items).toEqual(p.items)
    expect(q.above).toEqual(p.above)
    expect(q.satellites).toEqual(p.satellites)
  })
})

describe('layoutDrawing', () => {
  const { network, structure } = networkOf(yaml, boundary)
  const scene = layoutDrawing(network, structure, testMetrics)
  const full = drawingReport(scene, { network, structure, metrics: testMetrics })
  const report = { ...full.size, ...full.crossings, ...full.flow }
  const y = (id: string) => scene.nodes.find((n) => n.node.id === id)?.box.y ?? 0

  it('breaks no rule of containment, overlap, flow or level', () => {
    expect(report.overlaps).toBe(0)
    expect(report.outside).toBe(0)
    expect(report.intrusions).toBe(0)
    expect(report.flowViolations).toBe(0)
    expect(report.even.apart).toBe(0)
  })

  it('draws every node and every line', () => {
    expect(scene.nodes).toHaveLength(network.nodes.length + 1)
    expect(scene.wires).toHaveLength(network.links.length)
    expect(scene.hulls).toHaveLength(1)
  })

  it('gives a hull its outline, which holds its members and which no other line goes through', () => {
    const hull = scene.hulls?.[0]
    expect(hull?.box).toBeDefined()
    if (!hull?.box) return
    for (const id of hull.members) {
      const b = scene.nodes.find((n) => n.node.id === id)?.box
      expect(b && b.x >= hull.box.x && b.x + b.width <= hull.box.x + hull.box.width).toBe(true)
    }
    expect(report.throughNodes).toBe(0)
  })

  it('hands a hull the cards of its members left to right, and a seam between each pair', () => {
    const hull = scene.hulls?.[0]
    expect(hull?.boxes).toHaveLength(hull?.members.length ?? 0)
    expect(hull?.seams).toHaveLength(Math.max(0, (hull?.members.length ?? 0) - 1))
    const xs = hull?.boxes.map((b) => b.x + b.width / 2) ?? []
    expect(xs).toEqual([...xs].sort((a, b) => a - b))
  })

  it('puts floors as deep as each other side by side, not one under the other', () => {
    const box = (id: string) => scene.groups.find((g) => g.group.id === id)?.box
    const a = box('floor1')
    const b = box('floor2')
    expect(a && b && Math.abs(a.y - b.y) < 1e-6).toBe(true)
    expect(a && b && a.x + a.width <= b.x + 1e-6).toBe(true)
  })

  it("stands the upstream above, and a guest inside its host below the host's heading", () => {
    expect(y('wan')).toBeLessThan(y('edge'))
    expect(y('edge')).toBeLessThan(y('sw1'))
    expect(y('oob')).toBeLessThan(y('edge'))
    const srv = scene.nodes.find((n) => n.node.id === 'srv')
    const vm = scene.nodes.find((n) => n.node.id === 'vm1')?.box
    expect(srv?.header).toBeGreaterThan(0)
    expect(srv && vm && vm.y >= srv.box.y + (srv.header ?? 0)).toBe(true)
    expect(srv && vm && vm.y + vm.height <= srv.box.y + srv.box.height).toBe(true)
  })

  it('gives the same scene however the network is ordered', () => {
    const flipped = { ...network, nodes: [...network.nodes].reverse() }
    const again = layoutDrawing(flipped, structure, testMetrics)
    const at = (s: typeof scene) =>
      s.nodes.map((n) => `${n.node.id} ${n.box.x} ${n.box.y}`).sort((p, q) => p.localeCompare(q))
    expect(at(again)).toEqual(at(scene))
  })
})
