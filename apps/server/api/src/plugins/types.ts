/**
 * Data Source Plugin Architecture
 *
 * Unified plugin system for topology and metrics providers.
 * Each plugin declares its capabilities and implements corresponding interfaces.
 */

import type { MetricsData, ZabbixMapping } from '../types.js'

// ============================================
// Re-export base types from @shumoku/core
// ============================================

// These are the types that external plugins need
export {
  type DataSourceCapability,
  type ConnectionResult,
  type Host,
  type HostItem,
  type DiscoveredMetric,
  type MappingHint,
  type DataSourcePlugin,
  type TopologyCapable,
  type HostsCapable,
  type AutoMappingCapable,
  type PluginManifest,
  type PluginConfigProperty,
  hasTopologyCapability,
  hasHostsCapability,
  hasAutoMappingCapability,
  addHttpWarning,
} from '@shumoku/core'

// Re-export registry types (defined in registry.ts)
export type { PluginFactory, PluginRegistration, PluginRegistryInterface } from './registry.js'

// ============================================
// Server-specific Capability Interfaces
// ============================================

/**
 * Plugin can provide metrics data
 * (Server-specific: depends on MetricsData and ZabbixMapping)
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

// ============================================
// Alerts Types (Server-specific)
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
// Server-specific Type Guards
// ============================================

import type { DataSourcePlugin } from '@shumoku/core'

export function hasMetricsCapability(
  plugin: DataSourcePlugin,
): plugin is DataSourcePlugin & MetricsCapable {
  return plugin.capabilities.includes('metrics')
}

export function hasAlertsCapability(
  plugin: DataSourcePlugin,
): plugin is DataSourcePlugin & AlertsCapable {
  return plugin.capabilities.includes('alerts')
}

// ============================================
// Plugin Configuration Types (Server-specific)
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
