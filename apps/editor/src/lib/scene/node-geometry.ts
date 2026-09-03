// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { Position } from '@xyflow/svelte'
import type { Scene } from '../types'

export type TerminationRole = 'outlet' | 'eps' | 'panel' | 'bend'
export type WithTermination = { termination?: { role: TerminationRole } }
export type WithScaleOverride = { metadata?: Record<string, unknown> }
export type SceneSizedNode = WithTermination & WithScaleOverride

/**
 * Path corner radius for a polyline that bends through Nodes. The
 * bend dot is sized at 2x this so its footprint exactly matches the
 * arc the path cuts at each corner — visually the bend covers the
 * rounded corner rather than floating beside it.
 */
export const WIRE_CORNER_RADIUS = 8

/**
 * Flow-space multiplier that gives scene pins a map-marker-like screen
 * size. At ordinary zoom levels pins still grow and shrink slightly,
 * but they cannot become unreadably tiny or overwhelm the floor plan.
 * The multiplier affects rendering only; stored anchors and distance
 * calculations remain in unscaled scene coordinates.
 */
export function mapMarkerFlowScale(zoom: number): number {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1
  const screenScale = Math.max(0.5, Math.min(1.5, safeZoom))
  return screenScale / safeZoom
}

/**
 * Pixel dimensions of a SceneNode for its role. Devices are larger
 * pins; termination points (outlet / EPS / panel) are role-specific
 * smaller glyphs; bends are tiny anchor dots. Returned width/height
 * match what `SceneNode.svelte` actually renders, so callers can
 * compute correct centers, hit areas, and wire endpoint anchors
 * without re-deriving sizes.
 */
export function sceneNodeSize(node: WithTermination | undefined): { w: number; h: number } {
  const role = node?.termination?.role
  if (role === 'bend') return { w: WIRE_CORNER_RADIUS * 2, h: WIRE_CORNER_RADIUS * 2 }
  if (role === 'outlet') return { w: 28, h: 28 }
  if (role === 'eps') return { w: 22, h: 32 }
  if (role === 'panel') return { w: 44, h: 22 }
  return { w: 52, h: 52 }
}

/**
 * Effective display scale a node renders at: a per-element override
 * (`Node.metadata.displayScale`) wins, falling back to the per-scene
 * default. This is the multiplier applied on top of `sceneNodeSize`'s
 * base role dimensions.
 */
export function effectiveNodeScale(scene: Scene, node: SceneSizedNode | undefined): number {
  const override = node?.metadata?.displayScale
  if (typeof override === 'number' && override > 0) return override
  return scene.display?.nodeScale ?? 1
}

/**
 * Effective rendered size for a node in a given scene — base role
 * size times its effective scale. Both SceneCanvas (which hands these
 * to Svelte Flow as `Node.width` / `Node.height`) and cable-length
 * math (which adds half-w / half-h to recover the icon center) read
 * from this single source so the visual line and the reported length
 * stay in sync.
 */
export function effectiveNodeSize(
  scene: Scene,
  node: SceneSizedNode | undefined,
): { w: number; h: number } {
  const base = sceneNodeSize(node)
  const s = effectiveNodeScale(scene, node)
  return { w: base.w * s, h: base.h * s }
}

/**
 * Convert a legacy top-left placement to the current center anchor.
 * Runtime geometry must not call this: physical positions and cable
 * lengths are intentionally independent of rendered icon size. It is
 * kept here for the one-shot project-load migration only.
 */
export function nodeCenterFromTopLeft(
  scene: Scene,
  node: SceneSizedNode | undefined,
  topLeft: { x: number; y: number },
): { x: number; y: number } {
  const { w, h } = effectiveNodeSize(scene, node)
  return { x: topLeft.x + w / 2, y: topLeft.y + h / 2 }
}

/**
 * Turn a direction vector (from a node toward its peer) into the
 * side of the node a wire should exit through. Whichever axis
 * dominates wins, so wires come out of the side that faces the
 * peer instead of always exiting the top.
 *
 * The return value is a Svelte Flow `Position` — it doubles as both
 * a `sourceHandle` / `targetHandle` id (since our SceneNode handle
 * ids match the Position values) and a `sourcePosition` /
 * `targetPosition` for `getSmoothStepPath`.
 */
export function pickSideForDirection(dx: number, dy: number): Position {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? Position.Right : Position.Left
  return dy >= 0 ? Position.Bottom : Position.Top
}
