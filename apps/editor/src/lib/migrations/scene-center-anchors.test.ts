// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Node, Termination } from '@shumoku/core'
import { describe, expect, test } from 'vitest'
import type { Scene } from '../types'
import { migrateScenePositionsToCenterAnchors } from './scene-center-anchors'

function device(id: string): Node {
  return { id, label: id } as Node
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
    expect(stats).toEqual({ scenesMigrated: 1, placementsMigrated: 1 })
  })

  test('uses the legacy scene and per-placement display scales during conversion', () => {
    const nodes = new Map<string, Node>([['switch', device('switch')]])
    const scene: Scene = {
      id: 'floor',
      name: 'Floor',
      display: { nodeScale: 3 },
      nodePlacements: [{ nodeId: 'switch', position: { x: 10, y: 20 }, scale: 2 }],
    }

    migrateScenePositionsToCenterAnchors({ scenes: [scene], nodes, terminations: [] })

    expect(scene.nodePlacements[0]?.position).toEqual({ x: 62, y: 72 })
  })

  test('moves fixed-size termination placements once and is idempotent', () => {
    const terminations: Termination[] = [
      { id: 'eps', role: 'eps', label: 'EPS' },
      { id: 'outlet', role: 'outlet', label: 'Outlet' },
    ]
    const scene: Scene = {
      id: 'floor',
      name: 'Floor',
      nodePlacements: [
        { nodeId: 'eps', position: { x: 40, y: 50 } },
        { nodeId: 'outlet', position: { x: 10, y: 20 } },
      ],
    }

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

    expect(scene.nodePlacements[0]?.position).toEqual({ x: 51, y: 66 })
    expect(scene.nodePlacements[1]?.position).toEqual({ x: 24, y: 34 })
    expect(first).toEqual({ scenesMigrated: 1, placementsMigrated: 2 })
    expect(second).toEqual({ scenesMigrated: 0, placementsMigrated: 0 })
  })
})
