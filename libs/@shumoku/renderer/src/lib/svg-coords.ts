/**
 * SVG ↔ Screen coordinate conversion and shared rendering utilities.
 *
 * Bezier edge geometry lives in `@shumoku/core/src/layout/bezier-path.ts`
 * so the interactive renderer and the static SSR renderer share one
 * implementation. This file re-exports it for renderer-local imports.
 */

import type { PortSide } from '@shumoku/core'
import { polylinePath as roundedPath } from '../kit/wire-look'

export { bezierEdgePath, bezierOffsetPath } from '@shumoku/core'

type Side = PortSide

const LABEL_OFFSET = 12

/** Compute port label position and text-anchor based on port side */
export function computePortLabelPosition(port: {
  absolutePosition: { x: number; y: number }
  side?: Side
}): { x: number; y: number; textAnchor: string } {
  const px = port.absolutePosition.x
  const py = port.absolutePosition.y
  switch (port.side) {
    case 'top':
      return { x: px, y: py - LABEL_OFFSET, textAnchor: 'middle' }
    case 'bottom':
      return { x: px, y: py + LABEL_OFFSET + 4, textAnchor: 'middle' }
    case 'left':
      return { x: px - LABEL_OFFSET, y: py, textAnchor: 'end' }
    case 'right':
      return { x: px + LABEL_OFFSET, y: py, textAnchor: 'start' }
    default:
      return { x: px, y: py - LABEL_OFFSET, textAnchor: 'middle' }
  }
}

/** Extract display label from a node */
export function getNodeLabel(node: { label?: string | string[] }): string {
  return Array.isArray(node.label) ? (node.label[0] ?? '') : (node.label ?? '')
}

// ============================================================================
// VLAN color (same as svg.ts getVlanStroke)
// ============================================================================

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

/** Get stroke color based on VLAN IDs */
export function getVlanStroke(vlan?: number[]): string | undefined {
  if (!vlan || vlan.length === 0) return undefined
  const hash = vlan.reduce((acc, v) => acc + v, 0)
  return VLAN_COLORS[hash % VLAN_COLORS.length]
}

/**
 * The dash pattern a link is drawn with: dashed for a virtual link, dotted for one that is
 * assumed rather than confirmed.
 */
export function linkDasharray(
  link: { type?: string; style?: { strokeDasharray?: string } } | undefined,
): string {
  switch (link?.type) {
    case 'dashed':
      return '5 3'
    case 'dotted':
      return '1 4'
    default:
      return link?.style?.strokeDasharray ?? ''
  }
}

// ============================================================================
// Coordinate conversion
// ============================================================================

/** Convert SVG coordinates to screen (client) coordinates */
export function svgToScreen(
  svg: SVGSVGElement,
  svgX: number,
  svgY: number,
): { x: number; y: number } {
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: svgX, y: svgY }
  const p = new DOMPoint(svgX, svgY).matrixTransform(ctm)
  return { x: p.x, y: p.y }
}

/** Convert screen (client) coordinates to SVG coordinates */
export function screenToSvg(
  svg: SVGSVGElement,
  screenX: number,
  screenY: number,
): { x: number; y: number } {
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: screenX, y: screenY }
  const p = new DOMPoint(screenX, screenY).matrixTransform(ctm.inverse())
  return { x: p.x, y: p.y }
}

/**
 * Convert screen (client) coordinates to *world* coordinates — the
 * space used by node positions / layout output — by inverting the
 * viewport `<g>`'s screen CTM. Unlike `screenToSvg` (which only
 * inverts the SVG root's CTM), this includes any pan / zoom transform
 * the host attached to the viewport, so a cursor at a given client
 * position maps to the world point under that pixel regardless of
 * camera state. Falls back to the SVG root's CTM when no viewport
 * group exists (e.g. minimal viewer rendering).
 */
export function screenToWorld(
  svg: SVGSVGElement,
  screenX: number,
  screenY: number,
): { x: number; y: number } {
  const viewport = svg.querySelector('.viewport') as SVGGraphicsElement | null
  const ctm = (viewport ?? svg).getScreenCTM()
  if (!ctm) return { x: screenX, y: screenY }
  const p = new DOMPoint(screenX, screenY).matrixTransform(ctm.inverse())
  return { x: p.x, y: p.y }
}

/** Convert an SVG rect (center + size) to screen DOMRect, relative to a container element */
export function svgRectToContainer(
  svg: SVGSVGElement,
  container: HTMLElement,
  center: { x: number; y: number },
  size: { width: number; height: number },
): { top: number; left: number; width: number; height: number } {
  const topLeft = svgToScreen(svg, center.x - size.width / 2, center.y - size.height / 2)
  const bottomRight = svgToScreen(svg, center.x + size.width / 2, center.y + size.height / 2)
  const containerRect = container.getBoundingClientRect()
  return {
    top: topLeft.y - containerRect.top,
    left: topLeft.x - containerRect.left,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y,
  }
}

/** Convert a single SVG point to container-relative coordinates */
export function svgPointToContainer(
  svg: SVGSVGElement,
  container: HTMLElement,
  svgX: number,
  svgY: number,
): { top: number; left: number } {
  const screen = svgToScreen(svg, svgX, svgY)
  const containerRect = container.getBoundingClientRect()
  return {
    top: screen.y - containerRect.top,
    left: screen.x - containerRect.left,
  }
}

// ============================================================================
// Polyline path helpers
// ============================================================================

type Point = { x: number; y: number }

/**
 * Build an SVG path `d` string for an orthogonal polyline with optional
 * rounded corners. Uses quadratic-Bezier arcs (Q command) at each interior
 * joint so the right-angle turns read cleanly without being aggressively
 * crisp. Extracted from `SvgEdge.svelte` so weathermap overlays and
 * other consumers can reuse the exact same rounding logic.
 */
export function polylinePath(pts: Point[]): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M ${pts[0]?.x ?? 0} ${pts[0]?.y ?? 0}`
  const r = 6
  let d = `M ${pts[0]?.x ?? 0} ${pts[0]?.y ?? 0}`
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1]
    const curr = pts[i]
    const next = pts[i + 1]
    if (!prev || !curr || !next) continue
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
    const ri = Math.min(r, lenIn / 2, lenOut / 2)
    const inX = curr.x - (dxIn / lenIn) * ri
    const inY = curr.y - (dyIn / lenIn) * ri
    const outX = curr.x + (dxOut / lenOut) * ri
    const outY = curr.y + (dyOut / lenOut) * ri
    d += ` L ${inX} ${inY} Q ${curr.x} ${curr.y} ${outX} ${outY}`
  }
  const last = pts[pts.length - 1]
  if (last) d += ` L ${last.x} ${last.y}`
  return d
}

/**
 * The vertices of a polyline shifted sideways by `offset`: positive is the right-hand side of the
 * travel direction in screen coordinates (y-down), so for a rightward segment `+offset` shifts
 * the lane downward. Interior corners are mitered (the intersection of the two shifted lines);
 * a degenerate or pathological miter (further than 4x|offset| from the corner) falls back to the
 * average of the two per-segment shifts.
 */
export function offsetPolyline(pts: readonly Point[], offset: number): Point[] {
  if (pts.length < 2 || offset === 0 || !Number.isFinite(offset)) return [...pts]
  const n = pts.length
  const normals: Point[] = []
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i]
    const p1 = pts[i + 1]
    const len = p0 && p1 ? Math.hypot(p1.x - p0.x, p1.y - p0.y) : 0
    if (!p0 || !p1 || len < 0.001) normals.push({ x: 0, y: 0 })
    else normals.push({ x: (-(p1.y - p0.y) / len) * offset, y: ((p1.x - p0.x) / len) * offset })
  }
  return pts.map((p, i) => {
    const before = normals[i - 1]
    const after = normals[i]
    if (!before && after) return { x: p.x + after.x, y: p.y + after.y }
    if (before && !after) return { x: p.x + before.x, y: p.y + before.y }
    if (!before || !after) return p
    const prev = pts[i - 1]
    const next = pts[i + 1]
    const fallback = { x: p.x + (before.x + after.x) / 2, y: p.y + (before.y + after.y) / 2 }
    if (!prev || !next) return fallback
    const len1 = Math.hypot(p.x - prev.x, p.y - prev.y)
    const len2 = Math.hypot(next.x - p.x, next.y - p.y)
    if (len1 < 0.001 || len2 < 0.001) return fallback
    const d1 = { x: (p.x - prev.x) / len1, y: (p.y - prev.y) / len1 }
    const d2 = { x: (next.x - p.x) / len2, y: (next.y - p.y) / len2 }
    const cross = d1.x * d2.y - d1.y * d2.x
    if (Math.abs(cross) < 0.001) return fallback
    const a = { x: p.x + before.x, y: p.y + before.y }
    const b = { x: p.x + after.x, y: p.y + after.y }
    const t = ((a.y - b.y) * d2.x - (a.x - b.x) * d2.y) / cross
    const miter = { x: a.x + t * d1.x, y: a.y + t * d1.y }
    return Math.hypot(miter.x - p.x, miter.y - p.y) > 4 * Math.abs(offset) ? fallback : miter
  })
}

/**
 * A lane running alongside a drawn wire: the wire's polyline shifted by `offset`, its corners
 * rounded like the wire's own. A corner's centre lies on the side the line turns toward, so a lane
 * on that side bends tighter (radius - |offset|) and one on the other side wider (radius + |offset|).
 */
export function polylineOffsetPath(
  pts: readonly Point[],
  radii: readonly number[],
  offset: number,
): string {
  const moved = offsetPolyline(pts, offset)
  const shifted = moved.map((_, i) => {
    const r = radii[i] ?? 0
    const prev = pts[i - 1]
    const here = pts[i]
    const next = pts[i + 1]
    if (r <= 0 || !prev || !here || !next || !Number.isFinite(offset)) return r
    const turn = (here.x - prev.x) * (next.y - here.y) - (here.y - prev.y) * (next.x - here.x)
    return Math.max(0, r - offset * Math.sign(turn))
  })
  return roundedPath(moved, shifted)
}
