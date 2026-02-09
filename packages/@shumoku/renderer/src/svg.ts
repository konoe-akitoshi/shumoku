/**
 * SVG Renderer
 * Renders NetworkGraph to SVG
 */

import type {
  EdgeStyle,
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
  darkTheme,
  getDeviceIcon,
  ICON_LABEL_GAP,
  LABEL_LINE_HEIGHT,
  lightTheme,
  type SurfaceToken,
  type Theme,
} from '@shumoku/core'

import {
  getCDNIconUrl,
  hasCDNIcons,
  type IconDimensions,
  resolveAllIconDimensions,
} from './cdn-icons.js'
import type { DataAttributeOptions, RenderMode } from './types.js'

// ============================================
// Render Colors (derived from Theme)
// ============================================

type CenterlineSegment =
  | { type: 'line'; from: { x: number; y: number }; to: { x: number; y: number } }
  | {
      type: 'arc'
      center: { x: number; y: number }
      radius: number
      t0: { x: number; y: number }
      t1: { x: number; y: number }
      sweepFlag: number
    }

interface RenderColors {
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

/**
 * Convert Theme to RenderColors for SVG rendering
 */
function themeToRenderColors(theme: Theme): RenderColors {
  const { colors } = theme
  const defaultSurface = colors.surfaces['surface-1']

  return {
    backgroundColor: colors.background,
    defaultNodeFill: colors.surface,
    defaultNodeStroke: colors.textSecondary,
    defaultLinkStroke: colors.textSecondary,
    labelColor: colors.text,
    labelSecondaryColor: colors.textSecondary,
    subgraphFill: defaultSurface.fill,
    subgraphStroke: defaultSurface.stroke,
    subgraphLabelColor: defaultSurface.text,
    // Ports use darker colors
    portFill: theme.variant === 'dark' ? '#64748b' : '#334155',
    portStroke: theme.variant === 'dark' ? '#94a3b8' : '#0f172a',
    portLabelBg: theme.variant === 'dark' ? '#0f172a' : '#0f172a',
    portLabelColor: '#ffffff',
    endpointLabelBg: colors.background,
    endpointLabelStroke: defaultSurface.stroke,
  }
}

/**
 * Check if a string is a surface token
 */
function isSurfaceToken(value: string): value is SurfaceToken {
  return [
    'surface-1',
    'surface-2',
    'surface-3',
    'accent-blue',
    'accent-green',
    'accent-red',
    'accent-amber',
    'accent-purple',
  ].includes(value)
}

/**
 * Resolve a color value that may be a surface token or a direct color
 * Returns SurfaceColors (fill, stroke, text) for the resolved value
 */
function resolveSurfaceColors(
  theme: Theme,
  fillValue?: string,
  strokeValue?: string,
  interactive?: boolean,
): { fill: string; stroke: string; text: string } {
  // Check if fill is a surface token
  if (fillValue && isSurfaceToken(fillValue)) {
    if (interactive) {
      return {
        fill: `var(--shumoku-${fillValue}-fill)`,
        stroke: strokeValue || `var(--shumoku-${fillValue}-stroke)`,
        text: `var(--shumoku-${fillValue}-text)`,
      }
    }
    const surfaceColors = theme.colors.surfaces[fillValue]
    return {
      fill: surfaceColors.fill,
      stroke: strokeValue || surfaceColors.stroke,
      text: surfaceColors.text,
    }
  }

  // Use default surface as base
  if (interactive) {
    return {
      fill: fillValue || 'var(--shumoku-surface-1-fill)',
      stroke: strokeValue || 'var(--shumoku-surface-1-stroke)',
      text: 'var(--shumoku-surface-1-text)',
    }
  }
  const defaultSurface = theme.colors.surfaces['surface-1']
  return {
    fill: fillValue || defaultSurface.fill,
    stroke: strokeValue || defaultSurface.stroke,
    text: defaultSurface.text,
  }
}

// ============================================
// Renderer Options
// ============================================

/** Embedded content for a subgraph */
export interface EmbeddedSubgraphContent {
  /** SVG content to embed (inner content, without outer <svg> tag) */
  svgContent: string
  /** ViewBox of the embedded content */
  viewBox: string
}

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
  /**
   * Unique sheet ID for generating unique filter/marker IDs
   * Required when multiple SVGs are embedded in the same HTML page
   */
  sheetId?: string
  /**
   * Embedded content for subgraphs (subgraphId -> content)
   * Used to embed child SVG content into parent subgraph boxes
   */
  embeddedContent?: Map<string, EmbeddedSubgraphContent>
  /**
   * Pre-resolved icon dimensions (URL -> dimensions)
   * Used to render icons at correct aspect ratio
   */
  iconDimensions?: Map<string, IconDimensions>
}

const DEFAULT_OPTIONS: Required<SVGRendererOptions> = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  interactive: true,
  renderMode: 'static',
  dataAttributes: { device: true, link: true, metadata: true },
  sheetId: '',
  embeddedContent: new Map(),
  iconDimensions: new Map(),
}

// ============================================
// SVG Renderer
// ============================================

export class SVGRenderer {
  private options: Required<SVGRendererOptions>
  private theme: Theme = lightTheme
  private renderColors: RenderColors = themeToRenderColors(lightTheme)
  private edgeStyle: EdgeStyle = 'orthogonal'

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

  /** Get unique ID suffix for this sheet */
  private get idSuffix(): string {
    return this.options.sheetId ? `-${this.options.sheetId}` : ''
  }

  /** Get arrow marker ID */
  private get arrowId(): string {
    return `arrow${this.idSuffix}`
  }

  /** Get red arrow marker ID */
  private get arrowRedId(): string {
    return `arrow-red${this.idSuffix}`
  }

  /**
   * Get a color value: CSS variable in interactive mode, direct color in static mode.
   */
  private color(key: keyof RenderColors): string {
    if (!this.isInteractive) return this.renderColors[key]
    const varMap: Record<keyof RenderColors, string> = {
      backgroundColor: 'var(--shumoku-bg)',
      defaultNodeFill: 'var(--shumoku-node-fill)',
      defaultNodeStroke: 'var(--shumoku-node-stroke)',
      defaultLinkStroke: 'var(--shumoku-link-stroke)',
      labelColor: 'var(--shumoku-text)',
      labelSecondaryColor: 'var(--shumoku-text-secondary)',
      subgraphFill: 'var(--shumoku-surface)',
      subgraphStroke: 'var(--shumoku-border)',
      subgraphLabelColor: 'var(--shumoku-subgraph-label)',
      portFill: 'var(--shumoku-port-fill)',
      portStroke: 'var(--shumoku-port-stroke)',
      portLabelBg: 'var(--shumoku-port-label-bg)',
      portLabelColor: 'var(--shumoku-port-label-color)',
      endpointLabelBg: 'var(--shumoku-endpoint-label-bg)',
      endpointLabelStroke: 'var(--shumoku-endpoint-label-stroke)',
    }
    return varMap[key]
  }

  /**
   * Set theme based on theme type
   */
  private setTheme(themeType?: ThemeType): void {
    this.theme = themeType === 'dark' ? darkTheme : lightTheme
    this.renderColors = themeToRenderColors(this.theme)
  }

  render(graph: NetworkGraph, layout: LayoutResult): string {
    const { bounds } = layout

    // Set theme based on graph settings
    this.setTheme(graph.settings?.theme)

    // Set edge style for link rendering
    this.edgeStyle = graph.settings?.edgeStyle || 'orthogonal'

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
        const sw = this.getBandwidthStrokeWidth(bw)
        items.push({
          icon: this.renderBandwidthLegendIcon(sw),
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
    fill="${this.color('backgroundColor')}" stroke="${this.color('subgraphStroke')}" stroke-width="1.5" opacity="0.95" />
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
  private renderBandwidthLegendIcon(strokeWidth: number): string {
    const lineWidth = 24
    return `<line x1="0" y1="0" x2="${lineWidth}" y2="0" stroke="${this.color('defaultLinkStroke')}" stroke-width="${strokeWidth}" />`
  }

  private renderHeader(width: number, height: number, viewBox: string): string {
    // Interactive mode: let the container control sizing via CSS
    // Static mode: use exact pixel dimensions for standalone SVG
    const sizeAttrs = this.isInteractive
      ? 'width="100%" height="100%"'
      : `width="${width}" height="${height}"`
    return `<svg xmlns="http://www.w3.org/2000/svg"
  viewBox="${viewBox}"
  ${sizeAttrs}
  style="background: transparent">`
  }

  private renderDefs(): string {
    const shadowId = this.options.sheetId ? `node-shadow-${this.options.sheetId}` : 'node-shadow'
    return `<defs>
  <!-- Arrow marker -->
  <marker id="${this.arrowId}" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
    <polygon points="0 0, 10 3.5, 0 7" fill="${this.color('defaultLinkStroke')}" />
  </marker>
  <marker id="${this.arrowRedId}" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
    <polygon points="0 0, 10 3.5, 0 7" fill="#dc2626" />
  </marker>
  <!-- Node shadow: ultra-subtle, almost invisible (modern approach) -->
  <filter id="${shadowId}" x="-10%" y="-10%" width="120%" height="120%">
    <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#101828" flood-opacity="0.06"/>
  </filter>
</defs>`
  }

  private renderStyles(): string {
    // Monospace font stack for technical info
    const monoFont = 'ui-monospace, "JetBrains Mono", "Roboto Mono", Menlo, Consolas, monospace'

    const textColor = this.color('labelColor')
    const textSecondary = this.color('labelSecondaryColor')
    const subgraphLabel = this.color('subgraphLabelColor')

    return `<style>
  /* Node labels: primary name in semibold */
  .node-label { font-family: ${this.options.fontFamily}; font-size: 14px; font-weight: 600; fill: ${textColor}; }
  .node-label-bold { font-weight: 700; }
  /* Secondary/metadata labels: smaller, monospace for technical info */
  .node-label-secondary { font-family: ${monoFont}; font-size: 10px; font-weight: 400; fill: ${textSecondary}; }
  .node-icon { color: ${textSecondary}; }
  .subgraph-icon { opacity: 0.9; }
  /* Subgraph/zone labels: uppercase, letterspaced for modern look */
  .subgraph-label { font-family: ${this.options.fontFamily}; font-size: 11px; font-weight: 700; fill: ${subgraphLabel}; text-transform: uppercase; letter-spacing: 0.05em; }
  .link-label { font-family: ${monoFont}; font-size: 10px; fill: ${textSecondary}; }
  .endpoint-label { font-family: ${monoFont}; font-size: 9px; fill: ${textColor}; }
</style>`
  }

  private renderSubgraph(sg: LayoutSubgraph): string {
    const { bounds, subgraph } = sg
    const style = subgraph.style || {}

    // Resolve surface colors from token or direct color value
    const surfaceColors = resolveSurfaceColors(this.theme, style.fill, style.stroke, this.isInteractive)
    const fill = surfaceColors.fill
    const stroke = surfaceColors.stroke
    const labelColor = surfaceColors.text
    const strokeWidth = style.strokeWidth || 3
    const strokeDasharray = style.strokeDasharray || ''
    const labelPos = style.labelPosition || 'top'

    const rx = 12 // Border radius (larger for container/card feel)

    // Check if subgraph has icon (user-specified or CDN-supported vendor)
    // AWS uses service/resource format (e.g., ec2/instance)
    const iconKey =
      subgraph.service && subgraph.resource
        ? `${subgraph.service}/${subgraph.resource}`
        : subgraph.service || subgraph.model
    let hasIcon = false
    const defaultIconSize = 24
    const iconPadding = 8

    // Get icon URL and dimensions for sizing calculations
    let iconUrl: string | undefined
    let iconWidth = defaultIconSize
    let iconHeight = defaultIconSize

    if (subgraph.icon) {
      hasIcon = true
      iconUrl = subgraph.icon
      const dims = this.options.iconDimensions.get(subgraph.icon)
      if (dims) {
        const aspectRatio = dims.width / dims.height
        if (aspectRatio >= 1) {
          iconHeight = defaultIconSize
          iconWidth = Math.round(defaultIconSize * aspectRatio)
        } else {
          iconHeight = defaultIconSize
          iconWidth = Math.round(defaultIconSize * aspectRatio)
        }
      }
    } else if (subgraph.vendor && iconKey && hasCDNIcons(subgraph.vendor)) {
      const cdnUrl = getCDNIconUrl(subgraph.vendor, iconKey)
      const dims = this.options.iconDimensions.get(cdnUrl)
      if (dims) {
        hasIcon = true
        iconUrl = cdnUrl
        const aspectRatio = dims.width / dims.height
        if (aspectRatio >= 1) {
          iconHeight = defaultIconSize
          iconWidth = Math.round(defaultIconSize * aspectRatio)
        } else {
          iconHeight = defaultIconSize
          iconWidth = Math.round(defaultIconSize * aspectRatio)
        }
      }
      // dims not found = icon doesn't exist on CDN, skip icon
    }

    // Calculate icon position (top-left corner)
    const iconX = bounds.x + iconPadding
    const iconY = bounds.y + iconPadding

    // Label position - shift right if there's an icon
    let labelX = hasIcon ? bounds.x + iconWidth + iconPadding * 2 : bounds.x + 10
    let labelY = bounds.y + 20
    const textAnchor = 'start'

    if (labelPos === 'top') {
      labelX = hasIcon ? bounds.x + iconWidth + iconPadding * 2 : bounds.x + 10
      labelY = bounds.y + 20
    }

    // Render icon if available (user-specified URL or CDN URL)
    let iconSvg = ''
    if (hasIcon && iconUrl) {
      iconSvg = `<g class="subgraph-icon" transform="translate(${iconX}, ${iconY})">
    <image href="${iconUrl}" width="${iconWidth}" height="${iconHeight}" preserveAspectRatio="xMidYMid meet" />
  </g>`
    }

    // Hierarchical navigation attributes
    const hasSheet = subgraph.file || (subgraph.pins && subgraph.pins.length > 0)
    // Include bounds data for zoom-based navigation
    const boundsJson = hasSheet
      ? JSON.stringify({
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        }).replace(/"/g, '&quot;')
      : ''
    const sheetAttrs = hasSheet
      ? ` data-has-sheet="true" data-sheet-id="${sg.id}" data-bounds="${boundsJson}"`
      : ''

    // Check for embedded content
    const embeddedContent = this.options.embeddedContent?.get(sg.id)
    let embeddedSvg = ''
    if (embeddedContent) {
      // Calculate content area (below label, with padding)
      const labelHeight = 30 // Space for label
      const padding = 10
      const contentX = bounds.x + padding
      const contentY = bounds.y + labelHeight
      const contentWidth = bounds.width - padding * 2
      const contentHeight = bounds.height - labelHeight - padding

      // Embed child SVG with viewBox for automatic scaling
      embeddedSvg = `
  <svg x="${contentX}" y="${contentY}" width="${contentWidth}" height="${contentHeight}"
    viewBox="${embeddedContent.viewBox}" preserveAspectRatio="xMidYMid meet">
    ${embeddedContent.svgContent}
  </svg>`
    }

    // Render boundary ports for hierarchical connections
    let portsSvg = ''
    if (sg.ports && sg.ports.size > 0) {
      const portParts: string[] = []
      const centerX = bounds.x + bounds.width / 2
      const centerY = bounds.y + bounds.height / 2

      for (const port of sg.ports.values()) {
        const px = centerX + port.position.x
        const py = centerY + port.position.y
        const pw = port.size.width
        const ph = port.size.height

        // Port circle/diamond on boundary
        portParts.push(`<circle class="subgraph-port" cx="${px}" cy="${py}" r="${Math.max(pw, ph) / 2 + 2}"
          fill="#3b82f6" stroke="#1d4ed8" stroke-width="2" />`)

        // Port label
        let labelX = px
        let labelY = py
        let anchor = 'middle'
        const labelOffset = 16

        switch (port.side) {
          case 'top':
            labelY = py - labelOffset
            break
          case 'bottom':
            labelY = py + labelOffset + 4
            break
          case 'left':
            labelX = px - labelOffset
            anchor = 'end'
            break
          case 'right':
            labelX = px + labelOffset
            anchor = 'start'
            break
        }

        portParts.push(`<text x="${labelX}" y="${labelY}" class="port-label" text-anchor="${anchor}"
          fill="#3b82f6" font-size="10" font-weight="500">${this.escapeXml(port.label)}</text>`)
      }
      portsSvg = portParts.join('\n  ')
    }

    return `<g class="subgraph" data-id="${sg.id}"${sheetAttrs}>
  <rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}"
    rx="${rx}" ry="${rx}"
    fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"
    ${strokeDasharray ? `stroke-dasharray="${strokeDasharray}"` : ''} />
  ${iconSvg}
  <text x="${labelX}" y="${labelY}" class="subgraph-label" text-anchor="${textAnchor}" fill="${labelColor}">${this.escapeXml(subgraph.label)}</text>${embeddedSvg}
  ${portsSvg}
</g>`
  }

  /** Render node background (shape only) */
  /** Render complete node (bg + fg as one unit) */
  private renderNode(layoutNode: LayoutNode): string {
    const { id, node } = layoutNode
    const dataAttrs = this.buildNodeDataAttributes(node)
    const parentAttr = node.parent ? ` data-parent="${this.escapeXml(node.parent)}"` : ''
    const bg = this.renderNodeBackground(layoutNode)
    const fg = this.renderNodeForeground(layoutNode)

    // Apply shadow filter for card-like elevation
    const shadowId = this.options.sheetId ? `node-shadow-${this.options.sheetId}` : 'node-shadow'
    const filterAttr = ` filter="url(#${shadowId})"`

    return `<g class="node" data-id="${id}"${dataAttrs}${parentAttr}${filterAttr}>
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

    // Check if this is an export connector node (for hierarchical diagrams)
    const isExport = node.metadata?._isExport === true

    // Special styling for export connector nodes - use subgraph colors
    let fill = style.fill || this.color('defaultNodeFill')
    let stroke = style.stroke || this.color('defaultNodeStroke')
    if (isExport) {
      fill = style.fill || this.color('subgraphFill')
      stroke = style.stroke || this.color('defaultNodeStroke')
    }
    const strokeWidth = style.strokeWidth || 1.5
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

    return `<g class="node-bg" data-id="${id}">${shape}</g>`
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

    return attrs.length > 0 ? ` ${attrs.join(' ')}` : ''
  }

  /** Render node foreground (content only, ports rendered separately) */
  private renderNodeForeground(layoutNode: LayoutNode): string {
    const { id, position, size, node } = layoutNode
    const x = position.x
    const y = position.y
    const w = size.width

    const content = this.renderNodeContent(node, x, y, w)

    return `<g class="node-fg" data-id="${id}">
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
        fill="${this.color('portFill')}" stroke="${this.color('portStroke')}" stroke-width="1" rx="2" />`)

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
        `<rect class="port-label-bg" x="${bgX}" y="${bgY}" width="${labelWidth}" height="${labelHeight}" rx="2" fill="${this.color('portLabelBg')}" />`,
      )
      parts.push(
        `<text class="port-label" x="${labelX}" y="${labelY}" text-anchor="${textAnchor}" font-size="9" fill="${this.color('portLabelColor')}">${labelText}</text>`,
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
          fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashAttr} />`

      case 'rounded':
        return `<rect x="${x - halfW}" y="${y - halfH}" width="${w}" height="${h}" rx="8" ry="8"
          fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashAttr} />`

      case 'circle': {
        const r = Math.min(halfW, halfH)
        return `<circle cx="${x}" cy="${y}" r="${r}"
          fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashAttr} />`
      }

      case 'diamond':
        return `<polygon points="${x},${y - halfH} ${x + halfW},${y} ${x},${y + halfH} ${x - halfW},${y}"
          fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashAttr} />`

      case 'hexagon': {
        const hx = halfW * 0.866
        return `<polygon points="${x - halfW},${y} ${x - hx},${y - halfH} ${x + hx},${y - halfH} ${x + halfW},${y} ${x + hx},${y + halfH} ${x - hx},${y + halfH}"
          fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashAttr} />`
      }

      case 'cylinder': {
        const ellipseH = h * 0.15
        return `<g>
          <ellipse cx="${x}" cy="${y + halfH - ellipseH}" rx="${halfW}" ry="${ellipseH}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashAttr} />
          <rect x="${x - halfW}" y="${y - halfH + ellipseH}" width="${w}" height="${h - ellipseH * 2}" fill="${fill}" stroke="none" />
          <line x1="${x - halfW}" y1="${y - halfH + ellipseH}" x2="${x - halfW}" y2="${y + halfH - ellipseH}" stroke="${stroke}" stroke-width="${strokeWidth}" />
          <line x1="${x + halfW}" y1="${y - halfH + ellipseH}" x2="${x + halfW}" y2="${y + halfH - ellipseH}" stroke="${stroke}" stroke-width="${strokeWidth}" />
          <ellipse cx="${x}" cy="${y - halfH + ellipseH}" rx="${halfW}" ry="${ellipseH}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashAttr} />
        </g>`
      }

      case 'stadium':
        return `<rect x="${x - halfW}" y="${y - halfH}" width="${w}" height="${h}" rx="${halfH}" ry="${halfH}"
          fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashAttr} />`

      case 'trapezoid': {
        const indent = w * 0.15
        return `<polygon points="${x - halfW + indent},${y - halfH} ${x + halfW - indent},${y - halfH} ${x + halfW},${y + halfH} ${x - halfW},${y + halfH}"
          fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashAttr} />`
      }

      default:
        return `<rect x="${x - halfW}" y="${y - halfH}" width="${w}" height="${h}" rx="4" ry="4"
          fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashAttr} />`
    }
  }

  /**
   * Calculate icon render size based on pre-resolved dimensions
   * Returns dimensions that maintain aspect ratio within constraints
   */
  private calculateIconSize(
    dimensions: IconDimensions | undefined,
    maxWidth: number,
    defaultSize: number = DEFAULT_ICON_SIZE,
  ): { width: number; height: number } {
    if (!dimensions) {
      // Fallback to square
      const size = Math.min(defaultSize, maxWidth)
      return { width: size, height: size }
    }

    const aspectRatio = dimensions.width / dimensions.height

    if (aspectRatio >= 1) {
      // Horizontal or square image: constrain by height
      let height = defaultSize
      let width = Math.round(height * aspectRatio)
      if (width > maxWidth) {
        width = maxWidth
        height = Math.round(width / aspectRatio)
      }
      return { width, height }
    } else {
      // Vertical image: constrain by height
      const height = defaultSize
      const width = Math.round(height * aspectRatio)
      return { width, height }
    }
  }

  private calculateIconInfo(
    node: Node,
    w: number,
  ): { width: number; height: number; svg: string } | null {
    // Use full node width as max; layout engine already calculated appropriate size
    const maxIconWidth = w

    // User-specified icon URL takes highest priority
    if (node.icon) {
      const dims = this.options.iconDimensions.get(node.icon)
      const { width, height } = this.calculateIconSize(dims, maxIconWidth)
      return {
        width,
        height,
        svg: `<image href="${node.icon}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet" />`,
      }
    }

    // Try vendor-specific icon first (service for cloud, model for hardware)
    // AWS uses service/resource format (e.g., ec2/instance)
    const iconKey =
      node.service && node.resource
        ? `${node.service}/${node.resource}`
        : node.service || node.model
    // Use CDN icons for supported vendors (only if dimensions were resolved, i.e. icon exists)
    if (node.vendor && iconKey && hasCDNIcons(node.vendor)) {
      const cdnUrl = getCDNIconUrl(node.vendor, iconKey)
      const dims = this.options.iconDimensions.get(cdnUrl)
      if (dims) {
        const { width, height } = this.calculateIconSize(dims, maxIconWidth)
        return {
          width,
          height,
          svg: `<image href="${cdnUrl}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet" />`,
        }
      }
      // dims not found = icon doesn't exist on CDN, fall through to device type icon
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
    // Check if this is an export connector node
    const isExport = node.metadata?._isExport === true

    // For export connectors, render with arrow icon
    if (isExport) {
      return this.renderExportConnectorContent(node, x, y)
    }

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
    // First line: primary label (device name), subsequent lines: secondary (metadata like IP, VLAN)
    const labelStartY = contentTop + iconHeight + gap + LABEL_LINE_HEIGHT * 0.7 // 0.7 for text baseline adjustment
    for (const [i, line] of labels.entries()) {
      const isBold = line.includes('<b>') || line.includes('<strong>')
      const cleanLine = line.replace(/<\/?b>|<\/?strong>|<br\s*\/?>/gi, '')
      // First line = primary label, rest = secondary (metadata)
      const isSecondary = i > 0 && !isBold
      const className = isBold
        ? 'node-label node-label-bold'
        : isSecondary
          ? 'node-label-secondary'
          : 'node-label'
      parts.push(
        `<text x="${x}" y="${labelStartY + i * LABEL_LINE_HEIGHT}" class="${className}" text-anchor="middle">${this.escapeXml(cleanLine)}</text>`,
      )
    }

    return parts.join('\n  ')
  }

  /** Render content for export connector nodes */
  private renderExportConnectorContent(node: Node, x: number, y: number): string {
    const labels = Array.isArray(node.label) ? node.label : [node.label]
    const labelText = labels[0] || ''

    // Just render the label (subgraph name), no arrows
    return `<text x="${x}" y="${y + 4}" class="node-label" text-anchor="middle">${this.escapeXml(labelText)}</text>`
  }

  private renderLink(layoutLink: LayoutLink, nodes: Map<string, LayoutNode>): string {
    const { id, points, link, fromEndpoint, toEndpoint } = layoutLink
    const label = link.label

    // Auto-apply styles based on redundancy type
    const type = link.type || this.getDefaultLinkType(link.redundancy)
    const arrow = link.arrow ?? this.getDefaultArrowType(link.redundancy)

    const stroke =
      link.style?.stroke || this.getVlanStroke(link.vlan) || this.color('defaultLinkStroke')
    const dasharray = link.style?.strokeDasharray || this.getLinkDasharray(type)
    const markerEnd = arrow !== 'none' ? `url(#${this.arrowId})` : ''

    // Bandwidth determines stroke width
    const bandwidthStrokeWidth = this.getBandwidthStrokeWidth(link.bandwidth)
    const strokeWidth =
      link.style?.strokeWidth || bandwidthStrokeWidth || this.getLinkStrokeWidth(type)

    // Render link line
    let result = this.renderLinkLine(
      id,
      points,
      stroke,
      strokeWidth,
      dasharray,
      markerEnd,
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

    // Export link destination info (for tooltip on hierarchical export connectors)
    if (link.metadata?._destDevice) {
      attrs.push(`data-link-dest-device="${this.escapeXml(String(link.metadata._destDevice))}"`)
      if (link.metadata._destPort) {
        attrs.push(`data-link-dest-port="${this.escapeXml(String(link.metadata._destPort))}"`)
      }
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

    const lineHeight = 12
    const charWidth = 5.5
    const paddingX = 4

    // Calculate dimensions
    const maxLen = Math.max(...lines.map((l) => l.length))
    const rectWidth = maxLen * charWidth + paddingX
    const rectHeight = lines.length * lineHeight

    // Adjust rect position based on text anchor
    let rectX = x - paddingX / 2
    if (anchor === 'middle') {
      rectX = x - rectWidth / 2
    } else if (anchor === 'end') {
      rectX = x - rectWidth + paddingX / 2
    }

    // Simple offset approach (same as port labels)
    const rectY = y - lineHeight + 3

    let result = `\n<rect x="${rectX}" y="${rectY}" width="${rectWidth}" height="${rectHeight}" rx="2" fill="${this.color('endpointLabelBg')}" stroke="${this.color('endpointLabelStroke')}" stroke-width="0.5" />`

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
   * Bandwidth rendering configuration - stroke width represents speed
   * 1G   → 6px
   * 10G  → 10px
   * 25G  → 14px
   * 40G  → 18px
   * 100G → 24px
   */
  private getBandwidthStrokeWidth(bandwidth?: string): number {
    switch (bandwidth) {
      case '1G':
        return 6
      case '10G':
        return 10
      case '25G':
        return 14
      case '40G':
        return 18
      case '100G':
        return 24
      default:
        return 0
    }
  }

  /**
   * Render a link line with the given stroke width
   */
  private renderLinkLine(
    id: string,
    points: { x: number; y: number }[],
    stroke: string,
    strokeWidth: number,
    dasharray: string,
    markerEnd: string,
    type: LinkType,
  ): string {
    // Apply edge style transformations
    let effectivePoints = points
    let cornerRadius = 8

    if (this.edgeStyle === 'straight') {
      effectivePoints = [points[0], points[points.length - 1]]
      cornerRadius = 0
    } else if (this.edgeStyle === 'polyline') {
      cornerRadius = 0
    }

    // Build centerline as segments + fillet arcs
    const centerline = this.buildFilletedCenterline(effectivePoints, cornerRadius)
    const basePath = this.centerlineToPath(centerline, 0)

    let linePath = `<path class="link" data-id="${id}" d="${basePath}"
  fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"
  ${dasharray ? `stroke-dasharray="${dasharray}"` : ''}
  ${markerEnd ? `marker-end="${markerEnd}"` : ''} pointer-events="none" />`

    if (type === 'double') {
      const gap = Math.max(3, Math.round(strokeWidth * 0.9))
      const outerWidth = strokeWidth + gap * 2
      const innerWidth = Math.max(1, strokeWidth)
      const centerWidth = Math.max(1, strokeWidth - Math.round(gap * 0.8))
      linePath = `<path class="link-double-outer" d="${basePath}" fill="none" stroke="${stroke}" stroke-width="${outerWidth}" pointer-events="none" />
<path class="link-double-inner" d="${basePath}" fill="none" stroke="white" stroke-width="${innerWidth}" pointer-events="none" />
<path class="link-double-center" d="${basePath}" fill="none" stroke="${stroke}" stroke-width="${centerWidth}" pointer-events="none" />`
    }

    return `<g class="link-lines">
${linePath}
<path class="link-hit-area" d="${basePath}"
  fill="none" stroke="${stroke}" stroke-width="${Math.max(strokeWidth, 8)}" opacity="0" />
</g>`
  }

  /**
   * Simplify orthogonal path by absorbing micro-jogs.
   * When the layout creates a short segment (< minLen) between two longer segments,
   * it's typically a micro-offset (e.g., 5px horizontal jog between two long vertical runs).
   * We absorb these by snapping the short segment's endpoints onto the adjacent segments'
   * axis, effectively straightening the path.
   *
   * Example: ... → (100, 500) → (105, 500) → (105, 800) → ...
   *   The 5px horizontal jog is absorbed: → (105, 500) → (105, 800) → ...
   *   (or → (100, 500) → (100, 800) depending on which neighbor is longer)
   */
  private simplifyMicroJogs(
    points: { x: number; y: number }[],
    minLen: number,
  ): { x: number; y: number }[] {
    if (points.length <= 3) return points

    // Iteratively remove micro-jogs until stable
    let pts = points
    let changed = true
    while (changed) {
      changed = false
      if (pts.length <= 3) break

      const result: { x: number; y: number }[] = [pts[0]]

      let i = 1
      while (i < pts.length - 1) {
        const prev = result[result.length - 1]
        const curr = pts[i]
        const next = pts[i + 1]

        const distToCurr = Math.hypot(curr.x - prev.x, curr.y - prev.y)

        if (distToCurr < minLen && i + 1 < pts.length - 1) {
          // This segment is short — it's a micro-jog.
          // Absorb by skipping curr and adjusting next to align with prev's axis.
          const distToNext = Math.hypot(next.x - curr.x, next.y - curr.y)
          const distPrevToCurr = distToCurr

          if (distToNext > distPrevToCurr) {
            // Next segment is longer: snap curr onto next's line
            // If the short segment is mostly horizontal, inherit next's x
            // If mostly vertical, inherit next's y
            if (Math.abs(curr.x - prev.x) > Math.abs(curr.y - prev.y)) {
              // Short horizontal jog → snap prev endpoint's x to curr/next's x
              result[result.length - 1] = { x: next.x, y: prev.y }
            } else {
              // Short vertical jog → snap prev endpoint's y to curr/next's y
              result[result.length - 1] = { x: prev.x, y: next.y }
            }
          } else {
            // Prev segment is longer: snap next onto prev's line
            if (Math.abs(curr.x - prev.x) > Math.abs(curr.y - prev.y)) {
              pts[i + 1] = { x: prev.x, y: next.y }
            } else {
              pts[i + 1] = { x: next.x, y: prev.y }
            }
          }
          // Skip the micro-jog point
          changed = true
          i++
          continue
        }

        result.push(curr)
        i++
      }

      // Add remaining points
      while (i < pts.length) {
        result.push(pts[i])
        i++
      }

      pts = result
    }

    // Final pass: remove collinear points
    if (pts.length <= 2) return pts
    const cleaned: { x: number; y: number }[] = [pts[0]]
    for (let i = 1; i < pts.length - 1; i++) {
      const prev = cleaned[cleaned.length - 1]
      const curr = pts[i]
      const next = pts[i + 1]
      // Check if collinear (same direction)
      const dx1 = curr.x - prev.x
      const dy1 = curr.y - prev.y
      const dx2 = next.x - curr.x
      const dy2 = next.y - curr.y
      const cross = dx1 * dy2 - dy1 * dx2
      if (Math.abs(cross) > 0.01) {
        cleaned.push(curr)
      }
    }
    cleaned.push(pts[pts.length - 1])
    return cleaned
  }

  /**
   * Build a filleted centerline: sequence of line segments and arc definitions.
   * Each corner is represented by its arc center, radius, tangent points, and sweep direction.
   */
  private buildFilletedCenterline(
    points: { x: number; y: number }[],
    cornerRadius: number,
  ): CenterlineSegment[] {
    if (points.length < 2) return []
    if (points.length === 2 || cornerRadius < 1) {
      return [{ type: 'line', from: points[0], to: points[points.length - 1] }]
    }

    // Simplify micro-jogs that the layout engine creates
    const merged = this.simplifyMicroJogs(points, cornerRadius * 2)

    const segments: CenterlineSegment[] = []
    let prevEnd = merged[0]

    for (let i = 1; i < merged.length - 1; i++) {
      const prev = merged[i - 1]
      const curr = merged[i]
      const next = merged[i + 1]

      const distPrev = Math.hypot(curr.x - prev.x, curr.y - prev.y)
      const distNext = Math.hypot(next.x - curr.x, next.y - curr.y)

      if (distPrev < 0.01 || distNext < 0.01) {
        continue
      }

      // Direction unit vectors
      const d0x = (curr.x - prev.x) / distPrev
      const d0y = (curr.y - prev.y) / distPrev
      const d1x = (next.x - curr.x) / distNext
      const d1y = (next.y - curr.y) / distNext

      // Cross product determines turn direction (positive = CCW in SVG y-down)
      const cross = d0x * d1y - d0y * d1x

      if (Math.abs(cross) < 0.001) {
        // Collinear, no arc needed
        continue
      }

      // Clamp radius to half the shortest adjacent segment
      const maxRadius = Math.min(distPrev, distNext) / 2
      const R = Math.min(cornerRadius, maxRadius)

      if (R < 1) {
        continue
      }

      // Compute arc center first, then derive tangent points from it.
      // This ensures T0/T1 are exactly on the circle, minimizing floating-point drift.
      //
      // sign: determines which side of the segments the arc center lies on
      // In SVG y-down coords, cross > 0 = clockwise visual turn
      const sign = cross > 0 ? 1 : -1

      // Inward normals (pointing toward arc center) for each segment
      const m0x = -sign * d0y
      const m0y = sign * d0x
      const m1x = -sign * d1y
      const m1y = sign * d1x

      // Center = intersection of two lines, each offset R inward from the segments
      // Line 0: point (curr + R*m0), direction d0
      // Line 1: point (curr + R*m1), direction d1
      // Solve via parametric intersection: (curr + R*m0) + t*d0 = (curr + R*m1) + u*d1
      // => t*d0 - u*d1 = R*(m1 - m0)
      // Using cross product to solve for t:
      const denom = d0x * d1y - d0y * d1x // = cross, already known non-zero
      const diffX = R * (m1x - m0x)
      const diffY = R * (m1y - m0y)
      const t = (diffX * d1y - diffY * d1x) / denom
      const center = {
        x: curr.x + R * m0x + t * d0x,
        y: curr.y + R * m0y + t * d0y,
      }

      // Tangent points: project center back onto each segment (perpendicular drop)
      // T = C - R * inward_normal (since center is R away from segment in normal direction)
      const t0 = { x: center.x - m0x * R, y: center.y - m0y * R }
      const t1 = { x: center.x - m1x * R, y: center.y - m1y * R }

      // sweep-flag: in SVG y-down, cross > 0 = clockwise visual turn = sweep=1
      const sweepFlag = cross > 0 ? 1 : 0

      // Line from previous end to tangent start
      segments.push({ type: 'line', from: prevEnd, to: t0 })
      // Arc segment
      segments.push({ type: 'arc', center, radius: R, t0, t1, sweepFlag })

      prevEnd = t1
    }

    // Final line segment
    const last = merged[merged.length - 1]
    segments.push({ type: 'line', from: prevEnd, to: last })

    return segments
  }

  /**
   * Convert a filleted centerline to an SVG path string, optionally offset for parallel lines.
   * Line segments are shifted by `offset` perpendicular to their direction.
   * Arc segments become concentric arcs with radius R ± offset (same center).
   */
  private centerlineToPath(segments: CenterlineSegment[], offset: number): string {
    if (segments.length === 0) return ''

    const parts: string[] = []
    let first = true

    for (const seg of segments) {
      if (seg.type === 'line') {
        const dx = seg.to.x - seg.from.x
        const dy = seg.to.y - seg.from.y
        const len = Math.hypot(dx, dy)

        let fx = seg.from.x
        let fy = seg.from.y
        let tx = seg.to.x
        let ty = seg.to.y

        if (len > 0.01 && offset !== 0) {
          // Perpendicular unit vector (left normal)
          const nx = -dy / len
          const ny = dx / len
          fx += nx * offset
          fy += ny * offset
          tx += nx * offset
          ty += ny * offset
        }

        if (first) {
          parts.push(`M ${fx} ${fy}`)
          first = false
        }
        parts.push(`L ${tx} ${ty}`)
      } else {
        // Arc segment — concentric offset
        const { center, radius, t0, t1, sweepFlag } = seg

        // Offset radius: inner lines get smaller R, outer get larger
        // The offset sign relative to the arc is determined by sweep direction
        const signFactor = sweepFlag === 1 ? -1 : 1
        const Ro = radius + signFactor * offset

        if (Ro < 0.5) {
          // Radius too small, degenerate to sharp corner
          // Compute offset tangent points by scaling from center
          const scale = Math.max(0.5, Ro) / radius
          const ot1x = center.x + (t1.x - center.x) * scale
          const ot1y = center.y + (t1.y - center.y) * scale
          if (first) {
            const ot0x = center.x + (t0.x - center.x) * scale
            const ot0y = center.y + (t0.y - center.y) * scale
            parts.push(`M ${ot0x} ${ot0y}`)
            first = false
          }
          parts.push(`L ${ot1x} ${ot1y}`)
        } else {
          // Offset tangent points: same angle from center, different radius
          const ot0x = center.x + (t0.x - center.x) * (Ro / radius)
          const ot0y = center.y + (t0.y - center.y) * (Ro / radius)
          const ot1x = center.x + (t1.x - center.x) * (Ro / radius)
          const ot1y = center.y + (t1.y - center.y) * (Ro / radius)

          if (first) {
            parts.push(`M ${ot0x} ${ot0y}`)
            first = false
          }
          // SVG arc: A rx ry x-rotation large-arc-flag sweep-flag x y
          parts.push(`A ${Ro} ${Ro} 0 0 ${sweepFlag} ${ot1x} ${ot1y}`)
        }
      }
    }

    return parts.join(' ')
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
 * Render NetworkGraph to SVG string (sync)
 */
export function render(graph: NetworkGraph, layout: LayoutResult, options?: RenderOptions): string {
  const renderer = new SVGRenderer(options)
  return renderer.render(graph, layout)
}

/**
 * Collect all icon URLs from a NetworkGraph
 */
export function collectIconUrls(graph: NetworkGraph): string[] {
  const urls = new Set<string>()

  for (const node of graph.nodes) {
    if (node.icon) {
      urls.add(node.icon)
    } else if (node.vendor && hasCDNIcons(node.vendor)) {
      const iconKey =
        node.service && node.resource
          ? `${node.service}/${node.resource}`
          : node.service || node.model
      if (iconKey) {
        urls.add(getCDNIconUrl(node.vendor, iconKey))
      }
    }
  }

  if (graph.subgraphs) {
    for (const sg of graph.subgraphs) {
      if (sg.icon) {
        urls.add(sg.icon)
      }
    }
  }

  return Array.from(urls)
}

/**
 * Render NetworkGraph to SVG string (async)
 * Pre-resolves icon dimensions for correct aspect ratios
 * Use this in Node.js environments for CDN icons
 */
export async function renderAsync(
  graph: NetworkGraph,
  layout: LayoutResult,
  options?: RenderOptions,
): Promise<string> {
  const urls = collectIconUrls(graph)
  let iconDimensions = options?.iconDimensions

  if (!iconDimensions && urls.length > 0) {
    iconDimensions = await resolveAllIconDimensions(urls)
  }

  return render(graph, layout, { ...options, iconDimensions })
}
