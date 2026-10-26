// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Where things sit inside a part. Pure functions the parts share; none of them decides the
 * size or the position of the part itself.
 */

import {
  type Node,
  nodeBadgeWidth,
  nodeContentMetrics,
  nodeContentScale,
  nodePresentation,
  resolveIcon,
} from '@shumoku/core'
import { nodeContentWidth, type TextMetrics } from './measure'
import type { Box, Point, Side } from './scene'
import { CARD, PORT } from './tokens'

/**
 * Where the pieces of a card go. The content is one block, left-aligned inside so rows read
 * as a table; a box wider than the block (for its ports, or the minimum width) centres it, so
 * the name sits over the middle of the box where the wires meet it.
 */
export function cardContent(node: Node, box: Box, text: TextMetrics) {
  const presentation = nodePresentation(node)
  const icon = resolveIcon(node.spec)
  const metrics = nodeContentMetrics(presentation, !!icon)
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const inner = box.width * nodeContentScale(node.shape).x - CARD.padding * 2
  const block = Math.min(inner, nodeContentWidth(node, text))
  const left = cx - block / 2
  const top = cy - metrics.height / 2
  const textHeight = (presentation.labels.length + (presentation.subtitle ? 1 : 0)) * CARD.rowHeight
  const labelY = top + (metrics.headerHeight - textHeight) / 2 + 12
  const right = cx + block / 2
  const badgeWidth = nodeBadgeWidth(presentation.badge)
  return {
    ...presentation,
    icon,
    iconX: left,
    iconY: top + (metrics.headerHeight - CARD.iconSize) / 2,
    left,
    right,
    badgeWidth,
    badgeX: right - badgeWidth,
    badgeY: labelY - 12,
    headerX: left + (icon ? CARD.iconSize + CARD.iconGap : 0),
    labelY,
    dividerY: top + metrics.headerHeight + CARD.sectionGap / 2,
    rowY: top + metrics.headerHeight + CARD.sectionGap + 12,
  }
}

/** A polyline as a path, its corners softened a little. */
export function polylinePath(points: readonly Point[]): string {
  const first = points[0]
  if (!first) return ''
  if (points.length === 1) return `M ${first.x} ${first.y}`
  const radius = 6
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
    if (lenIn < 1 || lenOut < 1) {
      d += ` L ${curr.x} ${curr.y}`
      continue
    }
    const r = Math.min(radius, lenIn / 2, lenOut / 2)
    d += ` L ${curr.x - (dxIn / lenIn) * r} ${curr.y - (dyIn / lenIn) * r}`
    d += ` Q ${curr.x} ${curr.y} ${curr.x + (dxOut / lenOut) * r} ${curr.y + (dyOut / lenOut) * r}`
  }
  const last = points[points.length - 1]
  if (last && last !== first) d += ` L ${last.x} ${last.y}`
  return d
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

/** Dashed for a virtual link, dotted for one assumed rather than confirmed. */
export function wireDasharray(link: {
  type?: string
  style?: { strokeDasharray?: string }
}): string {
  switch (link.type) {
    case 'dashed':
      return '5 3'
    case 'dotted':
      return '1 4'
    default:
      return link.style?.strokeDasharray ?? ''
  }
}

/** The middle of a polyline, where a caption sits unless the layout says otherwise. */
export function polylineMiddle(points: readonly Point[]): Point | undefined {
  if (points.length === 0) return undefined
  const mid = Math.floor(points.length / 2)
  const a = points[mid - 1]
  const b = points[mid]
  if (!a || !b) return points[0]
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/** A displaced caption keeps a quiet leader back to the wire it describes. */
export function captionLeader(
  points: readonly Point[],
  anchor: Point,
  size: { width: number; height: number },
): { from: Point; to: Point } | undefined {
  let nearest: Point | undefined
  let distance = Number.POSITIVE_INFINITY
  for (const [i, b] of points.entries()) {
    const a = points[i - 1]
    if (!a) continue
    const dx = b.x - a.x
    const dy = b.y - a.y
    const lengthSquared = dx * dx + dy * dy
    const t = lengthSquared
      ? Math.max(0, Math.min(1, ((anchor.x - a.x) * dx + (anchor.y - a.y) * dy) / lengthSquared))
      : 0
    const p = { x: a.x + dx * t, y: a.y + dy * t }
    const d = Math.hypot(p.x - anchor.x, p.y - anchor.y)
    if (d < distance) {
      nearest = p
      distance = d
    }
  }
  if (!nearest) return undefined
  const dx = nearest.x - anchor.x
  const dy = nearest.y - anchor.y
  const scale = Math.max(Math.abs(dx) / (size.width / 2), Math.abs(dy) / (size.height / 2))
  if (scale <= 1.1) return undefined
  return { from: nearest, to: { x: anchor.x + dx / scale, y: anchor.y + dy / scale } }
}

/** Where a port's label text goes, and which way it reads from there. */
export function portLabelAnchor(
  at: Point,
  side: Side,
): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } {
  const offset = PORT.labelOffset
  switch (side) {
    case 'top':
      return { x: at.x, y: at.y - offset, anchor: 'middle' }
    case 'bottom':
      return { x: at.x, y: at.y + offset + 4, anchor: 'middle' }
    case 'left':
      return { x: at.x - offset, y: at.y, anchor: 'end' }
    case 'right':
      return { x: at.x + offset, y: at.y, anchor: 'start' }
  }
}
