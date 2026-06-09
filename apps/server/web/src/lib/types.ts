/**
 * Frontend type definitions.
 *
 * Domain types (Host, HostItem, Alert, MetricsMapping, …) are owned by
 * `@shumoku/core` so plugins and the web app share one display contract.
 * This file only defines the web's wire-format / UI-local shapes (DB rows,
 * widget configs, render context) and re-exports the core types under the
 * `$lib/types` import path for convenience.
 */

import type {
  DataSourceCapability,
  Identity,
  LayoutResult,
  MetricsMapping,
  NetworkGraph,
  PluginConfigSchema,
} from '@shumoku/core'

import type { MetricsData } from './stores/metrics'

// Re-export core types so consumers can keep importing from `$lib/types`.
export type {
  Alert,
  AlertQueryOptions,
  AlertSeverity,
  AlertStatus,
  ConnectionResult,
  DataSourceCapability,
  DiscoveredMetric,
  Host,
  HostItem,
  Identity,
  InterfaceNeighbor,
  LinkMetricsMapping,
  MetricsMapping,
  NodeMetricsMapping,
  PluginConfigProperty,
  PluginConfigSchema,
} from '@shumoku/core'

export type DataSourceStatus = 'connected' | 'disconnected' | 'unknown'

export interface DataSourcePluginInfo {
  type: string
  displayName: string
  capabilities: readonly DataSourceCapability[]
  /** Connection config schema — the web renders + validates one generic form from it. */
  configSchema?: PluginConfigSchema
  /** Per-use options schema (e.g. NetBox topology groupBy/filters). */
  optionsSchema?: PluginConfigSchema
}

export interface DataSource {
  id: string
  name: string
  /** Plugin `type` identifier. Open string — bundled plugins emit
   *  'zabbix' / 'netbox' / 'prometheus' / 'grafana' / 'aruba-instant-on',
   *  external plugins supply their own. */
  type: string
  configJson: string // Plugin-specific configuration as JSON
  status: DataSourceStatus
  statusMessage?: string
  lastCheckedAt?: number
  failCount: number
  createdAt: number
  updatedAt: number
}

export interface DataSourceInput {
  name: string
  type: string
  configJson: string
}

/**
 * Topology shell — name, mapping, share state, source pointers.
 * Graph content lives in source observations, not here. Read the
 * Manual snapshot via api.topologies.sources.latestSnapshot(...),
 * write a new one via api.topologies.sources.recordObservation(...).
 * The resolved project graph: api.topologies.getResolved(...).
 */
/** Topology-level scope policy. See api ScopeMode. */
export type ScopeMode = 'auto' | 'open' | 'closed'

/** Topology-wide merge method. additive = sources add; enrichment = enrich only. */
export type CompositionMode = 'additive' | 'enrichment'

/** One membership/scope criterion — mirrors core MembershipCriterion. */
export interface MembershipCriterion {
  attr: 'name' | 'subnet' | 'metadata'
  value: string
  /** Metadata key (only when attr === 'metadata'). */
  key?: string
}

/** Topology-level scope: include/exclude criteria. Empty = no scoping. */
export interface ScopeFilter {
  include?: MembershipCriterion[]
  exclude?: MembershipCriterion[]
}

export interface Topology {
  id: string
  name: string
  scopeMode: ScopeMode
  scopeSourceId?: string
  /** Common topology-level scope (include/exclude criteria). */
  scope?: ScopeFilter
  /** Topology-wide merge method. */
  compositionMode?: CompositionMode
  topologySourceId?: string
  metricsSourceId?: string
  mappingJson?: string
  shareToken?: string
  createdAt: number
  updatedAt: number
}

export interface TopologyInput {
  name: string
}

/**
 * Single file in a multi-file topology
 */
export interface TopologyFile {
  name: string
  content: string
}

/**
 * Multi-file content format
 */
export interface MultiFileContent {
  files: TopologyFile[]
}

/**
 * Parse multi-file JSON content
 */
export function parseMultiFileContent(contentJson: string): TopologyFile[] {
  const parsed = JSON.parse(contentJson) as MultiFileContent
  return parsed.files
}

/**
 * Serialize files to multi-file JSON format
 */
export function serializeMultiFileContent(files: TopologyFile[]): string {
  return JSON.stringify({ files }, null, 2)
}

// ============================================
// Topology Data Sources (Many-to-Many)
// ============================================

export type SyncMode = 'manual' | 'on_view' | 'webhook'
export type DataSourcePurpose = 'topology' | 'metrics'

// Per-source composition modes (topology-source-modes.md, Axis D). Scope is NOT
// here — it's a single per-topology decision (Topology.scopeMode).
export type NodeContribution = 'scoop' | 'anchor'
export type LinkContribution = 'add' | 'update'

export interface TopologyDataSource {
  id: string
  topologyId: string
  dataSourceId: string
  purpose: DataSourcePurpose
  syncMode: SyncMode
  webhookSecret?: string
  lastSyncedAt?: number
  priority: number
  optionsJson?: string
  nodeContribution: NodeContribution
  linkContribution: LinkContribution
  createdAt: number
  updatedAt: number
  dataSource?: DataSource
}

export interface TopologyDataSourceInput {
  dataSourceId: string
  purpose: DataSourcePurpose
  syncMode?: SyncMode
  priority?: number
  optionsJson?: string
  nodeContribution?: NodeContribution
  linkContribution?: LinkContribution
}

export interface ApiError {
  error: string
}

// ============================================
// Dashboard Types
// ============================================

export interface Dashboard {
  id: string
  name: string
  layoutJson: string
  shareToken?: string
  createdAt: number
  updatedAt: number
}

export interface DashboardInput {
  name: string
  layoutJson?: string
}

// Dashboard layout configuration
export interface DashboardLayout {
  columns: number
  rowHeight: number
  margin: number
  widgets: WidgetInstance[]
}

// Widget instance in a dashboard
export interface WidgetInstance {
  id: string
  type: string
  config: Record<string, unknown>
  position: WidgetPosition
}

export interface WidgetPosition {
  x: number
  y: number
  w: number
  h: number
}

// Widget definition for registry
export interface WidgetDefinition {
  type: string
  displayName: string
  icon: string
  defaultSize: { w: number; h: number }
  minSize?: { w: number; h: number }
  configSchema?: Record<string, unknown>
}

// Topology widget config
export interface TopologyWidgetConfig {
  topologyId: string
  sheetId?: string
  showMetrics: boolean
  showLabels: boolean
  interactive: boolean
}

// Metrics widget config
export interface MetricsWidgetConfig {
  dataSourceId?: string
  metricType: 'gauge' | 'status'
  title: string
}

// Health widget config
export interface HealthWidgetConfig {
  title: string
}

// DataSource widget config
export interface DataSourceWidgetConfig {
  title: string
}

// Render Context types
export interface Position {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface ViewBox {
  x: number
  y: number
  width: number
  height: number
}

export interface NodePortContext {
  id: string
  label: string
  position: Position
  size: Size
  side: 'top' | 'bottom' | 'left' | 'right'
}

export interface NodeContext {
  id: string
  label: string | string[]
  position: Position
  size: Size
  shape: string
  type?: string
  vendor?: string
  model?: string
  service?: string
  resource?: string
  ports: NodePortContext[]
  metadata?: Record<string, unknown>
  /** Discovery identity keys, used by the mapping UI for deterministic matching. */
  identity?: Identity
}

/** Port info resolved from a NodePort so callers can match without looking up the node. */
export interface NodePortInfo {
  id: string
  /** Canonical port label (e.g. "Gi1/0/1"). May be empty if unset on the node. */
  label?: string
  /** Full OS/API interface name (e.g. "GigabitEthernet1/0/1"). */
  interfaceName?: string
  /** Alternative names accepted for matching. */
  aliases?: string[]
}

export interface EdgeEndpoint {
  nodeId: string
  /** Port id reference (random, not human-readable). Use `portInfo` for display/matching. */
  port?: string
  /** Resolved port metadata. Absent when the port can't be found on the node. */
  portInfo?: NodePortInfo
  ip?: string
}

export interface EdgeContext {
  id: string
  from: EdgeEndpoint
  to: EdgeEndpoint
  path: string
  points: Position[]
  standard?: string
  vlan?: number[]
  redundancy?: string
  label?: string | string[]
  metadata?: Record<string, unknown>
}

export interface SubgraphContext {
  id: string
  label: string
  bounds: ViewBox
  vendor?: string
  service?: string
  model?: string
  resource?: string
  hasSheet: boolean
  sheetId?: string
}

export interface NodeStyleContext {
  fill: string
  stroke: string
  strokeWidth: number
  textColor: string
  secondaryTextColor: string
}

export interface EdgeAnimationStyle {
  name: string
  duration: string
  timingFunction: string
  iterationCount: string
}

export interface EdgeStyleContext {
  stroke: string
  strokeWidth: number
  strokeDasharray: string
  lineCount: number
  animation?: EdgeAnimationStyle
}

export interface SubgraphStyleContext {
  fill: string
  stroke: string
  strokeWidth: number
  labelColor: string
}

export interface TopologyContext {
  id: string
  name: string
  nodes: NodeContext[]
  edges: EdgeContext[]
  subgraphs: SubgraphContext[]
  viewBox: ViewBox
  theme: 'light' | 'dark'
  nodeStyles: Record<string, NodeStyleContext>
  edgeStyles: Record<string, EdgeStyleContext>
  subgraphStyles: Record<string, SubgraphStyleContext>
  cssVariables: Record<string, string>
  animationCSS: string
  metrics: MetricsData
  dataSourceId?: string
  mapping?: MetricsMapping
}

export interface ParsedTopologyResponse {
  id: string
  name: string
  graph: NetworkGraph
  layout: LayoutResult
  metrics: MetricsData
  dataSourceId?: string
  mapping?: MetricsMapping
}

// Alert widget config (web UI-only, not a core domain concept)
export interface AlertWidgetConfig {
  dataSourceId: string
  title?: string
  maxItems?: number
  showResolved?: boolean
  autoRefresh?: number // seconds
}
