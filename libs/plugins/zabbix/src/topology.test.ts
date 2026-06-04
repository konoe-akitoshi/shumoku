import { describe, expect, it } from 'vitest'
import { convertLldpToGraph } from './topology.js'
import type { ZabbixHost, ZabbixLldpNeighbor } from './types.js'

const OPTS = { sourceId: 'inst1', observedAt: 1_700_000_000_000 }

function hosts(): ZabbixHost[] {
  return [
    {
      hostid: '1',
      host: '172.16.0.2', // host.host is the IP here — must NOT be used as sysName
      name: 'ptxA.noc',
      status: '0',
      interfaces: [{ ip: '172.16.0.2', main: '1', type: '2', useip: '1' }],
      hostgroups: [{ groupid: '98', name: '016.000.seg' }],
      inventory: { hardware: 'Juniper Networks, Inc. ptx10002-60mr , kernel JUNOS 26.2' },
    },
    {
      hostid: '2',
      host: '172.16.0.3',
      name: 'ciscoB.noc',
      status: '0',
      interfaces: [{ ip: '172.16.0.3', main: '1', type: '2', useip: '1' }],
      hostgroups: [{ groupid: '98', name: '016.000.seg' }],
    },
  ]
}

/** A↔B reported from both ends (bidirectional LLDP), plus A→external neighbor. */
function neighbors(): Map<string, ZabbixLldpNeighbor[]> {
  return new Map([
    [
      '1',
      [
        {
          localIf: 'et-0/0/1',
          remSysname: 'ciscoB.noc',
          remPortId: 'et-0/0/9',
          speedBps: 100_000_000_000,
        },
        { localIf: 'et-0/0/2', remSysname: 'extX.noc', remPortId: 'ge-1', speedBps: 1_000_000_000 },
        { localIf: 'et-0/0/3', remSysname: '* No Info *' }, // no neighbor → ignored
      ],
    ],
    // mirror of the A↔B link from B's side — must de-dup to a single link
    [
      '2',
      [
        {
          localIf: 'et-0/0/9',
          remSysname: 'ptxA.noc',
          remPortId: 'et-0/0/1',
          speedBps: 100_000_000_000,
        },
      ],
    ],
  ])
}

describe('convertLldpToGraph', () => {
  it('builds host nodes with identity (sysName = host.name, not host.host)', () => {
    const g = convertLldpToGraph(hosts(), new Map(), OPTS)
    const a = g.nodes.find((n) => n.id === 'inst1:host:1')
    expect(a?.label).toBe('ptxA.noc')
    expect(a?.identity?.sysName).toBe('ptxA.noc') // NOT '172.16.0.2'
    expect(a?.identity?.mgmtIp).toBe('172.16.0.2')
    expect(a?.identity?.vendorIds?.['zabbix-hostid']).toBe('1')
    expect(a?.spec).toMatchObject({ vendor: 'juniper', model: 'ptx10002-60mr' })
    expect(a?.provenance).toEqual({ source: 'inst1', observedAt: OPTS.observedAt })
    expect(a?.parent).toBe('inst1:sg:98')
    // FQDN exposed for the compound layout (ghost detection + domain banding)
    expect(a?.metadata?.['hostname']).toBe('ptxA.noc')
  })

  it('builds links from LLDP neighbors with real ports + bandwidth, de-duping the mirror', () => {
    const g = convertLldpToGraph(hosts(), neighbors(), OPTS)
    // A↔B (deduped from both directions) + A↔extX = 2 links
    expect(g.links).toHaveLength(2)

    const ab = g.links.find(
      (l) =>
        (l.from.node === 'inst1:host:1' && l.to.node === 'inst1:host:2') ||
        (l.from.node === 'inst1:host:2' && l.to.node === 'inst1:host:1'),
    )
    expect(ab).toBeDefined()
    expect(ab?.metadata?.['discoveredVia']).toBe('zabbix-lldp')
    expect(ab?.metadata?.['speedBps']).toBe(100_000_000_000)

    // real port labels on both ends
    const a = g.nodes.find((n) => n.id === 'inst1:host:1')
    expect(a?.ports?.map((p) => p.label).sort()).toEqual(['et-0/0/1', 'et-0/0/2'])
    expect(a?.ports?.find((p) => p.label === 'et-0/0/1')?.speed).toBe('100g')
    const b = g.nodes.find((n) => n.id === 'inst1:host:2')
    expect(b?.ports?.map((p) => p.label)).toEqual(['et-0/0/9'])

    // every link endpoint references a real port on its node
    for (const l of g.links) {
      const fn = g.nodes.find((n) => n.id === l.from.node)
      const tn = g.nodes.find((n) => n.id === l.to.node)
      expect(fn?.ports?.some((p) => p.id === l.from.port)).toBe(true)
      expect(tn?.ports?.some((p) => p.id === l.to.port)).toBe(true)
    }
  })

  it('synthesizes an external node for a neighbor that is not a Zabbix host', () => {
    const g = convertLldpToGraph(hosts(), neighbors(), OPTS)
    const ext = g.nodes.find((n) => n.id === 'inst1:ext:extX.noc')
    expect(ext).toBeDefined()
    expect(ext?.label).toBe('extX.noc')
    expect(ext?.identity?.sysName).toBe('extX.noc')
    expect(ext?.metadata?.['external']).toBe(true)
    expect(ext?.parent).toBeUndefined()
    expect(g.nodes).toHaveLength(3) // A, B, extX
  })

  it('drops links to non-host neighbors when includeExternalNeighbors=false', () => {
    const g = convertLldpToGraph(hosts(), neighbors(), { ...OPTS, includeExternalNeighbors: false })
    expect(g.nodes.find((n) => n.id === 'inst1:ext:extX.noc')).toBeUndefined()
    expect(g.nodes).toHaveLength(2)
    expect(g.links).toHaveLength(1) // only A↔B
  })

  it("emits no subgraphs and no parents with groupBy:'none'", () => {
    const g = convertLldpToGraph(hosts(), neighbors(), { ...OPTS, groupBy: 'none' })
    expect(g.subgraphs).toBeUndefined()
    for (const n of g.nodes) expect(n.parent).toBeUndefined()
  })

  it('puts a host with no LLDP neighbors in the graph as a bare node', () => {
    const g = convertLldpToGraph(hosts(), new Map(), OPTS)
    expect(g.nodes).toHaveLength(2)
    expect(g.links).toHaveLength(0)
    expect(g.nodes.every((n) => !n.ports)).toBe(true)
  })
})
