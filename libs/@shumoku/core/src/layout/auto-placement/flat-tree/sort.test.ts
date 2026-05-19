// Source-port-label sibling sort.

import { describe, expect, test } from 'vitest'
import type { Link, Node } from '../../../models/types.js'
import { sortBlocksBySourcePort } from './sort.js'

function node(id: string, parent: string | undefined, ports: Array<[string, string]>): Node {
  return {
    id,
    label: id,
    ...(parent ? { parent } : {}),
    ports: ports.map(([pid, label]) => ({ id: pid, label })),
  }
}

function link(from: string, fromPort: string, to: string, toPort: string): Link {
  return {
    from: { node: from, port: fromPort },
    to: { node: to, port: toPort },
  }
}

const noFlip = () => false

describe('sortBlocksBySourcePort', () => {
  test('numeric-aware: Gi1/0/2 sorts before Gi1/0/10', () => {
    const parent = node('p', undefined, [
      ['p1', 'Gi1/0/2'],
      ['p2', 'Gi1/0/10'],
      ['p3', 'Gi1/0/1'],
    ])
    const nodesById = new Map([
      [parent.id, parent],
      ['c1', node('c1', undefined, [['p', 'in']])],
      ['c2', node('c2', undefined, [['p', 'in']])],
      ['c3', node('c3', undefined, [['p', 'in']])],
    ])
    const blockMembers = new Map([
      ['p', ['p']],
      ['c1', ['c1']],
      ['c2', ['c2']],
      ['c3', ['c3']],
    ])
    // c1 ← Gi1/0/2, c2 ← Gi1/0/10, c3 ← Gi1/0/1
    const links = [
      link('p', 'p1', 'c1', 'p'),
      link('p', 'p2', 'c2', 'p'),
      link('p', 'p3', 'c3', 'p'),
    ]
    const sorted = sortBlocksBySourcePort(
      ['c1', 'c2', 'c3'],
      'p',
      blockMembers,
      links,
      nodesById,
      noFlip,
    )
    // Expected: c3 (Gi1/0/1) → c1 (Gi1/0/2) → c2 (Gi1/0/10)
    expect(sorted).toEqual(['c3', 'c1', 'c2'])
  })

  test('blocks without a matching source link sort last (lexicographic tiebreaker)', () => {
    const parent = node('p', undefined, [['p1', 'Gi1/0/1']])
    const nodesById = new Map([
      [parent.id, parent],
      ['c1', node('c1', undefined, [['p', 'in']])],
      ['orphan', node('orphan', undefined, [])],
    ])
    const blockMembers = new Map([
      ['p', ['p']],
      ['c1', ['c1']],
      ['orphan', ['orphan']],
    ])
    const links = [link('p', 'p1', 'c1', 'p')]
    const sorted = sortBlocksBySourcePort(
      ['orphan', 'c1'],
      'p',
      blockMembers,
      links,
      nodesById,
      noFlip,
    )
    expect(sorted).toEqual(['c1', 'orphan'])
  })

  test('deterministic order for ties: same subgraph clusters first, then by id', () => {
    const parent = node('p', undefined, [
      ['p1', 'Gi1/0/1'],
      ['p2', 'Gi1/0/1'], // tie!
    ])
    const a = node('a', 'sg1', [['p', 'in']])
    const b = node('b', 'sg2', [['p', 'in']])
    const c = node('c', 'sg1', [['p', 'in']])
    const nodesById = new Map([
      [parent.id, parent],
      [a.id, a],
      [b.id, b],
      [c.id, c],
    ])
    const blockMembers = new Map([
      ['p', ['p']],
      ['a', ['a']],
      ['b', ['b']],
      ['c', ['c']],
    ])
    const links = [link('p', 'p1', 'a', 'p'), link('p', 'p1', 'b', 'p'), link('p', 'p2', 'c', 'p')]
    const sorted = sortBlocksBySourcePort(
      ['b', 'a', 'c'],
      'p',
      blockMembers,
      links,
      nodesById,
      noFlip,
    )
    // Same port label "Gi1/0/1". sg1 (a, c) sorts before sg2 (b); within
    // sg1, "a" < "c".
    expect(sorted).toEqual(['a', 'c', 'b'])
  })
})
