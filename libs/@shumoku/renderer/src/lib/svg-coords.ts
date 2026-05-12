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

/**
 * Build a cubic-Bezier SVG path that flows out of `from`'s port side and
 * into `to`'s.
 *
 * Tangent magnitude scales with **the distance along the port normal**
 * (the rank-axis gap), not the straight-line Euclidean distance. That
 * keeps the curve "shooting straight" out of the port for a sizeable
 * fraction of the vertical gap before bending sideways — endpoints
 * read as straight while the curvature concentrates in the middle.
 * Using the Euclidean distance instead made every long edge into a
 * gentle diagonal that started turning right at the port; perpendicular
 * gap gives the more telegraphic "stalk → arc → stalk" silhouette.
 *
 * No obstacle avoidance — by design, since we trade the bend-channel
 * correctness of libavoid for visual flow. If the edge crosses an
 * unrelated node body it just goes through it. Acceptable for the
 * network-diagram case where parent/child layers are clearly stacked.
 */
export function bezierEdgePath(
  from: { absolutePosition: { x: number; y: number }; side?: Side },
  to: { absolutePosition: { x: number; y: number }; side?: Side },
): string {
  const a = from.absolutePosition
  const b = to.absolutePosition
  const fromSide = from.side ?? 'bottom'
  const toSide = to.side ?? 'top'
  // Distance along the source's port normal (= the "rank-axis gap"
  // when source.side is top/bottom this is |dy|, when it's left/right
  // this is |dx|). Long stalks come out of the port before the arc
  // takes over.
  const normalGap = projectAlongNormal(fromSide, b.x - a.x, b.y - a.y)
  const reach = clamp(normalGap * 0.6, 40, 320)
  const [ax, ay] = tangentOffset(fromSide, reach)
  const [bx, by] = tangentOffset(toSide, reach)
  const c1x = a.x + ax
  const c1y = a.y + ay
  const c2x = b.x + bx
  const c2y = b.y + by
  return `M ${a.x} ${a.y} C ${c1x} ${c1y} ${c2x} ${c2y} ${b.x} ${b.y}`
}

/** Absolute distance from the port along its outward normal. */
function projectAlongNormal(side: Side, dx: number, dy: number): number {
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

function tangentOffset(side: Side, magnitude: number): [number, number] {
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
