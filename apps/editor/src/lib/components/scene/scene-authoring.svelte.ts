// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

// Module-scoped state shared between SceneCanvas (which captures the
// clicks) and SceneSideToolbar (which exposes the buttons). Module-
// level $state (not class fields) so the runes preprocessor handles
// it cleanly under SSR — class fields ate the reactivity earlier.

type TerminationRole = 'outlet' | 'eps' | 'panel'
type Pending =
  | { kind: 'product'; productId: string }
  | { kind: 'empty' }
  | { kind: 'termination'; role: TerminationRole }
  | null

let pendingPlacement = $state<Pending>(null)
let pendingWireFrom = $state<string | null>(null)
let pendingWireWaypoints = $state<{ x: number; y: number }[]>([])
let cursorScenePt = $state<{ x: number; y: number } | null>(null)
let calibrationMode = $state<{ from?: { x: number; y: number } } | null>(null)
let calibrationPrompt = $state<{
  from: { x: number; y: number }
  to: { x: number; y: number }
} | null>(null)
let calibrationMeters = $state('')

export const sceneAuthoring = {
  get pendingPlacement() {
    return pendingPlacement
  },
  set pendingPlacement(v: Pending) {
    pendingPlacement = v
  },
  get pendingWireFrom() {
    return pendingWireFrom
  },
  set pendingWireFrom(v: string | null) {
    pendingWireFrom = v
  },
  get pendingWireWaypoints() {
    return pendingWireWaypoints
  },
  set pendingWireWaypoints(v: { x: number; y: number }[]) {
    pendingWireWaypoints = v
  },
  get cursorScenePt() {
    return cursorScenePt
  },
  set cursorScenePt(v: { x: number; y: number } | null) {
    cursorScenePt = v
  },
  get calibrationMode() {
    return calibrationMode
  },
  set calibrationMode(v: { from?: { x: number; y: number } } | null) {
    calibrationMode = v
  },
  get calibrationPrompt() {
    return calibrationPrompt
  },
  set calibrationPrompt(v: typeof calibrationPrompt) {
    calibrationPrompt = v
  },
  get calibrationMeters() {
    return calibrationMeters
  },
  set calibrationMeters(v: string) {
    calibrationMeters = v
  },

  reset() {
    pendingPlacement = null
    pendingWireFrom = null
    pendingWireWaypoints = []
    cursorScenePt = null
    calibrationMode = null
    calibrationPrompt = null
    calibrationMeters = ''
  },

  startCalibration() {
    pendingPlacement = null
    pendingWireFrom = null
    pendingWireWaypoints = []
    calibrationMode = {}
  },
}
