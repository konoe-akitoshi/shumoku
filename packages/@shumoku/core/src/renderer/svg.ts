/**
 * SVG Renderer for network diagrams
 */

import type { NetworkGraph } from '../models'
import type { LayoutResult } from '../layout'
import type { Theme } from '../themes'

export interface SVGRendererOptions {
  width?: number
  height?: number
  padding?: number
  embedStyles?: boolean
}

export class SVGRenderer {
  private theme: Theme
  private options: SVGRendererOptions

  constructor(theme: Theme, options: SVGRendererOptions = {}) {
    this.theme = theme
    this.options = {
      width: 1920,
      height: 1080,
      padding: 50,
      embedStyles: true,
      ...options,
    }
  }

  /**
   * Render network graph to SVG string
   */
  render(network: NetworkGraph, layout: LayoutResult): string {
    const { padding = 50 } = this.options
    const viewBox = `${layout.bounds.x - padding} ${layout.bounds.y - padding} ${layout.bounds.width + padding * 2} ${layout.bounds.height + padding * 2}`

    const svg = this.createSVGElement(viewBox)
    const defs = this.createDefs()
    const background = this.createBackground(layout.bounds, padding)

    // Render layers
    const modulesGroup = this.renderModules(layout)
    const edgesGroup = this.renderEdges(network, layout)
    const nodesGroup = this.renderNodes(network, layout)

    // Compose SVG
    return `${svg}
${defs}
${background}
${modulesGroup}
${edgesGroup}
${nodesGroup}
</svg>`
  }

  private createSVGElement(viewBox: string): string {
    const { width, height } = this.options
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="${viewBox}" 
     xmlns="http://www.w3.org/2000/svg" version="1.1">`
  }

  private createDefs(): string {
    if (!this.options.embedStyles) return ''

    return `  <defs>
    <style type="text/css">
      <![CDATA[
        .node-label { 
          font-family: Arial, sans-serif; 
          font-size: 14px; 
          fill: ${this.theme.colors.text};
          text-anchor: middle;
          dominant-baseline: central;
        }
        .node-sublabel { 
          font-family: Consolas, monospace; 
          font-size: 12px; 
          fill: ${this.theme.colors.textSecondary};
          text-anchor: middle;
          dominant-baseline: central;
        }
        .edge-label {
          font-family: Consolas, monospace; 
          font-size: 12px; 
          fill: ${this.theme.colors.text};
          font-weight: bold;
          text-anchor: middle;
          dominant-baseline: central;
        }
        .port-label {
          font-family: Consolas, monospace; 
          font-size: 10px; 
          fill: ${this.theme.colors.textSecondary};
          text-anchor: middle;
          dominant-baseline: central;
        }
        .module-label {
          font-family: Arial, sans-serif;
          font-size: 16px;
          font-weight: 600;
          fill: ${this.theme.colors.text};
        }
      ]]>
    </style>
    <!-- Arrow markers for directed edges -->
    <marker id="arrowhead" markerWidth="10" markerHeight="7" 
            refX="10" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="${this.theme.colors.link}" />
    </marker>
  </defs>`
  }

  private createBackground(bounds: LayoutResult['bounds'], padding: number): string {
    return `  <rect x="${bounds.x - padding}" y="${bounds.y - padding}" 
        width="${bounds.width + padding * 2}" height="${bounds.height + padding * 2}" 
        fill="${this.theme.colors.background}" />`
  }

  private renderModules(layout: LayoutResult): string {
    if (!layout.modules || layout.modules.size === 0) return ''

    let svg = '  <g id="modules" opacity="0.8">\n'

    layout.modules.forEach((module, id) => {
      if (!module.bounds) return

      const { x, y, width, height } = module.bounds
      const padding = 20

      svg += `    <g id="module-${this.escapeXML(id)}">
      <rect x="${x - padding}" y="${y - padding}" 
            width="${width + padding * 2}" height="${height + padding * 2}"
            fill="${this.theme.colors.surface}" fill-opacity="0.5"
            stroke="${this.theme.colors.grid}" stroke-width="2"
            rx="${this.theme.dimensions.radius.medium}" />
      <text x="${x}" y="${y - 30}" class="module-label">
        ${this.escapeXML(module.data?.name || id)}
      </text>
    </g>\n`
    })

    svg += '  </g>\n'
    return svg
  }

  private renderEdges(network: NetworkGraph, layout: LayoutResult): string {
    let svg = '  <g id="edges">\n'

    layout.edges.forEach((edge, id) => {
      const link = network.links.find((l) => l.id === id)
      if (!link) return

      const sourceNode = layout.nodes.get(edge.source)
      const targetNode = layout.nodes.get(edge.target)
      if (!sourceNode || !targetNode) return

      // Determine line width based on bandwidth
      let strokeWidth = 2
      if (link.bandwidth) {
        if (link.bandwidth.includes('40G')) strokeWidth = 5
        else if (link.bandwidth.includes('10G')) strokeWidth = 4
        else if (link.bandwidth.includes('1G')) strokeWidth = 3
      }

      // Draw edge path
      if (edge.points && edge.points.length > 0) {
        // Use provided routing points
        svg += `    <polyline points="${edge.points.map((p) => `${p.x},${p.y}`).join(' ')}"
              fill="none" stroke="${this.theme.colors.link}" 
              stroke-width="${strokeWidth}" opacity="0.8" />\n`
      } else {
        // Simple line
        svg += `    <line x1="${sourceNode.position.x}" y1="${sourceNode.position.y}" 
              x2="${targetNode.position.x}" y2="${targetNode.position.y}"
              stroke="${this.theme.colors.link}" stroke-width="${strokeWidth}" 
              opacity="0.8" />\n`
      }

      // Edge labels
      if (link.bandwidth) {
        const midX = (sourceNode.position.x + targetNode.position.x) / 2
        const midY = (sourceNode.position.y + targetNode.position.y) / 2

        svg += `    <g>
      <rect x="${midX - 25}" y="${midY - 10}" width="50" height="20" 
            fill="${this.theme.colors.background}" fill-opacity="0.9" rx="4" />
      <text x="${midX}" y="${midY}" class="edge-label">
        ${this.escapeXML(link.bandwidth)}
      </text>
    </g>\n`
      }

      // Port labels
      if (link.source.portId) {
        svg += `    <text x="${sourceNode.position.x}" y="${sourceNode.position.y + sourceNode.size.height / 2 + 15}" 
          class="port-label">${this.escapeXML(link.source.portId)}</text>\n`
      }

      if (link.target.portId) {
        svg += `    <text x="${targetNode.position.x}" y="${targetNode.position.y - targetNode.size.height / 2 - 15}" 
          class="port-label">${this.escapeXML(link.target.portId)}</text>\n`
      }
    })

    svg += '  </g>\n'
    return svg
  }

  private renderNodes(network: NetworkGraph, layout: LayoutResult): string {
    let svg = '  <g id="nodes">\n'

    layout.nodes.forEach((node, id) => {
      const device = network.devices.find((d) => d.id === id)
      if (!device) return

      const { position, size } = node
      const deviceColor = this.theme.colors.devices[device.type] || this.theme.colors.primary

      // Determine shape based on device type
      const shape = this.getDeviceShape(device.type)

      svg += `    <g id="node-${this.escapeXML(id)}">\n`

      // Draw device shape
      if (shape === 'rect') {
        svg += `      <rect x="${position.x - size.width / 2}" y="${position.y - size.height / 2}" 
            width="${size.width}" height="${size.height}"
            fill="${deviceColor}" stroke="${this.theme.colors.grid}" 
            stroke-width="2" rx="${this.theme.dimensions.radius.small}" />\n`
      } else if (shape === 'circle') {
        const radius = Math.min(size.width, size.height) / 2
        svg += `      <circle cx="${position.x}" cy="${position.y}" r="${radius}"
            fill="${deviceColor}" stroke="${this.theme.colors.grid}" 
            stroke-width="2" />\n`
      }

      // Device name
      svg += `      <text x="${position.x}" y="${position.y}" class="node-label">
        ${this.escapeXML(device.name)}
      </text>\n`

      // IP address
      if (device.metadata?.ip) {
        svg += `      <text x="${position.x}" y="${position.y + 20}" class="node-sublabel">
        ${this.escapeXML(String(device.metadata.ip))}
      </text>\n`
      }

      // VLAN info
      if (device.metadata?.vlan) {
        svg += `      <text x="${position.x}" y="${position.y + 35}" class="node-sublabel">
        VLAN: ${this.escapeXML(String(device.metadata.vlan))}
      </text>\n`
      }

      svg += '    </g>\n'
    })

    svg += '  </g>\n'
    return svg
  }

  private getDeviceShape(type: string): 'rect' | 'circle' {
    switch (type) {
      case 'router':
      case 'firewall':
      case 'l3-switch':
      case 'l2-switch':
        return 'rect'
      case 'server':
      case 'vm':
      case 'cloud':
        return 'circle'
      default:
        return 'rect'
    }
  }

  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }
}

/**
 * Export network to SVG
 */
export function exportNetworkToSVG(
  network: NetworkGraph,
  layout: LayoutResult,
  theme: Theme,
  options?: SVGRendererOptions,
): string {
  const renderer = new SVGRenderer(theme, options)
  return renderer.render(network, layout)
}

/**
 * Download SVG as file
 */
export function downloadNetworkAsSVG(
  network: NetworkGraph,
  layout: LayoutResult,
  theme: Theme,
  filename = 'network-diagram.svg',
  options?: SVGRendererOptions,
): void {
  const svg = exportNetworkToSVG(network, layout, theme, options)
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
