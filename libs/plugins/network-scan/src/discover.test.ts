// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { validateTopologyIdentityContract } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { noticeNode } from './discover.js'

describe('noticeNode', () => {
  it('writes an on-link host with its address and ARP MAC on the node', () => {
    const { node, observation } = noticeNode('172.16.254.208', 22, 'scan', {
      ip: '172.16.254.208',
      mac: 'cc:d8:1f:9f:d4:ab',
      randomized: false,
    })
    expect(node).toEqual({
      id: 'scan:node:172.16.254.208',
      label: '172.16.254.208',
      address: '172.16.254.208',
      mac: 'cc:d8:1f:9f:d4:ab',
    })
    expect(observation.metadata).toEqual({ syncState: 'notice', reachableVia: 22 })
    expect(observation.provenance?.source).toBe('scan')
    expect(observation).not.toHaveProperty('identity')
  })

  it('writes a routed host with its address only', () => {
    const { node, observation } = noticeNode('10.9.0.1', 443, 'scan', null)
    expect(node).toEqual({ id: 'scan:node:10.9.0.1', label: '10.9.0.1', address: '10.9.0.1' })
    expect(node).not.toHaveProperty('mac')
    expect(observation.metadata).toEqual({ syncState: 'notice', reachableVia: 443 })
  })

  it('satisfies the topology identity contract', () => {
    const nodes = [
      noticeNode('10.0.0.1', 22, 'scan', {
        ip: '10.0.0.1',
        mac: '00:0d:5d:11:f0:73',
        randomized: false,
      }),
      noticeNode('10.9.0.1', undefined, 'scan', null),
    ]
    expect(
      validateTopologyIdentityContract({
        network: { nodes: nodes.map((n) => n.node), links: [] },
        observation: { nodes: Object.fromEntries(nodes.map((n) => [n.node.id, n.observation])) },
      }),
    ).toEqual({ nodesMissingIdentity: [], portsMissingName: [] })
  })
})
