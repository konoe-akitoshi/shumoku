// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Where things sit inside a part. Pure functions the parts share; none of them decides the
 * size or the position of the part itself.
 */

import { type Node, nodeContentScale, nodePresentation, resolveIcon } from '@shumoku/core'
import { badgeWidth, cardMetrics, type Kit, nodeContentWidth } from './measure'
import type { Box, Point, Side } from './scene'
import type { Tokens } from './tokens'

/**
 * Proportions of the non-rectangular node outlines, as shares of the box. Shapes, not sizes:
 * they stretch with the box.
 */
export const SHAPE = {
  /** Horizontal reach of a hexagon's slanted corners, as a share of half the width. */
  hexagonReach: 0.866,
  /** Height of a cylinder's end caps, as a share of the box height. */
  cylinderCap: 0.15,
  /** How far a trapezoid's top edge is pulled in, as a share of the box width. */
  trapezoidInset: 0.15,
} as const

/**
 * Where the pieces of a card go. The content is one block, left-aligned inside so rows read
 * as a table; a box wider than the block (for its ports, or the minimum width) centres it, so
 * the name sits over the middle of the box where the wires meet it. Lines are given by the
 * height of their middle; the text adds its own baseline shift.
 */
export function cardContent(node: Node, box: Box, kit: Kit) {
  const { card } = kit.tokens
  const presentation = nodePresentation(node)
  const icon = resolveIcon(node.spec)
  const metrics = cardMetrics(presentation, !!icon, kit.tokens)
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const inner = box.width * nodeContentScale(node.shape).x - card.padding * 2
  const block = Math.min(inner, nodeContentWidth(node, kit))
  const left = cx - block / 2
  const top = cy - metrics.height / 2
  const textHeight = (presentation.labels.length + (presentation.subtitle ? 1 : 0)) * card.rowHeight
  const labelCentre = top + (metrics.headerHeight - textHeight) / 2 + card.rowHeight / 2
  const right = cx + block / 2
  const badgeW = badgeWidth(presentation.badge, kit)
  return {
    ...presentation,
    icon,
    iconX: left,
    iconY: top + (metrics.headerHeight - card.iconSize) / 2,
    left,
    right,
    badgeWidth: badgeW,
    badgeX: right - badgeW,
    badgeY: labelCentre - card.badgeHeight / 2,
    headerX: left + (icon ? card.iconSize + card.iconGap : 0),
    labelCentre,
    dividerY: top + metrics.headerHeight + card.sectionGap / 2,
    rowCentre: top + metrics.headerHeight + card.sectionGap + card.rowHeight / 2,
  }
}

/**
 * A polyline as a path, each vertex rounded with a circular arc of the radius given for it (one
 * radius for all when a number). The arc is tangent to both straights, so a vertex of turning
 * angle θ takes `r·tan(θ/2)` off each; where that does not fit, the radius is reduced to fit.
 */
export function polylinePath(points: readonly Point[], radius: number | readonly number[]): string {
  const first = points[0]
  if (!first) return ''
  if (points.length === 1) return `M ${first.x} ${first.y}`
  let d = `M ${first.x} ${first.y}`
  for (const [i, curr] of points.entries()) {
    const prev = points[i - 1]
    const next = points[i + 1]
    if (!prev || !next) continue
    const dxIn = curr.x - prev.x
    const dyIn = curr.y - prev.y
    const dxOut = next.x - curr.x
    const dyOut = next.y - curr.y
    const lenIn = Math.hypot(dxIn, dyIn)
    const lenOut = Math.hypot(dxOut, dyOut)
    const wanted = typeof radius === 'number' ? radius : (radius[i] ?? 0)
    if (lenIn === 0 || lenOut === 0 || wanted <= 0) {
      d += ` L ${curr.x} ${curr.y}`
      continue
    }
    const cross = dxIn * dyOut - dyIn * dxOut
    const dot = dxIn * dxOut + dyIn * dyOut
    const theta = Math.atan2(Math.abs(cross), dot)
    if (theta < 1e-3) {
      d += ` L ${curr.x} ${curr.y}`
      continue
    }
    const tanHalf = Math.tan(theta / 2)
    const t = Math.min(wanted * tanHalf, lenIn / 2, lenOut / 2)
    const r = t / tanHalf
    if (!(t > 1e-6) || !Number.isFinite(r)) {
      d += ` L ${curr.x} ${curr.y}`
      continue
    }
    d += ` L ${curr.x - (dxIn / lenIn) * t} ${curr.y - (dyIn / lenIn) * t}`
    d += ` A ${r} ${r} 0 0 ${cross > 0 ? 1 : 0} ${curr.x + (dxOut / lenOut) * t} ${curr.y + (dyOut / lenOut) * t}`
  }
  const last = points[points.length - 1]
  if (last && last !== first) d += ` L ${last.x} ${last.y}`
  return d
}

/**
 * A closed polygon of horizontal and vertical edges as a path, every corner rounded with an arc
 * of `radius` (less where an edge is too short for it). The points run clockwise on the page.
 */
export function roundedPolygonPath(points: readonly Point[], radius: number): string {
  // Only the points where the edge turns are corners: a repeated point or one on a straight
  // run is dropped.
  const distinct = points.filter((p, i) => {
    const prev = points[(i + points.length - 1) % points.length]
    return prev === undefined || prev.x !== p.x || prev.y !== p.y
  })
  const corners = distinct.filter((p, i) => {
    const prev = distinct[(i + distinct.length - 1) % distinct.length]
    const next = distinct[(i + 1) % distinct.length]
    if (!prev || !next) return true
    return (p.x - prev.x) * (next.y - p.y) - (p.y - prev.y) * (next.x - p.x) !== 0
  })
  const n = corners.length
  if (n < 3) return ''
  const at = (i: number): Point => corners[(i + n) % n] ?? { x: 0, y: 0 }
  const arcs = corners.map((curr, i) => {
    const prev = at(i - 1)
    const next = at(i + 1)
    const lenIn = Math.hypot(curr.x - prev.x, curr.y - prev.y)
    const lenOut = Math.hypot(next.x - curr.x, next.y - curr.y)
    const r = Math.min(radius, lenIn / 2, lenOut / 2)
    const dxIn = lenIn === 0 ? 0 : (curr.x - prev.x) / lenIn
    const dyIn = lenIn === 0 ? 0 : (curr.y - prev.y) / lenIn
    const dxOut = lenOut === 0 ? 0 : (next.x - curr.x) / lenOut
    const dyOut = lenOut === 0 ? 0 : (next.y - curr.y) / lenOut
    // Turning clockwise on the page (y down) is a positive cross product.
    const clockwise = dxIn * dyOut - dyIn * dxOut > 0
    return {
      from: { x: curr.x - dxIn * r, y: curr.y - dyIn * r },
      to: { x: curr.x + dxOut * r, y: curr.y + dyOut * r },
      r,
      sweep: clockwise ? 1 : 0,
    }
  })
  const first = arcs[0]
  if (!first) return ''
  let d = `M ${first.to.x} ${first.to.y}`
  for (const arc of [...arcs.slice(1), first]) {
    d += ` L ${arc.from.x} ${arc.from.y} A ${arc.r} ${arc.r} 0 0 ${arc.sweep} ${arc.to.x} ${arc.to.y}`
  }
  return `${d} Z`
}

const VLAN_COLORS = [
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#0891b2',
  '#2563eb',
  '#7c3aed',
  '#c026d3',
  '#db2777',
  '#059669',
  '#0284c7',
  '#4f46e5',
]

/** A wire's colour from the VLANs it carries. */
export function vlanStroke(vlan?: number[]): string | undefined {
  if (!vlan || vlan.length === 0) return undefined
  const sum = vlan.reduce((acc, v) => acc + v, 0)
  return VLAN_COLORS[sum % VLAN_COLORS.length]
}

/**
 * The middle of a polyline, where a caption sits unless the layout says otherwise: half its length
 * from either end, as the line is read, whatever its vertices (a 45° straight or a turn adds
 * vertices without moving the middle much).
 */
export function polylineMiddle(points: readonly Point[]): Point | undefined {
  const first = points[0]
  if (!first) return undefined
  const lengths = points.slice(1).map((b, k) => {
    const a = points[k] ?? b
    return Math.hypot(b.x - a.x, b.y - a.y)
  })
  let left = lengths.reduce((s, l) => s + l, 0) / 2
  for (const [k, l] of lengths.entries()) {
    const a = points[k] ?? first
    const b = points[k + 1] ?? a
    if (left <= l && l > 0) {
      const t = left / l
      return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }
    }
    left -= l
  }
  return points[points.length - 1]
}

/**
 * Where a port's label goes: the middle of its box, and which way the text reads from there.
 * The box sits one offset away from the port, on the side the port faces.
 */
export function portLabelAnchor(
  at: Point,
  side: Side,
  { port }: Tokens,
): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } {
  const offset = port.labelOffset
  switch (side) {
    case 'top':
      return { x: at.x, y: at.y - offset, anchor: 'middle' }
    case 'bottom':
      return { x: at.x, y: at.y + offset, anchor: 'middle' }
    case 'left':
      return { x: at.x - offset, y: at.y, anchor: 'end' }
    case 'right':
      return { x: at.x + offset, y: at.y, anchor: 'start' }
  }
}
