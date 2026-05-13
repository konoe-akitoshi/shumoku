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
