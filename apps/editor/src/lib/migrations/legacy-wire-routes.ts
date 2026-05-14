// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

// `Scene.wireRoutes[].controlPoints` → `Link.bends`.
//
// Original model stored anonymous absolute-coord bend points on
// `Scene.wireRoutes`, parallel to the link list. A subsequent rewrite
// migrated bends to `Node`s with `termination.role = 'bend'` spliced
// into `Link.via`, but that leaked the abstraction into every
// consumer of `nodes`. The current model puts bends back on the
// link itself via `Link.bends` — drawing artifact stays with the
// link, no Node pollution.
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
  /** All links in the freshly loaded diagram — mutated in place. */
  links: Link[]
  /** Allocate a stable id for a new bend record. */
  newBendId(): string
}

/**
 * Walk the raw scenes payload (before `sanitizeScenes`) and convert
 * each `controlPoints` entry into `link.bends` entries. Bends all
 * sit at `afterIndex = -1` (between `from` and the first via entry,
 * or directly between `from` and `to`) — that matches the original
 * "draw a polyline through these points before any transit" intent.
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
      const linkIdx = deps.links.findIndex((l) => l.id === route.linkId)
      if (linkIdx < 0) continue
      const link = deps.links[linkIdx]
      if (!link) continue
      const newBends = points.map((pt) => ({
        id: deps.newBendId(),
        x: pt.x,
        y: pt.y,
        afterIndex: -1,
      }))
      deps.links[linkIdx] = { ...link, bends: [...(link.bends ?? []), ...newBends] }
    }
  }
}
