// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

// Module-scoped state shared between SceneCanvas (which captures
// the clicks), the side toolbar (which arms the actions), and the
// authoring overlays (calibration capture). Module-level $state —
// not class fields — so the runes preprocessor handles it cleanly
// under SSR.

type TerminationRole = 'outlet' | 'eps' | 'panel'
type Pending =
  | { kind: 'product'; productId: string }
  | { kind: 'empty' }
  | { kind: 'termination'; role: TerminationRole }
  | null

let pendingPlacement = $state<Pending>(null)
let calibrationMode = $state<{ from?: { x: number; y: number } } | null>(null)

export const sceneAuthoring = {
  get pendingPlacement() {
    return pendingPlacement
  },
  set pendingPlacement(v: Pending) {
    pendingPlacement = v
  },
  get calibrationMode() {
    return calibrationMode
  },
  set calibrationMode(v: { from?: { x: number; y: number } } | null) {
    calibrationMode = v
  },

  reset() {
    pendingPlacement = null
    calibrationMode = null
  },

  startCalibration() {
    pendingPlacement = null
    calibrationMode = {}
  },
}
