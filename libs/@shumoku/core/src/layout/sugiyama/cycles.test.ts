// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest'
import { removeCycles } from './cycles.js'
import type { Edge } from './types.js'

/** Build a small edge list tersely: `[['a','b','e1'], ...]` → Edge[]. */
function edges(pairs: [string, string, string][]): Edge[] {
  return pairs.map(([s, t, id]) => ({ id, source: s, target: t }))
}

/** Find the (possibly reversed) edge by its original id. */
function edgeById(dag: Edge[], id: string): Edge | undefined {
  return dag.find((e) => e.id === id)
}

describe('removeCycles', () => {
  it('leaves a DAG untouched', () => {
    // a → b → c (already acyclic)
    const nodes = ['a', 'b', 'c']
    const input = edges([
      ['a', 'b', 'e1'],
      ['b', 'c', 'e2'],
    ])
    const { dag, reversed } = removeCycles(nodes, input)
    expect(reversed.size).toBe(0)
    expect(dag.map((e) => [e.source, e.target])).toEqual([
      ['a', 'b'],
      ['b', 'c'],
    ])
  })

  it('reverses a back edge in a simple cycle', () => {
    // a → b → c → a  (back edge is the one that closes the loop)
    const nodes = ['a', 'b', 'c']
    const input = edges([
      ['a', 'b', 'e1'],
      ['b', 'c', 'e2'],
      ['c', 'a', 'e3'],
    ])
    const { dag, reversed } = removeCycles(nodes, input)
    expect(reversed.size).toBe(1)
    expect(reversed.has('e3')).toBe(true)

    const e3 = edgeById(dag, 'e3')
    expect(e3?.source).toBe('a')
    expect(e3?.target).toBe('c')
    expect(e3?.reversed).toBe(true)
  })

  it('handles two-node cycle (bidirectional edge)', () => {
    const nodes = ['a', 'b']
    const input = edges([
      ['a', 'b', 'e1'],
      ['b', 'a', 'e2'],
    ])
    const { reversed } = removeCycles(nodes, input)
    expect(reversed.size).toBe(1)
    // Either e1 or e2 gets reversed; we don't overspecify which.
    expect(reversed.has('e1') || reversed.has('e2')).toBe(true)
  })

  it('drops self loops from adjacency without flagging them', () => {
    // a → a should not be treated as a back edge
    const nodes = ['a']
    const input = edges([['a', 'a', 'self']])
    const { dag, reversed } = removeCycles(nodes, input)
    expect(reversed.size).toBe(0)
    expect(edgeById(dag, 'self')?.reversed).toBeUndefined()
  })

  it('handles disconnected components independently', () => {
    // a→b→a (cycle) and c→d (not)
    const nodes = ['a', 'b', 'c', 'd']
    const input = edges([
      ['a', 'b', 'e1'],
      ['b', 'a', 'e2'],
      ['c', 'd', 'e3'],
    ])
    const { reversed } = removeCycles(nodes, input)
    expect(reversed.size).toBe(1)
    expect(reversed.has('e3')).toBe(false)
  })

  it('produces a DAG on deeply nested cycles', () => {
    // Ring: a→b→c→d→a
    const nodes = ['a', 'b', 'c', 'd']
    const input = edges([
      ['a', 'b', 'e1'],
      ['b', 'c', 'e2'],
      ['c', 'd', 'e3'],
      ['d', 'a', 'e4'],
    ])
    const { dag, reversed } = removeCycles(nodes, input)
    expect(reversed.size).toBe(1)

    // Topo-sort-able → DAG check. If there's a cycle, no topological
    // order exists, so Kahn's algorithm produces fewer than |V| nodes.
    const inDeg = new Map(nodes.map((n) => [n, 0]))
    for (const e of dag) {
      if (e.source === e.target) continue
      inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1)
    }
    const queue = [...inDeg.entries()].filter(([_, d]) => d === 0).map(([n]) => n)
    let popped = 0
    const succ = new Map<string, string[]>()
    for (const n of nodes) succ.set(n, [])
    for (const e of dag) {
      if (e.source === e.target) continue
      succ.get(e.source)?.push(e.target)
    }
    while (queue.length > 0) {
      const u = queue.shift()
      if (u === undefined) break
      popped++
      for (const v of succ.get(u) ?? []) {
        const d = (inDeg.get(v) ?? 0) - 1
        inDeg.set(v, d)
        if (d === 0) queue.push(v)
      }
    }
    expect(popped).toBe(nodes.length)
  })
})
