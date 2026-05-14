// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Link, Node } from '@shumoku/core'
import { describe, expect, test } from 'vitest'
import { migrateBendNodesToLinkBends } from './bend-nodes-to-link-bends'

function termination(id: string, role: 'eps' | 'outlet' | 'panel' | 'bend'): Node {
  return {
    id,
    label: role,
    termination: { role },
    position: { x: id.length, y: id.length * 2 },
  } as Node
}

function device(id: string): Node {
  return { id, label: id, position: { x: 0, y: 0 } } as Node
}

function nodesMap(...ns: Node[]): Map<string, Node> {
  return new Map(ns.map((n) => [n.id, n]))
}

describe('migrateBendNodesToLinkBends', () => {
  test('no-op when there are no bend nodes', () => {
    const nodes = nodesMap(device('a'), device('b'), termination('eps-1', 'eps'))
    const links: Link[] = [
      { id: 'l1', from: { node: 'a', port: 'p' }, to: { node: 'b', port: 'p' }, via: ['eps-1'] },
    ]
    const stats = migrateBendNodesToLinkBends({ nodes, links })
    expect(stats).toEqual({ nodesRemoved: 0, linksTouched: 0, bendsAdded: 0 })
    expect(nodes.size).toBe(3)
    expect(links[0]?.via).toEqual(['eps-1'])
    expect(links[0]?.bends).toBeUndefined()
  })

  test('extracts a single bend before any termination (afterIndex = -1)', () => {
    const nodes = nodesMap(device('a'), device('b'), termination('bend-1', 'bend'))
    const links: Link[] = [
      { id: 'l1', from: { node: 'a', port: 'p' }, to: { node: 'b', port: 'p' }, via: ['bend-1'] },
    ]
    const stats = migrateBendNodesToLinkBends({ nodes, links })
    expect(stats.bendsAdded).toBe(1)
    expect(stats.nodesRemoved).toBe(1)
    expect(stats.linksTouched).toBe(1)
    expect(nodes.has('bend-1')).toBe(false)
    expect(links[0]?.via).toBeUndefined()
    expect(links[0]?.bends).toEqual([{ id: 'bend-1', x: 6, y: 12, afterIndex: -1 }])
  })

  test('extracts bends interleaved with terminations (correct afterIndex)', () => {
    const nodes = nodesMap(
      device('a'),
      device('b'),
      termination('eps-1', 'eps'),
      termination('bend-1', 'bend'),
      termination('outlet-1', 'outlet'),
      termination('bend-2', 'bend'),
    )
    const links: Link[] = [
      {
        id: 'l1',
        from: { node: 'a', port: 'p' },
        to: { node: 'b', port: 'p' },
        via: ['eps-1', 'bend-1', 'outlet-1', 'bend-2'],
      },
    ]
    const stats = migrateBendNodesToLinkBends({ nodes, links })
    expect(stats.bendsAdded).toBe(2)
    expect(stats.nodesRemoved).toBe(2)
    expect(stats.linksTouched).toBe(1)
    expect(links[0]?.via).toEqual(['eps-1', 'outlet-1'])
    expect(links[0]?.bends).toHaveLength(2)
    // bend-1 sits after eps-1 (index 0 in terminations-only via)
    expect(links[0]?.bends?.[0]).toMatchObject({ id: 'bend-1', afterIndex: 0 })
    // bend-2 sits after outlet-1 (index 1)
    expect(links[0]?.bends?.[1]).toMatchObject({ id: 'bend-2', afterIndex: 1 })
  })

  test('cleans up orphan bend Nodes not referenced by any link', () => {
    const nodes = nodesMap(device('a'), termination('bend-orphan', 'bend'))
    const links: Link[] = []
    const stats = migrateBendNodesToLinkBends({ nodes, links })
    expect(stats.nodesRemoved).toBe(1)
    expect(stats.bendsAdded).toBe(0)
    expect(stats.linksTouched).toBe(0)
    expect(nodes.has('bend-orphan')).toBe(false)
  })

  test('idempotent — second pass is a no-op', () => {
    const nodes = nodesMap(device('a'), device('b'), termination('bend-1', 'bend'))
    const links: Link[] = [
      { id: 'l1', from: { node: 'a', port: 'p' }, to: { node: 'b', port: 'p' }, via: ['bend-1'] },
    ]
    migrateBendNodesToLinkBends({ nodes, links })
    const stats2 = migrateBendNodesToLinkBends({ nodes, links })
    expect(stats2).toEqual({ nodesRemoved: 0, linksTouched: 0, bendsAdded: 0 })
    expect(links[0]?.bends).toHaveLength(1)
  })

  test('preserves an existing bends array (append, not replace)', () => {
    const nodes = nodesMap(device('a'), device('b'), termination('bend-2', 'bend'))
    const links: Link[] = [
      {
        id: 'l1',
        from: { node: 'a', port: 'p' },
        to: { node: 'b', port: 'p' },
        via: ['bend-2'],
        bends: [{ id: 'bend-0', x: 1, y: 1, afterIndex: -1 }],
      },
    ]
    migrateBendNodesToLinkBends({ nodes, links })
    expect(links[0]?.bends?.map((b: { id: string }) => b.id)).toEqual(['bend-0', 'bend-2'])
  })
})
