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
 * Tangent-bias cap relative to the curve's reach. Keeps the
 * emission angle bounded (~atan(0.4) ≈ 22°) even when the port
 * sits far off the node centre — without this, a short edge from
 * an off-centre port produces a wild S-curve because the lateral
 * lean overpowers the normal component.
 */
const MAX_BIAS_RATIO = 0.4

/**
 * Build a cubic-Bezier SVG path `d` string from one port to another.
 *
 * Each port is described by its absolute (x, y) position and which
 * side of the node it sits on. The path leaves `from` along that
 * side's outward normal, sweeps through two symmetric control points,
 * and enters `to` along its own side's inward normal.
 *
 * `lateralOffset` (optional, on either endpoint) shifts that endpoint
 * **and** its control point perpendicular to the port's outward
 * normal, so the curve still leaves / arrives straight along the
 * normal but starts (or ends) sideways from the port centre. Used by
 * the router to fan multiple edges sharing one port apart visually
 * without rerouting through orthogonal segments. Positive = right of
 * the outward normal in screen coords (y-down). The endpoint *visibly
 * detaches from the port centre* by the offset — fine for fan-out
 * decoration but not for tight-tolerance hit testing on the port itself.
 */
export function bezierEdgePath(
  from: {
    absolutePosition: { x: number; y: number }
    side?: PortSide
    lateralOffset?: number
    /**
     * Lateral component added to the tangent at this endpoint, in
     * pixels, perpendicular to the port's outward normal. Positive
     * = same direction as `lateralShift`'s positive sign (right of
     * outward normal, screen-coords y-down).
     *
     * Use this to make a port that sits off-centre on its node
     * emit the curve diagonally outward, like a physical cable
     * leaving the connector at an angle. Two downlinks coming out
     * of the bottom of a router naturally diverge instead of both
     * heading straight down — visually separating their fan-outs
     * and avoiding clashes with intermediate nodes between source
     * and target.
     */
    tangentBias?: number
  },
  to: {
    absolutePosition: { x: number; y: number }
    side?: PortSide
    lateralOffset?: number
    tangentBias?: number
  },
): string {
  const fromSide = from.side ?? 'bottom'
  const toSide = to.side ?? 'top'
  const [aShiftX, aShiftY] = lateralShift(fromSide, from.lateralOffset ?? 0)
  const [bShiftX, bShiftY] = lateralShift(toSide, to.lateralOffset ?? 0)
  const a = { x: from.absolutePosition.x + aShiftX, y: from.absolutePosition.y + aShiftY }
  const b = { x: to.absolutePosition.x + bShiftX, y: to.absolutePosition.y + bShiftY }
  const normalGap = projectAlongNormal(fromSide, b.x - a.x, b.y - a.y)
  const reach = clamp(normalGap * REACH_RATIO, MIN_REACH, MAX_REACH)
  const [ax, ay] = tangentOffset(fromSide, reach, capBias(from.tangentBias ?? 0, reach))
  const [bx, by] = tangentOffset(toSide, reach, capBias(to.tangentBias ?? 0, reach))
  return `M ${a.x} ${a.y} C ${a.x + ax} ${a.y + ay} ${b.x + bx} ${b.y + by} ${b.x} ${b.y}`
}

/** Clamp the tangent bias so the emission angle stays bounded. */
function capBias(bias: number, reach: number): number {
  const cap = reach * MAX_BIAS_RATIO
  if (bias > cap) return cap
  if (bias < -cap) return -cap
  return bias
}

/**
 * Vector that shifts a point sideways from a port by `offset` SVG
 * units. The shift is perpendicular to the port's outward normal —
 * for top/bottom ports that's horizontal, for left/right it's
 * vertical. Sign convention: positive = right of the outward normal
 * in screen coords (y-down). The 90° rotation matches `bezierOffsetPath`.
 */
function lateralShift(side: PortSide, offset: number): [number, number] {
  if (!offset) return [0, 0]
  switch (side) {
    case 'top':
      return [-offset, 0]
    case 'bottom':
      return [offset, 0]
    case 'left':
      return [0, offset]
    case 'right':
      return [0, -offset]
  }
}

/**
 * `bezierEdgePath` translated as a whole by `offset` SVG units along the
 * chord-perpendicular direction. Used to draw parallel "in" / "out"
 * lanes for weathermap-style flow overlays.
 *
 * This is a *parallel translate*, NOT a true cubic offset curve (which
 * cannot in general be represented exactly as another cubic). All four
 * control points shift by the same vector, so:
 *   • lane spacing is exactly `2 * |offset|` everywhere along the curve,
 *   • the offset curve never crosses the base curve or the opposite lane
 *     regardless of port-side configuration (incl. same-side U-turns
 *     and adjacent-side L-turns),
 *   • tangents are preserved at every point — but the lane endpoint is
 *     shifted off the port by `(nx, ny)`. Lanes are decorative; they
 *     are not meant to "connect to" the port.
 *
 * The shift direction is the chord normal (perpendicular to b-a). Sign
 * convention: in screen coordinates (y-down), `+offset` shifts to the
 * right-hand side of the chord A→B, `-offset` to the left. Pass
 * `+offset` and `-offset` for the two lanes; which one ends up labelled
 * "in" is a data-source semantic, not enforced here.
 *
 * Computed analytically — no DOM measurement, so callers don't need a
 * mounted SVGPathElement.
 */
export function bezierOffsetPath(
  from: { absolutePosition: { x: number; y: number }; side?: PortSide },
  to: { absolutePosition: { x: number; y: number }; side?: PortSide },
  offset: number,
): string {
  if (!Number.isFinite(offset) || offset === 0) return bezierEdgePath(from, to)

  const a = from.absolutePosition
  const b = to.absolutePosition
  const dx = b.x - a.x
  const dy = b.y - a.y
  const chordLen = Math.hypot(dx, dy)
  // Degenerate (coincident endpoints): no meaningful chord direction.
  if (chordLen === 0) return bezierEdgePath(from, to)

  // Right-hand chord normal × offset → uniform translation vector.
  const nx = -(dy / chordLen) * offset
  const ny = (dx / chordLen) * offset

  const fromSide = from.side ?? 'bottom'
  const toSide = to.side ?? 'top'
  const normalGap = projectAlongNormal(fromSide, dx, dy)
  const reach = clamp(normalGap * REACH_RATIO, MIN_REACH, MAX_REACH)
  const [ax, ay] = tangentOffset(fromSide, reach, 0)
  const [bx, by] = tangentOffset(toSide, reach, 0)

  const p0x = a.x + nx
  const p0y = a.y + ny
  const p1x = a.x + ax + nx
  const p1y = a.y + ay + ny
  const p2x = b.x + bx + nx
  const p2y = b.y + by + ny
  const p3x = b.x + nx
  const p3y = b.y + ny

  return `M ${p0x} ${p0y} C ${p1x} ${p1y} ${p2x} ${p2y} ${p3x} ${p3y}`
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

function tangentOffset(side: PortSide, magnitude: number, bias: number): [number, number] {
  switch (side) {
    case 'top':
      return [-bias, -magnitude]
    case 'bottom':
      return [bias, magnitude]
    case 'left':
      return [-magnitude, bias]
    case 'right':
      return [magnitude, -bias]
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
