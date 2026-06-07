// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { NetworkGraph } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { filterDisconnected } from './display-filter.js'

function node(id: string, state: 'discovered-only' | 'intrinsic-only' | 'confirmed') {
  return { id, label: id, provenance: { source: 's', state } }
}

describe('filterDisconnected', () => {
  it('drops degree-0 discovered-only nodes, keeps linked ones', () => {
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

  it('keeps operator-placed (intrinsic) orphans even at degree 0', () => {
    const g: NetworkGraph = {
      version: '1',
      nodes: [
        node('placed', 'intrinsic-only'),
        node('confirmed', 'confirmed'),
        node('junk', 'discovered-only'),
      ],
      links: [],
    }
    const out = filterDisconnected(g)
    expect(out.nodes.map((n) => n.id).sort()).toEqual(['confirmed', 'placed'])
  })

  it('returns the same reference when nothing is dropped (no-op)', () => {
    const g: NetworkGraph = {
      version: '1',
      nodes: [node('a', 'discovered-only'), node('b', 'discovered-only')],
      links: [{ id: 'l0', from: { node: 'a' }, to: { node: 'b' } }],
    }
    expect(filterDisconnected(g)).toBe(g)
  })
})
