/**
 * YAML parser for network diagrams
 */

import yaml from 'js-yaml'
import type {
  NetworkGraph,
  Node,
  Link,
  Subgraph,
  GraphSettings,
  CanvasSettings,
  PaperSize,
  PaperOrientation,
  NodeShape,
  LinkType,
  ArrowType,
  ThemeType,
} from '@shumoku/core/models'

// Re-define DeviceType enum locally (same as v2.DeviceType)
enum DeviceType {
  Router = 'router',
  L3Switch = 'l3-switch',
  L2Switch = 'l2-switch',
  Firewall = 'firewall',
  LoadBalancer = 'load-balancer',
  Server = 'server',
  AccessPoint = 'access-point',
  Cloud = 'cloud',
  Internet = 'internet',
  VPN = 'vpn',
  Database = 'database',
  Generic = 'generic',
}

// ============================================
// YAML Input Types
// ============================================

interface YamlNodeStyle {
  fill?: string
  stroke?: string
  strokeWidth?: number
  strokeDasharray?: string
  textColor?: string
  fontSize?: number
  fontWeight?: string
  opacity?: number
}

interface YamlNode {
  id: string
  label: string | string[]
  shape?: string
  type?: string
  parent?: string
  rank?: number | string
  style?: YamlNodeStyle
  metadata?: Record<string, unknown>
  /** Vendor name for vendor-specific icons (e.g., 'aws', 'azure', 'gcp', 'yamaha') */
  vendor?: string
  /** Service name within the vendor (e.g., 'ec2', 'vpc', 'lambda') */
  service?: string
  /** Model name for hardware vendors (e.g., 'rtx3510', 'ex4400') */
  model?: string
  /** Resource type within the service (e.g., 'instance', 'nat-gateway') */
  resource?: string
}

interface YamlLinkStyle {
  stroke?: string
  strokeWidth?: number
  strokeDasharray?: string
  opacity?: number
  minLength?: number
}

interface YamlLinkEndpoint {
  node: string
  port?: string
  ip?: string
}

interface YamlLink {
  id?: string
  from: string | YamlLinkEndpoint
  to: string | YamlLinkEndpoint
  label?: string | string[]
  type?: string
  arrow?: string
  bandwidth?: string
  redundancy?: string
  /** Single VLAN ID or array of VLANs for trunk */
  vlan?: number | number[]
  style?: YamlLinkStyle
}

interface YamlSubgraphStyle {
  fill?: string
  stroke?: string
  strokeWidth?: number
  strokeDasharray?: string
  labelPosition?: string
  labelFontSize?: number
  padding?: number
  nodeSpacing?: number
  rankSpacing?: number
}

interface YamlSubgraph {
  id: string
  label: string
  children?: string[]
  parent?: string
  direction?: string
  style?: YamlSubgraphStyle
  /** Vendor name for vendor-specific icons (e.g., 'aws', 'azure', 'gcp', 'yamaha') */
  vendor?: string
  /** Service name within the vendor (e.g., 'ec2', 'vpc', 'lambda') */
  service?: string
  /** Model name for hardware vendors (e.g., 'rtx3510', 'ex4400') */
  model?: string
  /** Resource type within the service (e.g., 'instance', 'nat-gateway') */
  resource?: string
}

interface YamlCanvasSettings {
  preset?: string
  orientation?: string
  width?: number
  height?: number
  dpi?: number
  fit?: boolean
  padding?: number
}

interface YamlGraphSettings {
  direction?: string
  theme?: string
  nodeSpacing?: number
  rankSpacing?: number
  subgraphPadding?: number
  canvas?: YamlCanvasSettings
  legend?: boolean | {
    enabled?: boolean
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
    showDeviceTypes?: boolean
    showBandwidth?: boolean
    showCableTypes?: boolean
    showVlans?: boolean
  }
}

interface YamlNetworkV2 {
  version?: string
  name?: string
  description?: string
  nodes?: YamlNode[]
  links?: YamlLink[]
  subgraphs?: YamlSubgraph[]
  settings?: YamlGraphSettings
}

// ============================================
// Parser Result Types
// ============================================

export interface ParseWarning {
  code: string
  message: string
  severity: 'warning' | 'error'
  line?: number
}

export interface ParseResult {
  graph: NetworkGraph
  warnings?: ParseWarning[]
}

// ============================================
// Parser Implementation
// ============================================

export class YamlParser {
  parse(input: string): ParseResult {
    const warnings: ParseWarning[] = []

    try {
      const data = yaml.load(input) as YamlNetworkV2

      if (!data || typeof data !== 'object') {
        throw new Error('Invalid YAML: expected object')
      }

      const graph: NetworkGraph = {
        version: data.version || '2.0.0',
        name: data.name,
        description: data.description,
        nodes: this.parseNodes(data.nodes || [], warnings),
        links: this.parseLinks(data.links || [], warnings),
        subgraphs: this.parseSubgraphs(data.subgraphs || [], warnings),
        settings: this.parseSettings(data.settings),
      }

      // Auto-assign nodes to subgraphs based on parent field
      this.assignNodesToSubgraphs(graph)

      return { graph, warnings: warnings.length > 0 ? warnings : undefined }
    } catch (error) {
      warnings.push({
        code: 'PARSE_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        severity: 'error',
      })

      return {
        graph: {
          version: '2.0.0',
          nodes: [],
          links: [],
        },
        warnings,
      }
    }
  }

  private parseNodes(yamlNodes: YamlNode[], warnings: ParseWarning[]): Node[] {
    return yamlNodes.map((n, index) => {
      if (!n.id) {
        warnings.push({
          code: 'MISSING_NODE_ID',
          message: `Node at index ${index} missing id`,
          severity: 'error',
        })
      }

      return {
        id: n.id || `node-${index}`,
        label: n.label || n.id || `Node ${index}`,
        shape: this.parseNodeShape(n.shape),
        type: this.parseDeviceType(n.type),
        parent: n.parent,
        rank: n.rank,
        style: n.style ? {
          fill: n.style.fill,
          stroke: n.style.stroke,
          strokeWidth: n.style.strokeWidth,
          strokeDasharray: n.style.strokeDasharray,
          textColor: n.style.textColor,
          fontSize: n.style.fontSize,
          fontWeight: n.style.fontWeight as 'normal' | 'bold' | undefined,
          opacity: n.style.opacity,
        } : undefined,
        metadata: n.metadata,
        vendor: n.vendor?.toLowerCase(),
        service: n.service?.toLowerCase(),
        model: n.model?.toLowerCase(),
        resource: n.resource?.toLowerCase(),
      }
    })
  }

  private parseLinks(yamlLinks: YamlLink[], _warnings: ParseWarning[]): Link[] {
    return yamlLinks.map((l, index) => ({
      id: l.id || `link-${index}`,
      from: this.parseLinkEndpoint(l.from),
      to: this.parseLinkEndpoint(l.to),
      label: l.label,
      type: this.parseLinkType(l.type),
      arrow: this.parseArrowType(l.arrow),
      bandwidth: this.parseBandwidth(l.bandwidth),
      redundancy: this.parseRedundancyType(l.redundancy),
      vlan: this.parseVlan(l.vlan),
      style: l.style ? {
        stroke: l.style.stroke,
        strokeWidth: l.style.strokeWidth,
        strokeDasharray: l.style.strokeDasharray,
        opacity: l.style.opacity,
        minLength: l.style.minLength,
      } : undefined,
    }))
  }

  private parseVlan(vlan?: number | number[]): number[] | undefined {
    if (vlan === undefined) {
      return undefined
    }
    return Array.isArray(vlan) ? vlan : [vlan]
  }

  private parseLinkEndpoint(endpoint: string | YamlLinkEndpoint): string | { node: string; port?: string; ip?: string } {
    if (typeof endpoint === 'string') {
      return endpoint
    }
    return {
      node: endpoint.node,
      port: endpoint.port,
      ip: endpoint.ip,
    }
  }

  private parseRedundancyType(redundancy?: string): 'ha' | 'vc' | 'vss' | 'vpc' | 'mlag' | 'stack' | undefined {
    if (!redundancy) return undefined

    const typeMap: Record<string, 'ha' | 'vc' | 'vss' | 'vpc' | 'mlag' | 'stack'> = {
      ha: 'ha',
      vrrp: 'ha',
      hsrp: 'ha',
      glbp: 'ha',
      keepalive: 'ha',
      vc: 'vc',
      'virtual-chassis': 'vc',
      vss: 'vss',
      vpc: 'vpc',
      mlag: 'mlag',
      mclag: 'mlag',
      stack: 'stack',
      stacking: 'stack',
      irf: 'stack',
    }

    return typeMap[redundancy.toLowerCase()]
  }

  private parseBandwidth(bandwidth?: string): '1G' | '10G' | '25G' | '40G' | '100G' | undefined {
    if (!bandwidth) return undefined

    const normalized = bandwidth.toUpperCase().replace(/\s/g, '')
    const bandwidthMap: Record<string, '1G' | '10G' | '25G' | '40G' | '100G'> = {
      '1G': '1G',
      '1GBE': '1G',
      '1GBIT': '1G',
      '10G': '10G',
      '10GBE': '10G',
      '10GBIT': '10G',
      '25G': '25G',
      '25GBE': '25G',
      '25GBIT': '25G',
      '40G': '40G',
      '40GBE': '40G',
      '40GBIT': '40G',
      '100G': '100G',
      '100GBE': '100G',
      '100GBIT': '100G',
    }

    return bandwidthMap[normalized]
  }

  private parseSubgraphs(yamlSubgraphs: YamlSubgraph[], warnings: ParseWarning[]): Subgraph[] {
    return yamlSubgraphs.map((s, index) => {
      if (!s.id) {
        warnings.push({
          code: 'MISSING_SUBGRAPH_ID',
          message: `Subgraph at index ${index} missing id`,
          severity: 'error',
        })
      }

      return {
        id: s.id || `subgraph-${index}`,
        label: s.label || s.id || `Subgraph ${index}`,
        children: s.children || [],
        parent: s.parent,
        direction: this.parseDirection(s.direction),
        style: s.style ? {
          fill: s.style.fill,
          stroke: s.style.stroke,
          strokeWidth: s.style.strokeWidth,
          strokeDasharray: s.style.strokeDasharray,
          labelPosition: s.style.labelPosition as 'top' | 'bottom' | 'left' | 'right' | undefined,
          labelFontSize: s.style.labelFontSize,
          padding: s.style.padding,
          nodeSpacing: s.style.nodeSpacing,
          rankSpacing: s.style.rankSpacing,
        } : undefined,
        vendor: s.vendor?.toLowerCase(),
        service: s.service?.toLowerCase(),
        model: s.model?.toLowerCase(),
        resource: s.resource?.toLowerCase(),
      }
    })
  }

  private parseSettings(settings?: YamlGraphSettings): GraphSettings | undefined {
    if (!settings) return undefined

    return {
      direction: this.parseDirection(settings.direction),
      theme: this.parseTheme(settings.theme),
      nodeSpacing: settings.nodeSpacing,
      rankSpacing: settings.rankSpacing,
      subgraphPadding: settings.subgraphPadding,
      canvas: this.parseCanvasSettings(settings.canvas),
      legend: settings.legend,
    }
  }

  private parseTheme(theme?: string): ThemeType | undefined {
    if (!theme) return undefined
    const normalized = theme.toLowerCase()
    if (normalized === 'light' || normalized === 'dark') {
      return normalized
    }
    // Default to light for unknown values (backwards compatibility with 'modern')
    return 'light'
  }

  private parseCanvasSettings(canvas?: YamlCanvasSettings): CanvasSettings | undefined {
    if (!canvas) return undefined

    const result: CanvasSettings = {}

    // Parse preset (paper size)
    if (canvas.preset) {
      const preset = this.parsePaperSize(canvas.preset)
      if (preset) {
        result.preset = preset
      }
    }

    // Parse orientation
    if (canvas.orientation) {
      const orientation = this.parsePaperOrientation(canvas.orientation)
      if (orientation) {
        result.orientation = orientation
      }
    }

    // Parse custom dimensions
    if (canvas.width !== undefined) result.width = canvas.width
    if (canvas.height !== undefined) result.height = canvas.height
    if (canvas.dpi !== undefined) result.dpi = canvas.dpi
    if (canvas.fit !== undefined) result.fit = canvas.fit
    if (canvas.padding !== undefined) result.padding = canvas.padding

    return Object.keys(result).length > 0 ? result : undefined
  }

  private parsePaperSize(size?: string): PaperSize | undefined {
    if (!size) return undefined
    const normalized = size.toUpperCase()
    const validSizes: PaperSize[] = ['A0', 'A1', 'A2', 'A3', 'A4', 'B0', 'B1', 'B2', 'B3', 'B4', 'letter', 'legal', 'tabloid']

    // Handle case-insensitive matching
    const found = validSizes.find(s => s.toUpperCase() === normalized)
    return found
  }

  private parsePaperOrientation(orientation?: string): PaperOrientation | undefined {
    if (!orientation) return undefined
    const normalized = orientation.toLowerCase()
    if (normalized === 'portrait' || normalized === 'p') return 'portrait'
    if (normalized === 'landscape' || normalized === 'l') return 'landscape'
    return undefined
  }

  private parseNodeShape(shape?: string): NodeShape {
    const shapeMap: Record<string, NodeShape> = {
      rect: 'rect',
      rectangle: 'rect',
      rounded: 'rounded',
      round: 'rounded',
      circle: 'circle',
      diamond: 'diamond',
      rhombus: 'diamond',
      hexagon: 'hexagon',
      cylinder: 'cylinder',
      database: 'cylinder',
      stadium: 'stadium',
      pill: 'stadium',
      trapezoid: 'trapezoid',
    }

    return shapeMap[shape?.toLowerCase() || ''] || 'rounded'
  }

  private parseDeviceType(type?: string): DeviceType | undefined {
    if (!type) return undefined

    const typeMap: Record<string, DeviceType> = {
      router: DeviceType.Router,
      'l3-switch': DeviceType.L3Switch,
      'l2-switch': DeviceType.L2Switch,
      switch: DeviceType.L2Switch,
      firewall: DeviceType.Firewall,
      'load-balancer': DeviceType.LoadBalancer,
      lb: DeviceType.LoadBalancer,
      server: DeviceType.Server,
      'access-point': DeviceType.AccessPoint,
      ap: DeviceType.AccessPoint,
      cloud: DeviceType.Cloud,
      internet: DeviceType.Internet,
      vpn: DeviceType.VPN,
      database: DeviceType.Database,
      db: DeviceType.Database,
    }

    return typeMap[type.toLowerCase()] || DeviceType.Generic
  }

  private parseLinkType(type?: string): LinkType {
    const typeMap: Record<string, LinkType> = {
      solid: 'solid',
      dashed: 'dashed',
      dotted: 'dashed',
      thick: 'thick',
      double: 'double',
      invisible: 'invisible',
      hidden: 'invisible',
    }

    return typeMap[type?.toLowerCase() || ''] || 'solid'
  }

  private parseArrowType(arrow?: string): ArrowType | undefined {
    if (!arrow) return undefined  // Let renderer decide based on redundancy

    const arrowMap: Record<string, ArrowType> = {
      none: 'none',
      forward: 'forward',
      '->': 'forward',
      back: 'back',
      '<-': 'back',
      both: 'both',
      '<->': 'both',
    }

    return arrowMap[arrow.toLowerCase()] || 'forward'
  }

  private parseDirection(direction?: string): 'TB' | 'BT' | 'LR' | 'RL' | undefined {
    const dirMap: Record<string, 'TB' | 'BT' | 'LR' | 'RL'> = {
      tb: 'TB',
      bt: 'BT',
      lr: 'LR',
      rl: 'RL',
      'top-bottom': 'TB',
      'bottom-top': 'BT',
      'left-right': 'LR',
      'right-left': 'RL',
    }

    return dirMap[direction?.toLowerCase() || '']
  }

  /**
   * Update children arrays for nested subgraphs based on subgraph.parent field
   */
  private assignNodesToSubgraphs(graph: NetworkGraph): void {
    if (!graph.subgraphs) return

    const subgraphMap = new Map<string, Subgraph>(
      graph.subgraphs.map((s: Subgraph) => [s.id, s])
    )

    // Update children arrays for nested subgraphs
    for (const subgraph of graph.subgraphs) {
      if (subgraph.parent) {
        const parent = subgraphMap.get(subgraph.parent)
        if (parent) {
          if (!parent.children) {
            parent.children = []
          }
          if (!parent.children.includes(subgraph.id)) {
            parent.children.push(subgraph.id)
          }
        }
      }
    }
  }
}

// Default instance
export const parser = new YamlParser()
