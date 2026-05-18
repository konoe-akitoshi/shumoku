// Primary parent extraction and cycle breaking.

import { describe, expect, test } from 'vitest'
import type { Link, Node } from '../../models/types.js'
import { breakCycles, buildChildrenOf, buildPrimaryParents } from './parents.js'

function node(id: string, parent?: string): Node {
  return { id, label: id, ...(parent ? { parent } : {}) }
}

function link(from: string, to: string, opts: { redundancy?: boolean } = {}): Link {
  return {
    from: { node: from, port: 'p1' },
    to: { node: to, port: 'p1' },
    ...(opts.redundancy ? { redundancy: true } : {}),
  }
}

function nodesMapFrom(nodes: readonly Node[]): Map<string, Node> {
  return new Map(nodes.map((n) => [n.id, n]))
}

const noFlip = () => false

describe('buildPrimaryParents', () => {
  test('linear chain a -> b -> c picks a as b parent, b as c parent', () => {
    const nodes = nodesMapFrom([node('a'), node('b'), node('c')])
    const parents = buildPrimaryParents([link('a', 'b'), link('b', 'c')], nodes, noFlip)
    expect(parents.get('b')).toBe('a')
    expect(parents.get('c')).toBe('b')
    expect(parents.has('a')).toBe(false)
  })

  test('multi-parent picks first link encountered', () => {
    const nodes = nodesMapFrom([node('a'), node('b'), node('c')])
    const parents = buildPrimaryParents([link('a', 'c'), link('b', 'c')], nodes, noFlip)
    expect(parents.get('c')).toBe('a')
  })

  test('redundancy links are ignored', () => {
    const nodes = nodesMapFrom([node('a'), node('b')])
    const parents = buildPrimaryParents([link('a', 'b', { redundancy: true })], nodes, noFlip)
    expect(parents.has('b')).toBe(false)
  })

  test('self-loop is ignored', () => {
    const nodes = nodesMapFrom([node('a')])
    const parents = buildPrimaryParents([link('a', 'a')], nodes, noFlip)
    expect(parents.has('a')).toBe(false)
  })

  test('shouldFlip swaps direction', () => {
    const nodes = nodesMapFrom([node('a'), node('b')])
    const parents = buildPrimaryParents([link('a', 'b')], nodes, () => true)
    expect(parents.get('a')).toBe('b')
  })

  test('links to unknown nodes are dropped', () => {
    const nodes = nodesMapFrom([node('a')])
    const parents = buildPrimaryParents([link('a', 'ghost')], nodes, noFlip)
    expect(parents.size).toBe(0)
  })
})

describe('breakCycles', () => {
  test('breaks a → b → c → a by dropping at least one edge', () => {
    const parents = new Map([
      ['b', 'a'],
      ['c', 'b'],
      ['a', 'c'],
    ])
    breakCycles(parents)
    // Cycle is gone — walking up from any start must terminate.
    for (const start of parents.keys()) {
      const seen = new Set<string>()
      let cur: string | undefined = start
      while (cur !== undefined && !seen.has(cur)) {
        seen.add(cur)
        cur = parents.get(cur)
      }
      expect(seen.has(cur ?? '')).toBe(false)
    }
  })

  test('linear chain stays intact', () => {
    const parents = new Map([
      ['b', 'a'],
      ['c', 'b'],
    ])
    breakCycles(parents)
    expect(parents.get('b')).toBe('a')
    expect(parents.get('c')).toBe('b')
  })
})

describe('buildChildrenOf', () => {
  test('builds inverse map', () => {
    const parents = new Map([
      ['b', 'a'],
      ['c', 'a'],
      ['d', 'b'],
    ])
    const children = buildChildrenOf(parents)
    expect(children.get('a')?.sort()).toEqual(['b', 'c'])
    expect(children.get('b')).toEqual(['d'])
    expect(children.has('c')).toBe(false)
  })
})
