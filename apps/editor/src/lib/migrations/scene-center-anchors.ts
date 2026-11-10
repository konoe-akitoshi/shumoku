// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Node, Termination } from '@shumoku/core'
import { effectiveNodeScale, sceneNodeSize } from '../scene/node-geometry'
import type { Scene } from '../types'

export interface SceneAnchorMigrationStats {
  scenesMigrated: number
  placementsMigrated: number
}

/**
 * Convert legacy scene positions from an icon's top-left corner to a
 * physical center anchor. The migration mutates the load-time store
 * objects in place, matching the other editor data migrations.
 *
 * A termination's placement is shifted by its role's fixed glyph size,
 * a node's by its drawn size in that scene. Link bends are deliberately
 * excluded: their x/y already represented the routed polyline point
 * even though the old bend glyph was offset.
 */
export function migrateScenePositionsToCenterAnchors({
  scenes,
  nodes,
  terminations,
}: {
  scenes: Scene[]
  nodes: Map<string, Node>
  terminations: readonly Termination[]
}): SceneAnchorMigrationStats {
  const legacyScenes = scenes.filter((scene) => scene.placementOrigin !== 'center')
  const roleOf = new Map(terminations.map((t) => [t.id, t.role]))
  let placementsMigrated = 0

  for (const scene of legacyScenes) {
    scene.nodePlacements = scene.nodePlacements.map((placement) => {
      const role = roleOf.get(placement.nodeId)
      if (!role && !nodes.has(placement.nodeId)) return placement
      placementsMigrated++
      const base = sceneNodeSize(role)
      // A termination's glyph had a fixed size; a node's followed the scene and its own scale.
      const scale = role ? 1 : effectiveNodeScale(scene, placement.nodeId)
      return {
        ...placement,
        position: {
          x: placement.position.x + (base.w * scale) / 2,
          y: placement.position.y + (base.h * scale) / 2,
        },
      }
    })
    scene.placementOrigin = 'center'
  }

  return { scenesMigrated: legacyScenes.length, placementsMigrated }
}
