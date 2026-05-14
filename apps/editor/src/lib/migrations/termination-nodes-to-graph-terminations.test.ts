// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Node, Termination } from '@shumoku/core'
import { describe, expect, test } from 'vitest'
import type { Scene } from '../types'
import { migrateTerminationNodesToGraphTerminations } from './termination-nodes-to-graph-terminations'

function termNode(id: string, role: 'eps' | 'outlet' | 'panel', label?: string): Node {
  return { id, label: label ?? role, termination: { role } } as Node
}

function deviceNode(id: string): Node {
  return { id, label: id } as Node
}

function nodesMap(...ns: Node[]): Map<string, Node> {
  return new Map(ns.map((n) => [n.id, n]))
}

function scene(id: string, placements: Array<{ nodeId: string; x: number; y: number }>): Scene {
  return {
    id,
    name: id,
    nodePlacements: placements.map((p) => ({ nodeId: p.nodeId, position: { x: p.x, y: p.y } })),
  }
}

describe('migrateTerminationNodesToGraphTerminations', () => {
  test('no-op when there are no termination Nodes', () => {
    const nodes = nodesMap(deviceNode('a'), deviceNode('b'))
    const terminations: Termination[] = []
    const stats = migrateTerminationNodesToGraphTerminations({ nodes, terminations })
    expect(stats).toEqual({ nodesRemoved: 0, terminationsAdded: 0 })
    expect(terminations).toEqual([])
    expect(nodes.size).toBe(2)
  })

  test('lifts EPS / Outlet / Panel Nodes into the terminations array', () => {
    const nodes = nodesMap(
      deviceNode('a'),
      termNode('eps-1', 'eps', '2F MDF'),
      termNode('out-1', 'outlet'),
      termNode('panel-1', 'panel'),
    )
    const terminations: Termination[] = []
    const scenes = [
      scene('s1', [
        { nodeId: 'eps-1', x: 10, y: 20 },
        { nodeId: 'out-1', x: 30, y: 40 },
        { nodeId: 'panel-1', x: 50, y: 60 },
      ]),
    ]

    const stats = migrateTerminationNodesToGraphTerminations({ nodes, terminations, scenes })
    expect(stats.nodesRemoved).toBe(3)
    expect(stats.terminationsAdded).toBe(3)
    expect(nodes.has('a')).toBe(true)
    expect(nodes.has('eps-1')).toBe(false)
    expect(terminations).toHaveLength(3)
    const eps = terminations.find((t) => t.id === 'eps-1')
    expect(eps).toMatchObject({ role: 'eps', label: '2F MDF', position: { x: 10, y: 20 } })
  })

  test('strips the now-orphan placements from scenes', () => {
    const nodes = nodesMap(termNode('eps-1', 'eps'))
    const terminations: Termination[] = []
    const scenes = [scene('s1', [{ nodeId: 'eps-1', x: 10, y: 20 }])]
    migrateTerminationNodesToGraphTerminations({ nodes, terminations, scenes })
    expect(scenes[0]?.nodePlacements.find((p) => p.nodeId === 'eps-1')).toBeUndefined()
  })

  test('preserves array-shaped labels by taking the first entry', () => {
    const node: Node = {
      id: 'eps-1',
      label: ['2F MDF', 'secondary'],
      termination: { role: 'eps' },
    } as Node
    const nodes = nodesMap(node)
    const terminations: Termination[] = []
    migrateTerminationNodesToGraphTerminations({ nodes, terminations })
    expect(terminations[0]?.label).toBe('2F MDF')
  })

  test('idempotent — second pass is a no-op', () => {
    const nodes = nodesMap(termNode('eps-1', 'eps'))
    const terminations: Termination[] = []
    migrateTerminationNodesToGraphTerminations({ nodes, terminations })
    const stats2 = migrateTerminationNodesToGraphTerminations({ nodes, terminations })
    expect(stats2).toEqual({ nodesRemoved: 0, terminationsAdded: 0 })
    expect(terminations).toHaveLength(1)
  })

  test('skips bends (already handled by the bend migration)', () => {
    const bend: Node = { id: 'bend-1', termination: { role: 'bend' } } as Node
    const nodes = nodesMap(bend, termNode('eps-1', 'eps'))
    const terminations: Termination[] = []
    migrateTerminationNodesToGraphTerminations({ nodes, terminations })
    expect(nodes.has('bend-1')).toBe(true) // bend left alone here
    expect(nodes.has('eps-1')).toBe(false)
    expect(terminations).toHaveLength(1)
  })
})
