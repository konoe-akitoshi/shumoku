import { describe, expect, it } from 'vitest'
import { fromNetworkGraph } from './network-model-from-graph.js'
import { readNetworkModel, toNetworkGraph } from './network-model-graph.js'

const graph = toNetworkGraph(
  readNetworkModel(`
groups:
  - id: az-1a
routingDomains:
  - { id: inet, label: Internet }
connections:
  - { id: vpn-1, label: Site-to-Site VPN }
redundancy:
  - { id: vrrp, nodes: [rt-1, rt-2], kind: vrrp }
  - { id: prod, label: prod, nodes: [esx-1, esx-2] }
segments:
  - id: lan
    vlan: 10
    prefix: 10.0.10.0/24
    addresses: { rt-1: 10.0.10.2, vrrp: 10.0.10.1, web: 10.0.10.20 }
  - { id: outside, prefix: 192.0.2.0/29, group: az-1a, addresses: { app: 192.0.2.5 } }
  - { id: wan, addresses: { rt-1: [198.51.100.2, 2001:db8::2] } }
nodes:
  - { id: rt-1, product: Yamaha/RTX/RTX3510, asn: 65001, address: 10.255.0.1 }
  - { id: rt-2, description: "Backup router\\nsecond line" }
  - { id: esx-1 }
  - { id: esx-2 }
  - { id: web, host: esx-1 }
  - { id: db, host: prod, assumed: true }
  - { id: app }
links:
  - endpoints: [{ node: rt-1 }, { routingDomain: inet }]
  - endpoints: [{ node: rt-1, port: ge0 }, { node: web }]
    segments: [lan, wan]
  - endpoints: [{ node: rt-2 }, { node: app }]
    segments: [outside]
    description: uplink
    bandwidth: 300M
    cable: om4
    length: 3m
    assumed: true
  - endpoints: [{ node: rt-2 }, { node: app }]
    connection: vpn-1
    virtual: true
  - endpoints: [{ node: app }, { segment: outside }]
`),
)
const node = (id: string) => graph.nodes.find((n) => n.id === id)

describe('toNetworkGraph annotations', () => {
  it('keeps node facts structured and complete for compact display and details', () => {
    expect(node('rt-1')?.annotations).toEqual(
      expect.arrayContaining([
        { kind: 'identity', label: 'Model', value: 'RTX3510' },
        { kind: 'identity', label: 'AS', value: 'AS65001' },
        { kind: 'relation', label: 'VRRP', value: 'vrrp · rt-2' },
        { kind: 'relation', label: 'Routes to', value: 'Internet' },
        { kind: 'address', label: 'Address', value: '10.255.0.1' },
        { kind: 'address', label: 'wan', value: '2001:db8::2' },
        { kind: 'address', label: 'VIP', value: '10.0.10.1' },
      ]),
    )
    expect(node('rt-2')?.annotations).toContainEqual({
      kind: 'note',
      label: 'Description',
      value: 'Backup router\nsecond line',
    })
    expect(node('db')?.annotations).toEqual([
      { kind: 'badge', label: 'Kind', value: 'Hosted' },
      { kind: 'relation', label: 'Host pool', value: 'prod (esx-1, esx-2)' },
      { kind: 'status', label: 'Presence', value: 'Assumed' },
    ])
  })

  it('does not repeat an address a link end already shows', () => {
    expect(graph.links.find((l) => l.from.node === 'rt-1' && l.to.node === 'web')?.to.ip).toBe(
      '10.0.10.20',
    )
    expect(node('web')?.annotations?.some((a) => a.value === '10.0.10.20')).toBe(false)
  })

  it('annotates a segment node with its subnet', () => {
    expect(node('outside')?.annotations).toEqual([
      { kind: 'address', label: 'Subnet', value: '192.0.2.0/29' },
    ])
  })

  it('infers only the unambiguous segment group', () => {
    expect(node('app')?.parent).toBe('az-1a')
    expect(node('web')?.parent).toBeUndefined()
  })

  it('distinguishes link kinds and keeps physical details out of the primary caption', () => {
    const [uplink, tunnel] = graph.links.filter((l) => l.from.node === 'rt-2')
    expect(uplink?.annotations).toEqual(
      expect.arrayContaining([
        { kind: 'note', label: 'Description', value: 'uplink' },
        { kind: 'relation', label: 'Segment', value: 'outside' },
        { kind: 'identity', label: 'Bandwidth', value: 'cap 300M' },
        { kind: 'detail', label: 'Cable', value: 'om4 3m' },
      ]),
    )
    expect(uplink?.type).toBe('dotted')
    expect(tunnel?.annotations).toContainEqual({
      kind: 'identity',
      label: 'Connection',
      value: 'Site-to-Site VPN',
    })
    expect(tunnel?.type).toBe('dashed')
    expect(graph.links.some((l) => l.to.node === 'web' && l.from.node === 'esx-1')).toBe(false)
  })

  it('carries a drawn host on the node, not a pool or a link', () => {
    expect(node('web')?.host).toBe('esx-1')
    expect(node('db')?.host).toBeUndefined()
    const { config } = fromNetworkGraph(graph)
    expect(config.nodes.find((n) => n.id === 'web')?.host).toBe('esx-1')
  })

  it('keeps display annotations out of the configuration it splits back', () => {
    const { config } = fromNetworkGraph(graph)
    expect(JSON.stringify(config)).not.toContain('AS65001')
    expect(JSON.stringify(config)).not.toContain('annotations')
    expect(
      config.links.find(
        (l) => l.endpoints[0] && 'node' in l.endpoints[0] && l.endpoints[0].node === 'rt-2',
      )?.assumed,
    ).toBe(true)
  })
})
