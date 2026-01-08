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
import { getDeviceIcon, getVendorIcon, type IconThemeVariant } from '../../icons'

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
  /** Theme for icon selection ('light', 'dark', or 'default') */
  theme?: IconThemeVariant
}

const DEFAULT_OPTIONS: Required<SVGRendererOptions> = {
  backgroundColor: '#ffffff',
  defaultNodeFill: '#e2e8f0',
  defaultNodeStroke: '#64748b',
  defaultLinkStroke: '#94a3b8',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  interactive: true,
  theme: 'default',
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
  .node-icon { color: #475569; }
  .subgraph-icon { opacity: 0.9; }
  .subgraph-label { font-family: ${this.options.fontFamily}; font-size: 14px; font-weight: 600; fill: #374151; }
  .link-label { font-family: ${this.options.fontFamily}; font-size: 11px; fill: #64748b; }
  .endpoint-label { font-family: ${this.options.fontFamily}; font-size: 9px; fill: #94a3b8; }
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

    // Check if subgraph has vendor icon (service for cloud, model for hardware)
    const iconKey = subgraph.service || subgraph.model
    const hasIcon = subgraph.vendor && iconKey
    const iconSize = 24
    const iconPadding = 8

    // Calculate icon position (top-left corner)
    const iconX = bounds.x + iconPadding
    const iconY = bounds.y + iconPadding

    // Label position - shift right if there's an icon
    let labelX = hasIcon ? bounds.x + iconSize + iconPadding * 2 : bounds.x + 10
    let labelY = bounds.y + 20
    const textAnchor = 'start'

    if (labelPos === 'top') {
      labelX = hasIcon ? bounds.x + iconSize + iconPadding * 2 : bounds.x + 10
      labelY = bounds.y + 20
    }

    // Render vendor icon if available
    let iconSvg = ''
    if (hasIcon) {
      const iconContent = getVendorIcon(
        subgraph.vendor!,
        iconKey!,
        subgraph.resource,
        this.options.theme
      )
      if (iconContent) {
        // Check if icon is a nested SVG (PNG-based with custom viewBox)
        if (iconContent.startsWith('<svg')) {
          const viewBoxMatch = iconContent.match(/viewBox="0 0 (\d+) (\d+)"/)
          if (viewBoxMatch) {
            const vbWidth = parseInt(viewBoxMatch[1])
            const vbHeight = parseInt(viewBoxMatch[2])
            const aspectRatio = vbWidth / vbHeight
            const iconWidth = Math.round(iconSize * aspectRatio)
            iconSvg = `<g class="subgraph-icon" transform="translate(${iconX}, ${iconY})">
    <svg width="${iconWidth}" height="${iconSize}" viewBox="0 0 ${vbWidth} ${vbHeight}">
      ${iconContent.replace(/<svg[^>]*>/, '').replace(/<\/svg>$/, '')}
    </svg>
  </g>`
          }
        } else {
          iconSvg = `<g class="subgraph-icon" transform="translate(${iconX}, ${iconY})">
    <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 48 48">
      ${iconContent}
    </svg>
  </g>`
        }
      }
    }

    return `<g class="subgraph" data-id="${sg.id}">
  <rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}"
    rx="${rx}" ry="${rx}"
    fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"
    ${strokeDasharray ? `stroke-dasharray="${strokeDasharray}"` : ''} />
  ${iconSvg}
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
    const icon = this.renderNodeIcon(node, x, y, h)
    const label = this.renderNodeLabel(node, x, y, h, !!icon)

    return `<g class="node" data-id="${id}" transform="translate(0,0)">
  ${shape}
  ${icon}
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

  private renderNodeIcon(node: Node, x: number, y: number, h: number): string {
    const iconSize = 40
    const iconY = y - h / 2 + 12 // Position near top of node

    // Try vendor-specific icon first (service for cloud, model for hardware)
    const iconKey = node.service || node.model
    if (node.vendor && iconKey) {
      const vendorIcon = getVendorIcon(
        node.vendor,
        iconKey,
        node.resource,
        this.options.theme
      )
      if (vendorIcon) {
        // Check if icon is a nested SVG (PNG-based with custom viewBox)
        if (vendorIcon.startsWith('<svg')) {
          // Extract viewBox to calculate aspect ratio
          const viewBoxMatch = vendorIcon.match(/viewBox="0 0 (\d+) (\d+)"/)
          if (viewBoxMatch) {
            const vbWidth = parseInt(viewBoxMatch[1])
            const vbHeight = parseInt(viewBoxMatch[2])
            const aspectRatio = vbWidth / vbHeight
            const iconWidth = Math.round(iconSize * aspectRatio)
            return `<g class="node-icon" transform="translate(${x - iconWidth / 2}, ${iconY})">
      <svg width="${iconWidth}" height="${iconSize}" viewBox="0 0 ${vbWidth} ${vbHeight}">
        ${vendorIcon.replace(/<svg[^>]*>/, '').replace(/<\/svg>$/, '')}
      </svg>
    </g>`
          }
        }
        // AWS icons use 48x48 viewBox
        return `<g class="node-icon" transform="translate(${x - iconSize / 2}, ${iconY})">
      <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 48 48">
        ${vendorIcon}
      </svg>
    </g>`
      }
    }

    // Fall back to device type icon
    const iconPath = getDeviceIcon(node.type)
    if (!iconPath) return ''

    // Default icons use 24x24 viewBox
    return `<g class="node-icon" transform="translate(${x - iconSize / 2}, ${iconY})">
      <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="currentColor">
        ${iconPath}
      </svg>
    </g>`
  }

  private renderNodeLabel(node: Node, x: number, y: number, _h: number, hasIcon: boolean): string {
    const labels = Array.isArray(node.label) ? node.label : [node.label]
    const lineHeight = 16
    const totalHeight = labels.length * lineHeight

    // Shift labels down if there's an icon
    const iconOffset = hasIcon ? 28 : 0
    const startY = y - totalHeight / 2 + lineHeight / 2 + 4 + iconOffset

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
    const { id, points, link, fromEndpoint, toEndpoint } = layoutLink
    const label = link.label

    // Auto-apply styles based on redundancy type
    const type = link.type || this.getDefaultLinkType(link.redundancy)
    const arrow = link.arrow ?? this.getDefaultArrowType(link.redundancy)

    const stroke = link.style?.stroke || this.getRedundancyStroke(link.redundancy) || this.options.defaultLinkStroke
    const strokeWidth = link.style?.strokeWidth || this.getBandwidthStrokeWidth(link.bandwidth) || this.getLinkStrokeWidth(type)
    const dasharray = link.style?.strokeDasharray || this.getLinkDasharray(type)
    const markerEnd = arrow !== 'none' ? 'url(#arrow)' : ''

    // Generate path - use bezier curve for smooth lines
    let path: string

    if (points.length === 4) {
      // Cubic bezier curve (start, control1, control2, end)
      path = `M ${points[0].x} ${points[0].y} C ${points[1].x} ${points[1].y}, ${points[2].x} ${points[2].y}, ${points[3].x} ${points[3].y}`
    } else if (points.length === 2) {
      // Straight line
      path = `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
    } else {
      // Polyline (fallback)
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

    // Center label
    if (label) {
      const labelText = Array.isArray(label) ? label.join(' / ') : label
      const midPoint = this.getMidPoint(points)
      result += `\n<text x="${midPoint.x}" y="${midPoint.y - 8}" class="link-label" text-anchor="middle">${this.escapeXml(labelText)}</text>`
    }

    // Endpoint labels (port/ip at both ends) - positioned along the line
    const fromLabels = this.formatEndpointLabels(fromEndpoint)
    const toLabels = this.formatEndpointLabels(toEndpoint)

    if (fromLabels.length > 0 && points.length > 1) {
      const labelPos = this.getEndpointLabelPosition(points, 'start')
      result += this.renderEndpointLabels(fromLabels, labelPos.x, labelPos.y, labelPos.anchor)
    }

    if (toLabels.length > 0 && points.length > 1) {
      const labelPos = this.getEndpointLabelPosition(points, 'end')
      result += this.renderEndpointLabels(toLabels, labelPos.x, labelPos.y, labelPos.anchor)
    }

    return `<g class="link-group">\n${result}\n</g>`
  }

  private formatEndpointLabels(endpoint: { node: string; port?: string; ip?: string; vlan_id?: number }): string[] {
    const parts: string[] = []
    if (endpoint.port) parts.push(endpoint.port)
    if (endpoint.ip) parts.push(endpoint.ip)
    if (endpoint.vlan_id !== undefined) parts.push(`VLAN${endpoint.vlan_id}`)
    return parts
  }

  /**
   * Calculate position for endpoint label along the line
   */
  private getEndpointLabelPosition(
    points: { x: number; y: number }[],
    which: 'start' | 'end'
  ): { x: number; y: number; anchor: string } {
    // Position label at ~25% or ~75% along the line to avoid node overlap
    const t = which === 'start' ? 0.15 : 0.85

    if (points.length === 4) {
      // Bezier curve - calculate position at t
      const mt = 1 - t
      const x = mt * mt * mt * points[0].x +
        3 * mt * mt * t * points[1].x +
        3 * mt * t * t * points[2].x +
        t * t * t * points[3].x
      const y = mt * mt * mt * points[0].y +
        3 * mt * mt * t * points[1].y +
        3 * mt * t * t * points[2].y +
        t * t * t * points[3].y

      // Get tangent direction for text anchor
      const dx = 3 * mt * mt * (points[1].x - points[0].x) +
        6 * mt * t * (points[2].x - points[1].x) +
        3 * t * t * (points[3].x - points[2].x)

      return { x, y: y - 6, anchor: dx > 0 ? 'start' : 'end' }
    }

    // Straight line
    const x = points[0].x + (points[1].x - points[0].x) * t
    const y = points[0].y + (points[1].y - points[0].y) * t
    const dx = points[1].x - points[0].x

    return { x, y: y - 6, anchor: dx > 0 ? 'start' : 'end' }
  }

  /**
   * Render endpoint labels stacked vertically with background
   */
  private renderEndpointLabels(lines: string[], x: number, y: number, anchor: string): string {
    if (lines.length === 0) return ''

    const lineHeight = 12
    const padding = 3
    const charWidth = 5.5 // Approximate character width for 9px font

    // Calculate max width
    const maxLen = Math.max(...lines.map(l => l.length))
    const rectWidth = maxLen * charWidth + padding * 2
    const rectHeight = lines.length * lineHeight + padding * 2

    // Adjust rect position based on text anchor
    let rectX = x - padding
    if (anchor === 'middle') {
      rectX = x - rectWidth / 2
    } else if (anchor === 'end') {
      rectX = x - rectWidth + padding
    }

    const rectY = y - lineHeight + 2

    let result = `\n<rect x="${rectX}" y="${rectY}" width="${rectWidth}" height="${rectHeight}" rx="2" ry="2" fill="white" fill-opacity="0.85" />`

    lines.forEach((line, i) => {
      const textY = y + i * lineHeight
      result += `\n<text x="${x}" y="${textY}" class="endpoint-label" text-anchor="${anchor}">${this.escapeXml(line)}</text>`
    })

    return result
  }

  private getLinkStrokeWidth(type: LinkType): number {
    switch (type) {
      case 'thick': return 3
      case 'double': return 2
      default: return 1.5
    }
  }

  /**
   * Get stroke width based on bandwidth
   */
  private getBandwidthStrokeWidth(bandwidth?: string): number | undefined {
    if (!bandwidth) return undefined
    switch (bandwidth) {
      case '1G': return 1
      case '10G': return 2
      case '25G': return 3
      case '40G': return 4
      case '100G': return 5
      default: return undefined
    }
  }

  /**
   * Get default link type based on redundancy
   */
  private getDefaultLinkType(redundancy?: string): LinkType {
    switch (redundancy) {
      case 'ha':
      case 'vc':
      case 'vss':
      case 'vpc':
      case 'mlag':
        return 'double'
      case 'stack':
        return 'thick'
      default:
        return 'solid'
    }
  }

  /**
   * Get default arrow type based on redundancy
   */
  private getDefaultArrowType(_redundancy?: string): 'none' | 'forward' | 'back' | 'both' {
    // Network diagrams typically show bidirectional connections, so no arrow by default
    return 'none'
  }

  /**
   * Get stroke color based on redundancy type
   */
  private getRedundancyStroke(redundancy?: string): string | undefined {
    switch (redundancy) {
      case 'ha':
        return '#dc2626' // Red for HA
      case 'vc':
      case 'vss':
        return '#7c3aed' // Purple for VC/VSS
      case 'vpc':
      case 'mlag':
        return '#2563eb' // Blue for vPC/MLAG
      case 'stack':
        return '#059669' // Green for stacking
      default:
        return undefined
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
      // Cubic bezier curve midpoint at t=0.5
      const t = 0.5
      const mt = 1 - t
      const x = mt * mt * mt * points[0].x +
        3 * mt * mt * t * points[1].x +
        3 * mt * t * t * points[2].x +
        t * t * t * points[3].x
      const y = mt * mt * mt * points[0].y +
        3 * mt * mt * t * points[1].y +
        3 * mt * t * t * points[2].y +
        t * t * t * points[3].y
      return { x, y }
    }

    if (points.length === 2) {
      // Simple midpoint between two points
      return {
        x: (points[0].x + points[1].x) / 2,
        y: (points[0].y + points[1].y) / 2,
      }
    }

    // For polylines, find the middle segment and get its midpoint
    const midIndex = Math.floor(points.length / 2)
    if (midIndex > 0 && midIndex < points.length) {
      return {
        x: (points[midIndex - 1].x + points[midIndex].x) / 2,
        y: (points[midIndex - 1].y + points[midIndex].y) / 2,
      }
    }

    return points[midIndex] || points[0]
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
