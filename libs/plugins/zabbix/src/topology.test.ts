import { describe, expect, it } from 'vitest'
import { convertSysmapToGraph } from './topology.js'
import type { ZabbixHost, ZabbixSysmap } from './types.js'

const OPTS = { sourceId: 'inst1', observedAt: 1_700_000_000_000 }

/** A small but representative standard sysmap: a host-group area frame, two
 *  host elements both in that group, a decorative image element, a host↔host
 *  link, and a host↔image link (which must be dropped). */
function fixtureMap(): ZabbixSysmap {
  return {
    sysmapid: '5',
    name: 'Backbone',
    width: '1920',
    height: '1080',
    selements: [
      // host-group area frame (groupid 98)
      {
        selementid: '100',
        elementtype: '3',
        elementsubtype: '1',
        label: '{HOST.NAME}',
        elements: [{ groupid: '98' }],
      },
      // host-group tile with no member hosts on this map → subgraph dropped
      { selementid: '101', elementtype: '3', label: 'empty', elements: [{ groupid: '999' }] },
      // host elements
      {
        selementid: '200',
        elementtype: '0',
        label: '{HOST.NAME}',
        elements: [{ hostid: '12758' }],
      },
      {
        selementid: '201',
        elementtype: '0',
        label: '{HOST.NAME}',
        elements: [{ hostid: '12759' }],
      },
      // decorative image element (no element ref)
      { selementid: '300', elementtype: '4', label: '', elements: [] },
    ],
    links: [
      // host ↔ host (kept)
      {
        linkid: '900',
        selementid1: '200',
        selementid2: '201',
        drawtype: '2',
        color: '0000FF',
        label: '',
      },
      // host ↔ image (dropped — image isn't a resolved host node)
      { linkid: '901', selementid1: '200', selementid2: '300', drawtype: '0', color: '000000' },
    ],
  }
}

function fixtureHosts(): Map<string, ZabbixHost> {
  const hosts: ZabbixHost[] = [
    {
      hostid: '12758',
      host: '172.16.0.2',
      name: 'ptx10002-60mr.noc',
      status: '0',
      interfaces: [{ ip: '172.16.0.2', main: '1', type: '2', useip: '1' }],
      hostgroups: [{ groupid: '98', name: '016.000.Backbone Routers' }],
      inventory: { hardware: 'Juniper Networks, Inc. ptx10002-60mr , kernel JUNOS 26.2' },
    },
    {
      hostid: '12759',
      host: '172.16.0.3',
      name: 'cisco8712.noc',
      status: '0',
      interfaces: [{ ip: '172.16.0.3', main: '1', type: '2', useip: '1' }],
      hostgroups: [{ groupid: '98', name: '016.000.Backbone Routers' }],
    },
  ]
  return new Map(hosts.map((h) => [h.hostid, h]))
}

const GROUP_NAMES = new Map([['98', '016.000.Backbone Routers']])

describe('convertSysmapToGraph', () => {
  it('maps host elements to nodes with identity + provenance', () => {
    const g = convertSysmapToGraph(fixtureMap(), fixtureHosts(), GROUP_NAMES, OPTS)

    expect(g.name).toBe('Backbone')
    expect(g.nodes).toHaveLength(2)

    const ptx = g.nodes.find((n) => n.id === 'inst1:se:200')
    expect(ptx).toBeDefined()
    expect(ptx?.label).toBe('ptx10002-60mr.noc') // host.name, not the macro label
    expect(ptx?.identity?.mgmtIp).toBe('172.16.0.2')
    expect(ptx?.identity?.sysName).toBe('172.16.0.2')
    expect(ptx?.identity?.vendorIds?.['zabbix-hostid']).toBe('12758')
    expect(ptx?.provenance).toEqual({ source: 'inst1', observedAt: OPTS.observedAt })
    expect(ptx?.metadata?.['zabbixStatus']).toBe('monitored')
  })

  it('derives vendor/model from inventory.hardware (best-effort)', () => {
    const g = convertSysmapToGraph(fixtureMap(), fixtureHosts(), GROUP_NAMES, OPTS)
    const ptx = g.nodes.find((n) => n.id === 'inst1:se:200')
    expect(ptx?.spec?.kind).toBe('hardware')
    expect(ptx?.spec).toMatchObject({ vendor: 'juniper', model: 'ptx10002-60mr' })

    // host without inventory → bare hardware spec, no vendor/model
    const cisco = g.nodes.find((n) => n.id === 'inst1:se:201')
    expect(cisco?.spec).toEqual({ kind: 'hardware' })
  })

  it('groups by host-group membership and nests member nodes (default)', () => {
    const g = convertSysmapToGraph(fixtureMap(), fixtureHosts(), GROUP_NAMES, OPTS)
    // both hosts are in group 98 → one subgraph, both parented; empty group 999
    // (a type-3 tile with no member host) is irrelevant to membership grouping
    expect(g.subgraphs).toHaveLength(1)
    const sg = g.subgraphs?.[0]
    expect(sg?.id).toBe('inst1:sg:98')
    expect(sg?.label).toBe('016.000.Backbone Routers')
    for (const n of g.nodes) expect(n.parent).toBe('inst1:sg:98')
  })

  it('picks the most-specific (fewest on-map members) host group, and honors groupExclude', () => {
    // 3 hosts all in catch-all "all" (3 members); only host A is also in "seg-a" (1 member)
    const mk = (id: string, groups: Array<[string, string]>): ZabbixHost => ({
      hostid: id,
      host: `h${id}`,
      name: `h${id}`,
      status: '0',
      hostgroups: groups.map(([groupid, name]) => ({ groupid, name })),
    })
    const hosts = new Map([
      [
        '1',
        mk('1', [
          ['10', 'all'],
          ['20', 'seg-a'],
        ]),
      ],
      ['2', mk('2', [['10', 'all']])],
      ['3', mk('3', [['10', 'all']])],
    ])
    const map: ZabbixSysmap = {
      sysmapid: '9',
      name: 'M',
      selements: [
        { selementid: 'a', elementtype: '0', elements: [{ hostid: '1' }] },
        { selementid: 'b', elementtype: '0', elements: [{ hostid: '2' }] },
        { selementid: 'c', elementtype: '0', elements: [{ hostid: '3' }] },
      ],
      links: [],
    }

    const g = convertSysmapToGraph(map, hosts, new Map(), OPTS)
    // host A → most-specific "seg-a" (1 < 3); B,C → "all"
    expect(g.nodes.find((n) => n.id === 'inst1:se:a')?.parent).toBe('inst1:sg:20')
    expect(g.nodes.find((n) => n.id === 'inst1:se:b')?.parent).toBe('inst1:sg:10')
    expect(new Set((g.subgraphs ?? []).map((s) => s.id))).toEqual(
      new Set(['inst1:sg:20', 'inst1:sg:10']),
    )

    // excluding "all" leaves B,C ungrouped and only the seg-a subgraph
    const g2 = convertSysmapToGraph(map, hosts, new Map(), { ...OPTS, groupExclude: ['all'] })
    expect(g2.nodes.find((n) => n.id === 'inst1:se:a')?.parent).toBe('inst1:sg:20')
    expect(g2.nodes.find((n) => n.id === 'inst1:se:b')?.parent).toBeUndefined()
    expect(g2.subgraphs).toHaveLength(1)
  })

  it("groupBy:'none' uses only standard host-group area elements", () => {
    // fixtureMap has a type-3 area element for group 98 → subgraph from it
    const g = convertSysmapToGraph(fixtureMap(), fixtureHosts(), GROUP_NAMES, {
      ...OPTS,
      groupBy: 'none',
    })
    expect(g.subgraphs).toHaveLength(1)
    expect(g.subgraphs?.[0]?.id).toBe('inst1:sg:98')
    // label resolved from groupNamesById in the area path
    expect(g.subgraphs?.[0]?.label).toBe('016.000.Backbone Routers')
    for (const n of g.nodes) expect(n.parent).toBe('inst1:sg:98')
  })

  it('maps host↔host links and synthesizes a port per endpoint', () => {
    const g = convertSysmapToGraph(fixtureMap(), fixtureHosts(), GROUP_NAMES, OPTS)
    // the host↔image link (901) is dropped
    expect(g.links).toHaveLength(1)
    const link = g.links[0]
    expect(link.id).toBe('inst1:link:900')
    expect(link.from.node).toBe('inst1:se:200')
    expect(link.to.node).toBe('inst1:se:201')
    expect(link.type).toBe('thick') // drawtype 2
    expect(link.style?.stroke).toBe('#0000FF')

    // endpoints reference real synthesized ports on their nodes
    const fromNode = g.nodes.find((n) => n.id === link.from.node)
    const toNode = g.nodes.find((n) => n.id === link.to.node)
    expect(fromNode?.ports?.some((p) => p.id === link.from.port)).toBe(true)
    expect(toNode?.ports?.some((p) => p.id === link.to.port)).toBe(true)
  })

  it('skips host elements whose host did not resolve', () => {
    const hosts = fixtureHosts()
    hosts.delete('12759') // host.get didn't return it
    const g = convertSysmapToGraph(fixtureMap(), hosts, GROUP_NAMES, OPTS)
    expect(g.nodes).toHaveLength(1)
    expect(g.links).toHaveLength(0) // its only link now has an unresolved endpoint
  })

  it("emits no subgraphs for a map with no host-group area elements (groupBy:'none')", () => {
    const map: ZabbixSysmap = {
      sysmapid: '7',
      name: 'Flat',
      selements: [
        { selementid: '1', elementtype: '0', elements: [{ hostid: '12758' }] },
        { selementid: '2', elementtype: '0', elements: [{ hostid: '12759' }] },
      ],
      links: [],
    }
    const g = convertSysmapToGraph(map, fixtureHosts(), GROUP_NAMES, { ...OPTS, groupBy: 'none' })
    expect(g.nodes).toHaveLength(2)
    expect(g.subgraphs).toBeUndefined()
    expect(g.links).toHaveLength(0)
    for (const n of g.nodes) expect(n.parent).toBeUndefined()
  })
})
