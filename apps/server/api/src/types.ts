/**
 * Type definitions for the Shumoku real-time server
 */

import type { LayoutResult, MetricsData, NetworkGraph } from '@shumoku/core'

export type {
  LinkMetrics,
  LinkMetricsMapping,
  MetricsData,
  MetricsMapping,
  NodeMetrics,
  NodeMetricsMapping,
} from '@shumoku/core'

// ============================================
// Configuration Types
// ============================================

export interface ServerConfig {
  port: number
  host: string
  dataDir: string
  pollInterval?: number
}

export interface TopologyConfig {
  name: string
  file: string
  mapping?: string
}

export interface WeathermapThreshold {
  value: number
  color: string
}

export interface WeathermapConfig {
  thresholds: WeathermapThreshold[]
}

export interface Config {
  server: ServerConfig
  topologies: TopologyConfig[]
  weathermap: WeathermapConfig
}

// ============================================
// Database Entity Types
// ============================================

export type DataSourceType = string
export type DataSourceStatus = 'connected' | 'disconnected' | 'unknown'

export interface DataSource {
  id: string
  name: string
  type: DataSourceType
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
  shareToken?: string
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

// ============================================
// Topology Data Source (Junction Table)
// ============================================

export type SyncMode = 'manual' | 'on_view' | 'webhook'
export type DataSourcePurpose = 'topology' | 'metrics'

// ============================================
// Merge Configuration
// ============================================

export type MergeMatchStrategy = 'id' | 'name' | 'attribute' | 'manual'
export type MergeMergeStrategy = 'merge-properties' | 'keep-base' | 'keep-overlay'
export type MergeUnmatchedStrategy = 'add-to-root' | 'add-to-subgraph' | 'ignore'

/**
 * Merge configuration for a topology data source
 * Stored in optionsJson field
 */
export interface TopologySourceMergeConfig {
  /** Is this the base source? Only one source should be marked as base */
  isBase?: boolean
  /** How to match nodes from this source to base (for overlay sources) */
  match?: MergeMatchStrategy
  /** Attribute path for 'attribute' match strategy */
  matchAttribute?: string
  /** Manual ID mapping: thisSourceNodeId -> baseNodeId */
  idMapping?: Record<string, string>
  /** What to do when nodes match */
  onMatch?: MergeMergeStrategy
  /** What to do with unmatched nodes */
  onUnmatched?: MergeUnmatchedStrategy
  /** Custom subgraph name for unmatched nodes */
  subgraphName?: string
}

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
  createdAt: number
  updatedAt: number
  // Joined data
  dataSource?: DataSource
}

export interface TopologyDataSourceInput {
  dataSourceId: string
  purpose: DataSourcePurpose
  syncMode?: SyncMode
  priority?: number
  optionsJson?: string
}

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
  layoutJson: string
}

// ============================================
// WebSocket Message Types
// ============================================

export interface MetricsMessage {
  type: 'metrics'
  data: MetricsData
}

export interface SubscribeMessage {
  type: 'subscribe'
  topology: string
}

export interface SetIntervalMessage {
  type: 'setInterval'
  interval: number
}

export interface FilterMessage {
  type: 'filter'
  nodes?: string[]
  links?: string[]
}

export type ClientMessage = SubscribeMessage | SetIntervalMessage | FilterMessage

export type ServerMessage = MetricsMessage

// ============================================
// Topology Types
// ============================================

export interface TopologyInstance {
  name: string
  config: TopologyConfig
  graph: NetworkGraph
  layout: LayoutResult
  metrics: MetricsData
}

// ============================================
// Client State
// ============================================

export interface ClientState {
  subscribedTopology: string | null
  filter: {
    nodes: string[]
    links: string[]
  }
}
