// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { NetworkGraph } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { filterDisconnected } from './display-filter.js'

function node(id: string, state: 'discovered-only' | 'intrinsic-only' | 'confirmed') {
  return { id, label: id, provenance: { source: 's', state } }
}

describe('filterDisconnected', () => {
  it('drops degree-0 nodes, keeps linked ones', () => {
    const g: NetworkGraph = {
      version: '1',
      nodes: [
        node('a', 'discovered-only'),
        node('b', 'discovered-only'),
        node('orphan', 'discovered-only'),
      ],
      links: [{ id: 'l0', from: { node: 'a' }, to: { node: 'b' } }],
    }
    const out = filterDisconnected(g)
    expect(out.nodes.map((n) => n.id).sort()).toEqual(['a', 'b'])
  })

  it('drops degree-0 nodes flat — provenance does not privilege them', () => {
    // No authored layer: an intrinsic-only or confirmed orphan is still an
    // orphan. Hide-disconnected hides it like any other degree-0 node.
    const g: NetworkGraph = {
      version: '1',
      nodes: [
        node('placed', 'intrinsic-only'),
        node('confirmed', 'confirmed'),
        node('junk', 'discovered-only'),
        node('a', 'discovered-only'),
        node('b', 'confirmed'),
      ],
      links: [{ id: 'l0', from: { node: 'a' }, to: { node: 'b' } }],
    }
    const out = filterDisconnected(g)
    expect(out.nodes.map((n) => n.id).sort()).toEqual(['a', 'b'])
  })

  it('returns the same reference when nothing is dropped (no-op)', () => {
    const g: NetworkGraph = {
      version: '1',
      nodes: [node('a', 'discovered-only'), node('b', 'discovered-only')],
      links: [{ id: 'l0', from: { node: 'a' }, to: { node: 'b' } }],
    }
    expect(filterDisconnected(g)).toBe(g)
  })

  it('keeps a degree-0 node whose identity matches a metrics binding (monitored ≠ noise)', () => {
    // A monitored AP that goes down loses its stale-LLDP uplink and drops to
    // degree 0 — it must stay on the map to show its red status. Matching is
    // by identity keys (registry format), NOT node ids: pre-flip Worker ids
    // are resolver-minted and unrelated to entity ids.
    const g: NetworkGraph = {
      version: '1',
      nodes: [
        {
          ...node('discovered:0', 'discovered-only'),
          identity: { mgmtIp: '192.168.11.131', vendorIds: { 'cvcue-boxid': '3' } },
        },
        { ...node('junk', 'discovered-only'), identity: { mgmtIp: '10.0.0.99' } },
        node('a', 'discovered-only'),
        node('b', 'discovered-only'),
      ],
      links: [{ id: 'l0', from: { node: 'a' }, to: { node: 'b' } }],
    }
    const out = filterDisconnected(g, new Set(['mgmtIp=192.168.11.131']))
    expect(out.nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'discovered:0'])
  })

  it('matches sysName case-insensitively (registry stores it lowercased)', () => {
    const g: NetworkGraph = {
      version: '1',
      nodes: [{ ...node('lonely', 'discovered-only'), identity: { sysName: 'SW-Core-01' } }],
      links: [],
    }
    const out = filterDisconnected(g, new Set(['sysName=sw-core-01']))
    expect(out.nodes.map((n) => n.id)).toEqual(['lonely'])
  })
})
