// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { layoutDrawing } from './layout.js'
import { sceneReport } from './report.js'
import { networkOf, problemOf, testMetrics } from './testing.js'

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
`

const boundary = ['wan']

describe('readProblem', () => {
  const p = problemOf(yaml, boundary)

  it('folds a redundancy set into one unit and draws the routing domain as a cloud', () => {
    expect(p.items.find((i) => i.id === 'unit:core')?.kind).toBe('unit')
    expect(p.items.find((i) => i.id === 'wan')?.kind).toBe('cloud')
    expect(p.items.find((i) => i.id === 'unit:core')?.members?.map((m) => m.node.id)).toEqual([
      'c1',
      'c2',
    ])
  })

  it('stands a hosted node beside its host', () => {
    expect(p.satellites).toContainEqual({ item: 'vm1', partner: 'srv', why: 'host' })
  })

  it('orders flows from the boundary down, and a line between members is inside', () => {
    expect(p.above).toContainEqual({ upper: 'wan', lower: 'edge' })
    expect(p.above).toContainEqual({ upper: 'edge', lower: 'unit:core' })
    expect(p.lines.filter((l) => l.role === 'inside')).toHaveLength(1)
  })

  it('stands an item without nearness beside its partner', () => {
    expect(p.satellites).toContainEqual({ item: 'oob', partner: 'edge', why: 'attach' })
    expect(p.free).toEqual([])
  })

  it('finds the access points on one switch as twins', () => {
    expect(p.twins.map((t) => t.members)).toContainEqual(['ap1', 'ap2'])
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
  const report = sceneReport(scene, { network, structure })
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

  it('puts floors as deep as each other side by side, not one under the other', () => {
    const box = (id: string) => scene.groups.find((g) => g.group.id === id)?.box
    const a = box('floor1')
    const b = box('floor2')
    expect(a && b && Math.abs(a.y - b.y) < 1e-6).toBe(true)
    expect(a && b && a.x + a.width <= b.x + 1e-6).toBe(true)
  })

  it('stands the upstream above, and a satellite level with its partner', () => {
    expect(y('wan')).toBeLessThan(y('edge'))
    expect(y('edge')).toBeLessThan(y('sw1'))
    expect(y('oob')).toBeCloseTo(y('edge'))
    expect(y('vm1')).toBeCloseTo(y('srv'))
  })

  it('gives the same scene however the network is ordered', () => {
    const flipped = { ...network, nodes: [...network.nodes].reverse() }
    const again = layoutDrawing(flipped, structure, testMetrics)
    const at = (s: typeof scene) =>
      s.nodes.map((n) => `${n.node.id} ${n.box.x} ${n.box.y}`).sort((p, q) => p.localeCompare(q))
    expect(at(again)).toEqual(at(scene))
  })
})
