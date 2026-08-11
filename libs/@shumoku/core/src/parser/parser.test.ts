// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { YamlParser } from './parser.js'

describe('YamlParser', () => {
  describe('node identity', () => {
    it('parses identity.mgmtIp/chassisId/sysName/vendorIds from a node', () => {
      const yaml = `
version: '1.0'
nodes:
  - id: fw01
    label: Firewall
    identity:
      mgmtIp: 10.0.0.1
      chassisId: 'aa:bb:cc:dd:ee:ff'
      sysName: fw01.example.com
      vendorIds:
        zabbix-hostid: '10780'
links: []
`
      const result = new YamlParser().parse(yaml)
      expect(result.warnings).toBeUndefined()
      expect(result.graph.nodes[0]?.identity).toEqual({
        mgmtIp: '10.0.0.1',
        chassisId: 'aa:bb:cc:dd:ee:ff',
        sysName: 'fw01.example.com',
        vendorIds: { 'zabbix-hostid': '10780' },
      })
    })

    it('omits identity entirely when the node has none (no empty object)', () => {
      const yaml = `
version: '1.0'
nodes:
  - id: n1
    label: Plain Node
links: []
`
      const result = new YamlParser().parse(yaml)
      expect(result.graph.nodes[0]?.identity).toBeUndefined()
    })

    it('parses port-level identity.ifName alongside node identity', () => {
      const yaml = `
version: '1.0'
nodes:
  - id: sw01
    label: Switch
    identity:
      mgmtIp: 10.0.0.2
    ports:
      - id: p1
        label: eth0
        identity:
          ifName: GigabitEthernet0/1
links: []
`
      const result = new YamlParser().parse(yaml)
      const node = result.graph.nodes[0]
      expect(node?.identity?.mgmtIp).toBe('10.0.0.2')
      expect(node?.ports?.[0]?.identity?.ifName).toBe('GigabitEthernet0/1')
    })
  })

  describe('authoring-schema enforcement', () => {
    const errorsOf = (yaml: string) =>
      (new YamlParser().parse(yaml).warnings ?? []).filter((w) => w.severity === 'error')

    it('reports a typo as UNKNOWN_KEY instead of silently dropping it', () => {
      const errs = errorsOf(`
version: '1'
nodes:
  - id: a
    lable: oops
links: []
`)
      expect(
        errs.some((w) => w.code === 'UNKNOWN_KEY' && w.message.includes('nodes[0].lable')),
      ).toBe(true)
    })

    it('reports an API envelope pasted whole — previously a silent EMPTY graph', () => {
      // {graph: {...}, capturedAt: ...} used to parse "successfully" into
      // {nodes: [], links: []} with zero warnings, wiping the editor content.
      const result = new YamlParser().parse(`
graph:
  nodes:
    - id: a
      label: A
capturedAt: 123
`)
      const errs = (result.warnings ?? []).filter((w) => w.code === 'UNKNOWN_KEY')
      expect(errs.map((w) => w.message).join('\n')).toContain('"graph"')
      expect(errs.map((w) => w.message).join('\n')).toContain('"capturedAt"')
    })

    it('reports observation-layer fields as NOT_AUTHORABLE with a JSON-editor hint', () => {
      const errs = errorsOf(`
version: '1'
nodes:
  - id: a
    label: A
    presence: anchor
links:
  - from: {node: a, port: p}
    to: {node: a, port: q}
    rateBps: 10000000000
`)
      const codes = errs.map((w) => `${w.code}:${w.message.match(/"([^"]+)"/)?.[1]}`)
      expect(codes).toContain('NOT_AUTHORABLE:nodes[0].presence')
      expect(codes).toContain('NOT_AUTHORABLE:links[0].rateBps')
      expect(errs.every((w) => w.code !== 'NOT_AUTHORABLE' || /JSON/.test(w.message))).toBe(true)
    })

    it('accepts every authorable field without complaint', () => {
      const errs = errorsOf(`
version: '1'
name: n
description: d
nodes:
  - id: a
    label: A
    type: firewall
    vendor: paloalto
    identity: {mgmtIp: 10.0.0.1}
    metadata: {room: noc}
    ports:
      - {id: p, label: e1, connectors: []}
links:
  - id: l1
    from: {node: a, port: p, module: {standard: 10GBASE-SR}}
    to: {node: a, port: p}
    standard: 10GBASE-SR
    vlan: [10, 20]
    metadata: {note: hand-written}
subgraphs:
  - id: sg
    label: SG
    identity: {name: SG}
    membership:
      - {attr: subnet, value: 10.0.0.0/24}
    scope: closed
`)
      expect(errs).toEqual([])
    })

    it('round-trips link metadata (nodes always could; links were the gap)', () => {
      const result = new YamlParser().parse(`
version: '1'
nodes:
  - {id: a, label: A}
  - {id: b, label: B}
links:
  - from: {node: a, port: p}
    to: {node: b, port: q}
    metadata: {vlan10: {nextHop: 192.168.12.1}}
`)
      expect(result.graph.links[0]?.metadata).toEqual({ vlan10: { nextHop: '192.168.12.1' } })
    })
  })
})
