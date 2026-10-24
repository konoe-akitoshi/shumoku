import { describe, expect, it } from 'vitest'
import type { NetworkModel } from './network-model.js'
import { applyGraphEdits } from './network-model-edit.js'
import { fromNetworkGraph, writeNetworkModel } from './network-model-from-graph.js'
import { readNetworkModel, toNetworkGraph } from './network-model-graph.js'
import type { NetworkGraph } from './types.js'

const yaml = `
name: Office
groups:
  - id: hq
    label: HQ
    groups:
      - id: rack
segments:
  - id: mgmt
    vlan: 10
    prefix: 10.0.10.0/24
    addresses:
      core: 10.0.10.1
routingDomains:
  - id: internet
redundancy:
  - id: pair
    nodes: [core, edge]
nodes:
  - id: core
    label: Core
    type: l3-switch
    product: Cisco/Catalyst/C9300
    software: IOS-XE 17.9
    asn: 65001
    group: rack
  - id: edge
    type: router
  - id: vm
    type: server
    host: edge
links:
  - id: l1
    endpoints: [{ node: core, port: ge-1 }, { node: edge, port: ge-0 }]
    speed: 2.5G
    segments: [mgmt]
    description: uplink
  - endpoints: [{ node: edge }, { routingDomain: internet }]
`

function edit(model: NetworkModel, change: (graph: NetworkGraph) => NetworkGraph): NetworkModel {
  const drawn = toNetworkGraph(model)
  return applyGraphEdits(model, drawn, change(structuredClone(drawn)))
}

describe('applyGraphEdits', () => {
  const model = readNetworkModel(yaml)

  it('keeps the model as it is when nothing is edited', () => {
    expect(edit(model, (g) => g)).toBe(model)
  })

  it('writes a moved node to the drawing layer and leaves the configuration alone', () => {
    const next = edit(model, (g) => ({
      ...g,
      nodes: g.nodes.map((n) => (n.id === 'core' ? { ...n, position: { x: 10, y: 20 } } : n)),
    }))
    expect(next.config).toEqual(model.config)
    expect(next.drawing?.nodes?.core?.position).toEqual({ x: 10, y: 20 })
  })

  it('keeps what the graph cannot say when a node is renamed', () => {
    const next = edit(model, (g) => ({
      ...g,
      nodes: g.nodes.map((n) => (n.id === 'core' ? { ...n, label: 'Core 1' } : n)),
    }))
    const core = next.config.nodes.find((n) => n.id === 'core')
    expect(core).toEqual({
      id: 'core',
      label: 'Core 1',
      type: 'l3-switch',
      product: 'Cisco/Catalyst/C9300',
      software: 'IOS-XE 17.9',
      asn: 65001,
      group: 'rack',
    })
    expect(next.config.routingDomains).toEqual(model.config.routingDomains)
    expect(next.config.links).toEqual(model.config.links)
  })

  it('adds a node and a link, and removes one with what refers to it', () => {
    const next = edit(model, (g) => ({
      ...g,
      nodes: [...g.nodes.filter((n) => n.id !== 'edge'), { id: 'ap', label: 'AP' }],
      links: [
        ...g.links.filter((l) => l.from.node !== 'edge' && l.to.node !== 'edge'),
        { id: 'l2', from: { node: 'core', port: 'ge-2' }, to: { node: 'ap', port: '' } },
      ],
    }))
    expect(next.config.nodes.map((n) => n.id)).toEqual(['core', 'vm', 'ap'])
    expect(next.config.nodes.find((n) => n.id === 'vm')?.host).toBeUndefined()
    expect(next.config.redundancy).toBeUndefined()
    expect(next.config.links).toEqual([
      // The routing domain's link is not drawn, so it stays.
      { endpoints: [{ node: 'edge' }, { routingDomain: 'internet' }] },
      { id: 'l2', endpoints: [{ node: 'core', port: 'ge-2' }, { node: 'ap' }] },
    ])
  })

  it('keeps a link as written until the field the graph draws from it is edited', () => {
    const plugged = edit(model, (g) => ({
      ...g,
      links: g.links.map((l) =>
        l.id === 'l1' ? { ...l, cable: { medium: 'fiber-mm' as const, length_m: 30 } } : l,
      ),
    }))
    const link = plugged.config.links.find((l) => l.id === 'l1')
    expect(link).toMatchObject({ speed: '2.5G', segments: ['mgmt'], description: 'uplink' })
    expect(link).toMatchObject({ cable: 'fiber-mm', length: '30m' })
  })

  it('moves a link between segments when its VLANs or end addresses change', () => {
    const next = edit(model, (g) => ({
      ...g,
      links: g.links.map((l) =>
        l.id === 'l1' ? { ...l, vlan: [10, 20], from: { ...l.from, ip: '10.0.10.2' } } : l,
      ),
    }))
    expect(next.config.links.find((l) => l.id === 'l1')?.segments).toEqual(['mgmt', 'vlan-20'])
    const mgmt = next.config.segments?.find((s) => s.id === 'mgmt')
    expect(mgmt).toMatchObject({ prefix: '10.0.10.0/24', addresses: { core: '10.0.10.2' } })
    expect(next.config.segments?.find((s) => s.id === 'vlan-20')).toEqual({
      id: 'vlan-20',
      vlan: 20,
    })
  })

  it('writes a redundancy kind to the set its ends form', () => {
    const next = edit(model, (g) => ({
      ...g,
      links: g.links.map((l) => (l.id === 'l1' ? { ...l, redundancy: 'mlag' as const } : l)),
    }))
    expect(next.config.redundancy).toEqual([{ id: 'pair', nodes: ['core', 'edge'], kind: 'mlag' }])
  })

  it('retains hosting when communication links are removed', () => {
    const next = edit(model, (g) => ({
      ...g,
      links: [],
    }))
    expect(next.config.nodes.find((n) => n.id === 'vm')).toEqual({
      id: 'vm',
      type: 'server',
      host: 'edge',
    })
  })

  it('moves a group to another parent', () => {
    const next = edit(model, (g) => ({
      ...g,
      subgraphs: g.subgraphs?.map(({ parent: _, ...sg }) => sg),
    }))
    expect(next.config.groups).toEqual([{ id: 'hq', label: 'HQ' }, { id: 'rack' }])
  })
})

describe('a node with a host is where its host is', () => {
  const hosted = readNetworkModel(`
groups:
  - { id: rack }
  - { id: other }
segments:
  - { id: lan, group: rack, addresses: { vm: 10.0.0.9, plain: 10.0.0.8 } }
redundancy:
  - { id: pool, nodes: [h1, h2] }
nodes:
  - { id: h1, group: rack }
  - { id: h2, group: rack }
  - { id: vm, type: virtual-machine, host: h1 }
  - { id: pooled, type: virtual-machine, host: pool }
  - { id: plain }
links: []
`)

  it('is drawn and written back without a group, and the written text reads again', () => {
    const graph = toNetworkGraph(hosted)
    expect(graph.nodes.find((n) => n.id === 'vm')?.parent).toBeUndefined()
    // A node with no host is still placed by its segments.
    expect(graph.nodes.find((n) => n.id === 'plain')?.parent).toBe('rack')
    const written = writeNetworkModel(fromNetworkGraph(graph))
    expect(readNetworkModel(written).config.nodes.find((n) => n.id === 'vm')?.group).toBeUndefined()
  })

  it('keeps the host and does not write the group a drawing moved it into', () => {
    const next = edit(hosted, (g) => ({
      ...g,
      nodes: g.nodes.map((n) =>
        n.id === 'vm' || n.id === 'pooled' ? { ...n, parent: 'other' } : n,
      ),
    }))
    for (const id of ['vm', 'pooled']) {
      const node = next.config.nodes.find((n) => n.id === id)
      expect(node?.group).toBeUndefined()
      expect(node?.host).toBeDefined()
    }
    expect(readNetworkModel(writeNetworkModel(next)).config.nodes).toHaveLength(5)
  })
})
