// Overlay-aware sibling reorder pass.

import { describe, expect, test } from 'vitest'
import type { Link } from '../../models/types.js'
import { reorderForOverlay } from './overlay-reorder.js'
import type { BlockChildren, BlockOfNode } from './types.js'

function overlay(from: string, to: string): Link {
  return {
    from: { node: from, port: 'p' },
    to: { node: to, port: 'p' },
    redundancy: 'ha',
  }
}

function blockMap(...rows: Array<[string, string[]]>): BlockChildren {
  return new Map(rows)
}

describe('reorderForOverlay', () => {
  test('no overlay links → no change', () => {
    const bc = blockMap(['root', ['a', 'b', 'c', 'd']])
    const blockOfNode: BlockOfNode = new Map([
      ['a', 'a'],
      ['b', 'b'],
      ['c', 'c'],
      ['d', 'd'],
    ])
    reorderForOverlay(bc, [], blockOfNode)
    expect(bc.get('root')).toEqual(['a', 'b', 'c', 'd'])
  })

  test('fewer than 3 siblings → no change', () => {
    const bc = blockMap(['root', ['a', 'b']])
    const blockOfNode: BlockOfNode = new Map([
      ['a', 'a'],
      ['b', 'b'],
    ])
    reorderForOverlay(bc, [overlay('a', 'b')], blockOfNode)
    expect(bc.get('root')).toEqual(['a', 'b'])
  })

  test('overlay between non-adjacent siblings pulls them together', () => {
    // Original order: a b c d. Overlay: a ↔ c.
    // Initial span = |ord(a) − ord(c)| = 2.
    // Greedy adjacent-swap brings the overlay-connected pair
    // adjacent. The leftmost improving swap is a↔b → [b,a,c,d]
    // with span |1−2| = 1. Further swaps either don't change
    // span or increase it, so the pass stops there.
    const bc = blockMap(['root', ['a', 'b', 'c', 'd']])
    const blockOfNode: BlockOfNode = new Map([
      ['a', 'a'],
      ['b', 'b'],
      ['c', 'c'],
      ['d', 'd'],
    ])
    reorderForOverlay(bc, [overlay('a', 'c')], blockOfNode)
    expect(bc.get('root')).toEqual(['b', 'a', 'c', 'd'])
  })

  test('overlay between adjacent siblings → already optimal, no change', () => {
    const bc = blockMap(['root', ['a', 'b', 'c', 'd']])
    const blockOfNode: BlockOfNode = new Map([
      ['a', 'a'],
      ['b', 'b'],
      ['c', 'c'],
      ['d', 'd'],
    ])
    reorderForOverlay(bc, [overlay('a', 'b')], blockOfNode)
    expect(bc.get('root')).toEqual(['a', 'b', 'c', 'd'])
  })

  test('overlay descends into subtrees', () => {
    // Tree:
    //   root → a, b, c
    //   a → a1
    //   c → c1
    // Overlay: a1 ↔ c1 (deep subtree pairs).
    // Initial span between a's subtree and c's subtree at the
    // root level = |0 − 2| = 2. The leftmost improving swap is
    // a ↔ b → [b, a, c] with span 1, so the pass stops there.
    const bc = blockMap(['root', ['a', 'b', 'c']], ['a', ['a1']], ['c', ['c1']])
    const blockOfNode: BlockOfNode = new Map([
      ['a', 'a'],
      ['a1', 'a1'],
      ['b', 'b'],
      ['c', 'c'],
      ['c1', 'c1'],
    ])
    reorderForOverlay(bc, [overlay('a1', 'c1')], blockOfNode)
    expect(bc.get('root')).toEqual(['b', 'a', 'c'])
  })

  test('deterministic: same input → same output', () => {
    const blockOfNode: BlockOfNode = new Map([
      ['a', 'a'],
      ['b', 'b'],
      ['c', 'c'],
      ['d', 'd'],
    ])
    const run = () => {
      const bc = blockMap(['root', ['a', 'b', 'c', 'd']])
      reorderForOverlay(bc, [overlay('a', 'c'), overlay('b', 'd')], blockOfNode)
      return bc.get('root')
    }
    expect(run()).toEqual(run())
  })
})
