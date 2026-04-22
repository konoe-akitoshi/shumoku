// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest'
import { reduceCrossings } from './ordering.js'
import type { Edge, LayerAssignment } from './types.js'

function edges(pairs: [string, string, string][]): Edge[] {
  return pairs.map(([s, t, id]) => ({ id, source: s, target: t }))
}

function makeLayers(layers: string[][]): LayerAssignment {
  const layerOf = new Map<string, number>()
  for (const [i, layer] of layers.entries()) {
    for (const n of layer) layerOf.set(n, i)
  }
  return { layers, layerOf }
}

/** Count edge crossings between two consecutive layers. */
function crossings(above: string[], below: string[], es: Edge[]): number {
  const aboveIdx = new Map(above.map((n, i) => [n, i]))
  const belowIdx = new Map(below.map((n, i) => [n, i]))
  const pairs = es
    .filter((e) => aboveIdx.has(e.source) && belowIdx.has(e.target))
    .map((e) => [aboveIdx.get(e.source) ?? 0, belowIdx.get(e.target) ?? 0] as const)
  let count = 0
  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      const a = pairs[i]
      const b = pairs[j]
      if (!a || !b) continue
      const [a1, a2] = a
      const [b1, b2] = b
      if ((a1 < b1 && a2 > b2) || (a1 > b1 && a2 < b2)) count++
    }
  }
  return count
}

describe('reduceCrossings', () => {
  it('leaves an already-optimal order untouched', () => {
    // a→c, b→d : no crossings already
    const input = makeLayers([
      ['a', 'b'],
      ['c', 'd'],
    ])
    const es = edges([
      ['a', 'c', 'e1'],
      ['b', 'd', 'e2'],
    ])
    const result = reduceCrossings(input, es)
    expect(result.layers).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })

  it('swaps a layer to remove crossings', () => {
    // a→d, b→c : crossing if [c, d] order
    const input = makeLayers([
      ['a', 'b'],
      ['c', 'd'],
    ])
    const es = edges([
      ['a', 'd', 'e1'],
      ['b', 'c', 'e2'],
    ])
    const before = crossings(input.layers[0] ?? [], input.layers[1] ?? [], es)
    const result = reduceCrossings(input, es)
    const after = crossings(result.layers[0] ?? [], result.layers[1] ?? [], es)
    expect(after).toBeLessThanOrEqual(before)
    // Specifically, the optimal order is [d, c]
    expect(result.layers[1]).toEqual(['d', 'c'])
  })

  it('keeps floating (unlinked) nodes stable', () => {
    const input = makeLayers([['a', 'b', 'c']])
    const result = reduceCrossings(input, [])
    expect(result.layers[0]).toEqual(['a', 'b', 'c'])
  })

  it('reduces crossings in a 3-layer chain', () => {
    // Layers: [a,b] → [c,d] → [e,f]
    // Edges tangle two layers: a→d, b→c, c→f, d→e
    const input = makeLayers([
      ['a', 'b'],
      ['c', 'd'],
      ['e', 'f'],
    ])
    const es = edges([
      ['a', 'd', 'e1'],
      ['b', 'c', 'e2'],
      ['c', 'f', 'e3'],
      ['d', 'e', 'e4'],
    ])

    const before =
      crossings(input.layers[0] ?? [], input.layers[1] ?? [], es) +
      crossings(input.layers[1] ?? [], input.layers[2] ?? [], es)

    const result = reduceCrossings(input, es)
    const after =
      crossings(result.layers[0] ?? [], result.layers[1] ?? [], es) +
      crossings(result.layers[1] ?? [], result.layers[2] ?? [], es)

    expect(after).toBeLessThanOrEqual(before)
  })

  it('updates layerOf to match reordered layers', () => {
    const input = makeLayers([
      ['a', 'b'],
      ['c', 'd'],
    ])
    const result = reduceCrossings(
      input,
      edges([
        ['a', 'd', 'e1'],
        ['b', 'c', 'e2'],
      ]),
    )
    for (const [i, layer] of result.layers.entries()) {
      for (const n of layer) expect(result.layerOf.get(n)).toBe(i)
    }
  })

  it('respects `iterations` option (0 iterations = no change)', () => {
    const input = makeLayers([
      ['a', 'b'],
      ['c', 'd'],
    ])
    const es = edges([
      ['a', 'd', 'e1'],
      ['b', 'c', 'e2'],
    ])
    const result = reduceCrossings(input, es, { iterations: 0 })
    expect(result.layers).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })

  it('is idempotent when re-run on already-reduced output', () => {
    const input = makeLayers([
      ['a', 'b'],
      ['c', 'd'],
    ])
    const es = edges([
      ['a', 'd', 'e1'],
      ['b', 'c', 'e2'],
    ])
    const once = reduceCrossings(input, es)
    const twice = reduceCrossings(once, es)
    expect(twice.layers).toEqual(once.layers)
  })

  it('does not mutate the input layer arrays', () => {
    const input = makeLayers([
      ['a', 'b'],
      ['c', 'd'],
    ])
    const snapshot = input.layers.map((l) => [...l])
    reduceCrossings(
      input,
      edges([
        ['a', 'd', 'e1'],
        ['b', 'c', 'e2'],
      ]),
    )
    expect(input.layers).toEqual(snapshot)
  })
})
