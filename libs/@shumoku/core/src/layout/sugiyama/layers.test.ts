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
