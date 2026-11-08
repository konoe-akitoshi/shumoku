// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import type { SourceNetwork } from '../models/network-model.js'
import { toNetworkGraph } from '../models/network-model-graph.js'
import { resolveNetwork, type SourceSnapshot } from './resolve-network.js'

const IP = '192.0.2.12'

/** A source that sees the core switch and a tenant switch, joined by one link. */
const discovered: SourceNetwork = {
  network: {
    nodes: [{ id: 'core' }, { id: 'tenant-sw', label: 'tenant-sw' }],
    links: [{ endpoints: [{ node: 'core' }, { node: 'tenant-sw' }] }],
  },
  observation: {
    nodes: {
      core: { identity: { mgmtIp: '192.0.2.1' } },
      'tenant-sw': { identity: { mgmtIp: IP } },
    },
  },
}

/** A source that says the tenant switch is not part of the network. */
const denies: SourceNetwork = {
  network: { nodes: [{ id: 'tenant', absent: true }], links: [] },
  observation: { nodes: { tenant: { identity: { mgmtIp: IP } } } },
}

const snap = (sourceId: string, priority: number, source: SourceNetwork): SourceSnapshot => ({
  sourceId,
  priority,
  capturedAt: 1000,
  status: 'ok',
  source,
})

const empty = { config: { nodes: [], links: [] } }

describe('resolveNetwork: absent', () => {
  it('drops the node and its links when the top-priority contribution says absent', () => {
    const out = resolveNetwork(empty, [snap('scan', 1, discovered), snap('manual', 2, denies)])
    expect(out.config.nodes).toHaveLength(1)
    expect(out.observation?.nodes?.[out.config.nodes[0]?.id ?? '']?.identity?.mgmtIp).toBe(
      '192.0.2.1',
    )
    expect(out.config.links).toEqual([])
  })

  it('is overruled by a higher-priority contribution that does not say it', () => {
    const out = resolveNetwork(empty, [snap('scan', 2, discovered), snap('manual', 1, denies)])
    expect(out.config.nodes).toHaveLength(2)
    expect(out.config.links).toHaveLength(1)
    expect(out.config.nodes.some((n) => n.absent)).toBe(false)
  })

  it('does not leak into the merged node when it loses', () => {
    const out = resolveNetwork(empty, [snap('scan', 2, discovered), snap('manual', 1, denies)])
    expect(JSON.stringify(out.config)).not.toContain('absent')
  })
})

describe('toNetworkGraph: absent', () => {
  it('draws neither an absent node nor the links that touch it', () => {
    const graph = toNetworkGraph({
      config: {
        nodes: [{ id: 'core' }, { id: 'tenant-sw', absent: true }],
        links: [{ endpoints: [{ node: 'core' }, { node: 'tenant-sw' }] }],
      },
    })
    expect(graph.nodes.map((n) => n.id)).toEqual(['core'])
    expect(graph.links).toEqual([])
  })
})
