// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest'
import type { Size } from '../../models/types.js'
import { assignCoordinates } from './coords.js'
import type { LayerAssignment } from './types.js'

function makeLayers(layers: string[][]): LayerAssignment {
  const layerOf = new Map<string, number>()
  for (const [i, layer] of layers.entries()) {
    for (const n of layer) layerOf.set(n, i)
  }
  return { layers, layerOf }
}

const uniformSize: Size = { width: 100, height: 50 }

describe('assignCoordinates', () => {
  it('places a single node at origin', () => {
    const layers = makeLayers([['a']])
    const positions = assignCoordinates(layers, { defaultSize: uniformSize })
    expect(positions.get('a')).toEqual({ x: 0, y: 25 })
  })

  it('centers a single layer around x = 0', () => {
    const layers = makeLayers([['a', 'b', 'c']])
    const positions = assignCoordinates(layers, {
      defaultSize: uniformSize,
      nodeGap: 20,
    })
    const xs = ['a', 'b', 'c'].map((n) => positions.get(n)?.x ?? 0)
    // Widths 100, 100, 100 with gap 20 → total 100 + 20 + 100 + 20 + 100 = 340
    // Centered: first node's centre at -120, then +120 apart
    expect(xs).toEqual([-120, 0, 120])
    // Same y (all in one layer)
    const ys = ['a', 'b', 'c'].map((n) => positions.get(n)?.y ?? 0)
    expect(new Set(ys).size).toBe(1)
  })

  it('stacks layers along y with layerGap spacing', () => {
    const layers = makeLayers([['a'], ['b']])
    const positions = assignCoordinates(layers, {
      defaultSize: uniformSize,
      layerGap: 40,
    })
    const ay = positions.get('a')?.y ?? 0
    const by = positions.get('b')?.y ?? 0
    // Layer thickness = 50 (height). a centre = 25. b centre = 50 + 40 + 25 = 115.
    expect(ay).toBe(25)
    expect(by).toBe(115)
  })

  it('accommodates nodes of different widths without overlap', () => {
    const layers = makeLayers([['a', 'b']])
    const sizes = new Map<string, Size>([
      ['a', { width: 200, height: 50 }],
      ['b', { width: 80, height: 50 }],
    ])
    const positions = assignCoordinates(layers, {
      sizes,
      defaultSize: uniformSize,
      nodeGap: 20,
    })
    const ax = positions.get('a')?.x ?? 0
    const bx = positions.get('b')?.x ?? 0
    // a's right edge should not overlap b's left edge
    const aRight = ax + 200 / 2
    const bLeft = bx - 80 / 2
    expect(bLeft).toBeGreaterThanOrEqual(aRight + 20 - 0.001)
  })

  it('uses the tallest node as layer thickness', () => {
    const layers = makeLayers([['a', 'b'], ['c']])
    const sizes = new Map<string, Size>([
      ['a', { width: 100, height: 100 }],
      ['b', { width: 100, height: 50 }],
      ['c', { width: 100, height: 50 }],
    ])
    const positions = assignCoordinates(layers, {
      sizes,
      defaultSize: uniformSize,
      layerGap: 20,
    })
    // Layer 0 thickness = 100 (tallest), centres at 50.
    expect(positions.get('a')?.y).toBe(50)
    expect(positions.get('b')?.y).toBe(50)
    // Layer 1 starts at 100 + 20 = 120, thickness = 50, centre = 145.
    expect(positions.get('c')?.y).toBe(145)
  })

  it('rotates to LR: primary axis becomes x', () => {
    const layers = makeLayers([['a'], ['b']])
    const positions = assignCoordinates(layers, {
      defaultSize: uniformSize,
      direction: 'LR',
    })
    const a = positions.get('a')
    const b = positions.get('b')
    // In LR, layer index drives x (not y).
    expect((a?.x ?? 0) < (b?.x ?? 0)).toBe(true)
    // Within-layer axis becomes y; single-node layers share x-axis centre.
    expect(a?.y).toBe(b?.y)
  })

  it('flips to BT: y negated', () => {
    const layers = makeLayers([['a'], ['b']])
    const tb = assignCoordinates(layers, { defaultSize: uniformSize, direction: 'TB' })
    const bt = assignCoordinates(layers, { defaultSize: uniformSize, direction: 'BT' })
    expect(bt.get('a')?.y).toBe(-(tb.get('a')?.y ?? 0))
    expect(bt.get('b')?.y).toBe(-(tb.get('b')?.y ?? 0))
    // x unchanged
    expect(bt.get('a')?.x).toBe(tb.get('a')?.x)
  })

  it('honours hints over barycenter', () => {
    // Without a hint, c would align under its parent b (barycenter).
    // With a hint, c snaps to the hinted x instead.
    const layers: LayerAssignment = {
      layers: [['a', 'b'], ['c']],
      layerOf: new Map([
        ['a', 0],
        ['b', 0],
        ['c', 1],
      ]),
    }
    const positions = assignCoordinates(layers, {
      defaultSize: uniformSize,
      edges: [{ id: 'e1', source: 'b', target: 'c' }],
      hints: new Map([['c', { x: 999 }]]),
    })
    expect(positions.get('c')?.x).toBe(999)
  })

  it('hint is still packed against siblings', () => {
    // Two siblings in the same layer: hint on one, barycenter on the
    // other. The hint wins for its node, packing still prevents overlap.
    const layers: LayerAssignment = {
      layers: [['p'], ['a', 'b']],
      layerOf: new Map([
        ['p', 0],
        ['a', 1],
        ['b', 1],
      ]),
    }
    const positions = assignCoordinates(layers, {
      defaultSize: uniformSize,
      nodeGap: 20,
      edges: [
        { id: 'e1', source: 'p', target: 'a' },
        { id: 'e2', source: 'p', target: 'b' },
      ],
      // a wants x=1000 (far right); b has no hint so barycenter=p.x
      hints: new Map([['a', { x: 1000 }]]),
    })
    const ax = positions.get('a')?.x ?? 0
    const bx = positions.get('b')?.x ?? 0
    // b must not overlap a; the two are at least (width + gap) apart
    expect(Math.abs(bx - ax)).toBeGreaterThanOrEqual(uniformSize.width + 20 - 0.001)
  })

  it('aligns a single-parent child directly under its parent (barycenter)', () => {
    // a  b            ← layer 0
    //    ↓
    //    c            ← layer 1, only parent is b
    // Without barycenter alignment, c would be centred at 0 (the only
    // node in its layer), sitting between a and b. With alignment, c
    // sits at b's x exactly.
    const layers: LayerAssignment = {
      layers: [['a', 'b'], ['c']],
      layerOf: new Map([
        ['a', 0],
        ['b', 0],
        ['c', 1],
      ]),
    }
    const positions = assignCoordinates(layers, {
      defaultSize: uniformSize,
      edges: [{ id: 'e1', source: 'b', target: 'c' }],
    })
    expect(positions.get('c')?.x).toBe(positions.get('b')?.x)
  })

  it('places a multi-parent child at the mean x of its parents', () => {
    // a  b            ← layer 0
    //  \ |
    //   c             ← layer 1, parents: a and b → x should be between
    const layers: LayerAssignment = {
      layers: [['a', 'b'], ['c']],
      layerOf: new Map([
        ['a', 0],
        ['b', 0],
        ['c', 1],
      ]),
    }
    const positions = assignCoordinates(layers, {
      defaultSize: uniformSize,
      edges: [
        { id: 'e1', source: 'a', target: 'c' },
        { id: 'e2', source: 'b', target: 'c' },
      ],
    })
    const ax = positions.get('a')?.x ?? 0
    const bx = positions.get('b')?.x ?? 0
    const cx = positions.get('c')?.x ?? 0
    expect(cx).toBeCloseTo((ax + bx) / 2)
  })

  it('centres siblings around their shared parent (two-pass average)', () => {
    // Two siblings of the same parent should sit symmetrically around
    // it, not one under the parent with the other pushed off to the
    // side (which a forward-only pack would produce). The forward pass
    // places [a=parent.x, b=parent.x+width+gap]; the backward pass
    // places [b=parent.x, a=parent.x-width-gap]; averaging gives the
    // symmetric layout.
    const layers: LayerAssignment = {
      layers: [['p'], ['a', 'b']],
      layerOf: new Map([
        ['p', 0],
        ['a', 1],
        ['b', 1],
      ]),
    }
    const positions = assignCoordinates(layers, {
      defaultSize: uniformSize,
      nodeGap: 20,
      edges: [
        { id: 'e1', source: 'p', target: 'a' },
        { id: 'e2', source: 'p', target: 'b' },
      ],
    })
    const px = positions.get('p')?.x ?? 0
    const ax = positions.get('a')?.x ?? 0
    const bx = positions.get('b')?.x ?? 0
    // a and b straddle p with equal offset
    expect(ax + bx).toBeCloseTo(2 * px)
    expect(ax).toBeLessThan(px)
    expect(bx).toBeGreaterThan(px)
    // No overlap: b's left edge is gap+width to the right of a's right edge
    expect(bx - ax).toBeGreaterThanOrEqual(uniformSize.width + 20 - 0.001)
  })

  it('falls back to centred layout when no edges are provided', () => {
    // Regression guard: callers that don't supply edges (e.g. unit
    // tests that only care about a single layer) keep the centred
    // behaviour.
    const layers: LayerAssignment = {
      layers: [['a', 'b', 'c']],
      layerOf: new Map([
        ['a', 0],
        ['b', 0],
        ['c', 0],
      ]),
    }
    const positions = assignCoordinates(layers, {
      defaultSize: uniformSize,
      nodeGap: 20,
    })
    const xs = ['a', 'b', 'c'].map((n) => positions.get(n)?.x ?? 0)
    expect(xs).toEqual([-120, 0, 120])
  })

  it('falls back to defaultSize when sizes map is missing a node', () => {
    const layers = makeLayers([['a', 'b']])
    const sizes = new Map<string, Size>([['a', { width: 100, height: 50 }]])
    const positions = assignCoordinates(layers, {
      sizes,
      defaultSize: { width: 80, height: 60 },
      nodeGap: 10,
    })
    // b uses defaultSize (80 wide, 60 tall). Layer thickness = max(50, 60) = 60.
    // Centres: widths 100, 80 → total span 100 + 10 + 80 = 190, centre offset = -95.
    // a centre x = (0 + 100/2) + (-95) = -45; b centre x = (100 + 10 + 80/2) - 95 = 55.
    expect(positions.get('a')?.x).toBe(-45)
    expect(positions.get('b')?.x).toBe(55)
  })
})
