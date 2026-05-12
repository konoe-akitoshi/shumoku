// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Cubic-Bezier edge path generation.
 *
 * Single source of truth for the curve geometry used by both the
 * interactive Svelte renderer (`@shumoku/renderer/src/components/svg/
 * SvgEdge.svelte`) and the static SSR renderer
 * (`@shumoku/renderer-svg/src/svg.ts`). Network diagrams should look
 * the same whether they're rendered live in the editor or exported as
 * SVG/PNG from the CLI/server.
 *
 * Tangent magnitude scales with **the distance along the port normal**
 * (the rank-axis gap), not the straight-line Euclidean distance. That
 * keeps the curve "shooting straight" out of the port for a sizeable
 * fraction of the gap before bending sideways — endpoints read as
 * straight stalks while the curvature concentrates in the middle.
 * Network-diagram convention.
 *
 * No obstacle avoidance — by design, in exchange for predictable,
 * solver-free output. If the curve crosses an unrelated node body it
 * just goes through it. Acceptable in the layered topology case where
 * layers are stacked clearly along the rank axis.
 */

export type PortSide = 'top' | 'bottom' | 'left' | 'right'

/** Minimum / maximum "stalk" length in pixels. */
const MIN_REACH = 40
const MAX_REACH = 320
const REACH_RATIO = 0.6

/**
 * Build a cubic-Bezier SVG path `d` string from one port to another.
 *
 * Each port is described by its absolute (x, y) position and which
 * side of the node it sits on. The path leaves `from` along that
 * side's outward normal, sweeps through two symmetric control points,
 * and enters `to` along its own side's inward normal.
 */
export function bezierEdgePath(
  from: { absolutePosition: { x: number; y: number }; side?: PortSide },
  to: { absolutePosition: { x: number; y: number }; side?: PortSide },
): string {
  const a = from.absolutePosition
  const b = to.absolutePosition
  const fromSide = from.side ?? 'bottom'
  const toSide = to.side ?? 'top'
  const normalGap = projectAlongNormal(fromSide, b.x - a.x, b.y - a.y)
  const reach = clamp(normalGap * REACH_RATIO, MIN_REACH, MAX_REACH)
  const [ax, ay] = tangentOffset(fromSide, reach)
  const [bx, by] = tangentOffset(toSide, reach)
  return `M ${a.x} ${a.y} C ${a.x + ax} ${a.y + ay} ${b.x + bx} ${b.y + by} ${b.x} ${b.y}`
}

/** Absolute distance from a port along its outward normal direction. */
function projectAlongNormal(side: PortSide, dx: number, dy: number): number {
  switch (side) {
    case 'top':
      return Math.abs(Math.min(0, dy))
    case 'bottom':
      return Math.abs(Math.max(0, dy))
    case 'left':
      return Math.abs(Math.min(0, dx))
    case 'right':
      return Math.abs(Math.max(0, dx))
  }
}

function tangentOffset(side: PortSide, magnitude: number): [number, number] {
  switch (side) {
    case 'top':
      return [0, -magnitude]
    case 'bottom':
      return [0, magnitude]
    case 'left':
      return [-magnitude, 0]
    case 'right':
      return [magnitude, 0]
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
