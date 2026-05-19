// Peer-emitter group detection.

import { describe, expect, test } from 'vitest'
import type { Node } from '../../models/types.js'
import { buildPeerEmitterAnchorMap, detectPeerEmitterGroups } from './emitter-groups.js'
import type { BlockMembers } from './types.js'

function node(id: string, parent?: string): Node {
  return {
    id,
    label: id,
    shape: 'rect',
    ...(parent ? { parent } : {}),
  }
}

function nodes(...defs: Array<[string, string | undefined]>): Map<string, Node> {
  return new Map(defs.map(([id, parent]) => [id, node(id, parent)]))
}

function blocks(...rows: Array<[string, string[]]>): BlockMembers {
  return new Map(rows)
}

describe('detectPeerEmitterGroups', () => {
  test('two single-member emitter blocks in the same subgraph connected by a primary edge → group', () => {
    const nodesById = nodes(['e1', 'sg'], ['e2', 'sg'])
    const blockMembers = blocks(['e1', ['e1']], ['e2', ['e2']])
    const parents = new Map([['e2', 'e1']])
    const groups = detectPeerEmitterGroups(blockMembers, parents, nodesById)
    expect(groups).toHaveLength(1)
    expect(groups[0]?.subgraph).toBe('sg')
    expect(groups[0]?.blocks).toEqual(['e1', 'e2'])
    // e1 is the upstream-most (no in-group primary parent), so it's the anchor.
    expect(groups[0]?.anchor).toBe('e1')
  })

  test('disconnected single-member emitter blocks in the same subgraph → no group', () => {
    const nodesById = nodes(['e1', 'sg'], ['e2', 'sg'])
    const blockMembers = blocks(['e1', ['e1']], ['e2', ['e2']])
    // No primary edge between e1 and e2.
    const parents = new Map<string, string>()
    expect(detectPeerEmitterGroups(blockMembers, parents, nodesById)).toEqual([])
  })

  test('two emitter blocks in different subgraphs → no group', () => {
    const nodesById = nodes(['e1', 'sg-a'], ['e2', 'sg-b'])
    const blockMembers = blocks(['e1', ['e1']], ['e2', ['e2']])
    const parents = new Map([['e2', 'e1']])
    expect(detectPeerEmitterGroups(blockMembers, parents, nodesById)).toEqual([])
  })

  test('three emitters in same subgraph → no group (2-emitter limit)', () => {
    const nodesById = nodes(['e1', 'sg'], ['e2', 'sg'], ['e3', 'sg'])
    const blockMembers = blocks(['e1', ['e1']], ['e2', ['e2']], ['e3', ['e3']])
    const parents = new Map([
      ['e2', 'e1'],
      ['e3', 'e2'],
    ])
    expect(detectPeerEmitterGroups(blockMembers, parents, nodesById)).toEqual([])
  })

  test('multi-member block (single-emitter subgraph) → not eligible', () => {
    const nodesById = nodes(['e1', 'sg'], ['e2', 'sg'])
    // Single block holding both members (single-emitter subgraph case).
    const blockMembers = blocks(['sg', ['e1', 'e2']])
    const parents = new Map([['e2', 'e1']])
    expect(detectPeerEmitterGroups(blockMembers, parents, nodesById)).toEqual([])
  })

  test('top-level (no subgraph) emitter blocks → no group', () => {
    const nodesById = nodes(['e1', undefined], ['e2', undefined])
    const blockMembers = blocks(['e1', ['e1']], ['e2', ['e2']])
    const parents = new Map([['e2', 'e1']])
    expect(detectPeerEmitterGroups(blockMembers, parents, nodesById)).toEqual([])
  })
})

describe('buildPeerEmitterAnchorMap', () => {
  test('maps each non-anchor to its group anchor', () => {
    const map = buildPeerEmitterAnchorMap([{ subgraph: 'sg', blocks: ['e1', 'e2'], anchor: 'e1' }])
    expect([...map.entries()]).toEqual([['e2', 'e1']])
  })

  test('empty input → empty map', () => {
    expect(buildPeerEmitterAnchorMap([]).size).toBe(0)
  })
})
