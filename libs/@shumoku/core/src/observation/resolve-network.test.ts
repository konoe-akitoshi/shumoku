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
      nodes: [{ id: 'a', productId: 'lib-1', ports: [{ name: 'ge-0', speed: '1G' }] }, { id: 'b' }],
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
    observation: {
      nodes: {
        a: {
          identity: { mgmtIp: '10.0.0.1' },
          ports: { 'ge-0': { identity: { ifName: 'ge-0' } } },
        },
        b: {},
      },
    },
  }
  const source: SourceNetwork = {
    network: {
      nodes: [
        { id: 'x', label: 'A', ports: [{ name: 'ge-0', interfaceName: 'GigabitEthernet0' }] },
      ],
      links: [],
    },
    observation: {
      nodes: {
        x: {
          identity: { mgmtIp: '10.0.0.1' },
          ports: { 'ge-0': { identity: { ifName: 'ge-0' } } },
        },
      },
    },
  }
  const { model, observation } = resolveNetwork(project, [
    { sourceId: 's', capturedAt: 1, status: 'ok', source },
  ])
  const a = model.config.nodes.find((n) => n.id === 'a')
  expect(a?.productId).toBe('lib-1')
  expect(a?.ports).toEqual([{ name: 'ge-0', speed: '1G', interfaceName: 'GigabitEthernet0' }])
  expect(observation.nodes?.['a']?.ports?.['ge-0']?.identity).toEqual({ ifName: 'ge-0' })
  const link = model.config.links[0]
  expect(link?.endpoints[0]).toEqual({ node: 'a', port: 'ge-0', plug: { cage: 'sfp+' } })
  expect(link?.cable).toEqual({ type: 'om4', productId: 'cab-1' })
  expect(link?.via).toEqual(['out-1'])
  expect(model.config.terminations).toEqual([{ id: 'out-1', role: 'outlet' }])
  expect('design' in model).toBe(false)
  expect('observation' in model).toBe(false)
})
