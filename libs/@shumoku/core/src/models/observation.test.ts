// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import type * as input from '../input/model.js'
import type { ObservationLayer } from './network-model.js'
import { toNetworkGraph } from './network-model-graph.js'
import type { Identity, Provenance } from './types.js'

/**
 * Shape tests for the observation record and the device attributes: what identifies a device is
 * configuration (`inputModel.Node` / `Port`), what a source said beyond it rides in the record
 * beside the model, and neither reaches the drawn graph.
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

  describe('device attributes are configuration', () => {
    it('a node writes what it is recognized by', () => {
      const node: input.Node = {
        id: 'core',
        address: '10.0.0.1',
        chassisId: '00:11:22:33:44:55',
        sysName: 'core-rtr-01',
        mac: '00:11:22:33:44:55',
        ports: [{ name: 'ge-0/0/0', mac: 'aa:bb:cc:dd:ee:ff' }],
      }
      expect(node.address).toBe('10.0.0.1')
      expect(node.ports?.[0]?.mac).toBe('aa:bb:cc:dd:ee:ff')
    })

    it('a source keeps its own identifiers in its observation', () => {
      const observation: ObservationLayer = {
        nodes: {
          core: {
            vendorIds: { 'netbox-device-id': '42', 'zabbix-host-id': '10084' },
            provenance: { source: 'netbox-1' },
            ports: { 'ge-0/0/0': { ifIndex: 10001 } },
          },
        },
      }
      expect(observation.nodes?.['core']?.vendorIds?.['netbox-device-id']).toBe('42')
      expect(observation.nodes?.['core']?.ports?.['ge-0/0/0']?.ifIndex).toBe(10001)
    })

    it('a hosts source still reports an Identity for matching', () => {
      const id: Identity = { mgmtIp: '10.0.0.1', ifName: 'GigabitEthernet1/0/1', ifIndex: 10001 }
      expect(id.mgmtIp).toBe('10.0.0.1')
    })
  })

  describe('the drawn graph carries no identity', () => {
    it('draws the attributes as facts and nothing of the record', () => {
      const graph = toNetworkGraph({
        config: {
          nodes: [{ id: 'core', label: 'Core', address: '10.0.0.1', sysName: 'core-rtr-01' }],
          links: [],
        },
      })
      const node = graph.nodes[0]
      expect(node?.annotations).toContainEqual({
        kind: 'address',
        label: 'Address',
        value: '10.0.0.1',
      })
      for (const key of ['identity', 'provenance', 'entityId', 'attachments', 'metadata']) {
        expect(node).not.toHaveProperty(key)
      }
      expect(graph).not.toHaveProperty('attachments')
      expect(graph).not.toHaveProperty('exclusions')
    })
  })
})
