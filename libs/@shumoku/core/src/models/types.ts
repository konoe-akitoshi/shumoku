// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

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

// ============================================
// Physical / logical node ports
// ============================================

export type PortRole = 'downlink' | 'uplink' | 'wan' | 'lan' | 'management' | 'power' | 'console'

export type PortConnector =
  | 'rj45'
  | 'sfp'
  | 'sfp+'
  | 'sfp28'
  | 'qsfp+'
  | 'qsfp28'
  | 'combo'
  | (string & {})

export type LinkMediumKind = 'twisted-pair' | 'fiber' | 'dac' | 'aoc' | (string & {})

export type FiberMode = 'singlemode' | 'multimode' | (string & {})

/**
 * Installed cable grade. Twisted-pair gets cat5e/6/6a/7/8; multi-mode
 * fiber gets OM3/4/5; single-mode gets OS1/2; DAC and AOC are passive
 * cable assemblies that don't have a separate grade axis but get their
 * own values so the field is one source of truth.
 */
export type CableGrade =
  | 'cat5e'
  | 'cat6'
  | 'cat6a'
  | 'cat7'
  | 'cat8'
  | 'om3'
  | 'om4'
  | 'om5'
  | 'os1'
  | 'os2'
  | 'dac'
  | 'aoc'

/**
 * Cable medium kind, split to distinguish multi-mode and single-mode
 * fiber (they have different reach characteristics and connector
 * conventions). Stored explicitly on `LinkCable.medium` so the user
 * can declare "fiber multi-mode" before picking a specific OM grade.
 */
export type CableMedium = 'twisted-pair' | 'fiber-mm' | 'fiber-sm' | 'dac' | 'aoc'

/**
 * Cable-end connector (the physical thing at the cable's tip), e.g.
 * "lc" / "sc" / "mpo" for fiber, "rj45" for twisted-pair.
 *
 * Not stored on `LinkCable` directly — it's derived from
 * `module.standard` via `STANDARD_SPECS[std].cableConnector`. Kept as a
 * type for derivation helpers and display logic.
 */
export type CableConnector = 'rj45' | 'lc' | 'sc' | 'mpo' | (string & {})

/**
 * PoE capability of a port. `class` is the IEEE 802.3 power class
 * tier the cage supports (af = 15.4W, at = 30W, bt = 60W or 90W).
 * `role` distinguishes power-sourcing (PSE — typical of switch ports)
 * from powered-device (PD — APs, IP phones, cameras). `watts` is an
 * override for non-standard or fine-grained budgets. All optional —
 * an empty `PortPoe` (`{}`) means "PoE capable, details unspecified".
 */
export interface PortPoe {
  class?: 'af' | 'at' | 'bt'
  role?: 'pse' | 'pd'
  watts?: number
}

/**
 * A node-side receptacle (cage). Ports belong to a Node and define the
 * physical slot a cable plug can be inserted into. The cage type
 * (e.g. "sfp+") describes what kind of plug is accepted; the actual
 * plug carrying the connection is owned by the Link endpoint.
 */
export interface NodePort {
  /** Stable generated ID, e.g. "port-...". Links should reference this. */
  id: string
  /** Display/canonical port label, e.g. "Gi1/0/1", "ge-0/0/0", "wan". May be empty. */
  label: string
  /** Physical faceplate marking, e.g. "1". Defaults to `label`. */
  faceplateLabel?: string
  /** Full OS/API interface name, e.g. "GigabitEthernet1/0/1". */
  interfaceName?: string
  /** Alternative names accepted for matching/search. */
  aliases?: string[]
  role?: PortRole | (string & {})
  /** Cage's nominal max speed label, e.g. "1g", "10g". */
  speed?: string
  /** Physical receptacle (cage) type, e.g. "rj45", "sfp+", "qsfp28". */
  cage?: PortConnector
  /**
   * PoE capability. `true` = capable, no further details (legacy /
   * convenience YAML form); object form carries class / role / watts.
   * Use `portPoeConfig(port)` to normalize.
   */
  poe?: boolean | PortPoe
  source?: 'catalog' | 'custom'
  disabled?: boolean
  notes?: string
}

/**
 * Bandwidth label/value used by plugin configs and metric overrides.
 * Distinct from `Link.standard` — this is just a parseable bandwidth
 * string ("10G", "2.5Gbps") or raw bps number, suitable wherever a
 * single capacity number is expected (e.g. plugin overrides, runtime
 * metrics). Use `resolveBandwidthBps` to convert to bits/sec.
 */
export type LinkBandwidthLabel =
  | '10M'
  | '100M'
  | '1G'
  | '2.5G'
  | '5G'
  | '10G'
  | '25G'
  | '40G'
  | '50G'
  | '100G'
  | '200G'
  | '400G'

export type LinkBandwidth = number | LinkBandwidthLabel | (string & {})

/**
 * IEEE 802.3 / industry standard identifying the link spec. Picking one
 * cascades down to speed, required cage, cable medium, and reach via the
 * `STANDARD_SPECS` registry — see `core/models/standards.ts`. Unknown /
 * vendor-proprietary values are accepted as plain strings; the registry
 * lookup just returns undefined and downstream code falls back to neutral
 * defaults.
 */
export type EthernetStandard =
  // Twisted-pair (RJ45 cage)
  | '10BASE-T'
  | '100BASE-TX'
  | '1000BASE-T'
  | '2.5GBASE-T'
  | '5GBASE-T'
  | '10GBASE-T'
  // Fiber multi-mode (short reach, OM3/OM4)
  | '1000BASE-SX'
  | '10GBASE-SR'
  | '25GBASE-SR'
  | '40GBASE-SR4'
  | '100GBASE-SR4'
  // Fiber single-mode (long reach)
  | '1000BASE-LX'
  | '10GBASE-LR'
  | '25GBASE-LR'
  | '40GBASE-LR4'
  | '100GBASE-LR4'
  // Direct attach copper (passive twinax cable assemblies)
  | '10GBASE-CR'
  | '25GBASE-CR'
  | '40GBASE-CR4'
  | '100GBASE-CR4'
  // Active optical cable assemblies (SFP/QSFP cage, integrated optics)
  | '10G-AOC'
  | '25G-AOC'
  | '40G-AOC'
  | '100G-AOC'
  | (string & {})

// ============================================
// Node Spec — discriminated union by `kind`
// ============================================

/**
 * Shared fields across all spec kinds.
 */
export interface SpecBase {
  /** Custom icon URL (overrides vendor/type icons) */
  icon?: string
  /** Vendor name for vendor-specific icons (e.g., 'aws', 'azure', 'gcp', 'yamaha') */
  vendor?: string
}

/** Physical device (switch, router, AP, server, etc.) */
export interface HardwareSpec extends SpecBase {
  kind: 'hardware'
  /** Device type (for default styling/icons) */
  type?: DeviceType
  /** Model name (e.g., 'catalyst-9300', 'rtx3510') */
  model?: string
}

/** Virtual machine — on-prem or cloud-based (EC2, ESXi VM, etc.) */
export interface ComputeSpec extends SpecBase {
  kind: 'compute'
  /** Device type (for default styling/icons) */
  type?: DeviceType
  /** Platform identifier (e.g., 'ec2', 'esxi', 'proxmox') */
  platform?: string
}

/** Managed / cloud service (Lambda, S3, CloudFront, etc.) */
export interface ServiceSpec extends SpecBase {
  kind: 'service'
  /** Service name within the vendor (e.g., 'lambda', 's3', 'rds') */
  service: string
  /** Resource type within the service (e.g., 'function', 'bucket') */
  resource?: string
}

/**
 * Node specification — describes *what* the element represents.
 * Discriminated by `kind` so each variant carries only relevant fields.
 */
export type NodeSpec = HardwareSpec | ComputeSpec | ServiceSpec

/** Extract DeviceType from a spec (hardware and compute only). */
export function specDeviceType(spec: NodeSpec | undefined): DeviceType | undefined {
  if (!spec || spec.kind === 'service') return undefined
  return spec.type
}

/**
 * Extract the icon lookup key for CDN icons.
 * Hardware → model, Service → service/resource, Compute → platform.
 */
export function specIconKey(spec: NodeSpec | undefined): string | undefined {
  if (!spec) return undefined
  if (spec.kind === 'service') {
    return spec.resource ? `${spec.service}/${spec.resource}` : spec.service
  }
  if (spec.kind === 'hardware') return spec.model
  if (spec.kind === 'compute') return spec.platform
  return undefined
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
   * What this node represents (hardware, compute, or service)
   */
  spec?: NodeSpec

  /**
   * Concrete ports owned by this node. Catalog-backed nodes snapshot
   * their port list here so saved diagrams do not change when catalog
   * definitions are updated later.
   */
  ports?: NodePort[]

  /**
   * Absolute center position.
   * Set by the layout engine or the editor.
   * When absent, the layout engine computes it automatically.
   */
  position?: Position
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
 * Module / transceiver attached to one end of a link. Each endpoint owns
 * its own module instance — the cable runs between two modules. For
 * RJ45 ports the module is the port's built-in PHY (no swappable
 * transceiver), but the standard it speaks still belongs here.
 */
export interface LinkModule {
  /**
   * IEEE / industry standard the module implements. Picking this pins
   * the cage form factor and cable medium kind via the `STANDARD_SPECS`
   * registry.
   */
  standard: EthernetStandard
  /** Vendor SKU for inventory, e.g. "SFP-10G-SR-S". Optional. */
  sku?: string
}

/**
 * The cable-side plug at one end of a link — what's mechanically
 * inserted into a port's cage. `cage` is the form factor (RJ45 / SFP+
 * / etc.) and is the structural anchor; **optional** because it's
 * derivable from `port.cage` (when set) or `module.standard` (via
 * `STANDARD_SPECS[std].cage`). Store explicit `cage` only when neither
 * source has it (e.g. user picked a plug form factor before picking a
 * module, on a port without catalog cage info). `module` is the
 * transceiver inside the plug for pluggable form factors (SFP /
 * SFP+ / SFP28 / QSFP+ / QSFP28); RJ45 direct, DAC, and AOC have no
 * separate module so it stays undefined.
 *
 * Invariants (validator-enforced):
 * - If both `cage` and `module.standard` are set, `module`'s required
 *   cage must equal `plug.cage`.
 * - If both `plug.cage` and `port.cage` are set, they must agree.
 */
export interface LinkPlug {
  /** Form factor the plug presents. Optional when derivable. */
  cage?: PortConnector
  /** Transceiver inside the plug. Absent for RJ45 direct / DAC / AOC. */
  module?: LinkModule
}

/**
 * Link endpoint. Conceptually a cable end plugged into a port on a node.
 * The endpoint references its node and port by id and owns its per-end
 * `plug` — symmetric links share the same plug shape on both ends;
 * asymmetric ones (BiDi pairs, BiDi-pair etc.) carry different plug
 * configs per end.
 */
export interface LinkEndpoint {
  node: string
  /** NodePort.id on the endpoint node — must reference an existing port. */
  port: string
  /** Cable-side plug at this end (form factor + optional module). */
  plug?: LinkPlug
  ip?: string // e.g., "10.57.0.1/30"
  /**
   * Pin reference for hierarchical connections (e.g., "subgraph-id:pin-id").
   * When set, this endpoint connects through a subgraph boundary pin.
   * The `port` field still references the underlying node port.
   */
  pin?: string
}

/**
 * Physical cable details that aren't fully implied by the link's standard.
 * `medium` is the cable kind (twisted-pair / fiber-mm / fiber-sm / dac /
 * aoc), stored explicitly so the user can declare "this is fiber" before
 * picking a specific OM grade. `category` is the installed grade within
 * that medium. `length_m` is informational (reach validation). The
 * cable-end connector is *not* stored — derived from `module.standard`
 * via `STANDARD_SPECS[std].cableConnector` to keep the model normalized.
 *
 * Invariant (validator-enforced): when both `medium` and `category` are
 * set, the category's medium must agree with `medium`.
 */
export interface LinkCable {
  /** Cable medium kind. Optional when not yet decided / not relevant. */
  medium?: CableMedium
  /** Installed cable grade within the medium. */
  category?: CableGrade
  /** Run length in meters. Used for reach warnings. */
  length_m?: number
}

export interface Link {
  id?: string

  /**
   * Source endpoint. Always a structured LinkEndpoint at runtime —
   * the parser normalizes any YAML shorthand.
   */
  from: LinkEndpoint

  /**
   * Target endpoint. Always a structured LinkEndpoint at runtime —
   * the parser normalizes any YAML shorthand.
   */
  to: LinkEndpoint

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
   * Cable details that don't follow from the standard. Optional — the
   * standard's defaults are sufficient for most diagrams.
   */
  cable?: LinkCable

  /**
   * Runtime / monitoring: instantaneous link rate in bits/sec, set by
   * metrics providers. Optional and orthogonal to module.standard (which
   * encodes the link's spec, not its current utilization).
   */
  rateBps?: number

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
 * Helper to get node ID from endpoint. Kept as a tiny accessor so callers
 * read intent ("the link's source node") rather than reaching into shape.
 */
export function getNodeId(endpoint: LinkEndpoint): string {
  return endpoint.node
}

// ============================================
// Subgraph Types
// ============================================

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
  direction?: Direction

  /**
   * Custom style
   */
  style?: SubgraphStyle

  /**
   * What this subgraph represents (hardware, compute, or service)
   */
  spec?: NodeSpec

  /**
   * File reference for external sheet definition (KiCad-style hierarchy)
   */
  file?: string

  /**
   * Pins for boundary connections (hierarchical sheets)
   * Defines connection points between this subgraph and parent/siblings
   */
  pins?: Pin[]

  /**
   * Absolute bounds (set by layout engine at runtime).
   * Derived from child node positions — not persisted.
   */
  bounds?: Bounds
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
  direction?: Direction

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
  CPE = 'cpe',
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
 * Layout flow direction. Used by every engine and option type that
 * produces directional diagrams.
 *   - `TB` top→bottom (default)
 *   - `BT` bottom→top
 *   - `LR` left→right
 *   - `RL` right→left
 */
export type Direction = 'TB' | 'BT' | 'LR' | 'RL'

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
    spacing?: {
      minEdgeGap: number
      maxLinkStrokeWidth: number
      portSpacingMin: number
      edgeNodeSpacing: number
      edgeEdgeSpacing: number
    }
    [key: string]: unknown
  }
}
