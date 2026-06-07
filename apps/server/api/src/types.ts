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

/**
 * Topology = the shell. Owns name, mapping, share token, source
 * pointers — NOT graph content. Each source attached to a topology
 * carries its own observation snapshots in `topology_observations`,
 * and the displayed graph is computed by `resolve()` over those at
 * read time.
 *
 * No `contentJson` field on purpose: that name conflated "the
 * Manual source 's input" with "the project 's current graph". The
 * Manual snapshot is read via
 *   GET  /api/topologies/:tid/sources/:sid/latest-snapshot
 * and written via
 *   POST /api/topologies/:tid/sources/:sid/observation
 * The resolved project graph has its own endpoint:
 *   GET  /api/topologies/:tid/resolved
 */
export interface Topology {
  id: string
  name: string
  /** Id of the Manual source attached to this topology, if any. */
  manualSourceId?: string
  /**
   * Structure / metrics data source ids. No longer stored on the topology row
   * (sources live in `topology_data_sources`); the `/context` response derives
   * them from the m2m table, and the share projection fills `mappingJson` from
   * the resolved bindings. These remain as optional READ-only wire fields.
   */
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

// ============================================
// Topology Data Source (Junction Table)
// ============================================

export type SyncMode = 'manual' | 'on_view' | 'webhook'
export type DataSourcePurpose = 'topology' | 'metrics'

// Source merge is governed by `TopologyDataSource.priority` — the
// higher-priority source wins each field in resolve() (see
// `@shumoku/core` resolve() and topology-source-priority-merge.md). The
// old base/overlay/match Merge-Config shape was retired with merge.ts.

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
