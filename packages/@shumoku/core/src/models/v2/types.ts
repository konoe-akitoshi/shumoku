/**
 * Shumoku v2 Data Models
 * Mermaid-like network diagram support
 */

// ============================================
// Node Types
// ============================================

export type NodeShape =
  | 'rect'      // Rectangle [text]
  | 'rounded'   // Rounded rectangle (text)
  | 'circle'    // Circle ((text))
  | 'diamond'   // Diamond {text}
  | 'hexagon'   // Hexagon {{text}}
  | 'cylinder'  // Database cylinder [(text)]
  | 'stadium'   // Stadium/pill shape ([text])
  | 'trapezoid' // Trapezoid [/text/]

export interface NodeStyle {
  fill?: string
  stroke?: string
  strokeWidth?: number
  strokeDasharray?: string
  textColor?: string
  fontSize?: number
  fontWeight?: 'normal' | 'bold'
  opacity?: number
}

export interface Node {
  id: string

  /**
   * Display label - can be single line or multiple lines
   * Supports basic HTML: <b>, <i>, <br/>
   */
  label: string | string[]

  /**
   * Node shape
   */
  shape: NodeShape

  /**
   * Device type (for default styling/icons)
   */
  type?: DeviceType

  /**
   * Parent subgraph ID
   */
  parent?: string

  /**
   * Rank/layer for horizontal alignment
   * Nodes with the same rank value will be placed on the same horizontal level
   */
  rank?: number | string

  /**
   * Custom style
   */
  style?: NodeStyle

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>
}

// ============================================
// Link Types
// ============================================

export type LinkType =
  | 'solid'     // Normal line -->
  | 'dashed'    // Dashed line -.->
  | 'thick'     // Thick line ==>
  | 'double'    // Double line o==o
  | 'invisible' // No line (for layout only)

export type ArrowType =
  | 'none'      // No arrow ---
  | 'forward'   // Arrow at target -->
  | 'back'      // Arrow at source <--
  | 'both'      // Arrows at both <-->

export interface LinkStyle {
  stroke?: string
  strokeWidth?: number
  strokeDasharray?: string
  opacity?: number
  /** Minimum length for this link (controls node spacing for HA pairs) */
  minLength?: number
}

/**
 * Link endpoint with optional port/IP details
 */
export interface LinkEndpoint {
  node: string
  port?: string
  ip?: string      // e.g., "10.57.0.1/30"
  vlan_id?: number
}

export interface Link {
  id?: string

  /**
   * Source endpoint - can be simple node ID or detailed endpoint
   */
  from: string | LinkEndpoint

  /**
   * Target endpoint - can be simple node ID or detailed endpoint
   */
  to: string | LinkEndpoint

  /**
   * Link label - can be multiple lines (displayed at center)
   */
  label?: string | string[]

  /**
   * Link type
   */
  type?: LinkType

  /**
   * Arrow direction
   */
  arrow?: ArrowType

  /**
   * Redundancy/clustering type - nodes connected with this will be placed on the same layer
   * ha: High Availability (VRRP, HSRP, GLBP, keepalive)
   * vc: Virtual Chassis (Juniper)
   * vss: Virtual Switching System (Cisco)
   * vpc: Virtual Port Channel (Cisco Nexus)
   * mlag: Multi-Chassis Link Aggregation
   * stack: Stacking
   */
  redundancy?: 'ha' | 'vc' | 'vss' | 'vpc' | 'mlag' | 'stack'

  /**
   * Custom style
   */
  style?: LinkStyle
}

/**
 * Helper to get node ID from endpoint
 */
export function getNodeId(endpoint: string | LinkEndpoint): string {
  return typeof endpoint === 'string' ? endpoint : endpoint.node
}

// ============================================
// Subgraph Types
// ============================================

export type LayoutDirection = 'TB' | 'BT' | 'LR' | 'RL'

export interface SubgraphStyle {
  fill?: string
  stroke?: string
  strokeWidth?: number
  strokeDasharray?: string
  labelPosition?: 'top' | 'bottom' | 'left' | 'right'
  labelFontSize?: number
  /** Padding inside this subgraph (like CSS padding) */
  padding?: number
  /** Horizontal spacing between nodes in this subgraph */
  nodeSpacing?: number
  /** Vertical spacing between layers in this subgraph */
  rankSpacing?: number
}

export interface Subgraph {
  id: string

  /**
   * Display label
   */
  label: string

  /**
   * Direct child node IDs
   */
  nodes?: string[]

  /**
   * Child subgraph IDs
   */
  children?: string[]

  /**
   * Parent subgraph ID (for nested subgraphs)
   */
  parent?: string

  /**
   * Layout direction within this subgraph
   */
  direction?: LayoutDirection

  /**
   * Custom style
   */
  style?: SubgraphStyle
}

// ============================================
// Graph Types
// ============================================

export interface GraphSettings {
  /**
   * Default layout direction
   */
  direction?: LayoutDirection

  /**
   * Theme name
   */
  theme?: string

  /**
   * Node spacing
   */
  nodeSpacing?: number

  /**
   * Rank spacing (between layers)
   */
  rankSpacing?: number

  /**
   * Subgraph padding
   */
  subgraphPadding?: number
}

export interface NetworkGraphV2 {
  version: string
  name?: string
  description?: string

  /**
   * All nodes (flat list)
   */
  nodes: Node[]

  /**
   * All links
   */
  links: Link[]

  /**
   * Subgraph definitions
   */
  subgraphs?: Subgraph[]

  /**
   * Global settings
   */
  settings?: GraphSettings
}

// ============================================
// Device Types (for default styling)
// ============================================

export enum DeviceType {
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
// Layout Result Types
// ============================================

export interface Position {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export interface LayoutNode {
  id: string
  position: Position
  size: Size
  node: Node
}

export interface LayoutLink {
  id: string
  from: string          // Node ID
  to: string            // Node ID
  fromEndpoint: LinkEndpoint  // Full endpoint info
  toEndpoint: LinkEndpoint    // Full endpoint info
  points: Position[]
  link: Link
}

export interface LayoutSubgraph {
  id: string
  bounds: Bounds
  subgraph: Subgraph
}

export interface LayoutResult {
  nodes: Map<string, LayoutNode>
  links: Map<string, LayoutLink>
  subgraphs: Map<string, LayoutSubgraph>
  bounds: Bounds
  metadata?: {
    algorithm: string
    duration: number
  }
}
