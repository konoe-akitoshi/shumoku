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
})
