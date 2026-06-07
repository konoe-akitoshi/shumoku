// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import type { Identity, Link, NetworkGraph, Node, NodePort, Provenance, Subgraph } from './types.js'

/**
 * Type-level + tiny runtime shape tests for the observation model
 * additions (Provenance / Identity). The point is to confirm the new
 * optional fields slot into Node / Link / Subgraph / NodePort without
 * breaking existing call sites.
 */
describe('observation model types', () => {
  describe('Provenance', () => {
    it('accepts the minimum required shape (source only)', () => {
      const p: Provenance = { source: 'intrinsic' }
      expect(p.source).toBe('intrinsic')
    })

    it('accepts an open string source (no union enforcement)', () => {
      // Mirrors the `Alert.source: string` regime — plugins can supply
      // their own identifier without core edits.
      const p: Provenance = { source: 'custom-vendor-x:instance-7' }
      expect(p.source).toBe('custom-vendor-x:instance-7')
    })

    it('accepts each state value the resolver assigns', () => {
      const states = ['confirmed', 'intrinsic-only', 'discovered-only', 'conflicting'] as const
      for (const state of states) {
        const p: Provenance = { source: 's', state, observedAt: 1700000000000 }
        expect(p.state).toBe(state)
      }
    })
  })

  describe('Identity', () => {
    it('holds device-identifying keys for nodes', () => {
      const id: Identity = {
        mgmtIp: '10.0.0.1',
        chassisId: '00:11:22:33:44:55',
        sysName: 'core-rtr-01',
      }
      expect(id.mgmtIp).toBe('10.0.0.1')
    })

    it('holds interface-identifying keys for ports', () => {
      const id: Identity = {
        ifName: 'GigabitEthernet1/0/1',
        ifIndex: 10001,
        mac: 'aa:bb:cc:dd:ee:ff',
      }
      expect(id.ifName).toBe('GigabitEthernet1/0/1')
    })

    it('holds source-specific vendor ids', () => {
      const id: Identity = {
        vendorIds: { 'netbox-device-id': '42', 'zabbix-host-id': '10084' },
      }
      expect(id.vendorIds?.['netbox-device-id']).toBe('42')
    })

    it('permits an empty identity (every field optional)', () => {
      const id: Identity = {}
      expect(id).toEqual({})
    })
  })

  describe('attachment to existing entities', () => {
    it('attaches to Node without disturbing required fields', () => {
      const node: Node = {
        id: 'n1',
        label: 'Router',
        shape: 'rect',
        provenance: { source: 'network-scan:1', state: 'confirmed', observedAt: 1 },
        identity: { mgmtIp: '10.0.0.1', chassisId: 'aa:bb:cc:dd:ee:ff' },
      }
      expect(node.provenance?.source).toBe('network-scan:1')
      expect(node.identity?.mgmtIp).toBe('10.0.0.1')
    })

    it('attaches to NodePort without disturbing required fields', () => {
      const port: NodePort = {
        id: 'p1',
        label: 'Gi1/0/1',
        connectors: ['rj45'],
        provenance: { source: 'network-scan:1' },
        identity: { ifName: 'GigabitEthernet1/0/1', ifIndex: 10001 },
      }
      expect(port.provenance?.source).toBe('network-scan:1')
      expect(port.identity?.ifName).toBe('GigabitEthernet1/0/1')
    })

    it('attaches to Link (no identity, endpoints identify it)', () => {
      const link: Link = {
        from: { node: 'a', port: 'p1' },
        to: { node: 'b', port: 'p2' },
        provenance: { source: 'network-scan:1', state: 'discovered-only' },
      }
      expect(link.provenance?.state).toBe('discovered-only')
    })

    it('attaches to Subgraph', () => {
      const sub: Subgraph = {
        id: 'sg1',
        label: 'Tier',
        provenance: { source: 'intrinsic' },
      }
      expect(sub.provenance?.source).toBe('intrinsic')
    })
  })

  describe('NetworkGraph backward shape', () => {
    it('a graph with no observation fields still satisfies the type', () => {
      // Critical: existing NetworkGraph YAML / JSON without provenance
      // / identity must keep type-checking. All four fields are optional.
      const graph: NetworkGraph = {
        version: '1.0',
        nodes: [{ id: 'n1', label: 'x', shape: 'rect' }],
        links: [],
      }
      expect(graph.nodes[0]?.provenance).toBeUndefined()
      expect(graph.nodes[0]?.identity).toBeUndefined()
    })
  })
})
