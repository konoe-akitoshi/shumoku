/**
 * SVG ↔ Screen coordinate conversion and shared rendering utilities.
 */

// ============================================================================
// Shared rendering helpers
// ============================================================================

/** Build an SVG path 'd' attribute from an array of points */
export function pointsToPathD(points: { x: number; y: number }[]): string {
  if (points.length === 0) return ''
  const [first, ...rest] = points
  if (!first) return ''
  let d = `M ${first.x} ${first.y}`
  for (const pt of rest) {
    d += ` L ${pt.x} ${pt.y}`
  }
  return d
}

type Side = 'top' | 'bottom' | 'left' | 'right'

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
