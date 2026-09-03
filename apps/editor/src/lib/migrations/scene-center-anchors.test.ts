// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Node, Termination } from '@shumoku/core'
import { describe, expect, test } from 'vitest'
import type { Scene } from '../types'
import { migrateScenePositionsToCenterAnchors } from './scene-center-anchors'

function device(id: string, displayScale?: number): Node {
  return {
    id,
    label: id,
    metadata: displayScale ? { displayScale } : undefined,
  } as Node
}

describe('migrateScenePositionsToCenterAnchors', () => {
  test('preserves the rendered center of legacy device placements', () => {
    const nodes = new Map<string, Node>([['switch', device('switch')]])
    const scene: Scene = {
      id: 'floor',
      name: 'Floor',
      nodePlacements: [{ nodeId: 'switch', position: { x: 100, y: 200 } }],
    }

    const stats = migrateScenePositionsToCenterAnchors({
      scenes: [scene],
      nodes,
      terminations: [],
    })

    expect(scene.placementOrigin).toBe('center')
    expect(scene.nodePlacements[0]?.position).toEqual({ x: 126, y: 226 })
    expect(stats).toEqual({
      scenesMigrated: 1,
      placementsMigrated: 1,
      terminationsMigrated: 0,
    })
  })

  test('uses the legacy scene and per-node display scales during conversion', () => {
    const nodes = new Map<string, Node>([['switch', device('switch', 2)]])
    const scene: Scene = {
      id: 'floor',
      name: 'Floor',
      display: { nodeScale: 3 },
      nodePlacements: [{ nodeId: 'switch', position: { x: 10, y: 20 } }],
    }

    migrateScenePositionsToCenterAnchors({ scenes: [scene], nodes, terminations: [] })

    expect(scene.nodePlacements[0]?.position).toEqual({ x: 62, y: 72 })
  })

  test('moves fixed-size terminations once and is idempotent', () => {
    const scene: Scene = { id: 'floor', name: 'Floor', nodePlacements: [] }
    const terminations: Termination[] = [
      { id: 'eps', role: 'eps', label: 'EPS', position: { x: 40, y: 50 } },
      { id: 'outlet', role: 'outlet', label: 'Outlet', position: { x: 10, y: 20 } },
    ]

    const first = migrateScenePositionsToCenterAnchors({
      scenes: [scene],
      nodes: new Map(),
      terminations,
    })
    const second = migrateScenePositionsToCenterAnchors({
      scenes: [scene],
      nodes: new Map(),
      terminations,
    })

    expect(terminations[0]?.position).toEqual({ x: 51, y: 66 })
    expect(terminations[1]?.position).toEqual({ x: 24, y: 34 })
    expect(first.terminationsMigrated).toBe(2)
    expect(second).toEqual({
      scenesMigrated: 0,
      placementsMigrated: 0,
      terminationsMigrated: 0,
    })
  })
})
