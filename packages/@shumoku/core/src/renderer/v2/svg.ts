/**
 * SVG Renderer v2
 * Renders NetworkGraphV2 to SVG
 */

import type {
  NetworkGraphV2,
  LayoutResult,
  LayoutNode,
  LayoutLink,
  LayoutSubgraph,
  Node,
  NodeShape,
  LinkType,
} from '../../models/v2'

// ============================================
// Renderer Options
// ============================================

export interface SVGRendererOptions {
  /** Background color */
  backgroundColor?: string
  /** Default node fill */
  defaultNodeFill?: string
  /** Default node stroke */
  defaultNodeStroke?: string
  /** Default link stroke */
  defaultLinkStroke?: string
  /** Font family */
  fontFamily?: string
  /** Include interactive elements */
  interactive?: boolean
}

const DEFAULT_OPTIONS: Required<SVGRendererOptions> = {
  backgroundColor: '#ffffff',
  defaultNodeFill: '#e2e8f0',
  defaultNodeStroke: '#64748b',
  defaultLinkStroke: '#94a3b8',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  interactive: true,
}

// ============================================
// SVG Renderer
// ============================================

export class SVGRendererV2 {
  private options: Required<SVGRendererOptions>

  constructor(options?: SVGRendererOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  render(_graph: NetworkGraphV2, layout: LayoutResult): string {
    const { bounds } = layout
    const width = bounds.width
    const height = bounds.height

    const parts: string[] = []

    // SVG header
    parts.push(this.renderHeader(width, height, bounds.x, bounds.y))

    // Defs (markers, gradients)
    parts.push(this.renderDefs())

    // Styles
    parts.push(this.renderStyles())

    // Subgraphs (background, render first)
    layout.subgraphs.forEach((sg) => {
      parts.push(this.renderSubgraph(sg))
    })

    // Links
    layout.links.forEach((link) => {
      parts.push(this.renderLink(link))
    })

    // Nodes
    layout.nodes.forEach((node) => {
      parts.push(this.renderNode(node))
    })

    // Close SVG
    parts.push('</svg>')

    return parts.join('\n')
  }

  private renderHeader(width: number, height: number, x: number, y: number): string {
    return `<svg xmlns="http://www.w3.org/2000/svg"
  viewBox="${x} ${y} ${width} ${height}"
  width="${width}"
  height="${height}"
  style="background: ${this.options.backgroundColor}">`
  }

  private renderDefs(): string {
    return `<defs>
  <!-- Arrow marker -->
  <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
    <polygon points="0 0, 10 3.5, 0 7" fill="${this.options.defaultLinkStroke}" />
  </marker>
  <marker id="arrow-red" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
    <polygon points="0 0, 10 3.5, 0 7" fill="#dc2626" />
  </marker>

  <!-- Filters -->
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="2" dy="2" stdDeviation="3" flood-opacity="0.15"/>
  </filter>
</defs>`
  }

  private renderStyles(): string {
    return `<style>
  .node { cursor: pointer; }
  .node:hover rect, .node:hover circle, .node:hover polygon { filter: brightness(0.95); }
  .node-label { font-family: ${this.options.fontFamily}; font-size: 12px; fill: #1e293b; }
  .node-label-bold { font-weight: bold; }
  .subgraph-label { font-family: ${this.options.fontFamily}; font-size: 14px; font-weight: 600; fill: #374151; }
  .link-label { font-family: ${this.options.fontFamily}; font-size: 11px; fill: #64748b; }
</style>`
  }

  private renderSubgraph(sg: LayoutSubgraph): string {
    const { bounds, subgraph } = sg
    const style = subgraph.style || {}

    const fill = style.fill || '#f8fafc'
    const stroke = style.stroke || '#cbd5e1'
    const strokeWidth = style.strokeWidth || 1
    const strokeDasharray = style.strokeDasharray || ''
    const labelPos = style.labelPosition || 'top'

    const rx = 8 // Border radius

    // Label position
    let labelX = bounds.x + 10
    let labelY = bounds.y + 20
    let textAnchor = 'start'

    if (labelPos === 'top') {
      labelX = bounds.x + 10
      labelY = bounds.y + 20
    }

    return `<g class="subgraph" data-id="${sg.id}">
  <rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}"
    rx="${rx}" ry="${rx}"
    fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"
    ${strokeDasharray ? `stroke-dasharray="${strokeDasharray}"` : ''} />
  <text x="${labelX}" y="${labelY}" class="subgraph-label" text-anchor="${textAnchor}">${this.escapeXml(subgraph.label)}</text>
</g>`
  }

  private renderNode(layoutNode: LayoutNode): string {
    const { id, position, size, node } = layoutNode
    const x = position.x
    const y = position.y
    const w = size.width
    const h = size.height

    const style = node.style || {}
    const fill = style.fill || this.options.defaultNodeFill
    const stroke = style.stroke || this.options.defaultNodeStroke
    const strokeWidth = style.strokeWidth || 1
    const strokeDasharray = style.strokeDasharray || ''

    const shape = this.renderNodeShape(node.shape, x, y, w, h, fill, stroke, strokeWidth, strokeDasharray)
    const label = this.renderNodeLabel(node, x, y, h)

    return `<g class="node" data-id="${id}" transform="translate(0,0)">
  ${shape}
  ${label}
</g>`
  }

  private renderNodeShape(
    shape: NodeShape,
    x: number, y: number,
    w: number, h: number,
    fill: string, stroke: string,
    strokeWidth: number, strokeDasharray: string
  ): string {
    const dashAttr = strokeDasharray ? `stroke-dasharray="${strokeDasharray}"` : ''
    const halfW = w / 2
    const halfH = h / 2

    switch (shape) {
      case 'rect':
        return `<rect x="${x - halfW}" y="${y - halfH}" width="${w}" height="${h}"
          fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashAttr} filter="url(#shadow)" />`

      case 'rounded':
        return `<rect x="${x - halfW}" y="${y - halfH}" width="${w}" height="${h}" rx="8" ry="8"
          fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashAttr} filter="url(#shadow)" />`

      case 'circle':
        const r = Math.min(halfW, halfH)
        return `<circle cx="${x}" cy="${y}" r="${r}"
          fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashAttr} filter="url(#shadow)" />`

      case 'diamond':
        return `<polygon points="${x},${y - halfH} ${x + halfW},${y} ${x},${y + halfH} ${x - halfW},${y}"
          fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashAttr} filter="url(#shadow)" />`

      case 'hexagon':
        const hx = halfW * 0.866
        return `<polygon points="${x - halfW},${y} ${x - hx},${y - halfH} ${x + hx},${y - halfH} ${x + halfW},${y} ${x + hx},${y + halfH} ${x - hx},${y + halfH}"
          fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashAttr} filter="url(#shadow)" />`

      case 'cylinder':
        const ellipseH = h * 0.15
        return `<g>
          <ellipse cx="${x}" cy="${y + halfH - ellipseH}" rx="${halfW}" ry="${ellipseH}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashAttr} />
          <rect x="${x - halfW}" y="${y - halfH + ellipseH}" width="${w}" height="${h - ellipseH * 2}" fill="${fill}" stroke="none" />
          <line x1="${x - halfW}" y1="${y - halfH + ellipseH}" x2="${x - halfW}" y2="${y + halfH - ellipseH}" stroke="${stroke}" stroke-width="${strokeWidth}" />
          <line x1="${x + halfW}" y1="${y - halfH + ellipseH}" x2="${x + halfW}" y2="${y + halfH - ellipseH}" stroke="${stroke}" stroke-width="${strokeWidth}" />
          <ellipse cx="${x}" cy="${y - halfH + ellipseH}" rx="${halfW}" ry="${ellipseH}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashAttr} filter="url(#shadow)" />
        </g>`

      case 'stadium':
        return `<rect x="${x - halfW}" y="${y - halfH}" width="${w}" height="${h}" rx="${halfH}" ry="${halfH}"
          fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashAttr} filter="url(#shadow)" />`

      case 'trapezoid':
        const indent = w * 0.15
        return `<polygon points="${x - halfW + indent},${y - halfH} ${x + halfW - indent},${y - halfH} ${x + halfW},${y + halfH} ${x - halfW},${y + halfH}"
          fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashAttr} filter="url(#shadow)" />`

      default:
        return `<rect x="${x - halfW}" y="${y - halfH}" width="${w}" height="${h}" rx="4" ry="4"
          fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashAttr} filter="url(#shadow)" />`
    }
  }

  private renderNodeLabel(node: Node, x: number, y: number, _h: number): string {
    const labels = Array.isArray(node.label) ? node.label : [node.label]
    const lineHeight = 16
    const totalHeight = labels.length * lineHeight
    const startY = y - totalHeight / 2 + lineHeight / 2 + 4

    const lines = labels.map((line, i) => {
      // Parse simple HTML tags
      const isBold = line.includes('<b>') || line.includes('<strong>')
      const cleanLine = line.replace(/<\/?b>|<\/?strong>|<br\s*\/?>/gi, '')
      const className = isBold ? 'node-label node-label-bold' : 'node-label'

      return `<text x="${x}" y="${startY + i * lineHeight}" class="${className}" text-anchor="middle">${this.escapeXml(cleanLine)}</text>`
    })

    return lines.join('\n  ')
  }

  private renderLink(layoutLink: LayoutLink): string {
    const { id, points, link } = layoutLink
    const type = link.type || 'solid'
    const label = link.label

    const stroke = link.style?.stroke || this.options.defaultLinkStroke
    const strokeWidth = link.style?.strokeWidth || this.getLinkStrokeWidth(type)
    const dasharray = link.style?.strokeDasharray || this.getLinkDasharray(type)
    const markerEnd = link.arrow !== 'none' ? 'url(#arrow)' : ''

    // Generate path
    let path: string

    if (points.length === 4) {
      // Bezier curve
      path = `M ${points[0].x} ${points[0].y} C ${points[1].x} ${points[1].y}, ${points[2].x} ${points[2].y}, ${points[3].x} ${points[3].y}`
    } else if (points.length === 2) {
      // Straight line
      path = `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
    } else {
      // Polyline
      path = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
    }

    let result = `<path class="link" data-id="${id}" d="${path}"
  fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"
  ${dasharray ? `stroke-dasharray="${dasharray}"` : ''}
  ${markerEnd ? `marker-end="${markerEnd}"` : ''} />`

    // Double line effect
    if (type === 'double') {
      result = `<path class="link-double-outer" d="${path}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth + 2}" />
<path class="link-double-inner" d="${path}" fill="none" stroke="white" stroke-width="${strokeWidth - 1}" />
${result}`
    }

    // Label
    if (label) {
      const labelText = Array.isArray(label) ? label.join(' / ') : label
      const midPoint = this.getMidPoint(points)
      result += `\n<text x="${midPoint.x}" y="${midPoint.y - 8}" class="link-label" text-anchor="middle">${this.escapeXml(labelText)}</text>`
    }

    return `<g class="link-group">\n${result}\n</g>`
  }

  private getLinkStrokeWidth(type: LinkType): number {
    switch (type) {
      case 'thick': return 3
      case 'double': return 2
      default: return 1.5
    }
  }

  private getLinkDasharray(type: LinkType): string {
    switch (type) {
      case 'dashed': return '5 3'
      case 'invisible': return '0'
      default: return ''
    }
  }

  private getMidPoint(points: { x: number; y: number }[]): { x: number; y: number } {
    if (points.length === 4) {
      // Bezier curve midpoint approximation
      const t = 0.5
      const x = Math.pow(1 - t, 3) * points[0].x +
        3 * Math.pow(1 - t, 2) * t * points[1].x +
        3 * (1 - t) * Math.pow(t, 2) * points[2].x +
        Math.pow(t, 3) * points[3].x
      const y = Math.pow(1 - t, 3) * points[0].y +
        3 * Math.pow(1 - t, 2) * t * points[1].y +
        3 * (1 - t) * Math.pow(t, 2) * points[2].y +
        Math.pow(t, 3) * points[3].y
      return { x, y }
    }

    // Linear midpoint
    const midIndex = Math.floor(points.length / 2)
    return points[midIndex]
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }
}

// Default export
export const svgRendererV2 = new SVGRendererV2()
