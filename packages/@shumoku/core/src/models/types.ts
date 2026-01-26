/**
 * Shumoku Data Models
 * Network diagram support with Mermaid-like syntax
 */

// ============================================
// Icon Dimensions
// ============================================

/** Icon dimensions for aspect ratio calculation */
export interface IconDimensions {
  width: number
  height: number
}

// ============================================
// Node Types
// ============================================

export type NodeShape =
  | 'rect' // Rectangle [text]
  | 'rounded' // Rounded rectangle (text)
  | 'circle' // Circle ((text))
  | 'diamond' // Diamond {text}
  | 'hexagon' // Hexagon {{text}}
  | 'cylinder' // Database cylinder [(text)]
  | 'stadium' // Stadium/pill shape ([text])
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

  /**
   * Vendor name for vendor-specific icons (e.g., 'aws', 'azure', 'gcp', 'yamaha')
   */
  vendor?: string

  /**
   * Service name within the vendor (e.g., 'ec2', 'vpc', 'lambda')
   * Used for cloud providers like AWS
   */
  service?: string

  /**
   * Model name for hardware vendors (e.g., 'rtx3510', 'ex4400')
   * Alternative to service for equipment vendors
   */
  model?: string

  /**
   * Resource type within the service (e.g., 'instance', 'nat-gateway')
   */
  resource?: string

  /**
   * Custom icon URL (overrides vendor/type icons)
   * Supports any image URL (PNG, SVG, etc.)
   */
  icon?: string
}

// ============================================
// Link Types
// ============================================

export type LinkType =
  | 'solid' // Normal line -->
  | 'dashed' // Dashed line -.->
  | 'thick' // Thick line ==>
  | 'double' // Double line o==o
  | 'invisible' // No line (for layout only)

/**
 * Edge routing style for diagram links
 * Controls how edges are routed between nodes
 */
export type EdgeStyle =
  | 'polyline' // Straight line segments connected at angles
  | 'orthogonal' // Only horizontal and vertical segments (default)
  | 'splines' // Smooth curved lines using cubic splines
  | 'straight' // Direct line from source to target (ignores bend points)

/**
 * Spline routing mode (only used when edgeStyle is 'splines')
 * Controls the trade-off between curve smoothness and node avoidance
 */
export type SplineMode =
  | 'sloppy' // Fewer control points, curvier routes, may overlap nodes (default)
  | 'conservative' // Properly routes around nodes but feels more orthogonal
  | 'conservative_soft' // Relaxed version of conservative

export type ArrowType =
  | 'none' // No arrow ---
  | 'forward' // Arrow at target -->
  | 'back' // Arrow at source <--
  | 'both' // Arrows at both <-->

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
  ip?: string // e.g., "10.57.0.1/30"
  /**
   * Pin reference for hierarchical connections (e.g., "subgraph-id:pin-id")
   * When set, this endpoint connects to a subgraph's boundary pin
   */
  pin?: string
}

/**
 * Link bandwidth/speed type
 * Controls line thickness for visual distinction
 */
export type LinkBandwidth = '1G' | '10G' | '25G' | '40G' | '100G'

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
   * Bandwidth/speed - affects line thickness
   * 1G: thin, 10G: normal, 25G: medium, 40G: thick, 100G: extra thick
   */
  bandwidth?: LinkBandwidth

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
   * VLANs carried on this link
   * Single VLAN for access ports, multiple for trunk ports
   */
  vlan?: number[]

  /**
   * Custom style
   */
  style?: LinkStyle

  /**
   * Custom metadata for extensions
   */
  metadata?: Record<string, unknown>
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
  /**
   * Fill color - can be a hex color or a surface token (e.g., "surface-1", "accent-blue")
   * Surface tokens are resolved to actual colors based on the current theme
   */
  fill?: string
  /**
   * Stroke color - can be a hex color or a surface token
   * If using a surface token, the stroke color from that token is used
   */
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

/**
 * Pin for hierarchical boundary connections (KiCad-style sheet pins)
 * Maps internal device:port to external connection point
 */
export interface Pin {
  /**
   * Unique identifier for the pin
   */
  id: string

  /**
   * Display label for the pin (e.g., "Office接続")
   */
  label?: string

  /**
   * Internal device reference (which device this pin connects to)
   */
  device?: string

  /**
   * Internal port reference (which port on the device)
   */
  port?: string

  /**
   * Direction hint for layout (incoming/outgoing)
   */
  direction?: 'in' | 'out' | 'bidirectional'

  /**
   * Visual position on the subgraph boundary
   */
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export interface Subgraph {
  id: string

  /**
   * Display label
   */
  label: string

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

  /**
   * Vendor name for vendor-specific icons (e.g., 'aws', 'azure', 'gcp', 'yamaha')
   */
  vendor?: string

  /**
   * Service name within the vendor (e.g., 'ec2', 'vpc', 'lambda')
   * Used for cloud providers like AWS
   */
  service?: string

  /**
   * Model name for hardware vendors (e.g., 'rtx3510', 'ex4400')
   * Alternative to service for equipment vendors
   */
  model?: string

  /**
   * Resource type within the service (e.g., 'instance', 'nat-gateway')
   */
  resource?: string

  /**
   * Custom icon URL (overrides vendor/type icons)
   * Supports any image URL (PNG, SVG, etc.)
   */
  icon?: string

  /**
   * File reference for external sheet definition (KiCad-style hierarchy)
   */
  file?: string

  /**
   * Pins for boundary connections (hierarchical sheets)
   * Defines connection points between this subgraph and parent/siblings
   */
  pins?: Pin[]
}

// ============================================
// Canvas/Sheet Size Types
// ============================================

/**
 * Standard paper size presets
 */
export type PaperSize =
  | 'A0'
  | 'A1'
  | 'A2'
  | 'A3'
  | 'A4'
  | 'B0'
  | 'B1'
  | 'B2'
  | 'B3'
  | 'B4'
  | 'letter'
  | 'legal'
  | 'tabloid'

/**
 * Paper orientation
 */
export type PaperOrientation = 'portrait' | 'landscape'

/**
 * Paper size dimensions in mm
 */
export const PAPER_SIZES: Record<PaperSize, { width: number; height: number }> = {
  A0: { width: 841, height: 1189 },
  A1: { width: 594, height: 841 },
  A2: { width: 420, height: 594 },
  A3: { width: 297, height: 420 },
  A4: { width: 210, height: 297 },
  B0: { width: 1000, height: 1414 },
  B1: { width: 707, height: 1000 },
  B2: { width: 500, height: 707 },
  B3: { width: 353, height: 500 },
  B4: { width: 250, height: 353 },
  letter: { width: 216, height: 279 },
  legal: { width: 216, height: 356 },
  tabloid: { width: 279, height: 432 },
}

/**
 * Canvas/sheet size settings
 */
export interface CanvasSettings {
  /**
   * Paper size preset (A0, A1, A2, A3, A4, etc.)
   */
  preset?: PaperSize

  /**
   * Paper orientation (portrait or landscape)
   * Only used with preset
   */
  orientation?: PaperOrientation

  /**
   * Custom width in pixels
   * Takes precedence over preset
   */
  width?: number

  /**
   * Custom height in pixels
   * Takes precedence over preset
   */
  height?: number

  /**
   * DPI for print output (default: 96 for screen, 300 for print)
   */
  dpi?: number

  /**
   * Fit content to canvas with padding
   * If true, scales content to fit within canvas
   */
  fit?: boolean

  /**
   * Padding around content when fit is true (in pixels)
   */
  padding?: number
}

/**
 * Convert paper size to pixels at given DPI
 */
export function paperSizeToPixels(
  size: PaperSize,
  orientation: PaperOrientation = 'portrait',
  dpi = 96,
): { width: number; height: number } {
  const dimensions = PAPER_SIZES[size]
  const mmToInch = 1 / 25.4

  let width = Math.round(dimensions.width * mmToInch * dpi)
  let height = Math.round(dimensions.height * mmToInch * dpi)

  if (orientation === 'landscape') {
    ;[width, height] = [height, width]
  }

  return { width, height }
}

// ============================================
// Graph Types
// ============================================

/**
 * Theme type for diagram appearance
 */
export type ThemeType = 'light' | 'dark'

export interface LegendSettings {
  /**
   * Show legend in the diagram
   */
  enabled?: boolean

  /**
   * Legend position
   */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

  /**
   * Show device type icons
   */
  showDeviceTypes?: boolean

  /**
   * Show bandwidth indicators
   */
  showBandwidth?: boolean

  /**
   * Show cable/link types
   */
  showCableTypes?: boolean

  /**
   * Show VLAN colors
   */
  showVlans?: boolean
}

export interface GraphSettings {
  /**
   * Default layout direction
   */
  direction?: LayoutDirection

  /**
   * Theme for diagram appearance (light or dark)
   */
  theme?: ThemeType

  /**
   * Edge routing style
   * - 'polyline': Straight line segments connected at angles
   * - 'orthogonal': Only horizontal and vertical segments (default)
   * - 'splines': Smooth curved lines using cubic splines
   * - 'straight': Direct line from source to target
   */
  edgeStyle?: EdgeStyle

  /**
   * Spline routing mode (only used when edgeStyle is 'splines')
   * - 'sloppy': Curvier routes, may overlap nodes (default)
   * - 'conservative': Properly routes around nodes
   * - 'conservative_soft': Relaxed version of conservative
   */
  splineMode?: SplineMode

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

  /**
   * Canvas/sheet size settings
   */
  canvas?: CanvasSettings

  /**
   * Legend configuration
   */
  legend?: boolean | LegendSettings
}

export interface NetworkGraph {
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

  /**
   * Top-level pins (for child sheets in hierarchical diagrams)
   * Defines connection points exposed to parent sheet
   */
  pins?: Pin[]
}

/**
 * Hierarchical network graph with resolved sheet references
 * Used when loading multi-file hierarchical diagrams
 */
export interface HierarchicalNetworkGraph extends NetworkGraph {
  /**
   * Map of sheet ID to their resolved NetworkGraph
   */
  sheets?: Map<string, NetworkGraph>

  /**
   * Parent sheet ID (if this is a child sheet)
   */
  parentSheet?: string

  /**
   * Breadcrumb path from root (e.g., ['root', 'server-room'])
   */
  breadcrumb?: string[]
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

/**
 * Port position on a node edge
 */
export interface LayoutPort {
  id: string
  /** Port name (e.g., "eth0", "Gi0/1") */
  label: string
  /** Position relative to node center */
  position: Position
  /** Port box size */
  size: Size
  /** Which side of the node (for rendering) */
  side: 'top' | 'bottom' | 'left' | 'right'
}

export interface LayoutNode {
  id: string
  position: Position
  size: Size
  node: Node
  /** Ports on this node */
  ports?: Map<string, LayoutPort>
}

export interface LayoutLink {
  id: string
  from: string // Node ID
  to: string // Node ID
  fromEndpoint: LinkEndpoint // Full endpoint info
  toEndpoint: LinkEndpoint // Full endpoint info
  points: Position[]
  link: Link
}

export interface LayoutSubgraph {
  id: string
  bounds: Bounds
  subgraph: Subgraph
  /** Boundary ports for hierarchical connections */
  ports?: Map<string, LayoutPort>
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
