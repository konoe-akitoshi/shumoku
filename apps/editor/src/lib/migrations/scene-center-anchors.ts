// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Node, Termination } from '@shumoku/core'
import { nodeCenterFromTopLeft, sceneNodeSize } from '../scene/node-geometry'
import type { Scene } from '../types'

export interface SceneAnchorMigrationStats {
  scenesMigrated: number
  placementsMigrated: number
  terminationsMigrated: number
}

/**
 * Convert legacy scene positions from an icon's top-left corner to a
 * physical center anchor. The migration mutates the load-time store
 * objects in place, matching the other editor data migrations.
 *
 * Termination positions live on the graph rather than in individual
 * scenes. They used fixed role dimensions in the legacy renderer, so
 * they are shifted once whenever at least one legacy scene is found.
 * Link bends are deliberately excluded: their x/y already represented
 * the routed polyline point even though the old bend glyph was offset.
 */
export function migrateScenePositionsToCenterAnchors({
  scenes,
  nodes,
  terminations,
}: {
  scenes: Scene[]
  nodes: Map<string, Node>
  terminations: Termination[]
}): SceneAnchorMigrationStats {
  const legacyScenes = scenes.filter((scene) => scene.placementOrigin !== 'center')
  let placementsMigrated = 0

  for (const scene of legacyScenes) {
    scene.nodePlacements = scene.nodePlacements.map((placement) => {
      const node = nodes.get(placement.nodeId)
      if (!node) return placement
      placementsMigrated++
      return {
        ...placement,
        position: nodeCenterFromTopLeft(scene, node, placement.position),
      }
    })
    scene.placementOrigin = 'center'
  }

  if (legacyScenes.length > 0) {
    for (const termination of terminations) {
      if (!termination.position) continue
      const { w, h } = sceneNodeSize({ termination: { role: termination.role } })
      termination.position = {
        x: termination.position.x + w / 2,
        y: termination.position.y + h / 2,
      }
    }
  }

  return {
    scenesMigrated: legacyScenes.length,
    placementsMigrated,
    terminationsMigrated:
      legacyScenes.length > 0
        ? terminations.filter((termination) => termination.position !== undefined).length
        : 0,
  }
}
