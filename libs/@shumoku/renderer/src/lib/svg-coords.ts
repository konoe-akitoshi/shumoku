/**
 * SVG ↔ Screen coordinate conversion utilities.
 *
 * Uses getScreenCTM() for bidirectional mapping between
 * SVG user units and screen (client viewport) pixels.
 */

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
