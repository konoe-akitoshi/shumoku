// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { readNetworkModel } from '../models/network-model-graph.js'
import { boundaryOf, drawNetwork } from './draw.js'
import { testMetrics } from './testing/support.js'

const wan = `
nodes:
  - { id: wan, type: external }
  - { id: edge }
  - { id: sw }
links:
  - endpoints: [{ node: wan }, { node: edge }]
  - endpoints: [{ node: edge }, { node: sw }]
`

describe('drawNetwork', () => {
  it('draws every node and line of a model', () => {
    const scene = drawNetwork(readNetworkModel(wan), { metrics: () => testMetrics })
    expect(scene.nodes.map((n) => n.node.id).sort()).toEqual(['edge', 'sw', 'wan'])
    expect(scene.wires).toHaveLength(2)
  })

  it('draws what the layers add to the configuration', () => {
    const model = readNetworkModel(wan)
    const scene = drawNetwork(
      { ...model, drawing: { nodes: { sw: { icon: '<svg viewBox="0 0 1 1"/>' } } } },
      { metrics: () => testMetrics },
    )
    expect(scene.nodes.find((n) => n.node.id === 'sw')?.node.spec?.icon).toBe(
      '<svg viewBox="0 0 1 1"/>',
    )
  })

  it('puts upstream above downstream from the external node', () => {
    const scene = drawNetwork(readNetworkModel(wan), { metrics: () => testMetrics })
    const top = (id: string) => scene.nodes.find((n) => n.node.id === id)?.box.y ?? Number.NaN
    expect(top('wan')).toBeLessThan(top('edge'))
    expect(top('edge')).toBeLessThan(top('sw'))
  })
})

describe('a guest of a host with no line', () => {
  it('is drawn beside its host, and a line to it finds its way', () => {
    const model = readNetworkModel(`
nodes:
  - { id: aws, type: cloud }
  - { id: fw }
  - { id: sw }
  - { id: vgw, host: aws }
links:
  - endpoints: [{ node: fw }, { node: sw }]
  - { endpoints: [{ node: fw }, { node: vgw }], virtual: true }
`)
    const scene = drawNetwork(model, { metrics: () => testMetrics })
    expect(scene.nodes.map((n) => n.node.id).sort()).toEqual(['aws', 'fw', 'sw', 'vgw'])
  })
})

describe('two lines straight across between two boxes', () => {
  it('are drawn when their ports are named in opposite orders on the two sides', () => {
    const model = readNetworkModel(`
nodes:
  - { id: a }
  - { id: b }
links:
  - endpoints: [{ node: a, port: p0 }, { node: b, port: q1 }]
  - { endpoints: [{ node: a, port: p1 }, { node: b, port: q0 }], virtual: true }
`)
    expect(drawNetwork(model, { metrics: () => testMetrics }).wires).toHaveLength(2)
  })
})

describe('a lone node in a group nested in one a line enters', () => {
  it('stays within the rows of its group, so the group does not reach above the line', () => {
    const model = readNetworkModel(`
groups:
  - id: site
    groups:
      - id: site/city
nodes:
  - { id: n0 }
  - { id: n1, group: site }
  - { id: n2, group: site/city }
  - { id: n3 }
  - { id: n4 }
  - { id: n5 }
  - { id: n6 }
links:
  - endpoints: [{ node: n0, port: e10 }, { node: n4, port: ptp1 }]
  - endpoints: [{ node: n0, port: e12 }, { node: n6, port: p22 }]
  - endpoints: [{ node: n1, port: e10 }, { node: n4, port: ptp2 }]
  - endpoints: [{ node: n1, port: e37 }, { node: n5, port: p3 }]
`)
    const scene = drawNetwork(model, { metrics: () => testMetrics })
    expect(scene.nodes.map((n) => n.node.id).sort()).toEqual([
      'n0',
      'n1',
      'n2',
      'n3',
      'n4',
      'n5',
      'n6',
    ])
  })
})

describe('sibling groups whose rows overlap', () => {
  it('are drawn side by side, not stacked against the rank bands', () => {
    // Read from a live network (names replaced): three racks of one site, the flows ordering
    // them while their rows overlap.
    const model = readNetworkModel(`
groups:
  - id: site
    groups:
      - id: site/a
      - id: site/b
      - id: site/c
nodes:
  - { id: n0, type: l2-switch, group: site/a }
  - { id: n1, type: l2-switch, group: site/a }
  - { id: n2, group: site/b }
  - { id: n3, type: l2-switch, group: site/b }
  - { id: n4, type: l2-switch, group: site/c }
  - { id: n5, group: site/c }
links:
  - endpoints: [{ node: n2 }, { node: n0, port: p16 }]
  - endpoints: [{ node: n4 }, { node: n1, port: p4 }]
    assumed: true
  - endpoints: [{ node: n5 }, { node: n3 }]
    assumed: true
`)
    const scene = drawNetwork(model, { metrics: () => testMetrics })
    expect(scene.wires).toHaveLength(3)
  })
})

describe('boundaryOf', () => {
  it('takes the external node when the structure names no candidate', () => {
    expect(boundaryOf(readNetworkModel(wan))).toEqual(['wan'])
  })

  it('takes where the physical meets the virtual', () => {
    const model = readNetworkModel(`
nodes:
  - { id: a }
  - { id: b }
  - { id: c }
links:
  - endpoints: [{ node: a }, { node: b }]
  - { endpoints: [{ node: b }, { node: c }], virtual: true }
`)
    expect(boundaryOf(model)).toEqual(['b'])
  })

  it('takes the external node over where the physical meets the virtual', () => {
    const model = readNetworkModel(`
nodes:
  - { id: isp, type: external }
  - { id: rt }
  - { id: br }
links:
  - endpoints: [{ node: isp }, { node: rt }]
  - endpoints: [{ node: rt }, { node: br }]
  - { endpoints: [{ node: rt }, { node: br }], virtual: true }
`)
    expect(boundaryOf(model)).toEqual(['isp'])
  })

  it('is overridden by the drawing layer alone', () => {
    const model = readNetworkModel(wan)
    expect(boundaryOf({ ...model, drawing: { settings: { boundary: ['sw'] } } })).toEqual(['sw'])
  })
})
