// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

// `Scene.wireRoutes[].controlPoints` → bend Nodes + `Link.via`.
//
// The old model stored anonymous absolute-coord bend points on
// `Scene.wireRoutes`, parallel to the link list. The new model treats
// every transit point — bends included — as a real `Node` so Svelte
// Flow's native selection / drag / delete machinery applies uniformly.
//
// Reads RAW input — `sanitizeScenes` strips `wireRoutes` before the
// store sees it, so by the time we'd query the store the legacy field
// is gone. See `migrations/README.md` for the order rule.

import type { Link } from '@shumoku/core'

export type LegacyScene = {
  id: string
  wireRoutes?: Array<{ linkId: string; controlPoints?: Array<{ x: number; y: number }> }>
}

export interface LegacyWireRoutesDeps {
  /** All links in the freshly loaded diagram — used to look up routes. */
  links: Link[]
  /** Create a bend Node at the given scene position, return its id. */
  addTerminationInScene(sceneId: string, position: { x: number; y: number }, role: 'bend'): string
  /** Splice bend ids into the named link's `via` chain. */
  updateLink(linkId: string, updates: { via: string[] }): void
}

/**
 * Walk the raw scenes payload (before `sanitizeScenes`) and convert
 * each `controlPoints` entry into a bend Node spliced into the
 * matching link's `via`. Bends go in front of any existing via
 * entries — preserves the visual order from before the migration
 * where bends were first-class waypoints.
 *
 * No-op for scenes / routes / points that are absent or empty.
 */
export function migrateLegacyWireRoutes(rawScenes: unknown[], deps: LegacyWireRoutesDeps): void {
  for (const raw of rawScenes) {
    const legacy = raw as LegacyScene
    const routes = legacy.wireRoutes
    if (!routes?.length) continue
    for (const route of routes) {
      const points = route.controlPoints
      if (!points?.length) continue
      const link = deps.links.find((l) => l.id === route.linkId)
      if (!link) continue
      const newBendIds: string[] = []
      for (const pt of points) {
        const id = deps.addTerminationInScene(legacy.id, pt, 'bend')
        newBendIds.push(id)
      }
      deps.updateLink(route.linkId, { via: [...newBendIds, ...(link.via ?? [])] })
    }
  }
}
