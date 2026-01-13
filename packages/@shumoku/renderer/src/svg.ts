/**
 * SVG Renderer
 * Renders NetworkGraph to SVG
 */

import type {
  IconThemeVariant,
  LayoutLink,
  LayoutNode,
  LayoutPort,
  LayoutResult,
  LayoutSubgraph,
  LegendSettings,
  LinkBandwidth,
  LinkType,
  NetworkGraph,
  Node,
  NodeShape,
  ThemeType,
} from '@shumoku/core'
import {
  DEFAULT_ICON_SIZE,
  getDeviceIcon,
  getVendorIconEntry,
  ICON_LABEL_GAP,
  LABEL_LINE_HEIGHT,
  MAX_ICON_WIDTH_RATIO,
} from '@shumoku/core'

import type { DataAttributeOptions, RenderMode } from './types.js'

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
  /** Include interactive elements (deprecated, use renderMode) */
  interactive?: boolean
  /**
   * Render mode
   * - 'static': Pure SVG without interactive data attributes (default)
   * - 'interactive': SVG with data attributes for runtime interactivity
   */
  renderMode?: RenderMode
  /**
   * Data attributes to include in interactive mode
   * Only used when renderMode is 'interactive'
   */
  dataAttributes?: DataAttributeOptions
}

const DEFAULT_OPTIONS: Required<SVGRendererOptions> = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  interactive: true,
  renderMode: 'static',
  dataAttributes: { device: true, link: true, metadata: true },
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

  /** Check if interactive mode is enabled */
  private get isInteractive(): boolean {
    return this.options.renderMode === 'interactive'
  }

  /** Get data attribute options with defaults */
  private get dataAttrs(): Required<DataAttributeOptions> {
    return {
      device: this.options.dataAttributes?.device ?? true,
      link: this.options.dataAttributes?.link ?? true,
      metadata: this.options.dataAttributes?.metadata ?? true,
    }
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

    // Calculate legend dimensions if enabled
    const legendSettings = this.getLegendSettings(graph.settings?.legend)
    let legendWidth = 0
    let legendHeight = 0
    if (legendSettings.enabled) {
      const legendDims = this.calculateLegendDimensions(graph, legendSettings)
      legendWidth = legendDims.width
      legendHeight = legendDims.height
    }

    // Expand bounds to include legend with padding
    const legendPadding = 20
    const expandedBounds = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width + (legendSettings.enabled && legendWidth > 0 ? legendPadding : 0),
      height: bounds.height + (legendSettings.enabled && legendHeight > 0 ? legendPadding : 0),
    }

    const parts: string[] = []

    // SVG header using expanded bounds
    const viewBox = `${expandedBounds.x} ${expandedBounds.y} ${expandedBounds.width} ${expandedBounds.height}`
    parts.push(this.renderHeader(expandedBounds.width, expandedBounds.height, viewBox))

    // Defs (markers, gradients)
    parts.push(this.renderDefs())

    // Styles
    parts.push(this.renderStyles())

    // Layer 1: Subgraphs (background)
    for (const sg of layout.subgraphs.values()) {
      parts.push(this.renderSubgraph(sg))
    }

    // Layer 2: Links (below nodes)
    for (const link of layout.links.values()) {
      parts.push(this.renderLink(link, layout.nodes))
    }

    // Layer 3: Nodes (bg + fg as one unit, without ports)
    for (const node of layout.nodes.values()) {
      parts.push(this.renderNode(node))
    }

    // Layer 4: Ports (separate layer on top of nodes)
    for (const node of layout.nodes.values()) {
      const portsRendered = this.renderPorts(node.id, node.position.x, node.position.y, node.ports)
      if (portsRendered) {
        parts.push(portsRendered)
      }
    }

    // Legend (if enabled) - use already calculated legendSettings
    if (legendSettings.enabled && legendWidth > 0) {
      parts.push(this.renderLegend(graph, layout, legendSettings))
    }

    // Close SVG
    parts.push('</svg>')

    return parts.join('\n')
  }

  /**
   * Calculate legend dimensions without rendering
   */
  private calculateLegendDimensions(
    graph: NetworkGraph,
    settings: LegendSettings,
  ): { width: number; height: number } {
    const lineHeight = 20
    const padding = 12
    const iconWidth = 30
    const maxLabelWidth = 100

    // Count items
    let itemCount = 0

    if (settings.showBandwidth) {
      const usedBandwidths = new Set<LinkBandwidth>()
      for (const link of graph.links) {
        if (link.bandwidth) usedBandwidths.add(link.bandwidth)
      }
      itemCount += usedBandwidths.size
    }

    if (itemCount === 0) {
      return { width: 0, height: 0 }
    }

    const width = iconWidth + maxLabelWidth + padding * 2
    const height = itemCount * lineHeight + padding * 2 + 20 // +20 for title

    return { width, height }
  }

  /**
   * Parse legend settings from various input formats
   */
  private getLegendSettings(
    legend?: boolean | LegendSettings,
  ): LegendSettings & { enabled: boolean } {
    if (legend === true) {
      return {
        enabled: true,
        position: 'top-right',
        showDeviceTypes: true,
        showBandwidth: true,
        showCableTypes: true,
        showVlans: false,
      }
    }

    if (legend && typeof legend === 'object') {
      return {
        enabled: legend.enabled !== false,
        position: legend.position ?? 'top-right',
        showDeviceTypes: legend.showDeviceTypes ?? true,
        showBandwidth: legend.showBandwidth ?? true,
        showCableTypes: legend.showCableTypes ?? true,
        showVlans: legend.showVlans ?? false,
      }
    }

    return { enabled: false, position: 'top-right' }
  }

  /**
   * Render legend showing visual elements used in the diagram
   */
  private renderLegend(
    graph: NetworkGraph,
    layout: LayoutResult,
    settings: LegendSettings,
  ): string {
    const items: { icon: string; label: string }[] = []
    const lineHeight = 20
    const padding = 12
    const iconWidth = 30
    const maxLabelWidth = 100

    // Collect used bandwidths
    const usedBandwidths = new Set<LinkBandwidth>()
    for (const link of graph.links) {
      if (link.bandwidth) usedBandwidths.add(link.bandwidth)
    }

    // Collect used device types
    const usedDeviceTypes = new Set<string>()
    for (const node of graph.nodes) {
      if (node.type) usedDeviceTypes.add(node.type)
    }

    // Build legend items
    if (settings.showBandwidth && usedBandwidths.size > 0) {
      const sortedBandwidths: LinkBandwidth[] = ['1G', '10G', '25G', '40G', '100G'].filter((b) =>
        usedBandwidths.has(b as LinkBandwidth),
      ) as LinkBandwidth[]

      for (const bw of sortedBandwidths) {
        const config = this.getBandwidthConfig(bw)
        items.push({
          icon: this.renderBandwidthLegendIcon(config.lineCount),
          label: bw,
        })
      }
    }

    if (items.length === 0) return ''

    // Calculate legend dimensions
    const legendWidth = iconWidth + maxLabelWidth + padding * 2
    const legendHeight = items.length * lineHeight + padding * 2 + 20 // +20 for title

    // Position based on settings
    const { bounds } = layout
    let legendX = bounds.x + bounds.width - legendWidth - 10
    let legendY = bounds.y + bounds.height - legendHeight - 10

    switch (settings.position) {
      case 'top-left':
        legendX = bounds.x + 10
        legendY = bounds.y + 10
        break
      case 'top-right':
        legendX = bounds.x + bounds.width - legendWidth - 10
        legendY = bounds.y + 10
        break
      case 'bottom-left':
        legendX = bounds.x + 10
        legendY = bounds.y + bounds.height - legendHeight - 10
        break
    }

    // Render legend box
    let svg = `<g class="legend" transform="translate(${legendX}, ${legendY})">
  <rect x="0" y="0" width="${legendWidth}" height="${legendHeight}" rx="4"
    fill="${this.themeColors.backgroundColor}" stroke="${this.themeColors.subgraphStroke}" stroke-width="1" opacity="0.95" />
  <text x="${padding}" y="${padding + 12}" class="subgraph-label" font-size="11">Legend</text>`

    // Render items
    for (const [index, item] of items.entries()) {
      const y = padding + 28 + index * lineHeight
      svg += `\n  <g transform="translate(${padding}, ${y})">`
      svg += `\n    ${item.icon}`
      svg += `\n    <text x="${iconWidth + 4}" y="4" class="node-label" font-size="10">${this.escapeXml(item.label)}</text>`
      svg += '\n  </g>'
    }

    svg += '\n</g>'
    return svg
  }

  /**
   * Render bandwidth indicator for legend
   */
  private renderBandwidthLegendIcon(lineCount: number): string {
    const lineSpacing = 3
    const lineWidth = 24
    const strokeWidth = 2
    const offsets = this.calculateLineOffsets(lineCount, lineSpacing)

    const lines = offsets.map((offset) => {
      const y = offset
      return `<line x1="0" y1="${y}" x2="${lineWidth}" y2="${y}" stroke="${this.themeColors.defaultLinkStroke}" stroke-width="${strokeWidth}" />`
    })

    return `<g transform="translate(0, 0)">${lines.join('')}</g>`
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
    // CSS variables for interactive runtime theming
    const cssVars = this.isInteractive
      ? `
  :root {
    --shumoku-bg: ${this.themeColors.backgroundColor};
    --shumoku-surface: ${this.themeColors.subgraphFill};
    --shumoku-text: ${this.themeColors.labelColor};
    --shumoku-text-secondary: ${this.themeColors.labelSecondaryColor};
    --shumoku-border: ${this.themeColors.subgraphStroke};
    --shumoku-node-fill: ${this.themeColors.defaultNodeFill};
    --shumoku-node-stroke: ${this.themeColors.defaultNodeStroke};
    --shumoku-link-stroke: ${this.themeColors.defaultLinkStroke};
    --shumoku-font: ${this.options.fontFamily};
  }`
      : ''

    return `<style>${cssVars}
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
            const vbWidth = Number.parseInt(viewBoxMatch[1], 10)
            const vbHeight = Number.parseInt(viewBoxMatch[2], 10)
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

  /** Render node background (shape only) */
  /** Render complete node (bg + fg as one unit) */
  private renderNode(layoutNode: LayoutNode): string {
    const { id, node } = layoutNode
    const dataAttrs = this.buildNodeDataAttributes(node)
    const bg = this.renderNodeBackground(layoutNode)
    const fg = this.renderNodeForeground(layoutNode)

    return `<g class="node" data-id="${id}"${dataAttrs}>
${bg}
${fg}
</g>`
  }

  private renderNodeBackground(layoutNode: LayoutNode): string {
    const { id, position, size, node } = layoutNode
    const x = position.x
    const y = position.y
    const w = size.width
    const h = size.height

    const style = node.style || {}
    const fill = style.fill || this.themeColors.defaultNodeFill
    const stroke = style.stroke || this.themeColors.defaultNodeStroke
    const strokeWidth = style.strokeWidth || 1
    const strokeDasharray = style.strokeDasharray || ''

    const shape = this.renderNodeShape(
      node.shape,
      x,
      y,
      w,
      h,
      fill,
      stroke,
      strokeWidth,
      strokeDasharray,
    )

    // Build data attributes for interactive mode
    const dataAttrs = this.buildNodeDataAttributes(node)

    return `<g class="node-bg" data-id="${id}"${dataAttrs}>${shape}</g>`
  }

  /** Build data attributes for a node (interactive mode only) */
  private buildNodeDataAttributes(node: Node): string {
    if (!this.isInteractive || !this.dataAttrs.device) return ''

    const attrs: string[] = []

    if (node.type) attrs.push(`data-device-type="${this.escapeXml(node.type)}"`)
    if (node.vendor) attrs.push(`data-device-vendor="${this.escapeXml(node.vendor)}"`)
    if (node.model) attrs.push(`data-device-model="${this.escapeXml(node.model)}"`)
    if (node.service) attrs.push(`data-device-service="${this.escapeXml(node.service)}"`)
    if (node.resource) attrs.push(`data-device-resource="${this.escapeXml(node.resource)}"`)

    // Include full metadata as JSON
    if (this.dataAttrs.metadata) {
      const deviceInfo = {
        id: node.id,
        label: node.label,
        type: node.type,
        vendor: node.vendor,
        model: node.model,
        service: node.service,
        resource: node.resource,
        metadata: node.metadata,
      }
      attrs.push(`data-device-json="${this.escapeXml(JSON.stringify(deviceInfo))}"`)
    }

    return attrs.length > 0 ? ` ${attrs.join(' ')}` : ''
  }

  /** Render node foreground (content only, ports rendered separately) */
  private renderNodeForeground(layoutNode: LayoutNode): string {
    const { id, position, size, node } = layoutNode
    const x = position.x
    const y = position.y
    const w = size.width

    const content = this.renderNodeContent(node, x, y, w)

    // Include data attributes for interactive mode (same as node-bg)
    const dataAttrs = this.buildNodeDataAttributes(node)

    return `<g class="node-fg" data-id="${id}"${dataAttrs}>
  ${content}
</g>`
  }

  /**
   * Render ports on a node (as separate groups)
   */
  private renderPorts(
    nodeId: string,
    nodeX: number,
    nodeY: number,
    ports?: Map<string, LayoutPort>,
  ): string {
    if (!ports || ports.size === 0) return ''

    const groups: string[] = []

    for (const port of ports.values()) {
      const px = nodeX + port.position.x
      const py = nodeY + port.position.y
      const pw = port.size.width
      const ph = port.size.height

      // Port data attribute for interactive mode
      const portDeviceAttr = this.isInteractive ? ` data-port-device="${nodeId}"` : ''

      const parts: string[] = []

      // Port box
      parts.push(`<rect class="port-box"
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

      parts.push(
        `<rect class="port-label-bg" x="${bgX}" y="${bgY}" width="${labelWidth}" height="${labelHeight}" rx="2" fill="${this.themeColors.portLabelBg}" />`,
      )
      parts.push(
        `<text class="port-label" x="${labelX}" y="${labelY}" text-anchor="${textAnchor}" font-size="9" fill="${this.themeColors.portLabelColor}">${labelText}</text>`,
      )

      // Wrap in a group with data attributes
      groups.push(`<g class="port" data-port="${port.id}"${portDeviceAttr}>
  ${parts.join('\n  ')}
</g>`)
    }

    return groups.join('\n')
  }

  private renderNodeShape(
    shape: NodeShape,
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string,
    stroke: string,
    strokeWidth: number,
    strokeDasharray: string,
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

      case 'circle': {
        const r = Math.min(halfW, halfH)
        return `<circle cx="${x}" cy="${y}" r="${r}"
          fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashAttr} filter="url(#shadow)" />`
      }

      case 'diamond':
        return `<polygon points="${x},${y - halfH} ${x + halfW},${y} ${x},${y + halfH} ${x - halfW},${y}"
          fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashAttr} filter="url(#shadow)" />`

      case 'hexagon': {
        const hx = halfW * 0.866
        return `<polygon points="${x - halfW},${y} ${x - hx},${y - halfH} ${x + hx},${y - halfH} ${x + halfW},${y} ${x + hx},${y + halfH} ${x - hx},${y + halfH}"
          fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashAttr} filter="url(#shadow)" />`
      }

      case 'cylinder': {
        const ellipseH = h * 0.15
        return `<g>
          <ellipse cx="${x}" cy="${y + halfH - ellipseH}" rx="${halfW}" ry="${ellipseH}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashAttr} />
          <rect x="${x - halfW}" y="${y - halfH + ellipseH}" width="${w}" height="${h - ellipseH * 2}" fill="${fill}" stroke="none" />
          <line x1="${x - halfW}" y1="${y - halfH + ellipseH}" x2="${x - halfW}" y2="${y + halfH - ellipseH}" stroke="${stroke}" stroke-width="${strokeWidth}" />
          <line x1="${x + halfW}" y1="${y - halfH + ellipseH}" x2="${x + halfW}" y2="${y + halfH - ellipseH}" stroke="${stroke}" stroke-width="${strokeWidth}" />
          <ellipse cx="${x}" cy="${y - halfH + ellipseH}" rx="${halfW}" ry="${ellipseH}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashAttr} filter="url(#shadow)" />
        </g>`
      }

      case 'stadium':
        return `<rect x="${x - halfW}" y="${y - halfH}" width="${w}" height="${h}" rx="${halfH}" ry="${halfH}"
          fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashAttr} filter="url(#shadow)" />`

      case 'trapezoid': {
        const indent = w * 0.15
        return `<polygon points="${x - halfW + indent},${y - halfH} ${x + halfW - indent},${y - halfH} ${x + halfW},${y + halfH} ${x - halfW},${y + halfH}"
          fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashAttr} filter="url(#shadow)" />`
      }

      default:
        return `<rect x="${x - halfW}" y="${y - halfH}" width="${w}" height="${h}" rx="4" ry="4"
          fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashAttr} filter="url(#shadow)" />`
    }
  }

  /**
   * Calculate icon dimensions for a node
   */
  private calculateIconInfo(
    node: Node,
    w: number,
  ): { width: number; height: number; svg: string } | null {
    // Cap icon width at MAX_ICON_WIDTH_RATIO of node width to leave room for ports
    const maxIconWidth = Math.round(w * MAX_ICON_WIDTH_RATIO)

    // Try vendor-specific icon first (service for cloud, model for hardware)
    const iconKey = node.service || node.model
    if (node.vendor && iconKey) {
      const iconEntry = getVendorIconEntry(node.vendor, iconKey, node.resource)
      if (iconEntry) {
        const vendorIcon = iconEntry[this.iconTheme] || iconEntry.default
        const viewBox = iconEntry.viewBox || '0 0 48 48'

        // Check if icon is a nested SVG (PNG-based with custom viewBox in content)
        if (vendorIcon.startsWith('<svg')) {
          const viewBoxMatch = vendorIcon.match(/viewBox="0 0 (\d+) (\d+)"/)
          if (viewBoxMatch) {
            const vbWidth = Number.parseInt(viewBoxMatch[1], 10)
            const vbHeight = Number.parseInt(viewBoxMatch[2], 10)
            const aspectRatio = vbWidth / vbHeight
            let iconWidth = Math.round(DEFAULT_ICON_SIZE * aspectRatio)
            let iconHeight = DEFAULT_ICON_SIZE
            if (iconWidth > maxIconWidth) {
              iconWidth = maxIconWidth
              iconHeight = Math.round(maxIconWidth / aspectRatio)
            }
            const innerSvg = vendorIcon.replace(/<svg[^>]*>/, '').replace(/<\/svg>$/, '')
            return {
              width: iconWidth,
              height: iconHeight,
              svg: `<svg width="${iconWidth}" height="${iconHeight}" viewBox="0 0 ${vbWidth} ${vbHeight}">${innerSvg}</svg>`,
            }
          }
        }

        // Parse viewBox for aspect ratio calculation
        const vbMatch = viewBox.match(/(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/)
        if (vbMatch) {
          const vbWidth = Number.parseInt(vbMatch[3], 10)
          const vbHeight = Number.parseInt(vbMatch[4], 10)
          const aspectRatio = vbWidth / vbHeight
          let iconWidth =
            Math.abs(aspectRatio - 1) < 0.01
              ? DEFAULT_ICON_SIZE
              : Math.round(DEFAULT_ICON_SIZE * aspectRatio)
          let iconHeight = DEFAULT_ICON_SIZE
          if (iconWidth > maxIconWidth) {
            iconWidth = maxIconWidth
            iconHeight = Math.round(maxIconWidth / aspectRatio)
          }
          return {
            width: iconWidth,
            height: iconHeight,
            svg: `<svg width="${iconWidth}" height="${iconHeight}" viewBox="${viewBox}">${vendorIcon}</svg>`,
          }
        }

        // Fallback: use viewBox directly
        return {
          width: DEFAULT_ICON_SIZE,
          height: DEFAULT_ICON_SIZE,
          svg: `<svg width="${DEFAULT_ICON_SIZE}" height="${DEFAULT_ICON_SIZE}" viewBox="${viewBox}">${vendorIcon}</svg>`,
        }
      }
    }

    // Fall back to device type icon
    const iconPath = getDeviceIcon(node.type)
    if (!iconPath) return null

    return {
      width: DEFAULT_ICON_SIZE,
      height: DEFAULT_ICON_SIZE,
      svg: `<svg width="${DEFAULT_ICON_SIZE}" height="${DEFAULT_ICON_SIZE}" viewBox="0 0 24 24" fill="currentColor">${iconPath}</svg>`,
    }
  }

  /**
   * Render node content (icon + label) with dynamic vertical centering
   */
  private renderNodeContent(node: Node, x: number, y: number, w: number): string {
    const iconInfo = this.calculateIconInfo(node, w)
    const labels = Array.isArray(node.label) ? node.label : [node.label]
    const labelHeight = labels.length * LABEL_LINE_HEIGHT

    // Calculate total content height
    const iconHeight = iconInfo?.height || 0
    const gap = iconHeight > 0 ? ICON_LABEL_GAP : 0
    const totalContentHeight = iconHeight + gap + labelHeight

    // Center the content block vertically in the node
    const contentTop = y - totalContentHeight / 2

    const parts: string[] = []

    // Render icon at top of content block
    if (iconInfo) {
      const iconY = contentTop
      parts.push(`<g class="node-icon" transform="translate(${x - iconInfo.width / 2}, ${iconY})">
      ${iconInfo.svg}
    </g>`)
    }

    // Render labels below icon
    const labelStartY = contentTop + iconHeight + gap + LABEL_LINE_HEIGHT * 0.7 // 0.7 for text baseline adjustment
    for (const [i, line] of labels.entries()) {
      const isBold = line.includes('<b>') || line.includes('<strong>')
      const cleanLine = line.replace(/<\/?b>|<\/?strong>|<br\s*\/?>/gi, '')
      const className = isBold ? 'node-label node-label-bold' : 'node-label'
      parts.push(
        `<text x="${x}" y="${labelStartY + i * LABEL_LINE_HEIGHT}" class="${className}" text-anchor="middle">${this.escapeXml(cleanLine)}</text>`,
      )
    }

    return parts.join('\n  ')
  }

  private renderLink(layoutLink: LayoutLink, nodes: Map<string, LayoutNode>): string {
    const { id, points, link, fromEndpoint, toEndpoint } = layoutLink
    const label = link.label

    // Auto-apply styles based on redundancy type
    const type = link.type || this.getDefaultLinkType(link.redundancy)
    const arrow = link.arrow ?? this.getDefaultArrowType(link.redundancy)

    const stroke =
      link.style?.stroke || this.getVlanStroke(link.vlan) || this.themeColors.defaultLinkStroke
    const dasharray = link.style?.strokeDasharray || this.getLinkDasharray(type)
    const markerEnd = arrow !== 'none' ? 'url(#arrow)' : ''

    // Get bandwidth rendering config
    const bandwidthConfig = this.getBandwidthConfig(link.bandwidth)
    const strokeWidth =
      link.style?.strokeWidth || bandwidthConfig.strokeWidth || this.getLinkStrokeWidth(type)

    // Render link lines based on bandwidth (single or multiple parallel lines)
    let result = this.renderBandwidthLines(
      id,
      points,
      stroke,
      strokeWidth,
      dasharray,
      markerEnd,
      bandwidthConfig,
      type,
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
      const vlanText =
        link.vlan.length === 1 ? `VLAN ${link.vlan[0]}` : `VLAN ${link.vlan.join(', ')}`
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

    // Build data attributes for interactive mode
    const dataAttrs = this.buildLinkDataAttributes(layoutLink)

    return `<g class="link-group" data-link-id="${id}"${dataAttrs}>\n${result}\n</g>`
  }

  /** Build data attributes for a link (interactive mode only) */
  private buildLinkDataAttributes(layoutLink: LayoutLink): string {
    if (!this.isInteractive || !this.dataAttrs.link) return ''

    const { link, fromEndpoint, toEndpoint } = layoutLink
    const attrs: string[] = []

    // Basic link attributes
    if (link.bandwidth) attrs.push(`data-link-bandwidth="${this.escapeXml(link.bandwidth)}"`)
    if (link.vlan && link.vlan.length > 0) {
      attrs.push(`data-link-vlan="${link.vlan.join(',')}"`)
    }
    if (link.redundancy) attrs.push(`data-link-redundancy="${this.escapeXml(link.redundancy)}"`)

    // Endpoint info
    const fromStr = fromEndpoint.port
      ? `${fromEndpoint.node}:${fromEndpoint.port}`
      : fromEndpoint.node
    const toStr = toEndpoint.port ? `${toEndpoint.node}:${toEndpoint.port}` : toEndpoint.node
    attrs.push(`data-link-from="${this.escapeXml(fromStr)}"`)
    attrs.push(`data-link-to="${this.escapeXml(toStr)}"`)

    // Include full metadata as JSON
    if (this.dataAttrs.metadata) {
      const linkInfo = {
        id: layoutLink.id,
        from: fromEndpoint,
        to: toEndpoint,
        bandwidth: link.bandwidth,
        vlan: link.vlan,
        redundancy: link.redundancy,
        label: link.label,
      }
      attrs.push(`data-link-json="${this.escapeXml(JSON.stringify(linkInfo))}"`)
    }

    return attrs.length > 0 ? ` ${attrs.join(' ')}` : ''
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
    portName: string,
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

    const offsetDist = 30 // Distance along line direction
    const perpDist = 20 // Perpendicular offset (fixed)

    // Position: offset along line direction + fixed horizontal offset for vertical links
    let x: number
    let y: number

    let anchor: string

    if (isVertical) {
      // For vertical links, use fixed horizontal offset (simpler and consistent)
      x = endpoint.x + perpDist * sideMultiplier
      y = endpoint.y + ny * offsetDist

      // Text anchor based on final position relative to endpoint
      anchor = 'middle'
      const labelDx = x - endpoint.x
      if (Math.abs(labelDx) > 8) {
        anchor = labelDx > 0 ? 'start' : 'end'
      }
    } else {
      // For horizontal links, position label near the port (not toward center)
      // Keep x near the endpoint, offset y below the line
      x = endpoint.x
      y = endpoint.y + perpDist // Always below the line

      // Text anchor: extend toward the center of the link
      // Start endpoint extends right (start), end endpoint extends left (end)
      // Check direction: if nextPoint is to the left, we're on the right side
      anchor = nx < 0 ? 'end' : 'start'
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
    const maxLen = Math.max(...lines.map((l) => l.length))
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

    for (const [i, line] of lines.entries()) {
      const textY = y + i * lineHeight
      result += `\n<text x="${x}" y="${textY}" class="endpoint-label" text-anchor="${anchor}">${this.escapeXml(line)}</text>`
    }

    return result
  }

  private getLinkStrokeWidth(type: LinkType): number {
    switch (type) {
      case 'thick':
        return 3
      case 'double':
        return 2
      default:
        return 2
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
    const strokeWidth = 2
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
    type: LinkType,
  ): string {
    const { lineCount } = config
    const lineSpacing = 3 // Space between parallel lines

    // Generate line paths
    const lines: string[] = []
    const basePath = this.generatePath(points)

    if (lineCount === 1) {
      // Single line
      let linePath = `<path class="link" data-id="${id}" d="${basePath}"
  fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"
  ${dasharray ? `stroke-dasharray="${dasharray}"` : ''}
  ${markerEnd ? `marker-end="${markerEnd}"` : ''} pointer-events="none" />`

      // Double line effect for redundancy types
      if (type === 'double') {
        linePath = `<path class="link-double-outer" d="${basePath}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth + 2}" pointer-events="none" />
<path class="link-double-inner" d="${basePath}" fill="none" stroke="white" stroke-width="${strokeWidth - 1}" pointer-events="none" />
${linePath}`
      }
      lines.push(linePath)
    } else {
      // Multiple parallel lines
      const offsets = this.calculateLineOffsets(lineCount, lineSpacing)
      for (const offset of offsets) {
        const offsetPoints = this.offsetPoints(points, offset)
        const path = this.generatePath(offsetPoints)
        lines.push(`<path class="link" data-id="${id}" d="${path}"
  fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"
  ${dasharray ? `stroke-dasharray="${dasharray}"` : ''} pointer-events="none" />`)
      }
    }

    // Calculate hit area width (same as actual lines, hidden underneath)
    const hitWidth = lineCount === 1 ? strokeWidth : (lineCount - 1) * lineSpacing + strokeWidth

    // Wrap all lines in a group with transparent hit area on top
    return `<g class="link-lines">
${lines.join('\n')}
<path class="link-hit-area" d="${basePath}"
  fill="none" stroke="${stroke}" stroke-width="${hitWidth}" opacity="0" />
</g>`
  }

  /**
   * Generate SVG path string from points with rounded corners
   */
  private generatePath(points: { x: number; y: number }[], cornerRadius = 8): string {
    if (points.length < 2) return ''
    if (points.length === 2) {
      return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
    }

    const parts: string[] = [`M ${points[0].x} ${points[0].y}`]

    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1]
      const curr = points[i]
      const next = points[i + 1]

      // Calculate distances to prev and next points
      const distPrev = Math.hypot(curr.x - prev.x, curr.y - prev.y)
      const distNext = Math.hypot(next.x - curr.x, next.y - curr.y)

      // Limit radius to half the shortest segment
      const maxRadius = Math.min(distPrev, distNext) / 2
      const radius = Math.min(cornerRadius, maxRadius)

      if (radius < 1) {
        // Too small for rounding, just use straight line
        parts.push(`L ${curr.x} ${curr.y}`)
        continue
      }

      // Calculate direction vectors
      const dirPrev = { x: (curr.x - prev.x) / distPrev, y: (curr.y - prev.y) / distPrev }
      const dirNext = { x: (next.x - curr.x) / distNext, y: (next.y - curr.y) / distNext }

      // Points where curve starts and ends
      const startCurve = { x: curr.x - dirPrev.x * radius, y: curr.y - dirPrev.y * radius }
      const endCurve = { x: curr.x + dirNext.x * radius, y: curr.y + dirNext.y * radius }

      // Line to start of curve, then quadratic bezier through corner
      parts.push(`L ${startCurve.x} ${startCurve.y}`)
      parts.push(`Q ${curr.x} ${curr.y} ${endCurve.x} ${endCurve.y}`)
    }

    // Line to final point
    const last = points[points.length - 1]
    parts.push(`L ${last.x} ${last.y}`)

    return parts.join(' ')
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
   * Offset points perpendicular to line direction, handling each segment properly
   * For orthogonal paths, this maintains parallel lines through bends
   */
  private offsetPoints(
    points: { x: number; y: number }[],
    offset: number,
  ): { x: number; y: number }[] {
    if (points.length < 2) return points

    const result: { x: number; y: number }[] = []

    for (let i = 0; i < points.length; i++) {
      const p = points[i]

      if (i === 0) {
        // First point: use direction to next point
        const next = points[i + 1]
        const perp = this.getPerpendicular(p, next)
        result.push({ x: p.x + perp.x * offset, y: p.y + perp.y * offset })
      } else if (i === points.length - 1) {
        // Last point: use direction from previous point
        const prev = points[i - 1]
        const perp = this.getPerpendicular(prev, p)
        result.push({ x: p.x + perp.x * offset, y: p.y + perp.y * offset })
      } else {
        // Middle point (bend): offset based on incoming segment direction
        const prev = points[i - 1]
        const perp = this.getPerpendicular(prev, p)
        result.push({ x: p.x + perp.x * offset, y: p.y + perp.y * offset })

        // Also add a point for the outgoing segment if direction changes
        const next = points[i + 1]
        const perpNext = this.getPerpendicular(p, next)

        // Check if direction changed (bend point)
        if (Math.abs(perp.x - perpNext.x) > 0.01 || Math.abs(perp.y - perpNext.y) > 0.01) {
          result.push({ x: p.x + perpNext.x * offset, y: p.y + perpNext.y * offset })
        }
      }
    }

    return result
  }

  /**
   * Get perpendicular unit vector for a line segment
   */
  private getPerpendicular(
    from: { x: number; y: number },
    to: { x: number; y: number },
  ): { x: number; y: number } {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const len = Math.sqrt(dx * dx + dy * dy)

    if (len === 0) return { x: 0, y: 0 }

    // Perpendicular unit vector (rotate 90 degrees)
    return { x: -dy / len, y: dx / len }
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
      case 'dashed':
        return '5 3'
      case 'invisible':
        return '0'
      default:
        return ''
    }
  }

  private getMidPoint(points: { x: number; y: number }[]): { x: number; y: number } {
    if (points.length === 4) {
      // Cubic bezier curve midpoint at t=0.5
      const t = 0.5
      const mt = 1 - t
      const x =
        mt * mt * mt * points[0].x +
        3 * mt * mt * t * points[1].x +
        3 * mt * t * t * points[2].x +
        t * t * t * points[3].x
      const y =
        mt * mt * mt * points[0].y +
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
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }
}

// Namespace-style API
export interface RenderOptions extends SVGRendererOptions {}

/**
 * Render NetworkGraph to SVG string
 */
export function render(graph: NetworkGraph, layout: LayoutResult, options?: RenderOptions): string {
  const renderer = new SVGRenderer(options)
  return renderer.render(graph, layout)
}
