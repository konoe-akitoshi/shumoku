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

describe('toNetworkGraph notes', () => {
  it('writes what a node says beyond its label under it', () => {
    expect(node('rt-1')?.notes).toEqual([
      'RTX3510',
      'AS65001',
      'vrrp with rt-2',
      'to Internet',
      '10.255.0.1',
      '+4 more',
    ])
    expect(node('rt-2')?.notes).toEqual(['vrrp with rt-1', 'VIP 10.0.10.1', 'Backup router'])
    expect(node('db')?.notes).toEqual(['on prod (esx-1, esx-2)', '(assumed)'])
  })

  it('does not repeat an address a link end already shows', () => {
    // web holds one address in the link's segments, so the link end shows it.
    expect(graph.links.find((l) => l.from.node === 'rt-1' && l.to.node === 'web')?.to.ip).toBe(
      '10.0.10.20',
    )
    expect(node('web')?.notes).toBeUndefined()
  })

  it('writes a segment drawn as a node with its VLAN, prefixes and routing domain', () => {
    expect(node('outside')?.notes).toEqual(['192.0.2.0/29'])
  })

  it('draws a node that names no group in the group of the segments holding its addresses', () => {
    expect(node('app')?.parent).toBe('az-1a')
    expect(node('web')?.parent).toBeUndefined()
  })

  it('writes what a link says beyond its line by it, and tells its kinds apart', () => {
    const [uplink, tunnel] = graph.links.filter((l) => l.from.node === 'rt-2')
    expect(uplink?.notes).toEqual(['uplink', 'outside', 'bandwidth 300M', 'om4 3m'])
    expect(uplink?.type).toBe('dotted')
    expect(tunnel?.notes).toEqual(['Site-to-Site VPN'])
    expect(tunnel?.type).toBe('dashed')
    expect(graph.links.find((l) => l.to.node === 'web' && l.from.node === 'esx-1')?.type).toBe(
      'runs-on',
    )
  })

  it('keeps notes out of the configuration it splits back', () => {
    const { config } = fromNetworkGraph(graph)
    expect(JSON.stringify(config)).not.toContain('AS65001')
    expect(
      config.links.find(
        (l) => l.endpoints[0] && 'node' in l.endpoints[0] && l.endpoints[0].node === 'rt-2',
      )?.assumed,
    ).toBe(true)
  })
})
