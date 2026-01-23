/**
 * Type definitions for the Shumoku real-time server
 */

import type { LayoutResult, NetworkGraph } from '@shumoku/core'

// ============================================
// Configuration Types
// ============================================

export interface ServerConfig {
  port: number
  host: string
  dataDir: string
}

export interface ZabbixConfig {
  url: string
  token: string
  pollInterval: number
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
  zabbix?: ZabbixConfig
  topologies: TopologyConfig[]
  weathermap: WeathermapConfig
}

// ============================================
// Database Entity Types
// ============================================

export type DataSourceType = 'zabbix' | 'netbox' | 'prometheus'

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

// Plugin config types (used inside configJson)
export interface NetBoxConfig {
  url: string
  token: string
  siteFilter?: string
  tagFilter?: string
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

export interface Dashboard {
  id: string
  name: string
  layoutJson: string
  createdAt: number
  updatedAt: number
}

export interface DashboardInput {
  name: string
  layoutJson: string
}

// ============================================
// Metrics Types
// ============================================

export interface NodeMetrics {
  status: 'up' | 'down' | 'unknown'
  cpu?: number
  memory?: number
  lastSeen?: number
}

export interface LinkMetrics {
  status: 'up' | 'down' | 'unknown'
  utilization?: number // Legacy: max of in/out for backward compatibility
  inUtilization?: number // Incoming direction utilization (0-100)
  outUtilization?: number // Outgoing direction utilization (0-100)
  inBps?: number
  outBps?: number
}

export interface MetricsData {
  nodes: Record<string, NodeMetrics>
  links: Record<string, LinkMetrics>
  timestamp: number
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
// Zabbix Types
// ============================================

export interface ZabbixHost {
  hostid: string
  host: string
  name: string
  status: string
}

export interface ZabbixItem {
  itemid: string
  hostid: string
  name: string
  key_: string
  lastvalue: string
  lastclock: string
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
