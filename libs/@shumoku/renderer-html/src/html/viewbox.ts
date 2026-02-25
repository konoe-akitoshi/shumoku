/**
 * ViewBox Utilities
 * Handles SVG viewBox parsing and manipulation
 */

export interface ViewBox {
  x: number
  y: number
  width: number
  height: number
}

export function parseViewBox(svg: SVGSVGElement): ViewBox | null {
  const vb = svg.getAttribute('viewBox')
  if (!vb) return null
  const parts = vb.split(/\s+|,/).map(Number)
  if (parts.length !== 4 || parts.some(Number.isNaN)) return null
  return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] }
}

export function setViewBox(svg: SVGSVGElement, vb: ViewBox, onUpdate?: () => void): void {
  svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.width} ${vb.height}`)
  onUpdate?.()
}

export function cloneViewBox(vb: ViewBox): ViewBox {
  return { x: vb.x, y: vb.y, width: vb.width, height: vb.height }
}
