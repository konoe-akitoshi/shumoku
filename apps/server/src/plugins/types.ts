/**
 * Data Source Plugin Architecture
 *
 * Unified plugin system for topology and metrics providers.
 * Each plugin declares its capabilities and implements corresponding interfaces.
 */

import type { NetworkGraph } from '@shumoku/core'
import type { MetricsData, ZabbixMapping } from '../types.js'

// ============================================
// Capability Types
// ============================================

/**
 * Capabilities a data source plugin can provide
 */
export type DataSourceCapability =
  | 'topology' // Can provide NetworkGraph
  | 'metrics' // Can provide MetricsData
  | 'hosts' // Can list hosts (for mapping UI)
  | 'auto-mapping' // Can suggest mappings automatically

// ============================================
// Common Types
// ============================================

export interface ConnectionResult {
  success: boolean
  message: string
  version?: string
}

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

// ============================================
// Base Plugin Interface
// ============================================

/**
 * Base interface all data source plugins must implement
 */
export interface DataSourcePlugin {
  /** Unique plugin type identifier */
  readonly type: string

  /** Human-readable name */
  readonly displayName: string

  /** List of capabilities this plugin provides */
  readonly capabilities: readonly DataSourceCapability[]

  /** Initialize the plugin with configuration */
  initialize(config: unknown): void

  /** Test connection to the data source */
  testConnection(): Promise<ConnectionResult>

  /** Clean up resources */
  dispose?(): void
}

// ============================================
// Capability Interfaces (Mixins)
// ============================================

/**
 * Plugin can provide topology (NetworkGraph)
 */
export interface TopologyCapable {
  /**
   * Fetch the current topology
   */
  fetchTopology(): Promise<NetworkGraph>

  /**
   * Watch for topology changes (optional)
   * Returns a cleanup function
   */
  watchTopology?(onChange: (graph: NetworkGraph) => void): () => void
}

/**
 * Plugin can provide metrics data
 */
export interface MetricsCapable {
  /**
   * Poll current metrics based on mapping
   */
  pollMetrics(mapping: ZabbixMapping): Promise<MetricsData>

  /**
   * Subscribe to metrics updates (optional)
   * Returns a cleanup function
   */
  subscribeMetrics?(mapping: ZabbixMapping, onUpdate: (metrics: MetricsData) => void): () => void
}

/**
 * Plugin can list hosts (for mapping UI)
 */
export interface HostsCapable {
  /**
   * Get all available hosts
   */
  getHosts(): Promise<Host[]>

  /**
   * Get items for a specific host
   */
  getHostItems?(hostId: string): Promise<HostItem[]>

  /**
   * Search hosts by name
   */
  searchHosts?(query: string): Promise<Host[]>
}

/**
 * Plugin can suggest automatic mappings
 */
export interface AutoMappingCapable {
  /**
   * Get mapping suggestions for a graph
   */
  getMappingHints(graph: NetworkGraph): Promise<MappingHint[]>
}

// ============================================
// Type Guards
// ============================================

export function hasTopologyCapability(
  plugin: DataSourcePlugin,
): plugin is DataSourcePlugin & TopologyCapable {
  return plugin.capabilities.includes('topology')
}

export function hasMetricsCapability(
  plugin: DataSourcePlugin,
): plugin is DataSourcePlugin & MetricsCapable {
  return plugin.capabilities.includes('metrics')
}

export function hasHostsCapability(
  plugin: DataSourcePlugin,
): plugin is DataSourcePlugin & HostsCapable {
  return plugin.capabilities.includes('hosts')
}

export function hasAutoMappingCapability(
  plugin: DataSourcePlugin,
): plugin is DataSourcePlugin & AutoMappingCapable {
  return plugin.capabilities.includes('auto-mapping')
}

// ============================================
// Plugin Configuration Types
// ============================================

export interface ZabbixPluginConfig {
  url: string
  token: string
  pollInterval?: number
}

export interface NetBoxPluginConfig {
  url: string
  token: string
  siteFilter?: string
  tagFilter?: string
}

/**
 * Prometheus metric presets for common exporters
 */
export type PrometheusMetricPreset = 'snmp' | 'node_exporter' | 'custom'

/**
 * Custom metric configuration for Prometheus
 */
export interface PrometheusCustomMetrics {
  /** Metric name for inbound octets (e.g., "ifHCInOctets") */
  inOctets: string
  /** Metric name for outbound octets (e.g., "ifHCOutOctets") */
  outOctets: string
  /** Label name for interface identification (e.g., "ifName" or "device") */
  interfaceLabel: string
  /** Metric name for host up/down status (e.g., "up") */
  upMetric?: string
}

export interface PrometheusPluginConfig {
  /** Prometheus server URL */
  url: string

  /** Basic auth credentials (optional) */
  basicAuth?: {
    username: string
    password: string
  }

  /** Metric preset - determines which exporter's metric names to use */
  preset: PrometheusMetricPreset

  /** Custom metrics configuration (required when preset is 'custom') */
  customMetrics?: PrometheusCustomMetrics

  /** Label name used to identify hosts (default: "instance") */
  hostLabel?: string

  /** Additional label to filter hosts (e.g., "job") */
  jobFilter?: string
}

/**
 * Prometheus-specific mapping format
 * Extends the base mapping with Prometheus labels
 */
export interface PrometheusNodeMapping {
  /** Instance label value (e.g., "192.168.1.1:9116") */
  instance?: string
  /** Job label value for filtering */
  job?: string
}

export interface PrometheusLinkMapping {
  /** Instance label value */
  instance?: string
  /** Interface label value (e.g., "eth0" or "GigabitEthernet0/0") */
  interface?: string
  /** Link capacity in bits per second */
  capacity?: number
}

export type PluginConfig = ZabbixPluginConfig | NetBoxPluginConfig | PrometheusPluginConfig
