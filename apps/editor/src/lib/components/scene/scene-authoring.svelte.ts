// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

// Module-scoped state shared between SceneCanvas (which captures the
// clicks) and SceneSideToolbar (which exposes the buttons). Keeping
// it in a singleton lets the toolbar live in `+page.svelte` while the
// authoring loop runs inside the canvas.

type Pending = { kind: 'product'; productId: string } | { kind: 'empty' } | null

class SceneAuthoring {
  pendingPlacement = $state<Pending>(null)
  pendingWireFrom = $state<string | null>(null)
  pendingWireWaypoints = $state<{ x: number; y: number }[]>([])
  cursorScenePt = $state<{ x: number; y: number } | null>(null)
  calibrationMode = $state<{ from?: { x: number; y: number } } | null>(null)
  calibrationPrompt = $state<{
    from: { x: number; y: number }
    to: { x: number; y: number }
  } | null>(null)
  calibrationMeters = $state('')

  reset() {
    this.pendingPlacement = null
    this.pendingWireFrom = null
    this.pendingWireWaypoints = []
    this.cursorScenePt = null
    this.calibrationMode = null
    this.calibrationPrompt = null
    this.calibrationMeters = ''
  }

  startCalibration() {
    this.pendingPlacement = null
    this.pendingWireFrom = null
    this.pendingWireWaypoints = []
    this.calibrationMode = {}
  }
}

export const sceneAuthoring = new SceneAuthoring()
