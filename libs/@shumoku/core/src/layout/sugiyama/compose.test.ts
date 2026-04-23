// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest'
import type { Size } from '../../models/types.js'
import { layoutFlat } from './compose.js'
import type { Edge } from './types.js'

function edges(pairs: [string, string, string][]): Edge[] {
  return pairs.map(([s, t, id]) => ({ id, source: s, target: t }))
}

const uniformSize: Size = { width: 100, height: 50 }

describe('layoutFlat', () => {
  it('lays out a simple chain with each node in its own layer', () => {
    // a → b → c
    const { positions, layerOf, layerCount } = layoutFlat(
      ['a', 'b', 'c'],
      edges([
        ['a', 'b', 'e1'],
        ['b', 'c', 'e2'],
      ]),
      { defaultSize: uniformSize },
    )

    expect(layerCount).toBe(3)
    expect(layerOf.get('a')).toBe(0)
    expect(layerOf.get('b')).toBe(1)
    expect(layerOf.get('c')).toBe(2)

    // All three centred on x (single column → x = 0)
    for (const n of ['a', 'b', 'c']) {
      expect(positions.get(n)?.x).toBe(0)
    }
    // Each node's y grows with the layer index
    expect((positions.get('a')?.y ?? 0) < (positions.get('b')?.y ?? 0)).toBe(true)
    expect((positions.get('b')?.y ?? 0) < (positions.get('c')?.y ?? 0)).toBe(true)
  })

  it('returns reversed edges from cycle removal', () => {
    // a → b → a cycle
    const { reversedEdges } = layoutFlat(
      ['a', 'b'],
      edges([
        ['a', 'b', 'e1'],
        ['b', 'a', 'e2'],
      ]),
      { defaultSize: uniformSize },
    )
    expect(reversedEdges.size).toBe(1)
  })

  it('removes crossings that the input order would produce', () => {
    // a→d and b→c with input layout order [a,b]/[c,d] crosses.
    // After ordering, layer 1 should reorder to [d,c] to remove the crossing.
    const { positions, layerOf } = layoutFlat(
      ['a', 'b', 'c', 'd'],
      edges([
        ['a', 'd', 'e1'],
        ['b', 'c', 'e2'],
      ]),
      { defaultSize: uniformSize },
    )
    // a and b are at layer 0, c and d at layer 1
    expect(layerOf.get('a')).toBe(0)
    expect(layerOf.get('b')).toBe(0)
    expect(layerOf.get('c')).toBe(1)
    expect(layerOf.get('d')).toBe(1)

    // After barycenter reduction, d should be to the left of c (under a)
    const dx = positions.get('d')?.x ?? 0
    const cx = positions.get('c')?.x ?? 0
    expect(dx).toBeLessThan(cx)
  })

  it('respects fixed positions by overriding output', () => {
    // Lay out 2 nodes, then pin a to (999, 999)
    const { positions } = layoutFlat(['a', 'b'], edges([['a', 'b', 'e1']]), {
      defaultSize: uniformSize,
      fixed: new Map([['a', { x: 999, y: 999 }]]),
    })
    expect(positions.get('a')).toEqual({ x: 999, y: 999 })
    // b's position is still algorithm-derived (not pinned)
    expect(positions.get('b')).not.toEqual({ x: 999, y: 999 })
  })

  it('handles disconnected components: each starts at layer 0', () => {
    // a → b, and c → d — two independent chains
    const { layerOf } = layoutFlat(
      ['a', 'b', 'c', 'd'],
      edges([
        ['a', 'b', 'e1'],
        ['c', 'd', 'e2'],
      ]),
      { defaultSize: uniformSize },
    )
    expect(layerOf.get('a')).toBe(0)
    expect(layerOf.get('c')).toBe(0)
    expect(layerOf.get('b')).toBe(1)
    expect(layerOf.get('d')).toBe(1)
  })

  it('respects node sizes when assigning coordinates', () => {
    const sizes = new Map<string, Size>([
      ['a', { width: 200, height: 50 }],
      ['b', { width: 80, height: 50 }],
    ])
    const { positions } = layoutFlat(['a', 'b'], [], {
      defaultSize: uniformSize,
      sizes,
      nodeGap: 20,
    })
    // Both at layer 0, side-by-side, no overlap
    const ax = positions.get('a')?.x ?? 0
    const bx = positions.get('b')?.x ?? 0
    const aRight = ax + 100
    const bLeft = bx - 40
    expect(bLeft).toBeGreaterThanOrEqual(aRight + 20 - 0.001)
  })

  it('applies direction rotation', () => {
    const { positions } = layoutFlat(['a', 'b'], edges([['a', 'b', 'e1']]), {
      defaultSize: uniformSize,
      direction: 'LR',
    })
    // In LR, layers grow along x; a → b should have ax < bx
    const ax = positions.get('a')?.x ?? 0
    const bx = positions.get('b')?.x ?? 0
    expect(ax).toBeLessThan(bx)
  })

  it('produces deterministic output for the same input', () => {
    const nodes = ['a', 'b', 'c', 'd']
    const es = edges([
      ['a', 'c', 'e1'],
      ['a', 'd', 'e2'],
      ['b', 'd', 'e3'],
    ])
    const out1 = layoutFlat(nodes, es, { defaultSize: uniformSize })
    const out2 = layoutFlat(nodes, es, { defaultSize: uniformSize })
    for (const n of nodes) {
      expect(out1.positions.get(n)).toEqual(out2.positions.get(n))
    }
  })
})
