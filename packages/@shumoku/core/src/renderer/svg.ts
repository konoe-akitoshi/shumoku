/**
 * SVG Renderer
 * Renders NetworkGraph to SVG
 */

import type {
  NetworkGraph,
  LayoutResult,
  LayoutNode,
  LayoutLink,
  LayoutSubgraph,
  LayoutPort,
  Node,
  NodeShape,
  LinkType,
  ThemeType,
} from '../models/index.js'
import { getDeviceIcon, getVendorIconEntry, type IconThemeVariant } from '../icons/index.js'

// ============================================
// Theme Colors
// ============================================

interface ThemeColors {
  backgroundColor: string
  defaultNodeFill: string
  defaultNodeStroke: string
  defaultLinkStroke: string
  labelColor: string
  labelSecondaryColor: string
  subgraphFill: string
  subgraphStroke: string
  subgraphLabelColor: string
  portFill: string
  portStroke: string
  portLabelBg: string
  portLabelColor: string
  endpointLabelBg: string
  endpointLabelStroke: string
}

const LIGHT_THEME: ThemeColors = {
  backgroundColor: '#ffffff',
  defaultNodeFill: '#e2e8f0',
  defaultNodeStroke: '#64748b',
  defaultLinkStroke: '#94a3b8',
  labelColor: '#1e293b',
  labelSecondaryColor: '#64748b',
  subgraphFill: '#f8fafc',
  subgraphStroke: '#cbd5e1',
  subgraphLabelColor: '#374151',
  portFill: '#475569',
  portStroke: '#1e293b',
  portLabelBg: '#1e293b',
  portLabelColor: '#ffffff',
  endpointLabelBg: '#ffffff',
  endpointLabelStroke: '#cbd5e1',
}

const DARK_THEME: ThemeColors = {
  backgroundColor: '#1e293b',
  defaultNodeFill: '#334155',
  defaultNodeStroke: '#64748b',
  defaultLinkStroke: '#64748b',
  labelColor: '#f1f5f9',
  labelSecondaryColor: '#94a3b8',
  subgraphFill: '#0f172a',
  subgraphStroke: '#475569',
  subgraphLabelColor: '#e2e8f0',
  portFill: '#64748b',
  portStroke: '#94a3b8',
  portLabelBg: '#0f172a',
  portLabelColor: '#f1f5f9',
  endpointLabelBg: '#1e293b',
  endpointLabelStroke: '#475569',
}

// ============================================
// Renderer Options
// ============================================

export interface SVGRendererOptions {
  /** Font family */
  fontFamily?: string
  /** Include interactive elements */
  interactive?: boolean
}

const DEFAULT_OPTIONS: Required<SVGRendererOptions> = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  interactive: true,
}

// ============================================
// SVG Renderer
// ============================================

export class SVGRenderer {
  private options: Required<SVGRendererOptions>
  private themeColors: ThemeColors = LIGHT_THEME
  private iconTheme: IconThemeVariant = 'default'

  constructor(options?: SVGRendererOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * Get theme colors based on theme type
   */
  private getThemeColors(theme?: ThemeType): ThemeColors {
    return theme === 'dark' ? DARK_THEME : LIGHT_THEME
  }

  /**
   * Get icon theme variant based on theme type
   */
  private getIconTheme(theme?: ThemeType): IconThemeVariant {
    return theme === 'dark' ? 'dark' : 'light'
  }

  render(graph: NetworkGraph, layout: LayoutResult): string {
    const { bounds } = layout

    // Set theme colors based on graph settings
    const theme = graph.settings?.theme
    this.themeColors = this.getThemeColors(theme)
    this.iconTheme = this.getIconTheme(theme)

    const parts: string[] = []

    // SVG header using content bounds
    const viewBox = `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`
    parts.push(this.renderHeader(bounds.width, bounds.height, viewBox))

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
      parts.push(this.renderLink(link, layout.nodes))
    })

    // Nodes
    layout.nodes.forEach((node) => {
      parts.push(this.renderNode(node))
    })

    // Close SVG
    parts.push('</svg>')

    return parts.join('\n')
  }

  private renderHeader(width: number, height: number, viewBox: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg"
  viewBox="${viewBox}"
  width="${width}"
  height="${height}"
  style="background: ${this.themeColors.backgroundColor}">`
  }

  private renderDefs(): string {
    return `<defs>
  <!-- Arrow marker -->
  <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
    <polygon points="0 0, 10 3.5, 0 7" fill="${this.themeColors.defaultLinkStroke}" />
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
  .node-label { font-family: ${this.options.fontFamily}; font-size: 12px; fill: ${this.themeColors.labelColor}; }
  .node-label-bold { font-weight: bold; }
  .node-icon { color: ${this.themeColors.labelSecondaryColor}; }
  .subgraph-icon { opacity: 0.9; }
  .subgraph-label { font-family: ${this.options.fontFamily}; font-size: 14px; font-weight: 600; fill: ${this.themeColors.subgraphLabelColor}; }
  .link-label { font-family: ${this.options.fontFamily}; font-size: 11px; fill: ${this.themeColors.labelSecondaryColor}; }
  .endpoint-label { font-family: ${this.options.fontFamily}; font-size: 9px; fill: ${this.themeColors.labelColor}; }
</style>`
  }

  private renderSubgraph(sg: LayoutSubgraph): string {
    const { bounds, subgraph } = sg
    const style = subgraph.style || {}

    const fill = style.fill || this.themeColors.subgraphFill
    const stroke = style.stroke || this.themeColors.subgraphStroke
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
      const iconEntry = getVendorIconEntry(subgraph.vendor!, iconKey!, subgraph.resource)
      if (iconEntry) {
        const iconContent = iconEntry[this.iconTheme] || iconEntry.default
        const viewBox = iconEntry.viewBox || '0 0 48 48'

        // Check if icon is a nested SVG (PNG-based with custom viewBox in content)
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
          // Use viewBox from entry
          iconSvg = `<g class="subgraph-icon" transform="translate(${iconX}, ${iconY})">
    <svg width="${iconSize}" height="${iconSize}" viewBox="${viewBox}">
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
    const { id, position, size, node, ports } = layoutNode
    const x = position.x
    const y = position.y
    const w = size.width
    const h = size.height

    const style = node.style || {}
    const fill = style.fill || this.themeColors.defaultNodeFill
    const stroke = style.stroke || this.themeColors.defaultNodeStroke
    const strokeWidth = style.strokeWidth || 1
    const strokeDasharray = style.strokeDasharray || ''

    const shape = this.renderNodeShape(node.shape, x, y, w, h, fill, stroke, strokeWidth, strokeDasharray)
    const icon = this.renderNodeIcon(node, x, y, h)
    const label = this.renderNodeLabel(node, x, y, h, !!icon)
    const portsRendered = this.renderPorts(x, y, ports)

    return `<g class="node" data-id="${id}" transform="translate(0,0)">
  ${shape}
  ${icon}
  ${label}
  ${portsRendered}
</g>`
  }

  /**
   * Render ports on a node
   */
  private renderPorts(
    nodeX: number,
    nodeY: number,
    ports?: Map<string, LayoutPort>
  ): string {
    if (!ports || ports.size === 0) return ''

    const parts: string[] = []

    ports.forEach((port) => {
      const px = nodeX + port.position.x
      const py = nodeY + port.position.y
      const pw = port.size.width
      const ph = port.size.height

      // Port box
      parts.push(`<rect class="port" data-port="${port.id}"
        x="${px - pw / 2}" y="${py - ph / 2}" width="${pw}" height="${ph}"
        fill="${this.themeColors.portFill}" stroke="${this.themeColors.portStroke}" stroke-width="1" rx="2" />`)

      // Port label - position based on side
      let labelX = px
      let labelY = py
      let textAnchor = 'middle'
      const labelOffset = 12

      switch (port.side) {
        case 'top':
          labelY = py - labelOffset
          break
        case 'bottom':
          labelY = py + labelOffset + 4
          break
        case 'left':
          labelX = px - labelOffset
          textAnchor = 'end'
          break
        case 'right':
          labelX = px + labelOffset
          textAnchor = 'start'
          break
      }

      // Port label with black background
      const labelText = this.escapeXml(port.label)
      const charWidth = 5.5
      const labelWidth = labelText.length * charWidth + 4
      const labelHeight = 12

      // Calculate background rect position based on text anchor
      let bgX = labelX - 2
      if (textAnchor === 'middle') {
        bgX = labelX - labelWidth / 2
      } else if (textAnchor === 'end') {
        bgX = labelX - labelWidth + 2
      }
      const bgY = labelY - labelHeight + 3

      parts.push(`<rect class="port-label-bg" x="${bgX}" y="${bgY}" width="${labelWidth}" height="${labelHeight}" rx="2" fill="${this.themeColors.portLabelBg}" />`)
      parts.push(`<text class="port-label" x="${labelX}" y="${labelY}" text-anchor="${textAnchor}" font-size="9" fill="${this.themeColors.portLabelColor}">${labelText}</text>`)
    })

    return parts.join('\n  ')
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
      const iconEntry = getVendorIconEntry(node.vendor, iconKey, node.resource)
      if (iconEntry) {
        const vendorIcon = iconEntry[this.iconTheme] || iconEntry.default
        // Get viewBox from entry, or use defaults
        const viewBox = iconEntry.viewBox || '0 0 48 48'

        // Check if icon is a nested SVG (PNG-based with custom viewBox in content)
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

        // Parse viewBox for aspect ratio calculation
        const vbMatch = viewBox.match(/(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/)
        if (vbMatch) {
          const vbWidth = parseInt(vbMatch[3])
          const vbHeight = parseInt(vbMatch[4])
          const aspectRatio = vbWidth / vbHeight
          // Keep square for 1:1 aspect ratio icons
          const iconWidth = Math.abs(aspectRatio - 1) < 0.01 ? iconSize : Math.round(iconSize * aspectRatio)
          return `<g class="node-icon" transform="translate(${x - iconWidth / 2}, ${iconY})">
      <svg width="${iconWidth}" height="${iconSize}" viewBox="${viewBox}">
        ${vendorIcon}
      </svg>
    </g>`
        }

        // Fallback: use viewBox directly
        return `<g class="node-icon" transform="translate(${x - iconSize / 2}, ${iconY})">
      <svg width="${iconSize}" height="${iconSize}" viewBox="${viewBox}">
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

  private renderLink(layoutLink: LayoutLink, nodes: Map<string, LayoutNode>): string {
    const { id, points, link, fromEndpoint, toEndpoint } = layoutLink
    const label = link.label

    // Auto-apply styles based on redundancy type
    const type = link.type || this.getDefaultLinkType(link.redundancy)
    const arrow = link.arrow ?? this.getDefaultArrowType(link.redundancy)

    const stroke = link.style?.stroke || this.getVlanStroke(link.vlan) || this.themeColors.defaultLinkStroke
    const dasharray = link.style?.strokeDasharray || this.getLinkDasharray(type)
    const markerEnd = arrow !== 'none' ? 'url(#arrow)' : ''

    // Get bandwidth rendering config
    const bandwidthConfig = this.getBandwidthConfig(link.bandwidth)
    const strokeWidth = link.style?.strokeWidth || bandwidthConfig.strokeWidth || this.getLinkStrokeWidth(type)

    // Render link lines based on bandwidth (single or multiple parallel lines)
    let result = this.renderBandwidthLines(
      id, points, stroke, strokeWidth, dasharray, markerEnd, bandwidthConfig, type
    )

    // Center label and VLANs
    const midPoint = this.getMidPoint(points)
    let labelYOffset = -8

    if (label) {
      const labelText = Array.isArray(label) ? label.join(' / ') : label
      result += `\n<text x="${midPoint.x}" y="${midPoint.y + labelYOffset}" class="link-label" text-anchor="middle">${this.escapeXml(labelText)}</text>`
      labelYOffset += 12
    }

    // VLANs (link-level, applies to both endpoints)
    if (link.vlan && link.vlan.length > 0) {
      const vlanText = link.vlan.length === 1
        ? `VLAN ${link.vlan[0]}`
        : `VLAN ${link.vlan.join(', ')}`
      result += `\n<text x="${midPoint.x}" y="${midPoint.y + labelYOffset}" class="link-label" text-anchor="middle">${this.escapeXml(vlanText)}</text>`
    }

    // Get node center positions for label placement
    const fromNode = nodes.get(fromEndpoint.node)
    const toNode = nodes.get(toEndpoint.node)
    const fromNodeCenterX = fromNode ? fromNode.position.x : points[0].x
    const toNodeCenterX = toNode ? toNode.position.x : points[points.length - 1].x

    // Endpoint labels (port/ip at both ends) - positioned along the line
    const fromLabels = this.formatEndpointLabels(fromEndpoint)
    const toLabels = this.formatEndpointLabels(toEndpoint)

    if (fromLabels.length > 0 && points.length > 1) {
      const portName = fromEndpoint.port || ''
      const labelPos = this.getEndpointLabelPosition(points, 'start', fromNodeCenterX, portName)
      result += this.renderEndpointLabels(fromLabels, labelPos.x, labelPos.y, labelPos.anchor)
    }

    if (toLabels.length > 0 && points.length > 1) {
      const portName = toEndpoint.port || ''
      const labelPos = this.getEndpointLabelPosition(points, 'end', toNodeCenterX, portName)
      result += this.renderEndpointLabels(toLabels, labelPos.x, labelPos.y, labelPos.anchor)
    }

    return `<g class="link-group">\n${result}\n</g>`
  }

  private formatEndpointLabels(endpoint: { node: string; port?: string; ip?: string }): string[] {
    const parts: string[] = []
    // Port is now rendered on the node itself, so don't include it here
    if (endpoint.ip) parts.push(endpoint.ip)
    return parts
  }

  /**
   * Calculate position for endpoint label near the port (not along the line)
   * This avoids label clustering at the center of links
   * Labels are placed based on port position relative to node center
   */
  private getEndpointLabelPosition(
    points: { x: number; y: number }[],
    which: 'start' | 'end',
    nodeCenterX: number,
    portName: string
  ): { x: number; y: number; anchor: string } {
    // Get the endpoint position (port position)
    const endpointIdx = which === 'start' ? 0 : points.length - 1
    const endpoint = points[endpointIdx]

    // Get the next/prev point to determine line direction
    const nextIdx = which === 'start' ? 1 : points.length - 2
    const nextPoint = points[nextIdx]

    // Calculate direction from endpoint toward the line
    const dx = nextPoint.x - endpoint.x
    const dy = nextPoint.y - endpoint.y
    const len = Math.sqrt(dx * dx + dy * dy)

    // Normalize direction
    const nx = len > 0 ? dx / len : 0
    const ny = len > 0 ? dy / len : 1

    // Perpendicular direction (90 degrees rotated)
    const perpX = -ny
    const perpY = nx

    const isVertical = Math.abs(dy) > Math.abs(dx)

    // Hash port name as fallback
    const portHash = this.hashString(portName)
    const hashDirection = portHash % 2 === 0 ? 1 : -1

    // Port position relative to node center determines label side
    const portOffsetFromCenter = endpoint.x - nodeCenterX

    let sideMultiplier: number

    if (isVertical) {
      if (Math.abs(portOffsetFromCenter) > 5) {
        // Port is on one side of node - place label outward
        sideMultiplier = portOffsetFromCenter > 0 ? 1 : -1
      } else {
        // Center port - use small hash-based offset to avoid overlap
        sideMultiplier = hashDirection * 0.2
      }
    } else {
      // Horizontal link: place label above/below based on which end
      const isStart = which === 'start'
      sideMultiplier = isStart ? -1 : 1
    }

    const offsetDist = 30  // Distance along line direction
    const perpDist = 20    // Perpendicular offset (fixed)

    // Position: offset along line direction + fixed horizontal offset for vertical links
    let x: number
    let y: number

    if (isVertical) {
      // For vertical links, use fixed horizontal offset (simpler and consistent)
      x = endpoint.x + perpDist * sideMultiplier
      y = endpoint.y + ny * offsetDist
    } else {
      // For horizontal links, use perpendicular calculation
      x = endpoint.x + nx * offsetDist + perpX * perpDist * sideMultiplier
      y = endpoint.y + ny * offsetDist + perpY * perpDist * sideMultiplier
    }

    // Text anchor based on final position relative to endpoint
    let anchor = 'middle'
    const labelDx = x - endpoint.x
    if (Math.abs(labelDx) > 8) {
      anchor = labelDx > 0 ? 'start' : 'end'
    }

    return { x, y, anchor }
  }

  /**
   * Render endpoint labels (IP) with white background
   */
  private renderEndpointLabels(lines: string[], x: number, y: number, anchor: string): string {
    if (lines.length === 0) return ''

    const lineHeight = 11
    const paddingX = 2
    const paddingY = 2
    const charWidth = 4.8 // Approximate character width for 9px font

    // Calculate dimensions
    const maxLen = Math.max(...lines.map(l => l.length))
    const rectWidth = maxLen * charWidth + paddingX * 2
    const rectHeight = lines.length * lineHeight + paddingY * 2

    // Adjust rect position based on text anchor
    let rectX = x - paddingX
    if (anchor === 'middle') {
      rectX = x - rectWidth / 2
    } else if (anchor === 'end') {
      rectX = x - rectWidth + paddingX
    }

    const rectY = y - lineHeight + paddingY

    let result = `\n<rect x="${rectX}" y="${rectY}" width="${rectWidth}" height="${rectHeight}" rx="2" fill="${this.themeColors.endpointLabelBg}" stroke="${this.themeColors.endpointLabelStroke}" stroke-width="0.5" />`

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
   * Bandwidth rendering configuration - line count represents speed
   * 1G   → 1 line
   * 10G  → 2 lines
   * 25G  → 3 lines
   * 40G  → 4 lines
   * 100G → 5 lines
   */
  private getBandwidthConfig(bandwidth?: string): { lineCount: number; strokeWidth: number } {
    const strokeWidth = 1.5
    switch (bandwidth) {
      case '1G':
        return { lineCount: 1, strokeWidth }
      case '10G':
        return { lineCount: 2, strokeWidth }
      case '25G':
        return { lineCount: 3, strokeWidth }
      case '40G':
        return { lineCount: 4, strokeWidth }
      case '100G':
        return { lineCount: 5, strokeWidth }
      default:
        return { lineCount: 1, strokeWidth }
    }
  }

  /**
   * Render bandwidth lines (single or multiple parallel lines)
   */
  private renderBandwidthLines(
    id: string,
    points: { x: number; y: number }[],
    stroke: string,
    strokeWidth: number,
    dasharray: string,
    markerEnd: string,
    config: { lineCount: number; strokeWidth: number },
    type: LinkType
  ): string {
    const { lineCount } = config
    const lineSpacing = 3 // Space between parallel lines

    if (lineCount === 1) {
      // Single line
      const path = this.generatePath(points)
      let result = `<path class="link" data-id="${id}" d="${path}"
  fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"
  ${dasharray ? `stroke-dasharray="${dasharray}"` : ''}
  ${markerEnd ? `marker-end="${markerEnd}"` : ''} />`

      // Double line effect for redundancy types
      if (type === 'double') {
        result = `<path class="link-double-outer" d="${path}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth + 2}" />
<path class="link-double-inner" d="${path}" fill="none" stroke="white" stroke-width="${strokeWidth - 1}" />
${result}`
      }
      return result
    }

    // Multiple parallel lines
    const paths: string[] = []
    const offsets = this.calculateLineOffsets(lineCount, lineSpacing)

    for (const offset of offsets) {
      const offsetPoints = this.offsetPoints(points, offset)
      const path = this.generatePath(offsetPoints)
      paths.push(`<path class="link" data-id="${id}" d="${path}"
  fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"
  ${dasharray ? `stroke-dasharray="${dasharray}"` : ''} />`)
    }

    return paths.join('\n')
  }

  /**
   * Generate SVG path string from points
   */
  private generatePath(points: { x: number; y: number }[]): string {
    if (points.length === 4) {
      // Cubic bezier curve
      return `M ${points[0].x} ${points[0].y} C ${points[1].x} ${points[1].y}, ${points[2].x} ${points[2].y}, ${points[3].x} ${points[3].y}`
    } else if (points.length === 2) {
      // Straight line
      return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
    } else {
      // Polyline
      return `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
    }
  }

  /**
   * Calculate offsets for parallel lines (centered around 0)
   */
  private calculateLineOffsets(lineCount: number, spacing: number): number[] {
    const offsets: number[] = []
    const totalWidth = (lineCount - 1) * spacing
    const startOffset = -totalWidth / 2

    for (let i = 0; i < lineCount; i++) {
      offsets.push(startOffset + i * spacing)
    }
    return offsets
  }

  /**
   * Offset points perpendicular to the line direction
   */
  private offsetPoints(points: { x: number; y: number }[], offset: number): { x: number; y: number }[] {
    if (points.length < 2) return points

    // Calculate perpendicular direction from first to last point
    const dx = points[points.length - 1].x - points[0].x
    const dy = points[points.length - 1].y - points[0].y
    const len = Math.sqrt(dx * dx + dy * dy)

    if (len === 0) return points

    // Perpendicular unit vector
    const perpX = -dy / len
    const perpY = dx / len

    // Offset all points
    return points.map(p => ({
      x: p.x + perpX * offset,
      y: p.y + perpY * offset,
    }))
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
   * VLAN color palette - distinct colors for different VLANs
   */
  private static readonly VLAN_COLORS = [
    '#dc2626', // Red
    '#ea580c', // Orange
    '#ca8a04', // Yellow
    '#16a34a', // Green
    '#0891b2', // Cyan
    '#2563eb', // Blue
    '#7c3aed', // Violet
    '#c026d3', // Magenta
    '#db2777', // Pink
    '#059669', // Emerald
    '#0284c7', // Light Blue
    '#4f46e5', // Indigo
  ]

  /**
   * Get stroke color based on VLANs
   */
  private getVlanStroke(vlan?: number[]): string | undefined {
    if (!vlan || vlan.length === 0) {
      return undefined
    }

    if (vlan.length === 1) {
      // Single VLAN: use color based on VLAN ID
      const colorIndex = vlan[0] % SVGRenderer.VLAN_COLORS.length
      return SVGRenderer.VLAN_COLORS[colorIndex]
    }

    // Multiple VLANs (trunk): use a combined hash color
    const hash = vlan.reduce((acc, v) => acc + v, 0)
    const colorIndex = hash % SVGRenderer.VLAN_COLORS.length
    return SVGRenderer.VLAN_COLORS[colorIndex]
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

  /**
   * Simple string hash for consistent but varied label placement
   */
  private hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }
}

// Default instance
export const svgRenderer = new SVGRenderer()
