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

export interface PrometheusPluginConfig {
  url: string
  // TODO: Add prometheus-specific config
}

export type PluginConfig = ZabbixPluginConfig | NetBoxPluginConfig | PrometheusPluginConfig
