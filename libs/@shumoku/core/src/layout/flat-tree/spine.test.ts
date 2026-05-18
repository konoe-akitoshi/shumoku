// Same-subgraph spine alignment.

import { describe, expect, test } from 'vitest'
import type { Node } from '../../models/types.js'
import { alignSameSubgraphSpine } from './spine.js'

function node(id: string, parent?: string): Node {
  return { id, label: id, ...(parent ? { parent } : {}) }
}

function nodesMapFrom(...ns: Node[]): Map<string, Node> {
  return new Map(ns.map((n) => [n.id, n]))
}

describe('alignSameSubgraphSpine', () => {
  test('does nothing when no same-subgraph parent-child block exists', () => {
    // parent block "a" → child block "b". Different subgraphs.
    const positions = new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 100, y: 100 }],
    ])
    const blockChildren = new Map([['a', ['b']]])
    const blockMembers = new Map([
      ['a', ['a']],
      ['b', ['b']],
    ])
    const nodes = nodesMapFrom(node('a', 'sg1'), node('b', 'sg2'))
    alignSameSubgraphSpine(positions, blockChildren, blockMembers, nodes)
    // b stays at 100 (different subgraph, no alignment).
    expect(positions.get('b')?.x).toBe(100)
  })

  test('shifts spine child to share parent x', () => {
    // Parent block "p" (in sg1) has 2 children: "spine" (also sg1) and
    // "other" (sg2). After alignment, spine should be at p.x; other
    // shifts by the same delta.
    const positions = new Map([
      ['p', { x: 0, y: 0 }],
      ['spine', { x: 100, y: 100 }],
      ['other', { x: -100, y: 100 }],
    ])
    const blockChildren = new Map([['p', ['spine', 'other']]])
    const blockMembers = new Map([
      ['p', ['p']],
      ['spine', ['spine']],
      ['other', ['other']],
    ])
    const nodes = nodesMapFrom(node('p', 'sg1'), node('spine', 'sg1'), node('other', 'sg2'))
    alignSameSubgraphSpine(positions, blockChildren, blockMembers, nodes)
    // Spine snaps to parent x.
    expect(positions.get('spine')?.x).toBe(0)
    // Other shifts by the same delta (−100).
    expect(positions.get('other')?.x).toBe(-200)
  })

  test('descendants of spine shift along with it', () => {
    // p → spine → grandchild (all in sg1). After alignment, grandchild
    // shifts by the same delta as spine.
    const positions = new Map([
      ['p', { x: 0, y: 0 }],
      ['spine', { x: 100, y: 100 }],
      ['grand', { x: 100, y: 200 }],
    ])
    const blockChildren = new Map([
      ['p', ['spine']],
      ['spine', ['grand']],
    ])
    const blockMembers = new Map([
      ['p', ['p']],
      ['spine', ['spine']],
      ['grand', ['grand']],
    ])
    const nodes = nodesMapFrom(node('p', 'sg1'), node('spine', 'sg1'), node('grand', 'sg2'))
    alignSameSubgraphSpine(positions, blockChildren, blockMembers, nodes)
    expect(positions.get('spine')?.x).toBe(0)
    expect(positions.get('grand')?.x).toBe(0)
  })

  test('processes top-down — root-level alignment runs first', () => {
    // Three-tier chain p (sg1) → c1 (sg1) → c2 (sg1). Both alignments
    // run; final positions should all share p.x.
    const positions = new Map([
      ['p', { x: 0, y: 0 }],
      ['c1', { x: 50, y: 100 }],
      ['c2', { x: 90, y: 200 }],
    ])
    const blockChildren = new Map([
      ['p', ['c1']],
      ['c1', ['c2']],
    ])
    const blockMembers = new Map([
      ['p', ['p']],
      ['c1', ['c1']],
      ['c2', ['c2']],
    ])
    const nodes = nodesMapFrom(node('p', 'sg1'), node('c1', 'sg1'), node('c2', 'sg1'))
    alignSameSubgraphSpine(positions, blockChildren, blockMembers, nodes)
    expect(positions.get('p')?.x).toBe(0)
    expect(positions.get('c1')?.x).toBe(0)
    expect(positions.get('c2')?.x).toBe(0)
  })
})
