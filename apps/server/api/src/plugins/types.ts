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
// Alerts Types
// ============================================

/**
 * Alert severity levels
 */
export type AlertSeverity = 'disaster' | 'high' | 'average' | 'warning' | 'information' | 'ok'

/**
 * Alert status
 */
export type AlertStatus = 'active' | 'resolved'

/**
 * Alert from a monitoring system
 */
export interface Alert {
  /** Unique identifier */
  id: string
  /** Alert severity */
  severity: AlertSeverity
  /** Alert title/name */
  title: string
  /** Detailed description */
  description?: string
  /** Host name (for node mapping) */
  host?: string
  /** Host ID in the data source */
  hostId?: string
  /** Mapped node ID (if mapping exists) */
  nodeId?: string
  /** When the alert started (Unix timestamp in ms) */
  startTime: number
  /** When the alert was resolved (Unix timestamp in ms) */
  endTime?: number
  /** Current alert status */
  status: AlertStatus
  /** Source system */
  source: 'zabbix' | 'prometheus' | 'grafana'
  /** When the alert was received via webhook (Unix timestamp in ms) */
  receivedAt?: number
  /** URL to the alert details in the source system */
  url?: string
  /** Labels from the source system */
  labels?: Record<string, string>
}

/**
 * Options for querying alerts
 */
export interface AlertQueryOptions {
  /** Time range in seconds (default: 3600 = 1 hour) */
  timeRange?: number
  /** Minimum severity to include */
  minSeverity?: AlertSeverity
  /** Only return active alerts */
  activeOnly?: boolean
  /** Filter by specific host IDs */
  hostIds?: string[]
}

/**
 * Plugin can provide alerts
 */
export interface AlertsCapable {
  /**
   * Get alerts from the monitoring system
   */
  getAlerts(options?: AlertQueryOptions): Promise<Alert[]>
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

export function hasAlertsCapability(
  plugin: DataSourcePlugin,
): plugin is DataSourcePlugin & AlertsCapable {
  return plugin.capabilities.includes('alerts')
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
  /** Skip TLS certificate verification (for self-signed certs) */
  insecure?: boolean
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

  /** Alertmanager URL (optional, derived from url if not specified) */
  alertmanagerUrl?: string
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

export interface GrafanaPluginConfig {
  url: string
  token: string
  /** Whether to receive alerts via webhook instead of Alertmanager API polling */
  useWebhook?: boolean
  webhookSecret?: string
}

export type PluginConfig =
  | ZabbixPluginConfig
  | NetBoxPluginConfig
  | PrometheusPluginConfig
  | GrafanaPluginConfig

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
