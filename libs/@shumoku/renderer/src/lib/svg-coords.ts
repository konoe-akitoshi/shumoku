/**
 * SVG ↔ Screen coordinate conversion and shared rendering utilities.
 *
 * Bezier edge geometry lives in `@shumoku/core/src/layout/bezier-path.ts`
 * so the interactive renderer and the static SSR renderer share one
 * implementation. This file re-exports it for renderer-local imports.
 */

import type { PortSide } from '@shumoku/core'

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
 * Build a laterally-offset polyline SVG path `d` string.
 *
 * Each segment of the polyline is shifted perpendicular to its direction
 * by `offset` pixels. Sign convention — matches `bezierOffsetPath`:
 * positive = right-hand side of the travel direction in screen coords
 * (y-down). So for a rightward segment `+offset` shifts the lane downward.
 *
 * Interior corners are mitered: the join point is the intersection of the
 * two adjacent offset-segment lines, so the path remains continuous and
 * gap-free. Pathological miters (angle close to 180° or degenerate
 * segments) fall back to the average of the two per-segment translations.
 * Miters that land further than 4×|offset| from the original corner are
 * also clamped to the average-translation fallback.
 *
 * The resulting offset points are passed to `polylinePath` so the output
 * has the same rounded-corner style as the base edge.
 */
export function polylineOffsetPath(pts: Point[], offset: number): string {
  if (pts.length < 2) return polylinePath(pts)
  if (offset === 0 || !Number.isFinite(offset)) return polylinePath(pts)

  const n = pts.length

  // Per-segment perpendicular offset vector.
  // Convention: right-hand side of travel (dx,dy) → normal (-dy/len, dx/len) × offset.
  const segNormals: Point[] = []
  for (const [i] of pts.entries()) {
    if (i >= n - 1) break
    const p0 = pts[i]
    const p1 = pts[i + 1]
    if (!p0 || !p1) {
      segNormals.push({ x: 0, y: 0 })
      continue
    }
    const dx = p1.x - p0.x
    const dy = p1.y - p0.y
    const len = Math.hypot(dx, dy)
    if (len < 0.001) {
      segNormals.push({ x: 0, y: 0 })
    } else {
      segNormals.push({ x: (-dy / len) * offset, y: (dx / len) * offset })
    }
  }

  const offsetPts: Point[] = new Array(n)

  // First point: shift by first segment's normal.
  const first = pts[0]
  const n0 = segNormals[0]
  if (!first || !n0) return polylinePath(pts)
  offsetPts[0] = { x: first.x + n0.x, y: first.y + n0.y }

  // Last point: shift by last segment's normal.
  const last = pts[n - 1]
  const nLast = segNormals[n - 2]
  if (!last || !nLast) return polylinePath(pts)
  offsetPts[n - 1] = { x: last.x + nLast.x, y: last.y + nLast.y }

  // Interior corners: miter join (line-line intersection of adjacent offset lines).
  for (const [i] of pts.entries()) {
    if (i === 0 || i >= n - 1) continue
    const pi = pts[i]
    const nm1 = segNormals[i - 1] // normal of segment ending at corner
    const ni = segNormals[i] // normal of segment starting at corner
    const prev = pts[i - 1]
    const next = pts[i + 1]

    if (!pi || !nm1 || !ni || !prev || !next) {
      offsetPts[i] = pi ?? { x: 0, y: 0 }
      continue
    }

    // Fallback: translate by average of the two per-segment normals.
    const fallback: Point = {
      x: pi.x + (nm1.x + ni.x) / 2,
      y: pi.y + (nm1.y + ni.y) / 2,
    }

    // Line 1: passes through (pi + nm1) with direction d(i-1).
    const Ax = pi.x + nm1.x
    const Ay = pi.y + nm1.y
    const dx1 = pi.x - prev.x
    const dy1 = pi.y - prev.y
    const len1 = Math.hypot(dx1, dy1)

    // Line 2: passes through (pi + ni) with direction d(i).
    const Bx = pi.x + ni.x
    const By = pi.y + ni.y
    const dx2 = next.x - pi.x
    const dy2 = next.y - pi.y
    const len2 = Math.hypot(dx2, dy2)

    if (len1 < 0.001 || len2 < 0.001) {
      offsetPts[i] = fallback
      continue
    }

    const Dx = dx1 / len1
    const Dy = dy1 / len1
    const Ex = dx2 / len2
    const Ey = dy2 / len2

    // Solve: (Ax,Ay) + t*(Dx,Dy) = (Bx,By) + s*(Ex,Ey)
    // Cross-product of directions to find t.
    const cross = Dx * Ey - Dy * Ex

    if (Math.abs(cross) < 0.001) {
      // Near-parallel segments (collinear or nearly so): use fallback.
      offsetPts[i] = fallback
      continue
    }

    const t = ((Ay - By) * Ex - (Ax - Bx) * Ey) / cross
    const miterX = Ax + t * Dx
    const miterY = Ay + t * Dy

    // Clamp pathological miters: if the join is further than 4×|offset|
    // from the original corner, fall back to the average-translation point.
    const dist = Math.hypot(miterX - pi.x, miterY - pi.y)
    if (dist > 4 * Math.abs(offset)) {
      offsetPts[i] = fallback
    } else {
      offsetPts[i] = { x: miterX, y: miterY }
    }
  }

  return polylinePath(offsetPts)
}
