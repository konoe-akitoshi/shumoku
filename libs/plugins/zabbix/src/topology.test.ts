import { describe, expect, it } from 'vitest'
import { convertZabbixToGraph } from './topology.js'
import type { ZabbixHost, ZabbixLldpNeighbor } from './types.js'

const OPTS = { sourceId: 'inst1', observedAt: 1_700_000_000_000 }
const NO_NBR = new Map<string, ZabbixLldpNeighbor[]>()
const NO_DESCR = new Map<string, string>()

function mkHost(over: Partial<ZabbixHost> & { hostid: string; name: string }): ZabbixHost {
  return { host: '0.0.0.0', status: '0', ...over }
}

describe('convertZabbixToGraph', () => {
  it('builds host nodes: sysName=host.name, mgmtIp, hostname metadata, host-group parent', () => {
    const hosts = [
      mkHost({
        hostid: '1',
        host: '172.16.0.2', // host.host is the IP — must NOT be used as sysName
        name: 'ptxA.noc',
        interfaces: [{ ip: '172.16.0.2', main: '1', type: '2', useip: '1' }],
        hostgroups: [{ groupid: '98', name: '016.000.seg' }],
      }),
    ]
    const g = convertZabbixToGraph(hosts, NO_NBR, NO_DESCR, OPTS)
    const n = g.nodes[0]
    expect(n?.label).toBe('ptxA.noc')
    expect(n?.identity?.sysName).toBe('ptxA.noc')
    expect(n?.identity?.mgmtIp).toBe('172.16.0.2')
    expect(n?.identity?.vendorIds?.['zabbix-hostid']).toBe('1')
    expect(n?.metadata?.['hostname']).toBe('ptxA.noc')
    expect(n?.parent).toBe('inst1:sg:016.000.seg')
    expect(g.subgraphs?.[0]?.label).toBe('016.000.seg')
  })

  it('derives device type/vendor/model from SNMP sysDescr when inventory is empty', () => {
    const hosts = [mkHost({ hostid: '1', name: 'ptxA.noc' })]
    const descr = new Map([
      ['1', 'Juniper Networks, Inc. ptx10002-60mr internet router, JUNOS 26.2'],
    ])
    const g = convertZabbixToGraph(hosts, NO_NBR, descr, OPTS)
    expect(g.nodes[0]?.spec).toMatchObject({ kind: 'hardware', vendor: 'juniper', type: 'router' })
    expect(g.nodes[0]?.spec?.model).toContain('ptx10002')
  })

  it('prefers structured inventory.{vendor,model,type} over parsing', () => {
    const hosts = [
      mkHost({
        hostid: '1',
        name: 'x',
        inventory: { vendor: 'Cisco', model: 'C9300', type: 'switch' },
      }),
    ]
    const g = convertZabbixToGraph(hosts, NO_NBR, NO_DESCR, OPTS)
    expect(g.nodes[0]?.spec).toMatchObject({ vendor: 'cisco', model: 'C9300', type: 'l2-switch' })
  })

  it('honors Zabbix "/" nested host groups as nested subgraphs', () => {
    const hosts = [
      mkHost({ hostid: '1', name: 'x', hostgroups: [{ groupid: '5', name: 'DC/Rack1/Top' }] }),
    ]
    const g = convertZabbixToGraph(hosts, NO_NBR, NO_DESCR, OPTS)
    expect(g.nodes[0]?.parent).toBe('inst1:sg:DC/Rack1/Top')
    const byId = new Map((g.subgraphs ?? []).map((s) => [s.id, s]))
    expect(byId.get('inst1:sg:DC')?.label).toBe('DC')
    expect(byId.get('inst1:sg:DC')?.parent).toBeUndefined()
    expect(byId.get('inst1:sg:DC/Rack1')?.parent).toBe('inst1:sg:DC')
    expect(byId.get('inst1:sg:DC/Rack1/Top')?.parent).toBe('inst1:sg:DC/Rack1')
    expect(byId.get('inst1:sg:DC/Rack1/Top')?.label).toBe('Top')
  })

  it('picks the most-specific group; a catch-all (largest) loses', () => {
    const mk = (id: string, extra: boolean) =>
      mkHost({
        hostid: id,
        name: `h${id}`,
        hostgroups: [
          { groupid: '9', name: 'all' },
          ...(extra ? [{ groupid: '1', name: 'seg' }] : []),
        ],
      })
    const g = convertZabbixToGraph(
      [mk('1', true), mk('2', false), mk('3', false)],
      NO_NBR,
      NO_DESCR,
      OPTS,
    )
    expect(g.nodes.find((n) => n.id === 'inst1:host:1')?.parent).toBe('inst1:sg:seg')
    expect(g.nodes.find((n) => n.id === 'inst1:host:2')?.parent).toBe('inst1:sg:all')
  })

  it('builds LLDP links with real ports + bandwidth, de-duping the mirror', () => {
    const hosts = [mkHost({ hostid: '1', name: 'A' }), mkHost({ hostid: '2', name: 'B' })]
    const nbr = new Map<string, ZabbixLldpNeighbor[]>([
      [
        '1',
        [
          {
            localIf: 'et-0/0/1',
            remSysname: 'B',
            remPortId: 'et-0/0/9',
            speedBps: 100_000_000_000,
          },
        ],
      ],
      [
        '2',
        [
          {
            localIf: 'et-0/0/9',
            remSysname: 'A',
            remPortId: 'et-0/0/1',
            speedBps: 100_000_000_000,
          },
        ],
      ],
    ])
    const g = convertZabbixToGraph(hosts, nbr, NO_DESCR, OPTS)
    expect(g.links).toHaveLength(1)
    expect(g.links[0]?.metadata?.['discoveredVia']).toBe('zabbix-lldp')
    expect(g.links[0]?.metadata?.['speedBps']).toBe(100_000_000_000)
    expect(
      g.nodes.find((n) => n.id === 'inst1:host:1')?.ports?.find((p) => p.label === 'et-0/0/1')
        ?.speed,
    ).toBe('100g')
  })

  it('adds a PARENT-tag link where LLDP saw no neighbor', () => {
    const hosts = [
      mkHost({ hostid: '1', name: 'child.life', tags: [{ tag: 'PARENT', value: 'up.noc' }] }),
      mkHost({ hostid: '2', name: 'up.noc' }),
    ]
    const g = convertZabbixToGraph(hosts, NO_NBR, NO_DESCR, OPTS)
    expect(g.links).toHaveLength(1)
    expect(g.links[0]?.metadata?.['discoveredVia']).toBe('zabbix-parent-tag')
    expect([g.links[0]?.from.node, g.links[0]?.to.node].sort()).toEqual([
      'inst1:host:1',
      'inst1:host:2',
    ])
  })

  it('does not duplicate an LLDP link with a PARENT-tag link', () => {
    const hosts = [
      mkHost({ hostid: '1', name: 'A', tags: [{ tag: 'PARENT', value: 'B' }] }),
      mkHost({ hostid: '2', name: 'B' }),
    ]
    const nbr = new Map<string, ZabbixLldpNeighbor[]>([
      ['1', [{ localIf: 'e1', remSysname: 'B', remPortId: 'e2' }]],
    ])
    const g = convertZabbixToGraph(hosts, nbr, NO_DESCR, OPTS)
    expect(g.links).toHaveLength(1)
    expect(g.links[0]?.metadata?.['discoveredVia']).toBe('zabbix-lldp')
  })

  it('synthesizes external nodes, or drops them when includeExternalNeighbors=false', () => {
    const hosts = [mkHost({ hostid: '1', name: 'A' })]
    const nbr = new Map<string, ZabbixLldpNeighbor[]>([
      ['1', [{ localIf: 'e1', remSysname: 'ext.x', remPortId: 'p' }]],
    ])
    const g = convertZabbixToGraph(hosts, nbr, NO_DESCR, OPTS)
    expect(g.nodes.find((n) => n.id === 'inst1:ext:ext.x')?.metadata?.['external']).toBe(true)
    const g2 = convertZabbixToGraph(hosts, nbr, NO_DESCR, {
      ...OPTS,
      includeExternalNeighbors: false,
    })
    expect(g2.nodes).toHaveLength(1)
    expect(g2.links).toHaveLength(0)
  })

  it("emits no subgraphs/parents with groupBy:'none'", () => {
    const hosts = [mkHost({ hostid: '1', name: 'A', hostgroups: [{ groupid: '1', name: 'g' }] })]
    const g = convertZabbixToGraph(hosts, NO_NBR, NO_DESCR, { ...OPTS, groupBy: 'none' })
    expect(g.subgraphs).toBeUndefined()
    expect(g.nodes[0]?.parent).toBeUndefined()
  })
})
