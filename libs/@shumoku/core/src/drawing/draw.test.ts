// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { readNetworkModel } from '../models/network-model-graph.js'
import { boundaryOf, drawNetwork } from './draw.js'
import { randomYaml } from './testing/random.js'
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

  it('does not take a node with a cable and a virtual link as the top', () => {
    // a hypervisor with a VM: where the physical meets the virtual, but not the way out
    const model = readNetworkModel(`
nodes:
  - { id: sw, type: l2-switch }
  - { id: esx, type: server }
  - { id: vm, type: server }
links:
  - endpoints: [{ node: sw }, { node: esx }]
  - { endpoints: [{ node: esx }, { node: vm }], virtual: true }
`)
    expect(boundaryOf(model)).toEqual(['sw'])
  })

  it('takes one top of each part the cables join, the most central of its routers', () => {
    // edge, core and branch are routers; core is the middle of the cabled part. The office is
    // reached by a tunnel only, so it is a part of its own with its own top.
    const model = readNetworkModel(`
nodes:
  - { id: edge, type: router }
  - { id: fw, type: firewall }
  - { id: core, type: router }
  - { id: dist, type: l3-switch }
  - { id: branch, type: router }
  - { id: office, type: router }
  - { id: office-sw, type: l2-switch }
links:
  - endpoints: [{ node: edge }, { node: fw }]
  - endpoints: [{ node: fw }, { node: core }]
  - endpoints: [{ node: core }, { node: dist }]
  - endpoints: [{ node: core }, { node: branch }]
  - { endpoints: [{ node: core }, { node: office }], virtual: true }
  - endpoints: [{ node: office }, { node: office-sw }]
`)
    expect(boundaryOf(model)).toEqual(['core', 'office'])
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

describe('a grouped network', () => {
  // twenty random shapes are a second locally and many on a busy CI runner
  it('is drawn whatever the shape, groups and types', { timeout: 30_000 }, () => {
    for (const seed of Array.from({ length: 20 }, (_, i) => i + 1)) {
      const model = readNetworkModel(randomYaml(seed, { grouped: true }))
      expect(() => drawNetwork(model, { metrics: () => testMetrics }), `seed ${seed}`).not.toThrow()
    }
  })

  it('keeps apart two legs in one gap where a line came in through a frame door', () => {
    // the line from a to e reaches the gap above e along more than one row
    const model = readNetworkModel(`
groups: [{ id: g1 }, { id: g2 }]
nodes:
  - { id: top, type: router }
  - { id: a, type: l2-switch, group: g1 }
  - { id: b, type: l2-switch, group: g2 }
  - { id: c, type: l2-switch, group: g2 }
  - { id: d, type: server, group: g1 }
  - { id: e, type: server, group: g2 }
links:
  - endpoints: [{ node: top }, { node: c }]
  - endpoints: [{ node: a }, { node: e }]
  - endpoints: [{ node: c }, { node: d }]
  - endpoints: [{ node: a }, { node: d }]
`)
    expect(drawNetwork(model, { metrics: () => testMetrics }).wires).toHaveLength(4)
  })
})

describe('a redundancy set and the switch its members are all cabled to', () => {
  it('draws the switch above the set when the hop count puts them level', () => {
    // Read from a live network (names replaced): a cluster of three hosts with no type, each
    // cabled to two switches, `lan` above them and `fast`, which hangs off `lan` and so is as
    // far from the top as the hosts. Level, the middle host had no side to meet `fast` by and the
    // drawing stopped with "no way through the corridors".
    const model = readNetworkModel(`
groups: [{ id: site }]
redundancy:
  - { id: pool, nodes: [h1, h2, h3], kind: cluster }
nodes:
  - { id: rt, type: router, group: site }
  - { id: edge, type: l2-switch, group: site }
  - { id: lan, type: l2-switch, group: site }
  - { id: fast, type: l2-switch, group: site }
  - { id: h1, group: site }
  - { id: h2, group: site }
  - { id: h3, group: site }
links:
  - endpoints: [{ node: rt, port: p1 }, { node: edge, port: p1 }]
  - endpoints: [{ node: edge, port: p2 }, { node: lan, port: p1 }]
  - endpoints: [{ node: lan, port: p2 }, { node: fast, port: mgmt }]
  - endpoints: [{ node: h1, port: nic0 }, { node: lan, port: p3 }]
  - endpoints: [{ node: h2, port: nic0 }, { node: lan, port: p4 }]
  - endpoints: [{ node: h3, port: nic0 }, { node: lan, port: p5 }]
  - endpoints: [{ node: h1, port: nic1 }, { node: fast, port: x1 }]
  - endpoints: [{ node: h2, port: nic1 }, { node: fast, port: x2 }]
  - endpoints: [{ node: h3, port: nic1 }, { node: fast, port: x3 }]
`)
    const scene = drawNetwork(model, { metrics: () => testMetrics })
    expect(scene.wires).toHaveLength(9)
    const y = (id: string) => scene.nodes.find((n) => n.node.id === id)?.box.y ?? 0
    expect(y('fast')).toBeLessThan(y('h2'))
    expect(scene.ports?.find((p) => p.nodeId === 'h2' && p.name === 'nic1')?.side).toBe('top')
  })
})

describe('a boundary the drawing layer names', () => {
  it('reports one that names nothing on a line and draws from the rest', () => {
    const model = readNetworkModel(wan)
    const named = {
      ...model,
      drawing: { ...model.drawing, settings: { boundary: ['nope', 'wan'] } },
    }
    const scene = drawNetwork(named, { metrics: () => testMetrics })
    expect(scene.issues).toEqual([{ code: 'unknown-boundary', id: 'nope' }])
    expect(scene.wires).toHaveLength(2)
  })
})
