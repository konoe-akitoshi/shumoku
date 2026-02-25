/**
 * Plugin Type Definitions
 *
 * Base interfaces for data source plugins.
 * External plugins can import these types without server dependencies.
 */

import type { NetworkGraph } from './models/types.js'

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
  | 'alerts' // Can provide alerts from monitoring system

// ============================================
// Common Types
// ============================================

export interface ConnectionResult {
  success: boolean
  message: string
  version?: string
  /** Non-critical warnings (e.g., insecure HTTP connection) */
  warnings?: string[]
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
  /** Extracted interface name (e.g., "GigabitEthernet0/0", "eth0") */
  interfaceName?: string
  /** Traffic direction */
  direction?: 'in' | 'out'
}

/**
 * A metric discovered from a data source for a specific host
 */
export interface DiscoveredMetric {
  /** Metric name (e.g., "ifHCInOctets", "node_cpu_seconds_total") */
  name: string
  /** Labels associated with this metric */
  labels: Record<string, string>
  /** Current value */
  value: number
  /** Human-readable description (from HELP) */
  help?: string
  /** Metric type (counter, gauge, histogram, summary) */
  type?: string
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
  fetchTopology(options?: Record<string, unknown>): Promise<NetworkGraph>

  /**
   * Watch for topology changes (optional)
   * Returns a cleanup function
   */
  watchTopology?(onChange: (graph: NetworkGraph) => void): () => void
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

  /**
   * Discover all available metrics for a host
   */
  discoverMetrics?(hostId: string): Promise<DiscoveredMetric[]>
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
// Plugin Registry Types
// ============================================

/**
 * Factory function to create plugin instances
 */
export type PluginFactory = (config: unknown) => DataSourcePlugin

/**
 * Plugin registration info
 */
export interface PluginRegistration {
  type: string
  displayName: string
  capabilities: readonly DataSourceCapability[]
  factory: PluginFactory
}

/**
 * Plugin registry interface for external plugins
 */
export interface PluginRegistryInterface {
  register(
    type: string,
    displayName: string,
    capabilities: readonly DataSourceCapability[],
    factory: PluginFactory,
  ): void
}

// ============================================
// Plugin Manifest (plugin.json)
// ============================================

/**
 * JSON Schema property definition for configSchema
 */
export interface PluginConfigProperty {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  title?: string
  description?: string
  format?: 'password' | 'uri' | 'email'
  default?: unknown
  enum?: (string | number)[]
  minimum?: number
  maximum?: number
}

/**
 * Plugin manifest (plugin.json)
 */
export interface PluginManifest {
  /** Unique plugin identifier */
  id: string
  /** Human-readable name */
  name: string
  /** Plugin version */
  version: string
  /** Description */
  description?: string
  /** Plugin capabilities */
  capabilities: DataSourceCapability[]
  /** Entry point file (default: index.js) */
  entry?: string
  /** JSON Schema for plugin configuration */
  configSchema?: {
    type: 'object'
    required?: string[]
    properties: Record<string, PluginConfigProperty>
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Add HTTP warning to connection result if URL uses insecure HTTP
 */
export function addHttpWarning(url: string, result: ConnectionResult): ConnectionResult {
  if (url.startsWith('http://')) {
    result.warnings = [...(result.warnings || []), 'Using insecure HTTP connection']
  }
  return result
}
