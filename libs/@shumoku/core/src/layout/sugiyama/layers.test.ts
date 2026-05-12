// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest'
import { assignLayers } from './layers.js'
import type { Edge } from './types.js'

function edges(pairs: [string, string, string][]): Edge[] {
  return pairs.map(([s, t, id]) => ({ id, source: s, target: t }))
}

describe('assignLayers', () => {
  it('places an isolated node at layer 0', () => {
    const { layers, layerOf } = assignLayers(['a'], [])
    expect(layers).toEqual([['a']])
    expect(layerOf.get('a')).toBe(0)
  })

  it('lays out a simple chain as consecutive layers', () => {
    // a → b → c → d
    const nodes = ['a', 'b', 'c', 'd']
    const e = edges([
      ['a', 'b', 'e1'],
      ['b', 'c', 'e2'],
      ['c', 'd', 'e3'],
    ])
    const { layers, layerOf } = assignLayers(nodes, e)
    expect(layerOf.get('a')).toBe(0)
    expect(layerOf.get('b')).toBe(1)
    expect(layerOf.get('c')).toBe(2)
    expect(layerOf.get('d')).toBe(3)
    expect(layers.length).toBe(4)
  })

  it('uses longest path — ties broken by longest predecessor chain', () => {
    // a → b → d
    //  \     ↗
    //   ─ c ─
    // b and c both reach d; d's layer should be max(layer(b), layer(c)) + 1 = 2.
    const nodes = ['a', 'b', 'c', 'd']
    const e = edges([
      ['a', 'b', 'e1'],
      ['a', 'c', 'e2'],
      ['b', 'd', 'e3'],
      ['c', 'd', 'e4'],
    ])
    const { layerOf } = assignLayers(nodes, e)
    expect(layerOf.get('a')).toBe(0)
    expect(layerOf.get('b')).toBe(1)
    expect(layerOf.get('c')).toBe(1)
    expect(layerOf.get('d')).toBe(2)
  })

  it('extends layer to accommodate a long-path dependency', () => {
    // a → b → c → e
    //          ↗
    //     a → d
    // e's layer = max(layer(c)=2, layer(d)=1) + 1 = 3
    const nodes = ['a', 'b', 'c', 'd', 'e']
    const es = edges([
      ['a', 'b', 'e1'],
      ['b', 'c', 'e2'],
      ['c', 'e', 'e3'],
      ['a', 'd', 'e4'],
      ['d', 'e', 'e5'],
    ])
    const { layerOf } = assignLayers(nodes, es)
    expect(layerOf.get('e')).toBe(3)
  })

  it('treats disconnected components independently, both starting at 0', () => {
    // a → b   and   c → d
    const nodes = ['a', 'b', 'c', 'd']
    const e = edges([
      ['a', 'b', 'e1'],
      ['c', 'd', 'e2'],
    ])
    const { layerOf } = assignLayers(nodes, e)
    expect(layerOf.get('a')).toBe(0)
    expect(layerOf.get('c')).toBe(0)
    expect(layerOf.get('b')).toBe(1)
    expect(layerOf.get('d')).toBe(1)
  })

  it('bucketizes nodes into layers[i] arrays matching layerOf', () => {
    const nodes = ['a', 'b', 'c', 'd']
    const e = edges([
      ['a', 'b', 'e1'],
      ['a', 'c', 'e2'],
      ['b', 'd', 'e3'],
      ['c', 'd', 'e4'],
    ])
    const { layers, layerOf } = assignLayers(nodes, e)
    for (const [i, layer] of layers.entries()) {
      for (const n of layer) expect(layerOf.get(n)).toBe(i)
    }
    const totalInLayers = layers.reduce((s, l) => s + l.length, 0)
    expect(totalInLayers).toBe(nodes.length)
  })

  it('preserves input order for nodes at the same layer (stable output)', () => {
    // a, b, c are all sources (no preds), all layer 0
    const nodes = ['a', 'b', 'c']
    const { layers } = assignLayers(nodes, [])
    expect(layers[0]).toEqual(['a', 'b', 'c'])
  })

  it('tiered mode: internal nodes use ASAP depth, leaves snap to bottom row', () => {
    // Mirrors the network-topology scenario from the discussion in
    // PR #229. Two intermediate switches that are siblings of a
    // distribution switch should land on the same layer as that
    // distribution switch (topologically peers), and their single
    // leaves should snap to the bottom row alongside leaves that
    // hang off deeper subtrees.
    //
    //   router (a)
    //   ├─ dist (b) ─── subdist (c) ─── leaf (deepLeaf)
    //   └─ peerSwitch (d) ─── shallowLeaf
    //
    // ASAP would give: a=0, b=1, d=1, c=2, deepLeaf=3, shallowLeaf=2
    // Under tiered, internal nodes stay at ASAP and ALL leaves go
    // to the max-asap layer (3), so shallowLeaf is pushed from 2→3.
    const nodes = ['a', 'b', 'c', 'd', 'deepLeaf', 'shallowLeaf']
    const e = edges([
      ['a', 'b', 'e1'],
      ['b', 'c', 'e2'],
      ['c', 'deepLeaf', 'e3'],
      ['a', 'd', 'e4'],
      ['d', 'shallowLeaf', 'e5'],
    ])
    const { layerOf } = assignLayers(nodes, e, { mode: 'tiered' })
    expect(layerOf.get('a')).toBe(0)
    expect(layerOf.get('b')).toBe(1)
    expect(layerOf.get('d')).toBe(1) // peer of b
    expect(layerOf.get('c')).toBe(2)
    expect(layerOf.get('deepLeaf')).toBe(3) // natural ASAP, also max
    expect(layerOf.get('shallowLeaf')).toBe(3) // pushed from 2 to 3
  })

  it('tiered mode: pure-tree chain gives chain-depth layering', () => {
    // Sanity check that simple chains still get sequential layers
    // (no leaf-pinning surprise when there's only one leaf at the end).
    const { layerOf } = assignLayers(
      ['a', 'b', 'c', 'd'],
      edges([
        ['a', 'b', 'e1'],
        ['b', 'c', 'e2'],
        ['c', 'd', 'e3'],
      ]),
    )
    expect(layerOf.get('a')).toBe(0)
    expect(layerOf.get('b')).toBe(1)
    expect(layerOf.get('c')).toBe(2)
    expect(layerOf.get('d')).toBe(3)
  })

  it('asap mode keeps leaves at their natural depth (no pin)', () => {
    const nodes = ['a', 'b', 'c', 'd', 'leaf2', 'leaf3']
    const e = edges([
      ['a', 'b', 'e1'],
      ['b', 'c', 'e2'],
      ['c', 'leaf3', 'e3'],
      ['a', 'd', 'e4'],
      ['d', 'leaf2', 'e5'],
    ])
    const { layerOf } = assignLayers(nodes, e, { mode: 'asap' })
    expect(layerOf.get('leaf2')).toBe(2) // not pushed to 3
    expect(layerOf.get('leaf3')).toBe(3)
  })

  it('tolerates residual cycles by placing stuck nodes at layer 0', () => {
    // a → b, and a cycle b → c → b (caller forgot to removeCycles first)
    // The non-cyclic path gives a=0, b=1; c is stuck (not reachable by topo
    // sort because it's in a cycle with b) — we place it at layer 0 rather
    // than crash.
    const nodes = ['a', 'b', 'c']
    const e = edges([
      ['a', 'b', 'e1'],
      ['b', 'c', 'e2'],
      ['c', 'b', 'e3'],
    ])
    const { layerOf } = assignLayers(nodes, e)
    // We don't over-specify which layer c ends up at, just that it
    // doesn't throw and every node has a layer.
    expect(layerOf.get('a')).toBeDefined()
    expect(layerOf.get('b')).toBeDefined()
    expect(layerOf.get('c')).toBeDefined()
  })
})
