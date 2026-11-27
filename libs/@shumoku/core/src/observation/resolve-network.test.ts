// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { expect, test } from 'vitest'
import type { SourceNetwork } from '../models/network-model.js'
import { resolveNetwork } from './resolve-network.js'

test('the order a person chose rides through the merge with the settings', () => {
  const project: SourceNetwork = {
    network: {
      groups: [{ id: 'g' }],
      nodes: [
        { id: 'a', group: 'g' },
        { id: 'b', group: 'g' },
      ],
      links: [{ endpoints: [{ node: 'a' }, { node: 'b' }] }],
    },
    drawing: { settings: { direction: 'LR' }, order: { g: ['b', 'a'], '': ['g'] } },
  }
  const { model } = resolveNetwork(project, [])
  expect(model.drawing?.settings).toEqual({ direction: 'LR' })
  expect(model.drawing?.order).toEqual({ g: ['b', 'a'], '': ['g'] })
  expect(resolveNetwork({ network: project.network }, []).model.drawing?.order).toBeUndefined()
})

test('ports, plugs, cables, products and terminations merge in the configuration', () => {
  const project: SourceNetwork = {
    network: {
      nodes: [
        {
          id: 'a',
          address: '10.0.0.1',
          productId: 'lib-1',
          ports: [{ name: 'ge-0', speed: '1G' }],
        },
        { id: 'b' },
      ],
      links: [
        {
          id: 'l',
          endpoints: [{ node: 'a', port: 'ge-0', plug: { cage: 'sfp+' } }, { node: 'b' }],
          cable: { type: 'om4', productId: 'cab-1' },
          via: ['out-1'],
        },
      ],
      terminations: [{ id: 'out-1', role: 'outlet' }],
    },
  }
  const source: SourceNetwork = {
    network: {
      nodes: [
        {
          id: 'x',
          label: 'A',
          address: '10.0.0.1',
          ports: [{ name: 'ge-0', interfaceName: 'GigabitEthernet0' }],
        },
      ],
      links: [],
    },
    observation: {
      nodes: { x: { vendorIds: { 'src-id': '7' }, ports: { 'ge-0': { ifIndex: 3 } } } },
    },
  }
  const { model, observation } = resolveNetwork(project, [
    { sourceId: 's', capturedAt: 1, status: 'ok', source },
  ])
  const a = model.config.nodes.find((n) => n.id === 'a')
  expect(a?.productId).toBe('lib-1')
  expect(a?.address).toBe('10.0.0.1')
  expect(a?.ports).toEqual([{ name: 'ge-0', speed: '1G', interfaceName: 'GigabitEthernet0' }])
  expect(observation.nodes?.['a']?.vendorIds).toEqual({ 'src-id': '7' })
  expect(observation.nodes?.['a']?.ports?.['ge-0']?.ifIndex).toBe(3)
  expect(JSON.stringify(observation)).not.toContain('identity')
  const link = model.config.links[0]
  expect(link?.endpoints[0]).toEqual({ node: 'a', port: 'ge-0', plug: { cage: 'sfp+' } })
  expect(link?.cable).toEqual({ type: 'om4', productId: 'cab-1' })
  expect(link?.via).toEqual(['out-1'])
  expect(model.config.terminations).toEqual([{ id: 'out-1', role: 'outlet' }])
  expect('design' in model).toBe(false)
  expect('observation' in model).toBe(false)
})

test('a node is matched by the address it has in a segment, as by its own', () => {
  const project: SourceNetwork = {
    network: {
      segments: [{ id: 'mgmt', addresses: { core: '10.0.0.1/24' } }],
      nodes: [{ id: 'core', label: 'Core' }],
      links: [],
    },
  }
  const source: SourceNetwork = {
    network: { nodes: [{ id: 'h1', address: '10.0.0.1', sysName: 'core-1' }], links: [] },
  }
  const { model, observation } = resolveNetwork(project, [
    { sourceId: 's', capturedAt: 1, status: 'ok', source },
  ])
  expect(model.config.nodes.map((n) => n.id)).toEqual(['core'])
  expect(model.config.nodes[0]?.sysName).toBe('core-1')
  expect(observation.nodes?.['core']?.provenance?.state).toBe('confirmed')
})

test('an exclusion by address hides a node whichever source names it', () => {
  const project: SourceNetwork = {
    network: { nodes: [], links: [] },
    observation: { exclusions: [{ mgmtIp: '10.0.0.9' }] },
  }
  const source: SourceNetwork = {
    network: {
      nodes: [
        { id: 'a', address: '10.0.0.9' },
        { id: 'b', address: '10.0.0.10' },
      ],
      links: [],
    },
  }
  const { model } = resolveNetwork(project, [
    { sourceId: 's', capturedAt: 1, status: 'ok', source },
  ])
  expect(model.config.nodes.map((n) => n.address)).toEqual(['10.0.0.10'])
})

test('clustering follows source priority, not the order the snapshots are listed in', () => {
  // The higher-priority source sees two devices; a lower one reports a node carrying both
  // their keys. Claimed first, the lower one would fold all three into one node.
  const high: SourceNetwork = {
    network: {
      nodes: [
        { id: 'h1', label: 'h1', sysName: 's1' },
        { id: 'h2', label: 'h2', address: '10.0.0.2' },
      ],
      links: [],
    },
  }
  const low: SourceNetwork = {
    network: { nodes: [{ id: 'l', label: 'l', sysName: 's1', address: '10.0.0.2' }], links: [] },
  }
  const project: SourceNetwork = { network: { nodes: [], links: [] } }
  const snaps = [
    { sourceId: 'low', capturedAt: 1, priority: 0, status: 'ok' as const, source: low },
    { sourceId: 'high', capturedAt: 1, priority: 1, status: 'ok' as const, source: high },
  ]
  const listedLowFirst = resolveNetwork(project, snaps).model.config.nodes
  const listedHighFirst = resolveNetwork(project, [...snaps].reverse()).model.config.nodes
  expect(listedLowFirst.map((n) => n.label).sort()).toEqual(['h1', 'h2'])
  expect(listedHighFirst.map((n) => n.label).sort()).toEqual(['h1', 'h2'])
})

test('the registry entity each merged node and port is carries out of the merge', () => {
  // two sources whose nodes share nothing but their entity: the registry said they are one
  const source = (id: string, nodeId: string, address: string, port: string) => ({
    sourceId: id,
    capturedAt: 1,
    status: 'ok' as const,
    source: {
      network: { nodes: [{ id: nodeId, address, ports: [{ name: port }] }], links: [] },
    },
    entities: { nodes: { [nodeId]: 'E-sw' }, ports: { [`${nodeId}:${port}`]: 'E-port' } },
  })
  const { model, observation } = resolveNetwork({ network: { nodes: [], links: [] } }, [
    source('inventory', 'sw-a', '10.0.0.1', 'Ethernet1'),
    source('controller', 'sw-b', '10.0.0.2', 'Ethernet1'),
  ])
  expect(model.config.nodes).toHaveLength(1)
  const id = model.config.nodes[0]?.id ?? ''
  expect(observation.nodes?.[id]?.entityId).toBe('E-sw')
  expect(observation.nodes?.[id]?.ports?.['Ethernet1']?.entityId).toBe('E-port')
})

test("the project's entity names a node it alone knows, and never splits it from its device", () => {
  // the project wrote `core` at an address and the registry kept it on E1; the device there has
  // since been swapped and registered as E2
  const project = {
    network: { nodes: [{ id: 'core', address: '10.9.9.1' }, { id: 'lone' }], links: [] },
  }
  const projectEntities = { nodes: { core: 'E1', lone: 'E-lone' }, ports: {} }
  const { model, observation } = resolveNetwork(
    project,
    [
      {
        sourceId: 'scan',
        capturedAt: 1,
        status: 'ok',
        source: {
          network: {
            nodes: [{ id: 'dev', address: '10.9.9.1', chassisId: 'c2:00:00:00:00:02' }],
            links: [],
          },
        },
        entities: { nodes: { dev: 'E2' }, ports: {} },
      },
    ],
    { projectEntities },
  )
  // one node for the device, named by the source's entity
  expect(model.config.nodes.map((n) => n.id).sort()).toEqual(['core', 'lone'])
  expect(observation.nodes?.['core']?.entityId).toBe('E2')
  expect(observation.nodes?.['lone']?.entityId).toBe('E-lone')
})
