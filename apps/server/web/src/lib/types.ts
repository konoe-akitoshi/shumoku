/**
 * Frontend type definitions
 */

import type { MetricsData } from './stores/metrics'

export type DataSourceType = 'zabbix' | 'netbox' | 'prometheus'

export type DataSourceCapability = 'topology' | 'metrics' | 'hosts' | 'auto-mapping'

export interface DataSourcePluginInfo {
  type: string
  displayName: string
  capabilities: readonly DataSourceCapability[]
}

export interface DataSource {
  id: string
  name: string
  type: DataSourceType
  configJson: string // Plugin-specific configuration as JSON
  createdAt: number
  updatedAt: number
}

export interface DataSourceInput {
  name: string
  type: DataSourceType
  configJson: string
}

export interface Topology {
  id: string
  name: string
  contentJson: string // Multi-file JSON: {"files": [{name, content}, ...]}
  topologySourceId?: string // Data source for structure (e.g., NetBox)
  metricsSourceId?: string // Data source for metrics (e.g., Zabbix)
  mappingJson?: string
  createdAt: number
  updatedAt: number
}

export interface TopologyInput {
  name: string
  contentJson: string // Multi-file JSON: {"files": [{name, content}, ...]}
  topologySourceId?: string
  metricsSourceId?: string
  mappingJson?: string
}

// Host and item types for mapping UI
export interface Host {
  id: string
  name: string
  displayName?: string
  status?: 'up' | 'down' | 'unknown'
  ip?: string
}

export interface HostItem {
  id: string
  hostId: string
  name: string
  key: string
  lastValue?: string
  unit?: string
}

export interface MappingHint {
  nodeId: string
  suggestedHostId?: string
  suggestedHostName?: string
  confidence: number // 0-1
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

export interface ZabbixMapping {
  nodes: Record<
    string,
    {
      hostId?: string
      hostName?: string
    }
  >
  links: Record<
    string,
    {
      in?: string
      out?: string
      interface?: string
      capacity?: number
    }
  >
}

export interface ConnectionTestResult {
  success: boolean
  message: string
  version?: string
}

export interface ApiError {
  error: string
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
}

export interface EdgeEndpoint {
  nodeId: string
  port?: string
  ip?: string
}

export interface EdgeContext {
  id: string
  from: EdgeEndpoint
  to: EdgeEndpoint
  path: string
  points: Position[]
  bandwidth?: string
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
  mapping?: ZabbixMapping
}

// NetworkGraph types for Cytoscape converter
export interface NetworkNode {
  id: string
  label?: string | string[]
  type?: string
  vendor?: string
  model?: string
  icon?: string
  parent?: string
  metadata?: Record<string, unknown>
}

export interface NetworkLinkEndpoint {
  node: string
  port?: string
  ip?: string
}

export interface NetworkLink {
  id?: string
  from: string | NetworkLinkEndpoint
  to: string | NetworkLinkEndpoint
  label?: string
  bandwidth?: string
  vlan?: number | number[]
  type?: 'solid' | 'dashed'
  arrow?: 'forward' | 'backward' | 'both' | 'none'
  redundancy?: string
  metadata?: Record<string, unknown>
}

export interface NetworkSubgraph {
  id: string
  label?: string
  parent?: string
  file?: string
  vendor?: string
  service?: string
  resource?: string
  style?: {
    fill?: string
    stroke?: string
    strokeWidth?: number
    strokeDasharray?: string
  }
}

export interface NetworkGraph {
  name?: string
  nodes: NetworkNode[]
  links: NetworkLink[]
  subgraphs?: NetworkSubgraph[]
}

export interface LayoutResult {
  nodes: Record<string, { x: number; y: number }>
  subgraphs?: Record<string, { x: number; y: number; width: number; height: number }>
}

export interface ParsedTopologyResponse {
  id: string
  name: string
  graph: NetworkGraph
  layout: LayoutResult
  metrics: MetricsData
  dataSourceId?: string
  mapping?: ZabbixMapping
}
