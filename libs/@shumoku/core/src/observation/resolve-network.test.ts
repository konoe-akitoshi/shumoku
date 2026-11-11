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
