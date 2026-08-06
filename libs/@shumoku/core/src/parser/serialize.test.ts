// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { YamlParser } from './parser.js'
import { dumpGraph } from './serialize.js'

const parse = (text: string) => new YamlParser().parse(text)
const fatal = (text: string) => parse(text).warnings?.find((w) => w.code === 'PARSE_ERROR')?.message

describe('dumpGraph', () => {
  it('quotes labels containing a newline so the output stays valid YAML', () => {
    // A hand-rolled `label: ${value}` writer emits the newline raw, which makes
    // the document unparseable ("a multiline key may not be an implicit key").
    const graph = parse(`
version: '1'
nodes:
  - id: seg
    label: "Management / VLAN 10\\n10.153.0.0/24"
links: []
`).graph
    expect(graph.nodes[0]?.label).toBe('Management / VLAN 10\n10.153.0.0/24')

    const dumped = dumpGraph(graph)
    expect(fatal(dumped)).toBeUndefined()
    expect(parse(dumped).graph.nodes[0]?.label).toBe('Management / VLAN 10\n10.153.0.0/24')
  })

  it('round-trips node identity, ports and metadata', () => {
    const graph = parse(`
version: '1'
nodes:
  - id: fw01
    label: Firewall
    type: firewall
    identity:
      mgmtIp: 10.0.0.1
      sysName: fw01
      vendorIds:
        zabbix-hostid: '10780'
    metadata:
      owner: netops
    ports:
      - id: p1
        label: eth0
        interfaceName: ethernet1/1
        identity:
          ifName: ethernet1/1
          ifIndex: 2
links: []
`).graph

    const reparsed = parse(dumpGraph(graph)).graph
    const node = reparsed.nodes[0]
    expect(node?.identity).toEqual({
      mgmtIp: '10.0.0.1',
      sysName: 'fw01',
      vendorIds: { 'zabbix-hostid': '10780' },
    })
    expect(node?.metadata).toEqual({ owner: 'netops' })
    expect(node?.ports?.[0]?.identity).toEqual({ ifName: 'ethernet1/1', ifIndex: 2 })
    expect(node?.spec).toEqual({ kind: 'hardware', type: 'firewall' })
  })

  it('round-trips link ids, labels, types and subgraph nesting', () => {
    const graph = parse(`
version: '1'
nodes:
  - id: a
    label: A
    parent: sheet-inner
  - id: b
    label: B
links:
  - id: tunnel0
    label: EtherIP/IPv6
    type: dashed
    from:
      node: a
      port: p1
    to:
      node: b
      port: p2
subgraphs:
  - id: sheet-outer
    label: Outer
  - id: sheet-inner
    label: Inner
    parent: sheet-outer
`).graph

    const reparsed = parse(dumpGraph(graph)).graph
    const link = reparsed.links[0]
    expect(link?.id).toBe('tunnel0')
    expect(link?.label).toBe('EtherIP/IPv6')
    expect(link?.type).toBe('dashed')
    expect(reparsed.subgraphs?.find((s) => s.id === 'sheet-inner')?.parent).toBe('sheet-outer')
    expect(reparsed.nodes.find((n) => n.id === 'a')?.parent).toBe('sheet-inner')
  })

  it('is a fixed point: parse(dump(g)) deep-equals g', () => {
    const graph = parse(`
version: '1'
name: Fixture
nodes:
  - id: fw01
    label: "Firewall\\n10.0.0.1"
    type: firewall
    vendor: paloalto
    identity:
      mgmtIp: 10.0.0.1
    ports:
      - id: p1
        label: eth1/1
        identity:
          ifName: ethernet1/1
  - id: seg
    label: Segment
    type: segment
    parent: sheet-a
    metadata:
      subnet: 10.0.0.0/24
links:
  - id: l1
    type: dashed
    from:
      node: fw01
      port: p1
    to:
      node: seg
      port: seg-p
subgraphs:
  - id: sheet-a
    label: Sheet A
`).graph

    expect(parse(dumpGraph(graph)).graph).toEqual(graph)
  })

  it('omits keys the graph leaves unset rather than emitting nulls', () => {
    const dumped = dumpGraph(
      parse("version: '1'\nnodes:\n  - id: n1\n    label: N1\nlinks: []\n").graph,
    )
    expect(dumped).not.toContain('null')
    expect(dumped).not.toContain('description:')
  })
})
