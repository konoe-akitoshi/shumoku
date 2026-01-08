/**
 * YAML parser v2 for Mermaid-like network diagrams
 */

import yaml from 'js-yaml'
import { v2 } from '@shumoku/core/models'

type NetworkGraphV2 = v2.NetworkGraphV2
type Node = v2.Node
type Link = v2.Link
type Subgraph = v2.Subgraph
type GraphSettings = v2.GraphSettings
type NodeShape = v2.NodeShape
type LinkType = v2.LinkType
type ArrowType = v2.ArrowType

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
  vlan_id?: number
}

interface YamlLink {
  id?: string
  from: string | YamlLinkEndpoint
  to: string | YamlLinkEndpoint
  label?: string | string[]
  type?: string
  arrow?: string
  redundancy?: string
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
  nodes?: string[]
  children?: string[]
  parent?: string
  direction?: string
  style?: YamlSubgraphStyle
}

interface YamlGraphSettings {
  direction?: string
  theme?: string
  nodeSpacing?: number
  rankSpacing?: number
  subgraphPadding?: number
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

export interface ParseResultV2 {
  graph: NetworkGraphV2
  warnings?: ParseWarning[]
}

// ============================================
// Parser Implementation
// ============================================

export class YamlParserV2 {
  parse(input: string): ParseResultV2 {
    const warnings: ParseWarning[] = []

    try {
      const data = yaml.load(input) as YamlNetworkV2

      if (!data || typeof data !== 'object') {
        throw new Error('Invalid YAML: expected object')
      }

      const graph: NetworkGraphV2 = {
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
      redundancy: this.parseRedundancyType(l.redundancy),
      style: l.style ? {
        stroke: l.style.stroke,
        strokeWidth: l.style.strokeWidth,
        strokeDasharray: l.style.strokeDasharray,
        opacity: l.style.opacity,
        minLength: l.style.minLength,
      } : undefined,
    }))
  }

  private parseLinkEndpoint(endpoint: string | YamlLinkEndpoint): string | { node: string; port?: string; ip?: string; vlan_id?: number } {
    if (typeof endpoint === 'string') {
      return endpoint
    }
    return {
      node: endpoint.node,
      port: endpoint.port,
      ip: endpoint.ip,
      vlan_id: endpoint.vlan_id,
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
        nodes: s.nodes || [],
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
      }
    })
  }

  private parseSettings(settings?: YamlGraphSettings): GraphSettings | undefined {
    if (!settings) return undefined

    return {
      direction: this.parseDirection(settings.direction),
      theme: settings.theme,
      nodeSpacing: settings.nodeSpacing,
      rankSpacing: settings.rankSpacing,
      subgraphPadding: settings.subgraphPadding,
    }
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
   * Auto-assign nodes to subgraphs based on node.parent field
   */
  private assignNodesToSubgraphs(graph: NetworkGraphV2): void {
    if (!graph.subgraphs) return

    const subgraphMap = new Map<string, Subgraph>(
      graph.subgraphs.map((s: Subgraph) => [s.id, s])
    )

    for (const node of graph.nodes) {
      if (node.parent) {
        const subgraph = subgraphMap.get(node.parent)
        if (subgraph) {
          if (!subgraph.nodes) {
            subgraph.nodes = []
          }
          if (!subgraph.nodes.includes(node.id)) {
            subgraph.nodes.push(node.id)
          }
        }
      }
    }

    // Also update children arrays for nested subgraphs
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

// Default export
export const parserV2 = new YamlParserV2()
