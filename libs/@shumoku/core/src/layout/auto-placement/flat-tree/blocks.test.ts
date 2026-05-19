// Block partition (emitter rules).

import { describe, expect, test } from 'vitest'
import type { NetworkGraph, Node } from '../../../models/types.js'
import { buildBlocks, findExternalEmitterBlocks } from './blocks.js'

function node(id: string, parent?: string): Node {
  return { id, label: id, ...(parent ? { parent } : {}) }
}

function makeGraph(nodes: Node[], subgraphIds: string[] = []): NetworkGraph {
  return {
    name: 't',
    nodes,
    links: [],
    subgraphs: subgraphIds.map((id) => ({ id, label: id })),
  }
}

describe('buildBlocks', () => {
  test('top-level nodes form single-member blocks', () => {
    const graph = makeGraph([node('a'), node('b')])
    const { blockMembers } = buildBlocks(graph, new Map())
    expect(blockMembers.get('a')).toEqual(['a'])
    expect(blockMembers.get('b')).toEqual(['b'])
  })

  test('1-emitter subgraph collapses into one block', () => {
    // sg1 contains {root, child1, child2}. root has no external children,
    // so the subgraph has 0 emitters → still one block.
    const graph = makeGraph([node('root', 'sg1'), node('c1', 'sg1'), node('c2', 'sg1')], ['sg1'])
    const { blockMembers, blockOfNode } = buildBlocks(
      graph,
      new Map([
        ['c1', 'root'],
        ['c2', 'root'],
      ]),
    )
    expect(blockMembers.get('sg1')).toEqual(['root', 'c1', 'c2'])
    expect(blockOfNode.get('root')).toBe('sg1')
    expect(blockOfNode.get('c1')).toBe('sg1')
  })

  test('multi-emitter subgraph splits per emitter', () => {
    // sg1 contains {e1, e2}; both have external tree-children (extA, extB
    // are outside the subgraph).
    const graph = makeGraph(
      [node('e1', 'sg1'), node('e2', 'sg1'), node('extA'), node('extB')],
      ['sg1'],
    )
    const parents = new Map([
      ['extA', 'e1'],
      ['extB', 'e2'],
    ])
    const { blockMembers, blockOfNode } = buildBlocks(graph, parents)
    expect(blockMembers.get('e1')).toEqual(['e1'])
    expect(blockMembers.get('e2')).toEqual(['e2'])
    expect(blockOfNode.get('e1')).toBe('e1')
    expect(blockOfNode.get('e2')).toBe('e2')
  })

  test('non-emitter members join nearest tree-parent emitter in same subgraph', () => {
    // sg1: e1 → nm → e2 → ext.
    // e1 and e2 are emitters (e1 to nm-via-link? No, e1 has no external
    // child. Let's make it explicit: e1 → extA, e2 → extB. nm is in
    // between e1 and e2 in the tree.
    const graph = makeGraph(
      [node('e1', 'sg1'), node('nm', 'sg1'), node('e2', 'sg1'), node('extA'), node('extB')],
      ['sg1'],
    )
    const parents = new Map([
      ['nm', 'e1'],
      ['e2', 'nm'],
      ['extA', 'e1'],
      ['extB', 'e2'],
    ])
    const { blockOfNode } = buildBlocks(graph, parents)
    // nm's nearest emitter ancestor is e1 → joins e1's block.
    expect(blockOfNode.get('nm')).toBe('e1')
  })

  test('empty subgraph (declared but no members) is skipped', () => {
    const graph = makeGraph([node('a')], ['empty-sg'])
    const { blockMembers } = buildBlocks(graph, new Map())
    expect(blockMembers.has('empty-sg')).toBe(false)
  })
})

describe('findExternalEmitterBlocks', () => {
  test('flags blocks whose intra-root emits externally', () => {
    // sg1's root r has internal child c1 + external child ext.
    const graph = makeGraph([node('r', 'sg1'), node('c1', 'sg1'), node('ext')], ['sg1'])
    const parents = new Map([
      ['c1', 'r'],
      ['ext', 'r'],
    ])
    const { blockMembers } = buildBlocks(graph, parents)
    const external = findExternalEmitterBlocks(blockMembers, parents)
    expect(external.has('sg1')).toBe(true)
  })

  test('does not flag a leaf cluster (no external children)', () => {
    const graph = makeGraph([node('r', 'sg1'), node('c1', 'sg1')], ['sg1'])
    const parents = new Map([['c1', 'r']])
    const { blockMembers } = buildBlocks(graph, parents)
    const external = findExternalEmitterBlocks(blockMembers, parents)
    expect(external.has('sg1')).toBe(false)
  })

  test('does not flag single-member blocks', () => {
    const graph = makeGraph([node('a'), node('b')])
    const parents = new Map([['b', 'a']])
    const { blockMembers } = buildBlocks(graph, parents)
    const external = findExternalEmitterBlocks(blockMembers, parents)
    expect(external.has('a')).toBe(false)
    expect(external.has('b')).toBe(false)
  })
})
